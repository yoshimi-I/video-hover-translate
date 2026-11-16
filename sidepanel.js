"use strict";
(() => {
  // src/common/seen.ts
  var LOOKUPS_KEY = "lookups";
  var seenStorageKey = (tabId) => `seen:${tabId}`;

  // src/content/page-title.ts
  function pageTitle(title) {
    return title.replace(/\s*[|｜–—-]?\s*(?:Disney\+|Netflix).*$/i, "").trim();
  }

  // src/sidepanel/active-tab.ts
  function isPlayPage(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") return false;
      if (parsed.hostname === "www.disneyplus.com") return parsed.pathname.includes("/play/");
      return parsed.hostname === "www.netflix.com" && /^\/watch\/\d+(?:\/|$)/.test(parsed.pathname);
    } catch {
      return false;
    }
  }
  function fixedTabId(search) {
    const raw = new URLSearchParams(search).get("tabId");
    return raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  }

  // src/sidepanel/vocab-build.ts
  var CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
  var isCefr = (value) => CEFR_ORDER.includes(value);

  // src/sidepanel/vocab-levels.generated.ts
  var VOCAB_LEVELS = globalThis.VHT_VOCAB_LEVELS ?? {};

  // src/sidepanel/levels.ts
  var TOEIC_BADGE = {
    A1: "A1\u30FB120\u70B9\u301C",
    A2: "A2\u30FB225\u70B9\u301C",
    B1: "B1\u30FB550\u70B9\u301C",
    B2: "B2\u30FB785\u70B9\u301C",
    C1: "C1\u30FB945\u70B9\u301C",
    C2: "C2\u30FB945\u70B9\u8D85"
  };
  function cefrOf(headword, table = VOCAB_LEVELS) {
    const level = table[headword.toLowerCase()];
    return level && isCefr(level) ? level : null;
  }
  function levelInfo(item, table = VOCAB_LEVELS) {
    if (item.kind === "phrase") return { group: "phrase", badge: "\u719F\u8A9E", rank: -1 };
    if (item.kind === "span") return { group: "phrase", badge: "\u9078\u629E", rank: -1 };
    const cefr = cefrOf(item.headword, table);
    if (!cefr) return { group: "out", badge: "\u7BC4\u56F2\u5916", rank: 0 };
    const group = cefr === "A1" || cefr === "A2" ? "A" : cefr === "B1" ? "B1" : cefr === "B2" ? "B2" : "C";
    return { group, badge: TOEIC_BADGE[cefr], rank: CEFR_ORDER.indexOf(cefr) + 1 };
  }

  // ../node_modules/lucide/dist/esm/defaultAttributes.mjs
  var defaultAttributes = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  };

  // ../node_modules/lucide/dist/esm/createElement.mjs
  var createSVGElement = ([tag, attrs, children]) => {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs).forEach((name) => {
      element.setAttribute(name, String(attrs[name]));
    });
    if (children?.length) {
      children.forEach((child) => {
        const childElement = createSVGElement(child);
        element.appendChild(childElement);
      });
    }
    return element;
  };
  var createElement = (iconNode, customAttrs = {}) => {
    const tag = "svg";
    const attrs = {
      ...defaultAttributes,
      ...customAttrs
    };
    return createSVGElement([tag, attrs, iconNode]);
  };

  // ../node_modules/lucide/dist/esm/icons/arrow-down-wide-narrow.mjs
  var ArrowDownWideNarrow = [
    ["path", { d: "m3 16 4 4 4-4" }],
    ["path", { d: "M7 20V4" }],
    ["path", { d: "M11 4h10" }],
    ["path", { d: "M11 8h7" }],
    ["path", { d: "M11 12h4" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/arrow-left.mjs
  var ArrowLeft = [
    ["path", { d: "m12 19-7-7 7-7" }],
    ["path", { d: "M19 12H5" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/book-a.mjs
  var BookA = [
    [
      "path",
      { d: "M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" }
    ],
    ["path", { d: "m8 13 4-7 4 7" }],
    ["path", { d: "M9.1 11h5.7" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/captions.mjs
  var Captions = [
    ["rect", { width: "18", height: "14", x: "3", y: "5", rx: "2", ry: "2" }],
    ["path", { d: "M7 15h4M15 15h2M7 11h2M13 11h4" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/chart-bar.mjs
  var ChartBar = [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16" }],
    ["path", { d: "M7 16h8" }],
    ["path", { d: "M7 11h12" }],
    ["path", { d: "M7 6h3" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/clock.mjs
  var Clock = [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 6v6l4 2" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/key-round.mjs
  var KeyRound = [
    [
      "path",
      {
        d: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"
      }
    ],
    ["circle", { cx: "16.5", cy: "7.5", r: ".5", fill: "currentColor" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/list.mjs
  var List = [
    ["path", { d: "M3 5h.01" }],
    ["path", { d: "M3 12h.01" }],
    ["path", { d: "M3 19h.01" }],
    ["path", { d: "M8 5h13" }],
    ["path", { d: "M8 12h13" }],
    ["path", { d: "M8 19h13" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/rotate-ccw-clock.mjs
  var RotateCcwClock = [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
    ["path", { d: "M3 3v5h5" }],
    ["path", { d: "M12 7v5l4 2" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/search-check.mjs
  var SearchCheck = [
    ["path", { d: "m8 11 2 2 4-4" }],
    ["circle", { cx: "11", cy: "11", r: "8" }],
    ["path", { d: "m21 21-4.3-4.3" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/search.mjs
  var Search = [
    ["path", { d: "m21 21-4.34-4.34" }],
    ["circle", { cx: "11", cy: "11", r: "8" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/settings.mjs
  var Settings = [
    [
      "path",
      {
        d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"
      }
    ],
    ["circle", { cx: "12", cy: "12", r: "3" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/text-quote.mjs
  var TextQuote = [
    ["path", { d: "M17 5H3" }],
    ["path", { d: "M21 12H8" }],
    ["path", { d: "M21 19H8" }],
    ["path", { d: "M3 12v7" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/trending-up.mjs
  var TrendingUp = [
    ["path", { d: "M16 7h6v6" }],
    ["path", { d: "m22 7-8.5 8.5-5-5L2 17" }]
  ];

  // ../node_modules/lucide/dist/esm/icons/user-round.mjs
  var UserRound = [
    ["circle", { cx: "12", cy: "8", r: "5" }],
    ["path", { d: "M20 21a8 8 0 0 0-16 0" }]
  ];

  // src/sidepanel/icons.ts
  var ICONS = {
    settings: Settings,
    back: ArrowLeft,
    words: BookA,
    phrases: TextQuote,
    lookedUp: SearchCheck,
    rate: TrendingUp,
    levels: ChartBar,
    recent: RotateCcwClock,
    list: List,
    search: Search,
    proper: UserRound,
    sortRecent: Clock,
    sortLevel: ArrowDownWideNarrow,
    captions: Captions,
    key: KeyRound
  };
  var isIconName = (name) => Object.hasOwn(ICONS, name);
  function icon(name, size = 14) {
    return createElement(ICONS[name], { width: size, height: size, "aria-hidden": "true", class: `icon icon-${name}` });
  }
  function hydrateIcons(root) {
    for (const el of Array.from(root.querySelectorAll("i[data-icon]"))) {
      const name = el.dataset.icon ?? "";
      if (isIconName(name)) el.replaceWith(icon(name, Number(el.dataset.size) || 14));
    }
  }

  // src/sidepanel/rows.ts
  var DEFAULT_FILTERS = { groups: /* @__PURE__ */ new Set(["B1", "B2", "C", "phrase"]), lookedUpOnly: false, showProper: false, query: "" };
  var isProperNoun = (item, level) => item.kind === "word" && level.group === "out" && new RegExp("\\p{Lu}", "u").test(item.headword);
  function buildRows(items2, filters2, sort2, info = levelInfo) {
    const rows = items2.map((item) => {
      const level = info(item);
      return {
        key: item.key,
        kind: item.kind,
        headword: item.headword,
        badge: level.badge,
        group: level.group,
        ja: item.ja,
        sentence: item.sentence,
        count: item.count,
        lookedUp: item.lookedUp,
        lastSeenAt: item.lastSeenAt,
        rank: level.rank,
        proper: isProperNoun(item, level)
      };
    });
    const byRecent = (a, b) => b.lastSeenAt - a.lastSeenAt || a.headword.localeCompare(b.headword);
    const byLevel = (a, b) => b.rank - a.rank || byRecent(a, b);
    const query = filters2.query.trim().toLowerCase();
    return rows.filter((r) => r.proper ? filters2.showProper : filters2.groups.has(r.group)).filter((r) => !filters2.lookedUpOnly || r.lookedUp).filter((r) => !query || r.headword.toLowerCase().includes(query) || r.ja.toLowerCase().includes(query)).sort(sort2 === "level" ? byLevel : byRecent);
  }

  // src/sidepanel/summary.ts
  function summarize(items2, info = levelInfo) {
    const byGroup = { A: 0, B1: 0, B2: 0, C: 0, out: 0, phrase: 0 };
    let words = 0;
    let phrases = 0;
    let lookedUp = 0;
    for (const item of items2) {
      if (item.lookedUp) lookedUp++;
      if (item.kind !== "word") {
        phrases++;
        byGroup.phrase++;
        continue;
      }
      const level = info(item);
      if (isProperNoun(item, level)) continue;
      words++;
      byGroup[level.group]++;
    }
    const leveled = byGroup.A + byGroup.B1 + byGroup.B2 + byGroup.C;
    return { words, phrases, lookedUp, byGroup, b1PlusRate: leveled > 0 ? (byGroup.B1 + byGroup.B2 + byGroup.C) / leveled : null };
  }
  function recentLookups(entries, n) {
    const latest = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const prev = latest.get(entry.key);
      if (!prev || entry.at >= prev.at) latest.set(entry.key, entry);
    }
    return [...latest.values()].sort((a, b) => b.at - a.at).slice(0, n);
  }
  function timeAgo(at, now) {
    const minutes = Math.floor(Math.max(0, now - at) / 6e4);
    if (minutes < 1) return "\u305F\u3063\u305F\u4ECA";
    if (minutes < 60) return `${minutes}\u5206\u524D`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}\u6642\u9593\u524D`;
    return `${Math.floor(hours / 24)}\u65E5\u524D`;
  }

  // src/sidepanel/render.ts
  function seenMessage(view) {
    if (view.total === 0) return view.playPage ? "\u5B57\u5E55\u304C\u51FA\u308B\u3068\u3001\u3053\u3053\u306B\u5358\u8A9E\u304C\u305F\u307E\u308A\u307E\u3059" : "Disney+ / Netflix \u306E\u518D\u751F\u30DA\u30FC\u30B8\u3067\u4F7F\u3048\u307E\u3059";
    if (view.shown === 0) return "\u6761\u4EF6\u306B\u5408\u3046\u5358\u8A9E\u304C\u3042\u308A\u307E\u305B\u3093\u3002\u7D5E\u308A\u8FBC\u307F\u3092\u5909\u3048\u3066\u307F\u3066\u304F\u3060\u3055\u3044";
    return null;
  }
  var ROW_HTML = '<div class="head"><span class="headword"></span><span class="badge"></span></div><div class="ja"></div><div class="foot"><span class="sentence"></span><span class="looked" title="\u8A33\u3092\u958B\u3044\u305F\u8A9E"></span><span class="count" title="\u51FA\u305F\u56DE\u6570"></span></div>';
  function createRow(doc, key) {
    const li = doc.createElement("li");
    li.className = "row";
    li.dataset.key = key;
    li.innerHTML = ROW_HTML;
    li.querySelector(".looked").append(icon("lookedUp", 13));
    return li;
  }
  function fillRow(li, row) {
    const part = (cls) => li.querySelector(`.${cls}`);
    part("headword").textContent = row.headword;
    const badge = part("badge");
    badge.textContent = row.badge;
    badge.dataset.group = row.group;
    part("looked").hidden = !row.lookedUp;
    part("count").textContent = row.count > 0 ? `\xD7${row.count}` : "";
    part("ja").textContent = row.ja;
    const sentence = part("sentence");
    sentence.textContent = row.sentence;
    sentence.title = row.sentence;
  }
  function renderRows(list, rows) {
    const existing = /* @__PURE__ */ new Map();
    for (const el of Array.from(list.children)) existing.set(el.dataset.key ?? "", el);
    let next = list.firstElementChild;
    for (const row of rows) {
      let el = existing.get(row.key);
      if (el) existing.delete(row.key);
      else el = createRow(list.ownerDocument, row.key);
      fillRow(el, row);
      if (el === next) next = next.nextElementSibling;
      else list.insertBefore(el, next);
    }
    for (const el of existing.values()) el.remove();
  }
  function renderKpis(root, summary) {
    const set = (name, text) => {
      const el = root.querySelector(`[data-kpi="${name}"] .value`);
      if (el) el.textContent = text;
    };
    set("words", String(summary.words));
    set("phrases", String(summary.phrases));
    set("lookedUp", String(summary.lookedUp));
    set("b1Plus", summary.b1PlusRate === null ? "\u2014" : `${Math.round(summary.b1PlusRate * 100)}%`);
  }
  function renderLevels(root, byGroup, selected) {
    const max = Math.max(0, ...Object.values(byGroup));
    for (const button of Array.from(root.querySelectorAll("[data-group]"))) {
      const group = button.dataset.group;
      const n = byGroup[group] ?? 0;
      button.setAttribute("aria-pressed", String(selected.has(group)));
      const num = button.querySelector(".num");
      if (num) num.textContent = String(n);
      const bar = button.querySelector(".bar");
      if (bar) bar.style.width = max > 0 ? `${n / max * 100}%` : "0%";
    }
  }
  function renderRecent(list, items2, now) {
    const doc = list.ownerDocument;
    const cell = (cls, text) => {
      const el = doc.createElement("span");
      el.className = cls;
      el.textContent = text;
      return el;
    };
    list.replaceChildren(
      ...items2.map((item) => {
        const li = doc.createElement("li");
        li.dataset.key = item.key;
        const badge = cell("badge", item.badge);
        badge.dataset.group = item.group;
        const headword = cell("headword", item.headword);
        headword.title = item.headword;
        const ja = cell("ja", item.ja);
        ja.title = item.ja;
        li.append(headword, ja, badge, cell("ago", timeAgo(item.at, now)));
        return li;
      })
    );
  }

  // src/common/settings.ts
  var DEFAULT_SETTINGS = { enabled: true, pauseOnHover: true };
  async function loadSettings() {
    const stored = await chrome.storage.sync.get({ ...DEFAULT_SETTINGS });
    return {
      enabled: stored.enabled ?? DEFAULT_SETTINGS.enabled,
      pauseOnHover: stored.pauseOnHover ?? DEFAULT_SETTINGS.pauseOnHover
    };
  }
  async function saveSettings(settings) {
    await chrome.storage.sync.set(settings);
  }
  async function loadApiFields() {
    return globalThis.VHTProviders.normalize(await chrome.storage.local.get(["provider", "apiUrl", "apiKey", "model"]));
  }
  async function saveApiConfig(config) {
    await chrome.storage.local.set(config);
  }

  // src/sidepanel/settings-tab.ts
  async function initSettingsTab(doc = document) {
    const input = (id) => doc.getElementById(id);
    const settings = await loadSettings();
    const api = await loadApiFields();
    const enabled = input("enabled");
    const pause = input("pauseOnHover");
    enabled.checked = settings.enabled;
    pause.checked = settings.pauseOnHover;
    enabled.addEventListener("change", () => void saveSettings({ enabled: enabled.checked }));
    pause.addEventListener("change", () => void saveSettings({ pauseOnHover: pause.checked }));
    const provider = input("provider");
    function showConfig(config) {
      provider.value = config.provider;
      input("apiUrl").value = config.apiUrl;
      input("apiKey").value = config.apiKey;
      input("model").value = config.model;
      input("model-field").hidden = config.provider === "custom";
      input("key-field").hidden = config.provider === "ollama";
      input("provider-help").textContent = config.provider === "ollama" ? "ローカルのOllamaに接続します。モデルの導入と拡張の接続許可が必要です。字幕は設定したローカルサーバーに送ります。" : config.provider === "openai" ? "OpenAI互換のChat Completions APIを利用します。再生中は字幕ごとに翻訳を要求します。字幕が送信され、利用料金が発生する場合があります。" : "従来の /translate・/translate-span APIを利用します。";
    }
    showConfig(api);
    provider.addEventListener("change", () => {
      const next = provider.value === api.provider ? api : globalThis.VHTProviders.normalize({ provider: provider.value });
      showConfig(next);
      input("status").textContent = "変更はまだ保存されていません。";
      input("api-test-status").textContent = "";
    });
    doc.getElementById("save").addEventListener("click", async () => {
      const config = { provider: provider.value, apiUrl: input("apiUrl").value.trim(), apiKey: provider.value === "ollama" ? "" : input("apiKey").value.trim(), model: input("model").value.trim() };
      const result = globalThis.VHTProviders.validate(config);
      const status = input("status");
      status.className = "warn";
      if (!result.ok) { status.textContent = result.text; return; }
      const controls = [input("save"), provider, input("apiUrl"), input("apiKey"), input("model")];
      controls.forEach(control => { control.disabled = true; });
      // Invoke directly in the click gesture, before awaiting storage or any other operation.
      try {
        const granted = await chrome.permissions.request({ origins: [globalThis.VHTProviders.originPattern(config.apiUrl)] });
        if (!granted) { status.textContent = "接続先へのアクセスが許可されなかったため、設定は変更していません。"; return; }
        await saveApiConfig(config);
        Object.assign(api, config);
        status.className = "ok";
        status.textContent = "保存しました";
        input("api-test-status").textContent = "";
      } catch { status.textContent = "設定を保存できませんでした。拡張を再読み込みして再試行してください。"; }
      finally { controls.forEach(control => { control.disabled = false; }); }
    });
    input("test-api").addEventListener("click", async () => {
      const button = input("test-api"), status = input("api-test-status");
      button.disabled = true;
      status.textContent = "保存済みの設定で翻訳をテスト中…";
      try {
        const reply = await chrome.runtime.sendMessage({ type: "testApi" });
        const errors = { forbidden: "認証エラー。APIキーを確認してください。", network: "接続できません。URL・接続許可・ローカルサーバーの起動を確認してください。", timeout: "タイムアウトしました。モデルの準備状況を確認してください。", "no-api-key": "API設定を保存してください。", "bad-request": "APIまたはモデルがリクエストに対応していません。", server: "モデルの応答が必要なJSON形式ではありません。モデル名や対応APIを確認してください。", throttled: "APIの回数制限に達しました。" };
        status.textContent = reply?.ok ? `接続成功: ${reply.translation}` : errors[reply?.error] ?? "テストに失敗しました。拡張を再読み込みしてください。";
      } catch { status.textContent = "テストできませんでした。拡張を再読み込みしてください。"; }
      finally { button.disabled = false; }
    });
  }

  // src/sidepanel/main.ts
  var RECENT_MAX = 5;
  var DEFAULT_TITLE = "Video Hover Translate";
  var $ = (id) => document.getElementById(id);
  var fixed = fixedTabId(location.search);
  var target = null;
  var items = [];
  var lookups = [];
  var filters = DEFAULT_FILTERS;
  var sort = "recent";
  var refreshSeq = 0;
  var itemsOf = (state) => state?.items ? Object.values(state.items) : [];
  function drawHeader() {
    $("work-title").textContent = target?.title || DEFAULT_TITLE;
    const live = target?.playPage ?? false;
    const pill = $("status-pill");
    pill.classList.toggle("live", live);
    pill.textContent = live ? "\u8996\u8074\u4E2D" : "\u518D\u751F\u30DA\u30FC\u30B8\u4EE5\u5916";
  }
  function drawRecent() {
    const keys = new Set(items.filter((item) => item.lookedUp).map((item) => item.key));
    const recent = recentLookups(lookups.filter((entry) => keys.has(entry.key)), RECENT_MAX).map((entry) => {
      const level = levelInfo(entry);
      return { key: entry.key, headword: entry.headword, ja: entry.ja, badge: level.badge.split("\u30FB")[0], group: level.group, at: entry.at };
    });
    renderRecent($("recent"), recent, Date.now());
    $("recent-empty").hidden = recent.length > 0;
  }
  function draw() {
    const summary = summarize(items);
    renderKpis($("kpis"), summary);
    renderLevels($("levels"), summary.byGroup, filters.groups);
    const rows = buildRows(items, filters, sort);
    const message = seenMessage({ playPage: target?.playPage ?? false, total: items.length, shown: rows.length });
    const box = $("seen-message");
    box.hidden = message === null;
    box.textContent = message ?? "";
    $("list-count").textContent = items.length > 0 ? `${rows.length} / ${items.length}\u4EF6` : "";
    renderRows($("seen-list"), rows);
    drawRecent();
  }
  function syncControls() {
    for (const button of Array.from(document.querySelectorAll("#toolbar [data-flag]"))) {
      const on = button.dataset.flag === "lookedUpOnly" ? filters.lookedUpOnly : filters.showProper;
      button.setAttribute("aria-pressed", String(on));
    }
    for (const button of Array.from(document.querySelectorAll("#sort [data-sort]"))) {
      button.setAttribute("aria-pressed", String(button.dataset.sort === sort));
    }
  }
  var previousView = "dashboard";
  function showView(name) {
    if (name !== "settings") previousView = name;
    for (const view of ["dashboard", "study", "settings"]) $("view-" + view).hidden = view !== name;
    $("show-dashboard").setAttribute("aria-pressed", String(name === "dashboard"));
    $("show-study").setAttribute("aria-pressed", String(name === "study"));
    if (name === "study") document.dispatchEvent(new Event("vht:study-open"));
    $(name === "settings" ? "close-settings" : name === "study" ? "library-search" : "show-dashboard").focus();
  }
  $("show-dashboard").addEventListener("click", () => showView("dashboard"));
  $("show-study").addEventListener("click", () => showView("study"));
  async function currentTab() {
    if (fixed !== null) return chrome.tabs.get(fixed).catch(() => void 0);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }
  async function loadItems(tabId) {
    const key = seenStorageKey(tabId);
    const stored = await chrome.storage.session.get(key);
    return itemsOf(stored[key]);
  }
  async function refresh() {
    const seq = ++refreshSeq;
    const tab = await currentTab();
    const next = tab?.id !== void 0 ? { id: tab.id, playPage: isPlayPage(tab.url), title: pageTitle(tab.title ?? "") } : null;
    const loaded = next ? await loadItems(next.id) : [];
    if (seq !== refreshSeq) return;
    target = next;
    items = loaded;
    drawHeader();
    draw();
  }
  $("check-connection").addEventListener("click", async () => {
    const box = $("connection-status");
    const button = $("check-connection");
    box.hidden = false;
    box.textContent = "確認中…";
    button.disabled = true;
    try {
      const tab = await currentTab();
      if (!tab?.id || !isPlayPage(tab.url)) {
        box.textContent = "Netflix または Disney+ の作品を再生してから確認してください。";
        return;
      }
      const api = await loadApiFields();
      let state;
      try {
        state = await chrome.tabs.sendMessage(tab.id, { type: "diagnose" });
      } catch {
        box.textContent = "ページ上の拡張に接続できません。Netflix / Disney+ のタブを再読み込みしてください。改善しない場合は、拡張のサイトへのアクセスが許可されているか確認してください。";
        return;
      }
      if (!state?.version) {
        box.textContent = "古い拡張が動いています。拡張を再読み込みしてから、動画のタブも再読み込みしてください。";
        return;
      }
      const errors = {
        "no-api-key": "API URL またはキーが未設定",
        forbidden: "API認証エラー（403）",
        network: "API通信エラー",
        timeout: "APIタイムアウト",
        server: "API応答エラー",
        throttled: "APIの回数制限",
        "bad-request": "APIリクエストエラー",
        stale: "拡張の再読み込みが必要"
      };
      const lines = [
        `拡張: 接続済み（${state.version}）`,
        `ホバー翻訳: ${state.enabled ? "ON" : "OFF（設定で有効にしてください）"}`,
        `動画: ${state.videoFound ? "検出済み" : "未検出"}`,
        `字幕: ${state.subtitlesReadable ? "取得済み" : "未取得"} / Netflix字幕要素: ${state.netflixContainers}`,
        `表示中の単語: ${state.tokenCount}`,
        `マウス操作: ${state.pointerReachable === null ? "字幕待ち" : state.pointerReachable ? "届いています" : "他の要素に遮られています"}`,
        `API設定: ${globalThis.VHTProviders.validate(api).ok ? "保存済み" : "URL・キー・モデルの設定を確認してください"}`,
        `翻訳: ${state.translationState === "ready" ? "成功" : state.translationState === "loading" ? "処理中" : state.translationState === "error" ? errors[state.translationError] ?? state.translationError ?? "エラー" : "字幕待ち"}`
      ];
      box.textContent = lines.join("\n");
    } catch {
      box.textContent = "接続を確認できませんでした。サイドパネルを開き直してください。";
    } finally {
      button.disabled = false;
    }
  });
  $("open-settings").addEventListener("click", () => showView("settings"));
  $("close-settings").addEventListener("click", () => showView(previousView));
  $("levels").addEventListener("click", (e) => {
    const group = e.target.closest("[data-group]")?.dataset.group;
    if (!group) return;
    const groups = new Set(filters.groups);
    if (groups.has(group)) groups.delete(group);
    else groups.add(group);
    filters = { ...filters, groups };
    draw();
  });
  $("toolbar").addEventListener("click", (e) => {
    const flag = e.target.closest("[data-flag]")?.dataset.flag;
    if (flag === "lookedUpOnly") filters = { ...filters, lookedUpOnly: !filters.lookedUpOnly };
    else if (flag === "showProper") filters = { ...filters, showProper: !filters.showProper };
    else return;
    syncControls();
    draw();
  });
  $("sort").addEventListener("click", (e) => {
    const value = e.target.closest("[data-sort]")?.dataset.sort;
    if (value !== "recent" && value !== "level") return;
    sort = value;
    syncControls();
    draw();
  });
  $("search").addEventListener("input", (e) => {
    filters = { ...filters, query: e.target.value };
    draw();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[LOOKUPS_KEY]) {
      lookups = changes[LOOKUPS_KEY].newValue ?? [];
      drawRecent();
      return;
    }
    if (area !== "session" || !target) return;
    const change = changes[seenStorageKey(target.id)];
    if (!change) return;
    items = itemsOf(change.newValue);
    draw();
  });
  if (fixed === null) chrome.tabs.onActivated.addListener(() => void refresh());
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (tabId === target?.id && (info.url !== void 0 || info.title !== void 0 || info.status === "complete")) void refresh();
  });
  setInterval(drawRecent, 6e4);
  async function init() {
    hydrateIcons(document);
    syncControls();
    const loadLookups = chrome.storage.local.get(LOOKUPS_KEY).then((stored) => {
      lookups = stored[LOOKUPS_KEY] ?? [];
    });
    await Promise.all([initSettingsTab(), loadLookups]);
    await refresh();
    document.body.dataset.ready = "1";
  }
  void init();
})();
/*! Bundled license information:

lucide/dist/esm/defaultAttributes.mjs:
lucide/dist/esm/createElement.mjs:
lucide/dist/esm/icons/arrow-down-wide-narrow.mjs:
lucide/dist/esm/icons/arrow-left.mjs:
lucide/dist/esm/icons/book-a.mjs:
lucide/dist/esm/icons/captions.mjs:
lucide/dist/esm/icons/chart-bar.mjs:
lucide/dist/esm/icons/clock.mjs:
lucide/dist/esm/icons/key-round.mjs:
lucide/dist/esm/icons/list.mjs:
lucide/dist/esm/icons/rotate-ccw-clock.mjs:
lucide/dist/esm/icons/search-check.mjs:
lucide/dist/esm/icons/search.mjs:
lucide/dist/esm/icons/settings.mjs:
lucide/dist/esm/icons/text-quote.mjs:
lucide/dist/esm/icons/trending-up.mjs:
lucide/dist/esm/icons/user-round.mjs:
lucide/dist/esm/lucide.mjs:
  (**
   * @license lucide v1.59.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
