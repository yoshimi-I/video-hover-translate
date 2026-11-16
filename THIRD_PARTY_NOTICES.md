# Third-party notices

The root MIT license applies to project code. The following dependencies and datasets retain their own terms; they are not relicensed under MIT.

## Vocabulary levels (`data/vocab-levels.js`)

The level lookup was separated without changing its entries from the original distribution. It is an adaptation: headwords are lowercased, parts of speech are removed, and each headword has one CEFR level.

- **A1–B2**: The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies, Tono Laboratory. Copyright belongs to Tono Laboratory at TUFS. Source: [CEFR-J](https://www.cefr-j.org/download.html), distributed via [Open Language Profiles](https://github.com/openlanguageprofiles/olp-en-cefrj). The upstream terms allow research and commercial use at no charge with proper citation. The original distribution's download date is not known; do not represent this as version 1.6.
- **C1–C2**: Octanove Vocabulary Profile C1/C2 Version 1.0, created by Octanove Labs. Source: [Open Language Profiles](https://github.com/openlanguageprofiles/olp-en-cefrj). Licensed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/). The C1–C2 adaptation is distributed under the same license. See [full terms](licenses/CC-BY-SA-4.0.txt).

These approximate word levels are not language proficiency assessments. Neither the original dataset providers nor this project guarantee their accuracy.

## Zod (bundled in `sw.js`)

Copyright (c) 2025 Colin McDonnell. MIT License.

[Upstream](https://github.com/colinhacks/zod) · [Full notice](licenses/Zod-MIT.txt)

The original bundle includes Zod v4; its exact original package version was not supplied.

## Lucide (bundled in `sidepanel.js`)

The original bundle identifies Lucide v1.59.0 and the ISC license. Copyright Lucide Icons and Contributors. Some icons derive from Feather, Copyright (c) 2013-present Cole Bemis, MIT License.

[Upstream](https://github.com/lucide-icons/lucide) · [Full ISC and Feather notices](licenses/Lucide-ISC.txt)

## Development dependency

Playwright is used only for tests and is not included in the extension archive. It retains its Apache-2.0 license.
