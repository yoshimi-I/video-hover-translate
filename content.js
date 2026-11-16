"use strict";
(() => {
  // src/common/settings.ts
  var DEFAULT_SETTINGS = { enabled: true, pauseOnHover: true };
  async function loadSettings() {
    const stored = await chrome.storage.sync.get({ ...DEFAULT_SETTINGS });
    return {
      enabled: stored.enabled ?? DEFAULT_SETTINGS.enabled,
      pauseOnHover: stored.pauseOnHover ?? DEFAULT_SETTINGS.pauseOnHover
    };
  }

  // ../shared/src/text.ts
  function spanText(tokens, start2, end) {
    return tokens.slice(start2, end + 1).join(" ");
  }

  // src/content/selection.ts
  function levelsFor(tokenIndex, result, tokenCount) {
    const candidates = [
      { range: { start: tokenIndex, end: tokenIndex }, ja: result.words[tokenIndex]?.ja ?? "", kind: "word", idiom: false }
    ];
    const phrase = result.phrases.find((p) => p.start <= tokenIndex && tokenIndex <= p.end);
    if (phrase) candidates.push({ range: { start: phrase.start, end: phrase.end }, ja: phrase.ja, kind: "phrase", idiom: phrase.idiom });
    candidates.push({ range: { start: 0, end: tokenCount - 1 }, ja: result.sentence.ja, kind: "sentence", idiom: false });
    const levels = [];
    for (const c of candidates) {
      const prev = levels[levels.length - 1];
      if (prev && prev.range.start === c.range.start && prev.range.end === c.range.end) continue;
      levels.push(c);
    }
    return levels;
  }
  function clampLevel(level, levelCount) {
    return Math.min(Math.max(level, 0), Math.max(levelCount - 1, 0));
  }

  // src/content/tokenizer.ts
  var WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu;
  var ANNOTATION = /\[[^\]]*\]|\([^)]*\)/g;
  var SPEAKER = new RegExp("^\\s*[-\u2013\u2014]?\\s*\\p{Lu}[\\p{Lu}\\p{M}\\p{N} .'\u2019-]*:\\s*", "u");
  function pushDialogue(part, segments, tokens, dialogue) {
    if (!part) return;
    dialogue.push(part);
    let last = 0;
    for (const m of part.matchAll(WORD)) {
      const index = m.index ?? 0;
      if (index > last) segments.push({ text: part.slice(last, index), token: null });
      segments.push({ text: m[0], token: tokens.length });
      tokens.push(m[0]);
      last = index + m[0].length;
    }
    if (last < part.length) segments.push({ text: part.slice(last), token: null });
  }
  function tokenizeCue(rawLines) {
    const tokens = [];
    const lines = [];
    const dialogue = [];
    for (const raw of rawLines) {
      const segments = [];
      let rest = raw;
      const speaker = SPEAKER.exec(rest);
      if (speaker) {
        segments.push({ text: speaker[0], token: null });
        rest = rest.slice(speaker[0].length);
      }
      let last = 0;
      for (const m of rest.matchAll(ANNOTATION)) {
        const index = m.index ?? 0;
        pushDialogue(rest.slice(last, index), segments, tokens, dialogue);
        segments.push({ text: m[0], token: null });
        last = index + m[0].length;
      }
      pushDialogue(rest.slice(last), segments, tokens, dialogue);
      lines.push(segments);
    }
    return { lines, tokens, text: dialogue.join(" ").replace(/\s+/g, " ").trim() };
  }

  // src/content/wheel.ts
  var DEFAULT_WHEEL = { threshold: 100, cooldownMs: 200, gestureGapMs: 300 };
  var WheelStepper = class {
    constructor(opts = DEFAULT_WHEEL) {
      this.opts = opts;
    }
    opts;
    acc = 0;
    dir = 0;
    lastEventAt = Number.NEGATIVE_INFINITY;
    lastStepAt = Number.NEGATIVE_INFINITY;
    /** deltaY > 0（ページを下へスクロールする向き）で +1、逆で -1、動かさないなら 0。 */
    feed(deltaY, now) {
      if (deltaY === 0) return 0;
      const dir = deltaY > 0 ? 1 : -1;
      const newGesture = now - this.lastEventAt > this.opts.gestureGapMs || dir !== this.dir;
      this.lastEventAt = now;
      this.dir = dir;
      if (newGesture) {
        this.acc = 0;
        this.lastStepAt = now;
        return dir;
      }
      this.acc += deltaY;
      if (now - this.lastStepAt >= this.opts.cooldownMs && Math.abs(this.acc) >= this.opts.threshold) {
        this.acc = 0;
        this.lastStepAt = now;
        return dir;
      }
      return 0;
    }
  };

  // src/content/controller.ts
  var DWELL_MS = 120;
  var CLOSE_DELAY_MS = 300;
  var CONTEXT_CUES = 2;
  var MESSAGES = {
    noApiKey: "\u30B5\u30A4\u30C9\u30D1\u30CD\u30EB\u306E\u8A2D\u5B9A\uFF08\u2699\uFF09\u3067 API \u30AD\u30FC\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044",
    failed: "\u7FFB\u8A33\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08\u30AF\u30EA\u30C3\u30AF\u3067\u518D\u8A66\u884C\uFF09",
    noTranslation: "\uFF08\u8A33\u306A\u3057\uFF09",
    stale: "\u62E1\u5F35\u304C\u66F4\u65B0\u3055\u308C\u307E\u3057\u305F\u3002\u30DA\u30FC\u30B8\u3092\u518D\u8AAD\u307F\u8FBC\u307F\u3057\u3066\u304F\u3060\u3055\u3044"
  };
  var NOT_RETRYABLE = /* @__PURE__ */ new Set(["no-api-key", "stale"]);
  function errorPopup(error) {
    if (error === "no-api-key") return { kind: "error", text: MESSAGES.noApiKey, retry: false };
    if (error === "stale") return { kind: "error", text: MESSAGES.stale, retry: false };
    return { kind: "error", text: MESSAGES.failed, retry: true };
  }
  var Controller = class {
    constructor(deps) {
      this.deps = deps;
    }
    deps;
    current = null;
    history = [];
    hoverToken = null;
    pendingToken = null;
    level = 0;
    popupOpen = false;
    /** 範囲の訳のポップアップを開いているときの状態。 */
    span = null;
    /** ドラッグで範囲を選んでいる最中。 */
    dragging = false;
    dwellTimer = null;
    closeTimer = null;
    /** 拡張が一時停止させた video。ポップアップを閉じる・ドラッグを取り消すときに再開する。 */
    pausedVideo = null;
    pausing = false;
    /** 今のポップアップで、調べた語として送った項目。 */
    sentLookups = /* @__PURE__ */ new Set();
    stepper = new WheelStepper();
    onCue(lines) {
      this.close();
      this.current = null;
      if (!lines) {
        this.deps.overlay.renderCue(null);
        return;
      }
      const cue = tokenizeCue(lines);
      this.deps.overlay.renderCue(cue);
      if (cue.tokens.length === 0) return;
      const state = { cue, context: this.history.slice(-CONTEXT_CUES), status: "loading", autoRetried: false };
      this.history = [...this.history, cue.text].slice(-CONTEXT_CUES);
      this.current = state;
      this.request(state);
    }
    onTokenOver(index) {
      this.cancelClose();
      if (!this.current || this.dragging || this.span) return;
      if (this.popupOpen && index === this.hoverToken) {
        this.cancelDwell();
        return;
      }
      if (this.pendingToken === index) return;
      this.cancelDwell();
      this.pendingToken = index;
      this.dwellTimer = setTimeout(() => {
        this.dwellTimer = null;
        this.pendingToken = null;
        this.open(index);
      }, DWELL_MS);
    }
    /** 単語のない所へ移った。待っている途中のタイマーだけ止め、開いているポップアップは閉じない。 */
    onTokenOut() {
      this.cancelDwell();
    }
    onAreaEnter() {
      this.cancelClose();
    }
    onAreaLeave() {
      this.cancelDwell();
      this.cancelClose();
      this.closeTimer = setTimeout(() => this.close(), CLOSE_DELAY_MS);
    }
    onWheel(deltaY) {
      const state = this.current;
      if (this.span || !this.popupOpen || this.hoverToken === null || state?.status !== "ready" || !state.result) return;
      const step = this.stepper.feed(deltaY, Date.now());
      if (step === 0) return;
      const levels = levelsFor(this.hoverToken, state.result, state.cue.tokens.length);
      this.level = clampLevel(this.level + step, levels.length);
      this.refreshPopup();
    }
    onRetry() {
      const state = this.current;
      if (this.span) {
        if (state && this.span.status === "error") this.requestSpan(state, this.span);
        return;
      }
      if (state?.status === "error") this.request(state);
    }
    /** ドラッグで2語目に入った。待ちを取り消し、語のポップアップは隠すが動画は再開しない（設計書 v2-1 2.1-4）。 */
    onSpanStart() {
      this.cancelDwell();
      this.cancelClose();
      if (this.popupOpen) this.hidePopup();
      this.dragging = true;
      void this.pauseIfNeeded();
    }
    onSpanSelect(start2, end) {
      this.dragging = false;
      const state = this.current;
      if (!state || start2 >= end) {
        this.onSpanCancel();
        return;
      }
      this.cancelDwell();
      this.cancelClose();
      this.popupOpen = true;
      this.hoverToken = null;
      this.level = 0;
      this.sentLookups.clear();
      this.span = { start: start2, end, status: "loading" };
      this.requestSpan(state, this.span);
      void this.pauseIfNeeded();
    }
    onSpanCancel() {
      this.dragging = false;
      if (this.popupOpen) return;
      this.deps.overlay.highlight(null);
      this.resumeIfPaused();
    }
    /** 拡張が OFF にされたとき。 */
    reset() {
      this.close();
      this.current = null;
      this.history = [];
      this.deps.overlay.renderCue(null);
    }
    request(state) {
      state.status = "loading";
      this.refreshPopup();
      void this.deps.translate({ text: state.cue.text, tokens: state.cue.tokens, context: state.context }).then((reply) => {
        if (this.current !== state) return;
        if (reply.ok) {
          state.status = "ready";
          state.result = reply.result;
        } else if (this.popupOpen && !this.span && !state.autoRetried && !NOT_RETRYABLE.has(reply.error)) {
          state.autoRetried = true;
          this.request(state);
          return;
        } else {
          state.status = "error";
          state.error = reply.error;
        }
        this.refreshPopup();
      });
    }
    requestSpan(state, span) {
      span.status = "loading";
      this.refreshPopup();
      const { text, tokens } = state.cue;
      void this.deps.translateSpan({ text, tokens, context: state.context, start: span.start, end: span.end }).then((reply) => {
        if (this.current !== state || this.span !== span) return;
        if (reply.ok) {
          span.status = "ready";
          span.ja = reply.result.ja;
        } else {
          span.status = "error";
          span.error = reply.error;
        }
        this.refreshPopup();
      });
    }
    open(index) {
      const state = this.current;
      if (!state) return;
      const wasOpen = this.popupOpen;
      this.popupOpen = true;
      this.hoverToken = index;
      this.level = 0;
      if (!wasOpen) this.sentLookups.clear();
      if (state.status === "error" && !state.autoRetried && state.error !== "stale") {
        state.autoRetried = true;
        this.request(state);
      } else {
        this.refreshPopup();
      }
      if (!wasOpen) void this.pauseIfNeeded();
    }
    /** ポップアップを開いている間とドラッグ中は、拡張が止めた動画を止めたままにする。 */
    holdsVideo() {
      return this.popupOpen || this.dragging;
    }
    async pauseIfNeeded() {
      if (!this.deps.settings().pauseOnHover || this.pausedVideo?.paused || this.pausing) return;
      const video = this.deps.player.getVideo();
      if (!video || video.paused) return;
      this.pausing = true;
      let ok = false;
      try {
        ok = await this.deps.player.setPaused(video, true);
      } finally {
        this.pausing = false;
      }
      if (!ok) return;
      if (this.holdsVideo()) this.pausedVideo = video;
      else void this.deps.player.setPaused(video, false);
    }
    resumeIfPaused() {
      const video = this.pausedVideo;
      this.pausedVideo = null;
      if (video) void this.deps.player.setPaused(video, false);
    }
    /** ポップアップを隠す（動画には触らない）。 */
    hidePopup() {
      this.popupOpen = false;
      this.hoverToken = null;
      this.level = 0;
      this.span = null;
      this.sentLookups.clear();
      this.deps.overlay.hidePopup();
    }
    close() {
      this.cancelDwell();
      this.cancelClose();
      this.dragging = false;
      if (this.popupOpen) this.hidePopup();
      this.deps.overlay.highlight(null);
      this.resumeIfPaused();
    }
    refreshPopup() {
      const state = this.current;
      if (!this.popupOpen || !state) return;
      if (this.span) {
        this.showSpan(state, this.span);
        return;
      }
      const index = this.hoverToken;
      if (index === null) return;
      const word = { start: index, end: index };
      if (state.status === "loading") {
        this.show(word, { kind: "loading" });
        return;
      }
      if (state.status === "error" || !state.result) {
        this.show(word, errorPopup(state.error));
        return;
      }
      const levels = levelsFor(index, state.result, state.cue.tokens.length);
      this.level = clampLevel(this.level, levels.length);
      const level = levels[this.level];
      this.show(level.range, { kind: "text", text: level.ja || MESSAGES.noTranslation });
      this.notifyLookup(state, index, level);
    }
    showSpan(state, span) {
      const range = { start: span.start, end: span.end };
      if (span.status === "loading") {
        this.show(range, { kind: "loading" }, "span");
        return;
      }
      if (span.status === "error") {
        this.show(range, errorPopup(span.error), "span");
        return;
      }
      this.show(range, { kind: "text", text: span.ja || MESSAGES.noTranslation }, "span");
      this.sendLookup({ kind: "span", headword: spanText(state.cue.tokens, span.start, span.end), ja: span.ja ?? "", sentence: state.cue.text });
    }
    /** 語の段階と熟語の句の段階だけを送る（設計書 v2-1 5.1）。 */
    notifyLookup(state, index, level) {
      if (level.kind === "word") {
        const token = state.cue.tokens[index] ?? "";
        const headword = state.result?.words[index]?.base || token.toLowerCase();
        this.sendLookup({ kind: "word", headword, ja: level.ja, sentence: state.cue.text });
      } else if (level.kind === "phrase" && level.idiom) {
        this.sendLookup({ kind: "phrase", headword: spanText(state.cue.tokens, level.range.start, level.range.end), ja: level.ja, sentence: state.cue.text });
      }
    }
    sendLookup(item) {
      const key = `${item.kind}:${item.headword.toLowerCase()}`;
      if (this.sentLookups.has(key)) return;
      this.sentLookups.add(key);
      this.deps.lookedUp(item);
    }
    show(range, content, tone = "hover") {
      this.deps.overlay.highlight(range, tone);
      this.deps.overlay.showPopup(range, content);
    }
    cancelDwell() {
      if (this.dwellTimer) clearTimeout(this.dwellTimer);
      this.dwellTimer = null;
      this.pendingToken = null;
    }
    cancelClose() {
      if (this.closeTimer) clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  };

  // src/content/overlay.ts
  var LOADING_TEXT = "\u7FFB\u8A33\u4E2D\u2026";
  var GAP = 8;
  var POINTER_INSET = 8;
  var clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  var CSS = `
:host { all: initial; }
.box { --hl: rgba(255, 214, 10, 0.38); position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%); max-width: 90%; text-align: center;
  pointer-events: auto; color: #fff; font: 600 clamp(18px, 2.6vw, 44px)/1.35 system-ui, sans-serif;
  text-shadow: 0 0 4px #000, 0 2px 6px #000; user-select: none; -webkit-user-select: none; }
.box[hidden], .popup[hidden] { display: none; }
.line { white-space: pre-wrap; }
.tok { cursor: help; border-radius: 4px; }
.tok:hover { background: rgba(255, 255, 255, 0.12); }
/* \u7BC4\u56F2\u306F\u8A9E\u306E\u3042\u3044\u3060\u3082\u3064\u306A\u3044\u30671\u672C\u306E\u5E2F\u306B\u3059\u308B\u3002\u30DD\u30A4\u30F3\u30BF\u30FC\u306E\u4E0B\u306E\u8A9E\u3082\u3001\u30DB\u30D0\u30FC\u306E\u8272\u3067\u306F\u306A\u304F\u7BC4\u56F2\u306E\u8272\u3067\u5857\u308B */
.tok.hl, .tok.hl:hover, .hl-gap { background: var(--hl); border-radius: 0; }
.tok.hl.hl-first { border-top-left-radius: 4px; border-bottom-left-radius: 4px; }
.tok.hl.hl-last { border-top-right-radius: 4px; border-bottom-right-radius: 4px; }
/* \u30DB\u30D0\u30FC\uFF08\u8A9E\u30FB\u53E5\u30FB\u6587\uFF09\u306F\u9EC4\u3001\u30C9\u30E9\u30C3\u30B0\u3067\u9078\u3093\u3060\u7BC4\u56F2\u306F\u9752 */
.box[data-tone="span"] { --hl: rgba(64, 140, 255, 0.6); }
.popup { position: absolute; pointer-events: auto; width: max-content; max-width: min(560px, 80%); padding: 10px 14px; border-radius: 10px;
  background: rgba(20, 20, 24, 0.95); color: #fff; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  font: 500 clamp(14px, 1.6vw, 24px)/1.5 system-ui, "Hiragino Sans", sans-serif; }
.popup .muted { opacity: 0.7; }
.popup button { all: unset; cursor: pointer; text-decoration: underline; }
`;
  var Overlay = class {
    constructor(cb, getVideoRect, doc = document, opts = {}) {
      this.cb = cb;
      this.getVideoRect = getVideoRect;
      this.doc = doc;
      this.host = doc.createElement("div");
      this.host.id = "dht-overlay-host";
      this.host.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;";
      const shadow = this.host.attachShadow({ mode: "open" });
      shadow.innerHTML = `<style>${CSS}</style><div class="box" hidden></div><div class="popup" hidden></div>`;
      this.box = shadow.querySelector(".box");
      this.popup = shadow.querySelector(".popup");
      this.hitTest = opts.hitTest ?? ((x, y) => this.host.shadowRoot?.elementFromPoint?.(x, y) ?? null);
      this.box.addEventListener("pointerover", (e) => {
        const token = e.target?.closest?.("[data-token]");
        if (token) this.cb.onTokenOver(Number(token.getAttribute("data-token")));
        else this.cb.onTokenOut();
      });
      this.box.addEventListener("pointerenter", () => this.enter("box"));
      this.box.addEventListener("pointerleave", () => this.leave("box"));
      const trackPointer = (e) => {
        const { clientX, clientY } = e;
        if (typeof clientX === "number" && typeof clientY === "number") this.pointer = { x: clientX, y: clientY };
      };
      this.popup.addEventListener("pointerenter", (e) => {
        trackPointer(e);
        this.enter("popup");
      });
      this.popup.addEventListener("pointermove", trackPointer);
      this.popup.addEventListener("pointerleave", () => this.leave("popup"));
      this.box.addEventListener("wheel", this.onWheel, { passive: false });
      this.popup.addEventListener("wheel", this.onWheel, { passive: false });
      this.popup.addEventListener("click", (e) => {
        if (e.target?.closest?.("[data-retry]")) this.cb.onRetry();
      });
      this.box.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        if (e.button !== 0) return;
        const token = this.tokenFrom(e.target);
        if (token === null) return;
        e.preventDefault();
        this.drag = { start: token, current: token, started: false };
        const pointerId = e.pointerId;
        if (typeof pointerId === "number" && typeof this.box.setPointerCapture === "function") {
          try {
            this.box.setPointerCapture(pointerId);
          } catch {
          }
        }
      });
      this.box.addEventListener("pointermove", (e) => {
        const drag = this.drag;
        if (!drag) return;
        const token = this.tokenAt(e.clientX, e.clientY, e.target);
        if (token === null || token === drag.current) return;
        drag.current = token;
        if (!drag.started && token !== drag.start) {
          drag.started = true;
          this.cb.onSpanStart();
        }
        if (drag.started) this.highlight(this.dragRange(drag), "span");
      });
      this.box.addEventListener("pointerup", (e) => {
        e.stopPropagation();
        const drag = this.drag;
        this.drag = null;
        if (!drag?.started) return;
        if (drag.current === drag.start) {
          this.highlight(null);
          this.cb.onSpanCancel();
          return;
        }
        const { start: start2, end } = this.dragRange(drag);
        this.cb.onSpanSelect(start2, end);
      });
      this.box.addEventListener("pointercancel", () => this.cancelDrag());
      this.box.addEventListener("click", (e) => e.stopPropagation());
    }
    cb;
    getVideoRect;
    doc;
    host;
    box;
    popup;
    inBox = false;
    inPopup = false;
    /** ポップアップの上にあるポインターの位置（client 座標）。 */
    pointer = null;
    windowWheel = false;
    lastWheel = null;
    layoutTimer = null;
    remount = () => this.attachToDocument();
    relayout = () => this.layout();
    hitTest;
    /** ドラッグ中の状態。started はポインタが2語目に入ったか。 */
    drag = null;
    mount() {
      this.attachToDocument();
      this.doc.addEventListener("fullscreenchange", this.remount);
      this.doc.defaultView?.addEventListener("resize", this.relayout);
      this.layoutTimer = setInterval(this.relayout, 500);
    }
    unmount() {
      this.doc.removeEventListener("fullscreenchange", this.remount);
      this.doc.defaultView?.removeEventListener("resize", this.relayout);
      if (this.layoutTimer) clearInterval(this.layoutTimer);
      this.layoutTimer = null;
      this.setWindowWheel(false);
      this.host.remove();
    }
    renderCue(cue) {
      this.cancelDrag();
      this.box.replaceChildren();
      if (!cue) {
        this.box.hidden = true;
        return;
      }
      for (const line of cue.lines) {
        const lineEl = this.doc.createElement("div");
        lineEl.className = "line";
        for (const seg of line) {
          const span = this.doc.createElement("span");
          span.textContent = seg.text;
          if (seg.token !== null) {
            span.className = "tok";
            span.dataset.token = String(seg.token);
          }
          lineEl.appendChild(span);
        }
        this.box.appendChild(lineEl);
      }
      this.box.hidden = false;
    }
    highlight(range, tone = "hover") {
      if (range) this.box.dataset.tone = tone;
      else delete this.box.dataset.tone;
      const inRange = (el) => {
        const token = el instanceof HTMLElement ? el.dataset.token : void 0;
        return range !== null && token !== void 0 && Number(token) >= range.start && Number(token) <= range.end;
      };
      for (const line of Array.from(this.box.children)) {
        const spans = Array.from(line.children);
        spans.forEach((span, k) => {
          if (!(span instanceof HTMLElement)) return;
          if (span.dataset.token === void 0) {
            span.classList.toggle("hl-gap", inRange(spans[k - 1]) && inRange(spans[k + 1]));
            return;
          }
          const i = Number(span.dataset.token);
          const on = inRange(span);
          span.classList.toggle("hl", on);
          span.classList.toggle("hl-first", on && i === range?.start);
          span.classList.toggle("hl-last", on && i === range?.end);
        });
      }
    }
    showPopup(range, content) {
      this.popup.replaceChildren();
      if (content.kind === "loading") {
        const el = this.doc.createElement("span");
        el.className = "muted";
        el.textContent = LOADING_TEXT;
        this.popup.appendChild(el);
      } else if (content.kind === "text") {
        this.popup.textContent = content.text;
      } else if (content.retry) {
        const button = this.doc.createElement("button");
        button.dataset.retry = "";
        button.textContent = content.text;
        this.popup.appendChild(button);
      } else {
        this.popup.textContent = content.text;
      }
      this.popup.hidden = false;
      this.setWindowWheel(true);
      this.positionPopup(range);
    }
    hidePopup() {
      this.popup.hidden = true;
      this.inPopup = false;
      this.pointer = null;
      this.setWindowWheel(false);
    }
    /** Ctrl+ホイール。ポップアップを開いている間は window でも受けるので、同じイベントは1回だけ扱う。 */
    onWheel = (e) => {
      if (!e.ctrlKey || e === this.lastWheel) return;
      this.lastWheel = e;
      e.preventDefault();
      this.cb.onWheel(e.deltaY);
    };
    /**
     * ポップアップを開いている間は、ポインターが字幕の箱とポップアップの外（隙間など）にあっても
     * Ctrl+ホイールでブラウザがズームしないようにする。閉じている間はページのスクロールを妨げないよう外す。
     */
    setWindowWheel(on) {
      const win = this.doc.defaultView;
      if (!win || on === this.windowWheel) return;
      this.windowWheel = on;
      if (on) win.addEventListener("wheel", this.onWheel, { capture: true, passive: false });
      else win.removeEventListener("wheel", this.onWheel, { capture: true });
    }
    enter(area) {
      if (area === "box") this.inBox = true;
      else this.inPopup = true;
      this.cb.onAreaEnter();
    }
    leave(area) {
      if (area === "box") this.inBox = false;
      else this.inPopup = false;
      if (!this.inBox && !this.inPopup) this.cb.onAreaLeave();
    }
    attachToDocument() {
      const parent = this.doc.fullscreenElement ?? this.doc.body;
      if (this.host.parentElement !== parent) parent.appendChild(this.host);
      this.layout();
    }
    layout() {
      const rect = this.getVideoRect();
      if (!rect || rect.width === 0) {
        this.host.style.display = "none";
        return;
      }
      Object.assign(this.host.style, {
        display: "block",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
    }
    /**
     * ハイライト範囲のすぐ上に置き、プレイヤーの枠からはみ出さないようにする。
     * ポインターがポップアップの上にあるときは、ポインターが外れない所まで寄せる。外れると、
     * 次の Ctrl+ホイールがポップアップに届かず、pointerleave から 300ms で閉じてしまう（段階を変えて大きさが変わるとき）。
     */
    positionPopup(range) {
      const hostRect = this.host.getBoundingClientRect();
      const spans = [...this.box.querySelectorAll("[data-token]")].filter((s) => {
        const i = Number(s.dataset.token);
        return i >= range.start && i <= range.end;
      });
      if (spans.length === 0) return;
      const rects = spans.map((s) => s.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left)) - hostRect.left;
      const right = Math.max(...rects.map((r) => r.right)) - hostRect.left;
      const top = Math.min(...rects.map((r) => r.top)) - hostRect.top;
      const { width, height } = this.popup.getBoundingClientRect();
      let x = (left + right) / 2 - width / 2;
      let y = top - height - GAP;
      if (this.inPopup && this.pointer) {
        const px = this.pointer.x - hostRect.left;
        const py = this.pointer.y - hostRect.top;
        x = clamp(x, px + POINTER_INSET - width, px - POINTER_INSET);
        y = clamp(y, py + POINTER_INSET - height, py - POINTER_INSET);
      }
      x = clamp(x, GAP, Math.max(hostRect.width - width - GAP, GAP));
      y = Math.max(y, GAP);
      this.popup.style.left = `${x}px`;
      this.popup.style.top = `${y}px`;
    }
    tokenFrom(target) {
      const token = target?.closest?.("[data-token]");
      return token ? Number(token.getAttribute("data-token")) : null;
    }
    /** キャプチャ中は event.target がキャプチャした要素に固定されるので、座標から今いるトークンを引く。 */
    tokenAt(x, y, fallback) {
      const el = this.hitTest(x, y) ?? (fallback instanceof Element ? fallback : null);
      return el && this.box.contains(el) ? this.tokenFrom(el) : null;
    }
    dragRange(drag) {
      return { start: Math.min(drag.start, drag.current), end: Math.max(drag.start, drag.current) };
    }
    cancelDrag() {
      const drag = this.drag;
      this.drag = null;
      if (drag?.started) {
        this.highlight(null);
        this.cb.onSpanCancel();
      }
    }
  };

  // src/content/page-title.ts
  function pageTitle(title) {
    return title.replace(/\s*[|｜–—-]?\s*(?:Disney\+|Netflix).*$/i, "").trim();
  }

  // src/content/deep-query.ts
  function collectRoots(root = document) {
    const roots = [root];
    if (root instanceof Element && root.shadowRoot) roots.push(root.shadowRoot);
    for (let i = 0; i < roots.length; i++) {
      for (const el of roots[i].querySelectorAll("*")) {
        if (el.shadowRoot) roots.push(el.shadowRoot);
      }
    }
    return roots;
  }
  function querySelectorDeep(selectors, root = document) {
    const roots = collectRoots(root);
    for (const selector of selectors) {
      for (const r of roots) {
        const found = r.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }
  function querySelectorAllDeep(selector, root = document) {
    return collectRoots(root).flatMap((r) => [...r.querySelectorAll(selector)]);
  }

  // src/content/player-control.ts
  var PLAYBACK_CONFIRM_MS = 1e3;
  function findVideo(root = document) {
    const videos = querySelectorAllDeep("video", root).filter((v) => v instanceof HTMLVideoElement);
    let best = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const v of videos) {
      const rect = v.getBoundingClientRect();
      let score = 0;
      if (rect.width > 0 && rect.height > 0) score += 100 + Math.min(rect.width * rect.height / 2e4, 50);
      if (v.readyState >= 2) score += 40;
      if (!v.paused) score += 30;
      if (score > bestScore) {
        best = v;
        bestScore = score;
      }
    }
    return best;
  }
  function findPlayPauseButton(root = document) {
    for (const host of querySelectorAllDeep("toggle-play-pause", root)) {
      const button = host.shadowRoot?.querySelector('button, [role="button"]');
      if (button && !button.disabled && button.getAttribute("aria-disabled") !== "true") return button;
    }
    const button = querySelectorDeep([
      'button[data-uia="control-play-pause-pause"]',
      'button[data-uia="control-play-pause-play"]'
    ], root);
    return button && !button.disabled && button.getAttribute("aria-disabled") !== "true" ? button : null;
  }
  function setPaused(video, paused, opts = {}) {
    if (video.paused === paused) return Promise.resolve(true);
    const button = (opts.findButton ?? (() => findPlayPauseButton(video.ownerDocument)))();
    if (!button) return Promise.resolve(false);
    const eventName = paused ? "pause" : "play";
    return new Promise((resolve) => {
      const onEvent = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        video.removeEventListener(eventName, onEvent);
        resolve(false);
      }, opts.confirmMs ?? PLAYBACK_CONFIRM_MS);
      video.addEventListener(eventName, onEvent, { once: true });
      button.click();
    });
  }

  // src/content/subtitle-source.ts
  var CONTAINER_SELECTORS = [
    "timed-text-override-region",
    ".TimedTextOverlay",
    ".hive-subtitle-renderer-wrapper",
    ".dss-subtitle-renderer-wrapper",
    ".shaka-text-container",
    ".player-timedtext",
    ".player-timedtext-text-container"
  ];
  var LINE_SELECTORS = ".hive-subtitle-renderer-line, .dss-subtitle-renderer-line";
  var BLOCK_TAGS = /* @__PURE__ */ new Set(["DIV", "P", "LI"]);
  function textLines(root) {
    let out = "";
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent ?? "";
        return;
      }
      if (!(node instanceof Element)) return;
      if (node.tagName === "BR") {
        out += "\n";
        return;
      }
      const block = BLOCK_TAGS.has(node.tagName);
      if (block) out += "\n";
      for (const child of node.shadowRoot ? node.shadowRoot.childNodes : node.childNodes) walk(child);
      if (block) out += "\n";
    };
    for (const child of root.childNodes) walk(child);
    return out.split("\n");
  }
  function readLines(container) {
    const lineEls = querySelectorAllDeep(LINE_SELECTORS, container);
    const raw = lineEls.length > 0 ? lineEls.map((el) => el.textContent ?? "") : textLines(container.shadowRoot ?? container);
    return raw.map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 0);
  }
  var SubtitleSource = class {
    constructor(onCue, opts = {}) {
      this.onCue = onCue;
      this.opts = opts;
    }
    onCue;
    opts;
    container = null;
    /**
     * このコンテナから字幕の文字を一度でも読めたか。読めるまでは元の字幕を隠さず、"attached" も報告しない
     * （文字が slot や closed shadow root の中にあるなど、形が想定外なら元の字幕のまま。設計書 9章）。
     */
    readable = false;
    observer = null;
    discoveryObserver = null;
    originalVisibility = "";
    originalVisibilityPriority = "";
    timer = null;
    lastKey = "";
    /** 既知のセレクタのコンテナを見つけて監視しているか（まだ字幕を読めていなくても true。「!」バッジの判定に使う）。 */
    get attached() {
      return this.container !== null;
    }
    start() {
      if (this.timer) return;
      this.tick();
      this.discoveryObserver = new MutationObserver(() => {
        if (!this.container || !this.container.isConnected) this.tick();
      });
      for (const root of collectRoots(this.opts.root ?? document)) {
        this.discoveryObserver.observe(root, { childList: true, subtree: true });
      }
      this.timer = setInterval(() => this.tick(), this.opts.pollMs ?? 1e3);
    }
    stop() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.discoveryObserver?.disconnect();
      this.discoveryObserver = null;
      this.detach(false);
    }
    /** 1回分の確認。テストからも呼ぶ。 */
    tick() {
      if (this.container && !this.container.isConnected) {
        this.detach(true);
        this.onCue(null);
      }
      if (this.container) {
        if (this.readable) this.hide();
        this.read();
        return;
      }
      const found = querySelectorDeep(CONTAINER_SELECTORS, this.opts.root ?? document);
      if (found instanceof HTMLElement) this.attach(found);
    }
    attach(el) {
      this.container = el;
      this.originalVisibility = el.style.getPropertyValue("visibility");
      this.originalVisibilityPriority = el.style.getPropertyPriority("visibility");
      this.readable = false;
      this.observer = new MutationObserver(() => this.read());
      const options = { childList: true, subtree: true, characterData: true };
      this.observer.observe(el, options);
      if (el.shadowRoot) this.observer.observe(el.shadowRoot, options);
      this.read();
    }
    detach(notify) {
      this.observer?.disconnect();
      this.observer = null;
      const wasReadable = this.readable;
      if (this.container && wasReadable && this.opts.hide !== false) {
        this.container.removeAttribute("data-vht-subtitles-hidden");
        if (this.container.style.getPropertyValue("visibility") === "hidden") {
          if (this.originalVisibility) this.container.style.setProperty("visibility", this.originalVisibility, this.originalVisibilityPriority);
          else this.container.style.removeProperty("visibility");
        }
      }
      this.container = null;
      this.readable = false;
      this.lastKey = "";
      if (notify && wasReadable) this.opts.onStatus?.("searching");
    }
    hide() {
      if (this.opts.hide === false || !this.container) return;
      const root = this.container.getRootNode();
      if (!root.querySelector("style[data-vht-subtitle-suppression]")) {
        const style = this.container.ownerDocument.createElement("style");
        style.setAttribute("data-vht-subtitle-suppression", "");
        // Opacity on the container cannot be undone by a child's visibility.
        // The separate stylesheet survives React rewriting the inline style.
        style.textContent = "[data-vht-subtitles-hidden] { opacity: 0 !important; pointer-events: none !important; }";
        (root instanceof Document ? root.head ?? root.documentElement : root).appendChild(style);
      }
      this.container.setAttribute("data-vht-subtitles-hidden", "");
      this.container.style.setProperty("visibility", "hidden", "important");
    }
    read() {
      if (!this.container) return;
      const lines = readLines(this.container);
      if (!this.readable) {
        if (lines.length === 0) return;
        this.readable = true;
        this.hide();
        this.opts.onStatus?.("attached");
      }
      const key = lines.join("\n");
      if (key === this.lastKey) return;
      this.lastKey = key;
      this.onCue(lines.length > 0 ? lines : null);
    }
  };

  // src/content/main.ts
  // Netflix uses client-side navigation between browse and watch pages.
  function isPlaybackAllowed() {
    return location.hostname !== "www.netflix.com" || /^\/watch\/\d+(?:\/|$)/.test(location.pathname);
  }
  var BADGE_AFTER_MS = 15e3;
  var settings = DEFAULT_SETTINGS;
  var running = false;
  var send = (msg) => {
    try {
      return chrome.runtime.sendMessage(msg);
    } catch (err) {
      return Promise.reject(err);
    }
  };
  var failure = () => chrome.runtime?.id ? "network" : "stale";
  var overlay = new Overlay(
    {
      onTokenOver: (i) => controller.onTokenOver(i),
      onTokenOut: () => controller.onTokenOut(),
      onAreaEnter: () => controller.onAreaEnter(),
      onAreaLeave: () => controller.onAreaLeave(),
      onWheel: (deltaY) => controller.onWheel(deltaY),
      onRetry: () => controller.onRetry(),
      onSpanStart: () => controller.onSpanStart(),
      onSpanSelect: (start2, end) => controller.onSpanSelect(start2, end),
      onSpanCancel: () => controller.onSpanCancel()
    },
    () => findVideo()?.getBoundingClientRect() ?? null
  );
  var controller = new Controller({
    overlay,
    player: { getVideo: () => findVideo(), setPaused: (video, paused) => setPaused(video, paused) },
    translate: async (body) => {
      try {
        return await send({ type: "translate", ...body });
      } catch {
        return { ok: false, error: failure() };
      }
    },
    translateSpan: async (body) => {
      try {
        return await send({ type: "translateSpan", ...body });
      } catch {
        return { ok: false, error: failure() };
      }
    },
    lookedUp: (item) => {
      send({ type: "lookedUp", ...item, title: pageTitle(document.title) }).catch(() => void 0);
    },
    settings: () => settings
  });
  var reported = null;
  function reportStatus(found) {
    if (reported === found) return;
    reported = found;
    if (!found) console.warn("[Video Hover Translate] \u5B57\u5E55\u30B3\u30F3\u30C6\u30CA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\u914D\u4FE1\u30B5\u30FC\u30D3\u30B9 \u306E\u753B\u9762\u69CB\u6210\u304C\u5909\u308F\u3063\u305F\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\u3002");
    send({ type: "status", subtitlesFound: found }).catch(() => void 0);
  }
  var source = new SubtitleSource((lines) => controller.onCue(lines), {
    onStatus: (status) => {
      if (status === "attached") reportStatus(true);
    }
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "diagnose") return false;
    const token = overlay.host.shadowRoot?.querySelector("[data-token]");
    const rect = token?.getBoundingClientRect();
    const hit = rect ? document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) : null;
    sendResponse({
      version: "0.4.0",
      enabled: settings.enabled,
      running,
      videoFound: Boolean(findVideo()),
      subtitlesReadable: source.readable,
      subtitleContainer: source.container?.tagName ?? null,
      netflixContainers: document.querySelectorAll(".player-timedtext, .player-timedtext-text-container").length,
      tokenCount: overlay.host.shadowRoot?.querySelectorAll("[data-token]").length ?? 0,
      pointerReachable: rect ? hit === overlay.host : null,
      translationState: controller.current?.status ?? "waiting",
      translationError: controller.current?.error ?? null
    });
    return false;
  });
  var videoSeenAt = null;
  setInterval(() => {
    if (settings.enabled && isPlaybackAllowed()) start();
    else if (running) stop();
    if (!running) return;
    if (!findVideo()) {
      videoSeenAt = null;
      return;
    }
    videoSeenAt ??= Date.now();
    if (!source.attached && Date.now() - videoSeenAt > BADGE_AFTER_MS) reportStatus(false);
  }, 1e3);
  function start() {
    if (running || !isPlaybackAllowed()) return;
    running = true;
    overlay.mount();
    source.start();
  }
  function stop() {
    if (!running) return;
    running = false;
    source.stop();
    controller.reset();
    overlay.unmount();
  }
  async function applySettings() {
    settings = await loadSettings();
    if (settings.enabled) start();
    else stop();
  }
  void applySettings();
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === "sync") void applySettings();
  });
})();
