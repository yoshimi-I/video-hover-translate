/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const core = globalThis.VHTStudy;
  const PROGRESS_KEY = 'study-progress-v1';
  const $ = id => document.getElementById(id);
  const names = { word: '単語', phrase: '熟語', span: '選択範囲' };
  let cards = [], progress = {}, pageSize = 50, loadSeq = 0;
  let questions = [], index = 0, score = 0, answered = 0, saveFailures = 0, locked = false, saving = false;

  function filtered() {
    return core.filterLibrary(cards, { query: $('library-search').value, kind: $('library-kind').value });
  }
  function quizPool() {
    return core.filterLibrary(filtered(), { mistakesOnly: $('mistakes-only').checked, progress }).filter(card => card.ja);
  }
  function element(tag, className, value) {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = value;
    return el;
  }
  function updateControls() {
    $('start-quiz').disabled = saving || questions.length > 0 || quizPool().length === 0;
    $('export-vocabulary').disabled = filtered().length === 0;
  }
  function drawLibrary() {
    const visible = filtered();
    $('library-count').textContent = `${visible.length} / 全${cards.length}語`;
    const reviews = cards.map(card => core.reviewFor(progress, card.key));
    const total = reviews.reduce((sum, review) => sum + review.attempts, 0);
    const correct = reviews.reduce((sum, review) => sum + review.correct, 0);
    const mistakes = reviews.filter(review => review.lastCorrect === false).length;
    $('study-stats').textContent = `前回間違えた語 ${mistakes}語 · ${total ? `累計正答率 ${Math.round(correct / total * 100)}%（${correct}/${total}）` : 'クイズはまだ未回答'}`;
    $('library-empty').hidden = visible.length > 0;
    $('library-empty').textContent = cards.length ? '検索条件に一致する語がありません。' : '字幕にホバーして訳を調べると、ここに単語がたまります。動画を閉じても復習できます。';
    const fragment = document.createDocumentFragment();
    for (const card of visible.slice(0, pageSize)) {
      const row = element('li', 'library-item', '');
      const review = core.reviewFor(progress, card.key);
      row.append(element('p', 'library-word', card.headword), element('p', 'library-meaning', card.ja || '訳なし'));
      row.append(element('p', 'muted', `${names[card.kind]} · ${card.count}回調べた${review.attempts ? ` · クイズ ${review.correct}/${review.attempts}正解` : ''}`));
      if (card.sentence) row.append(element('p', 'library-context', card.sentence));
      if (card.title) row.append(element('p', 'muted', card.title));
      fragment.append(row);
    }
    $('library-list').replaceChildren(fragment);
    $('library-more').hidden = visible.length <= pageSize;
    updateControls();
  }
  async function load() {
    const seq = ++loadSeq;
    try {
      const saved = await chrome.storage.local.get(['lookups', PROGRESS_KEY]);
      if (seq !== loadSeq) return;
      cards = core.buildLibrary(saved.lookups);
      progress = saved[PROGRESS_KEY] && typeof saved[PROGRESS_KEY] === 'object' && !Array.isArray(saved[PROGRESS_KEY]) ? saved[PROGRESS_KEY] : {};
      drawLibrary();
    } catch {
      $('library-empty').hidden = false;
      $('library-empty').textContent = '履歴を読み込めませんでした。サイドパネルを開き直してください。';
    }
  }
  function showContext(card) {
    $('quiz-context').textContent = [card.sentence, card.title].filter(Boolean).join('\n');
    $('quiz-context').hidden = false;
  }
  function renderQuestion() {
    const question = questions[index];
    locked = false;
    $('quiz-position').textContent = `${index + 1} / ${questions.length}問 · ${score}問正解`;
    $('quiz-word').textContent = question.card.headword;
    $('quiz-feedback').textContent = '';
    $('quiz-context').hidden = true;
    $('quiz-context').textContent = '';
    $('self-rate').hidden = true;
    $('next-question').hidden = true;
    $('reveal-answer').hidden = question.mode !== 'flashcard';
    const options = question.options.map(value => {
      const button = element('button', '', value);
      button.type = 'button';
      button.addEventListener('click', () => void answer(value === question.card.ja, button));
      return button;
    });
    $('quiz-options').replaceChildren(...options);
    $('quiz-word').setAttribute('tabindex', '-1');
    $('quiz-word').focus();
  }
  async function answer(correct, selected) {
    if (locked || saving || !questions.length) return;
    locked = true;
    saving = true;
    answered++;
    if (correct) score++;
    const card = questions[index].card;
    for (const button of $('quiz-options').children) {
      button.disabled = true;
      if (button.textContent === card.ja) button.dataset.answer = 'correct';
      else if (button === selected) button.dataset.answer = 'wrong';
    }
    $('self-rate').hidden = true;
    $('reveal-answer').hidden = true;
    $('quiz-feedback').textContent = `${correct ? '正解！' : 'もう一度覚えよう'} ${card.ja}`;
    showContext(card);
    $('finish-quiz').disabled = true;
    try {
      const reply = await chrome.runtime.sendMessage({ type: 'studyAnswer', key: card.key, correct });
      if (!reply?.ok || !reply.review) throw new Error('Review was not saved');
      progress = { ...progress, [card.key]: reply.review };
    } catch {
      saveFailures++;
      $('quiz-feedback').textContent += '\nこの回答の保存に失敗しました。サイドパネルを開き直してください。';
    } finally {
      saving = false;
      $('finish-quiz').disabled = false;
      $('next-question').hidden = false;
      $('next-question').textContent = index + 1 === questions.length ? '結果を見る' : '次の問題';
      drawLibrary();
      $('next-question').focus();
    }
  }
  function finish() {
    if (saving) return;
    $('quiz-summary').textContent = `今回の結果: ${score} / ${answered}問正解${answered ? `（${Math.round(score / answered * 100)}%）` : ''}。${saveFailures ? `保存できなかった回答が${saveFailures}件あります。` : answered ? '回答を記録しました。' : 'まだ回答していません。'}`;
    questions = [];
    $('quiz-session').hidden = true;
    updateControls();
  }
  $('start-quiz').addEventListener('click', () => {
    questions = core.createQuiz(filtered(), { limit: Number($('quiz-count').value), mistakesOnly: $('mistakes-only').checked, progress });
    if (!questions.length) {
      $('quiz-summary').textContent = '出題できる語がありません。検索条件や「前回間違えた語だけ」を変更してください。';
      return;
    }
    index = score = answered = saveFailures = 0;
    $('quiz-summary').textContent = '英語に合う日本語を選んでください。訳が1種類だけの場合は答えを見て自己採点します。';
    $('quiz-session').hidden = false;
    renderQuestion();
    updateControls();
  });
  $('next-question').addEventListener('click', () => {
    if (!locked || saving) return;
    if (++index >= questions.length) finish();
    else renderQuestion();
  });
  $('finish-quiz').addEventListener('click', finish);
  $('reveal-answer').addEventListener('click', () => {
    if (!questions.length || locked) return;
    $('quiz-feedback').textContent = questions[index].card.ja;
    showContext(questions[index].card);
    $('reveal-answer').hidden = true;
    $('self-rate').hidden = false;
  });
  $('remembered').addEventListener('click', () => void answer(true));
  $('forgotten').addEventListener('click', () => void answer(false));
  $('library-search').addEventListener('input', () => { pageSize = 50; drawLibrary(); });
  $('library-kind').addEventListener('change', () => { pageSize = 50; drawLibrary(); });
  $('mistakes-only').addEventListener('change', updateControls);
  $('library-more').addEventListener('click', () => { pageSize += 50; drawLibrary(); });
  $('export-vocabulary').addEventListener('click', () => {
    const words = filtered();
    if (!words.length) return;
    let url;
    try {
      const format = $('export-format').value;
      const ext = format === 'anki' ? 'tsv' : format;
      const type = { csv: 'text/csv', json: 'application/json', anki: 'text/tab-separated-values' }[format];
      const data = core.exportVocabulary(words, progress, format);
      url = URL.createObjectURL(new Blob([data], { type: `${type};charset=utf-8` }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `video-hover-translate-${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.append(link);
      link.click();
      link.remove();
      $('export-status').textContent = `${words.length}語を書き出しました。`;
    } catch {
      $('export-status').textContent = '書き出しに失敗しました。もう一度お試しください。';
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.lookups || changes[PROGRESS_KEY])) void load();
  });
  document.addEventListener('vht:study-open', () => void load());
  void load();
})();
