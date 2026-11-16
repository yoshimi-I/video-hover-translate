# Privacy

## Browser storage

- `chrome.storage.local`: selected engine/model, API endpoint and key, translation cache, recent lookup history (up to 2,000 events), quiz progress and due dates (`study-progress-v1`). These are not committed to the repository or included in release archives.
- `chrome.storage.session`: per-tab vocabulary, removed when tabs close or the browser session ends.
- `chrome.storage.sync`: enabled/disabled and pause-on-hover preferences; these preferences may sync through the user's Chrome account.

API keys are stored as local extension settings, not encrypted by this application. Do not use a key that grants broader access than required by the translation backend.

## Network

When translation is enabled, detected subtitle text, its tokens, and up to two nearby subtitle cues are sent to the endpoint and engine configured by the user. The custom API uses `x-api-key`; OpenAI-compatible APIs use a Bearer key when configured. Ollama mode sends no API key and is limited to localhost / 127.0.0.1. A local server may itself use a cloud model; its configuration determines any onward network transmission. Translating a selected span also sends its start/end token indexes. The configured server's privacy policy and retention rules apply.

A subtitle cue is requested when it is detected; requests are not limited to words hovered by the user. Cached translations may avoid a repeated request. The extension does not upload lookup history, quiz scores, or exports as a separate dataset. There is no project telemetry or analytics endpoint.

Quizzes and exports run locally and do not call a translation API. The sample demo uses original examples in memory; demo answers never modify saved history or progress. The explicit connection-test button sends one short sample translation request using saved settings.

## Exports and deletion

Exports contain only selected vocabulary and its review metadata; they exclude API settings and translation caches. CSV/JSON can contain subtitle examples and title names. Share exported files deliberately.

Uninstalling the extension removes its stored data from the profile. Export vocabulary first if you want to retain it. There is no import UI in this version. Chrome profile synchronization, backups, and downloads are managed by Chrome and the operating system.

## Permissions

- `storage`: preferences, caches, history, and quiz progress.
- `unlimitedStorage`: translation cache capacity.
- `sidePanel`: the extension UI.
- Netflix / Disney+ host access: detect captions and show the hover overlay.
- Tokyo-region API Gateway host access: call the user's compatible translation service.

No new permissions are needed for quizzes or file exports.

## Optional host permissions

The manifest declares optional HTTPS host access and optional loopback HTTP access so users can configure their own endpoint. These are not all granted at installation. Saving an endpoint requests access only to its host (Chrome host permissions cover all ports on that host). URLs with embedded credentials, query strings or fragments are rejected. HTTP is restricted to localhost and 127.0.0.1. Translation requests reject redirects to avoid forwarding credentials to another endpoint.

Switching engine changes input defaults and clears keys for other engines; Ollama never forwards a saved cloud key. Translation caches are scoped by engine, endpoint and model. API keys are not part of cache identifiers.
