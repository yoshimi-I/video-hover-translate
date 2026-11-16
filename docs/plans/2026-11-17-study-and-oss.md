# Study features and OSS implementation plan

Goal: Review saved lookup history across videos, export vocabulary, and publish the extension source with accurate licensing and no personal credentials.

Architecture: Keep the existing Chrome extension entry points and storage keys. Add a dependency-free study core and a separate sidepanel study controller. Read existing `lookups` records, aggregate duplicates, and store quiz progress under `study-progress-v1` without changing lookup history.

1. Write failing unit tests for history normalization, deduplication, bounded quizzes, unique distractors, short-history flashcards, answer persistence, and safe CSV/JSON/Anki serialization. Implement `study-core.js` and run `node --test tests/study-core.test.cjs`.
2. Add a sidepanel vocabulary and quiz view, search/type filters, export controls, answer feedback, review of mistakes, and empty states. Write browser tests before implementation; verify saved history works without an active streaming tab and settings navigation preserves the selected view.
3. Retain existing playback checks and run the complete suite, including actual browser download checks. Verify all runtime scripts parse and packaged assets are complete.
4. Prepare README, API contract, privacy and contribution documentation, CI, packaging command, and third-party license notices. Keep the existing backend private; document the compatible API contract without personal endpoints or keys.
5. Confirm ownership of the original code/assets before public publication. Inspect the exact tracked files and release archive for credentials and local user data. Initialize Git and publish a new public repository under the authenticated user's account when rights are confirmed.

Product choices: English-to-Japanese multiple choice, up to four distinct options. Fall back to a self-rated flashcard if only one distinct meaning exists. Quiz decks are fixed per session and contain no repeated card. CSV includes UTF-8 BOM and spreadsheet formula protection; Anki uses two tab-separated fields; JSON exports an explicit vocabulary/progress schema without settings.
