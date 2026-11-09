# Sollum

**Fulcrum — the pivot.** One of the three parts of V3KTOR // Mapping the Self:
- **Corpus** (The Patch): the body.
- **Fulcrum** (Sollum): the pivot.
- **Mentis** (V3KTOR™): the mind.

Sollum asks you to pick between pairs of words, a quarter-second apart, and keeps the order your choices make. On an ordinary day you get your normal. On a short-sleep, four-coffee, no-meal, three-beer day it shows whether "Tomorrow" still beats "Right now", and which links in the chain came before.

- **The page:** https://v3ktor.org/sollum/ (what it does and what it's based on)
- **The app:** https://v3ktor.org/sollum/app/ (it installs on a phone and works offline)
- **Free, private, bilingual (English and French).** No account, no ads, no server.
  - Everything stays in the phone's browser storage.
  - Nothing is sent unless you write something in "Improve the app" and send it yourself.

## What it does
- **Test:** twin duels between words, plus one-shot duels on the habit you want to stop. The order, the hesitations and the flips are compared only against your own ordinary days.
- **Report an incident:** what happened, and when. On the same phone, The Patch's day summary fills in the hours before (sleep, caffeine, sugar, meals, drinks).
- **Your pattern:**
  - the vicious circle;
  - a scale that shows why reasons stop weighing anything near the pivot;
  - your own chain once you have one.
- **The message card:** your words from a good day, and who to call, shown when the readings say you're sliding.
  - Help lines for every province and territory, checked 8 Nov 2026.

Not a diagnosis, and not medical advice. It shows a pattern in your own choices; what you do with it is yours.

## How it's built
- **`sollum/app/index.html` is the whole app.** HTML, CSS, JavaScript and the word list are in one file, with no build step.
- **Install files:** `app/manifest.webmanifest`, `app/sw.js` (offline cache) and `app/icons/` make it installable.
- **`sollum/index.html`** is the website page; `img/` holds its screenshots.
- **`sollum/sw.js`** only cleans up after the app's first address (`/sollum/`, 8 Nov 2026): it clears that offline copy and removes itself.
- **Data:**
  - It reads The Patch's day summary from the shared `v3k.days.v1` table in this browser, only when both apps run on the same site.
  - It writes its own fields under `sollum` in that same table and nothing else.

## License
Copyright (C) 2026 Tobie David. Free software under the [GNU Affero General Public License](../LICENSE), version 3 or (at your option) any later version.

There are two extra terms under section 7 (full wording at the top of `app/index.html`):
- Every copy keeps this line in its About screen: "Made by Tobie and Claude. Free version at v3ktor.org/sollum."
- A changed version can't be presented as the original Sollum, and it has to say who changed it and when, next to that line: "Changed by [name] on [date]. Not checked by the original authors."
