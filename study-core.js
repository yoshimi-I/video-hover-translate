/* SPDX-License-Identifier: MIT */
(function (root) {
  'use strict';
  const PREFIX = { word: 'w', phrase: 'p', span: 's' };
  const text = value => typeof value === 'string' ? value : '';
  const time = value => Number.isFinite(value) && value >= 0 && value <= 8640000000000000 ? value : 0;

  function buildLibrary(history) {
    const cards = new Map();
    for (const item of Array.isArray(history) ? history : []) {
      if (!item || !Object.hasOwn(PREFIX, item.kind)) continue;
      const headword = text(item.headword).trim().replace(/\s+/g, ' ');
      if (!headword) continue;
      const key = `${PREFIX[item.kind]}:${headword.toLowerCase()}`;
      const at = time(item.at);
      const previous = cards.get(key);
      const latest = !previous || at >= previous.lastAt;
      const card = latest ? {
        key, kind: item.kind, headword, ja: text(item.ja).trim(),
        sentence: text(item.sentence), title: text(item.title)
      } : { ...previous };
      card.count = (previous?.count ?? 0) + 1;
      card.firstAt = previous ? Math.min(previous.firstAt, at) : at;
      card.lastAt = previous ? Math.max(previous.lastAt, at) : at;
      cards.set(key, card);
    }
    return [...cards.values()].sort((a, b) => b.lastAt - a.lastAt);
  }

  function reviewFor(progress, key) {
    const value = progress && Object.hasOwn(progress, key) ? progress[key] : null;
    const attempts = Math.max(0, Math.floor(time(value?.attempts)));
    return {
      attempts,
      correct: Math.min(attempts, Math.max(0, Math.floor(time(value?.correct)))),
      lastCorrect: typeof value?.lastCorrect === 'boolean' ? value.lastCorrect : null,
      lastReviewedAt: time(value?.lastReviewedAt),
      dueAt: time(value?.dueAt),
      intervalDays: Math.min(60, Math.floor(time(value?.intervalDays))),
      streak: Math.min(6, Math.floor(time(value?.streak)))
    };
  }

  function filterLibrary(cards, { query = '', kind = 'all', mistakesOnly = false, progress = {}, dueOnly = false, now = Date.now() } = {}) {
    const needle = text(query).trim().toLocaleLowerCase();
    return cards.filter(card => (kind === 'all' || card.kind === kind)
      && (!needle || [card.headword, card.ja, card.title].some(value => value.toLocaleLowerCase().includes(needle)))
      && (!mistakesOnly || reviewFor(progress, card.key).lastCorrect === false)
      && (!dueOnly || reviewFor(progress, card.key).dueAt <= now));
  }

  function shuffled(items, random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function createQuiz(cards, { limit = 10, random = Math.random, mistakesOnly = false, progress = {}, dueOnly = false, now = Date.now() } = {}) {
    const eligible = filterLibrary(cards, { mistakesOnly, progress, dueOnly, now }).filter(card => card.ja);
    const meanings = [...new Set(cards.map(card => card.ja).filter(Boolean))];
    const size = Number.isFinite(limit) ? Math.max(0, Math.min(50, Math.floor(limit))) : 10;
    return shuffled(eligible, random).slice(0, size).map(card => {
      const wrong = shuffled(meanings.filter(meaning => meaning !== card.ja), random).slice(0, 3);
      return { card, mode: wrong.length ? 'choice' : 'flashcard', options: wrong.length ? shuffled([card.ja, ...wrong], random) : [] };
    });
  }

  function recordAnswer(progress, key, correct, now = Date.now()) {
    const previous = reviewFor(progress, key);
    const intervals = [1, 3, 7, 14, 30, 60];
    const intervalDays = correct ? intervals[Math.min(previous.streak, intervals.length - 1)] : 0;
    return { ...progress, [key]: {
      attempts: previous.attempts + 1,
      correct: previous.correct + (correct ? 1 : 0),
      lastCorrect: Boolean(correct),
      lastReviewedAt: time(now),
      dueAt: time(now) + (correct ? intervalDays * 86400000 : 600000),
      intervalDays,
      streak: correct ? Math.min(previous.streak + 1, 6) : 0
    } };
  }

  function csvCell(value) {
    let out = String(value ?? '');
    if (/^[\s\uFEFF]*[=+\-@]/.test(out) || /^[\t\r\n]/.test(out)) out = "'" + out;
    return `"${out.replaceAll('"', '""')}"`;
  }

  function exportVocabulary(cards, progress = {}, format = 'csv', now = Date.now()) {
    // Explicit fields prevent settings or unknown storage fields from leaking into exports.
    const words = cards.map(card => ({
      key: card.key, kind: card.kind, headword: card.headword, ja: card.ja,
      sentence: card.sentence, title: card.title, count: card.count,
      firstAt: card.firstAt, lastAt: card.lastAt, review: reviewFor(progress, card.key)
    }));
    if (format === 'json') return JSON.stringify({ version: 1, exportedAt: time(now), words }, null, 2);
    if (format === 'anki') {
      const field = value => text(value).replace(/[\t\r\n]+/g, ' ').trim();
      return words.map(word => `${field(word.headword)}\t${field(word.ja)}`).join('\n') + (words.length ? '\n' : '');
    }
    if (format !== 'csv') throw new Error('Unknown export format');
    const header = ['英語', '日本語', '種類', '例文', '作品', '調べた回数', '初回日時', '最終日時', '回答数', '正解数', '次回復習日時'];
    const iso = at => at ? new Date(at).toISOString() : '';
    const rows = words.map(word => [word.headword, word.ja, word.kind, word.sentence, word.title, word.count, iso(word.firstAt), iso(word.lastAt), word.review.attempts, word.review.correct, iso(word.review.dueAt)]);
    return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  const api = { buildLibrary, filterLibrary, createQuiz, recordAnswer, reviewFor, exportVocabulary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VHTStudy = api;
})(globalThis);
