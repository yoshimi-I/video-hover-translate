# Contributing

Run `npm ci`, `npm run check`, and `npm test` before submitting a change. See README for installing Playwright Chromium on Linux. Add behavior-focused tests for subtitle/player regressions and study/export changes. Runtime code must work with Chrome Manifest V3 without remote script execution or eval.

Keep changes focused. Describe the user-visible behavior and verification in the pull request. Synthetic player fixtures do not prove compatibility with every current Netflix / Disney+ player; state when a change was also checked during actual playback.

Do not submit API keys, personal endpoints, browsing history, exported vocabulary, full subtitles, or video captures. For diagnostics, share error codes and connection status with personal details removed.

Vocabulary data has its own licensing. Retain all attribution and license notices, and verify provenance before adding a new dataset. Contributions to project code use the repository's MIT license; third-party material retains its own license.
