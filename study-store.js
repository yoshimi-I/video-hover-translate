/* SPDX-License-Identifier: MIT */
(function (root) {
  'use strict';
  const core = typeof module !== 'undefined' && module.exports ? require('./study-core.js') : root.VHTStudy;
  class StudyReviewStore {
    constructor(storage, now = Date.now) {
      this.storage = storage;
      this.now = now;
      this.queue = Promise.resolve();
    }
    record(key, correct) {
      if (typeof key !== 'string' || !/^[wps]:.+/.test(key) || key.length > 1000 || typeof correct !== 'boolean') {
        return Promise.reject(new Error('Invalid study answer'));
      }
      const run = this.queue.then(async () => {
        const saved = await this.storage.get('study-progress-v1');
        const value = saved['study-progress-v1'];
        const progress = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const next = core.recordAnswer(progress, key, correct, this.now());
        await this.storage.set({ 'study-progress-v1': next });
        return next[key];
      });
      this.queue = run.catch(() => {});
      return run;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = StudyReviewStore;
  else root.VHTReviewStore = StudyReviewStore;
})(globalThis);
