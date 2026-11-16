# Product direction

## What we want people to get from this project

A short path from watching an English subtitle to remembering its vocabulary, with ownership of the resulting data. GitHub stars are a possible response to usefulness and clear communication; they are not a feature or an outcome we can promise.

## Why v0.5 focuses on setup, demo and review

[asbplayer](https://github.com/asbplayer/asbplayer) is a reference for vocabulary mining and Anki workflows. [LST](https://github.com/DarlingGoose/LST) demonstrates the appeal of local and direct-provider subtitle translation. We infer that the main immediate obstacles in this repository were requiring a private custom backend, needing streaming access/keys just to try the UI, and offering random quizzes without a reason to return.

Changes in v0.5 address those concrete obstacles:

1. OpenAI-compatible APIs and loopback Ollama replace the requirement for a project-specific server. Existing custom APIs remain supported.
2. An isolated sample deck lets a visitor try vocabulary, review and exports without a key or video. No sample answers touch personal history.
3. Due dates turn saved words into a repeatable review queue. This is a lightweight fixed schedule, not a claim of Anki/FSRS equivalence.
4. A legible, editable play/speech icon, demo screenshots and an English README make the project easier to recognize and assess.

## Further work to validate

Potential next contributions: a careful JSON import/merge workflow; more UI/translation languages; manually tested provider/model compatibility recipes; accessibility and keyboard navigation; eventually a richer subtitle timeline or AnkiConnect integration. These are ideas, not implemented features. Multi-service expansion should follow real playback fixtures and regression testing rather than a long unsupported compatibility list.

Measure genuine feedback through reproducible issues and contributor discussions. The extension does not add tracking to measure adoption, and it does not prompt users for stars while they are watching.
