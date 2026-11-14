# Tests

`node tests/run.js` runs everything. The same command runs on every pull request (`.github/workflows/tests.yml`).

| File | What it checks | Needs |
|---|---|---|
| `threshold/engine.test.js` | One check or more for each of the Threshold Log's reading rules. The rules are read out of the shipped app file, so what is tested is what people open. | Node |
| `gut/repair.test.js` | The Food Trial Log's 13 repair cases, in the English and the French copy. | Node |
| `../tools/stamp_cache.js --check` | Every app's offline cache carries the name of the file it holds. | Node |
| `apps/load.test.js` | Every page and app on the site loads, runs no script error, asks nothing of another site, and every link leads somewhere. | Playwright |
| `gut/one-food.test.js` | In the Food Trial Log, a bad day takes one food off the list, and undoing the report puts it back. | Playwright |
| `threshold/import.test.js` | The Threshold Log's import gives the same lists as the Food Trial Log's own screens, on five saved examples; from the browser, from a backup file, and from an old save. | Playwright |
| `threshold/screens.test.js` | Every screen and sheet of the Threshold Log, in both languages, on a 320-pixel phone: the words it never uses, French punctuation, nothing off screen, the keyboard, offline, the door, a day turning over, unreadable saved data, and the web page. | Playwright |
| `threshold/people.test.js` | Two made-up people use the Threshold Log for six weeks, one tap at a time. At the end every count on screen is checked against `threshold/oracle.js`, an independent recount that shares no code with the app. The bars are checked as pictures too: a column of pixels down each step holds red and green in the share of its entries, red at the bottom. | Playwright |

To run the screen tests on your own machine: `npm install --no-save playwright` and `npx playwright install chromium`, once.

`fixtures/` holds saved Food Trial Log states from made-up people. `lib/png.js` reads a screenshot into its pixels, in plain Node. `threshold/people.js` is the two people; everything they do is decided by a seeded random number, so every run plays the same six weeks.

Not tested here: a real iPhone. Installing, and bringing the Food Trial Log's lists into an installed app by its backup file, were tested in a desktop browser only.
