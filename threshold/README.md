# Threshold Log

Step two of the system, after the [Food Trial Log](../gut/). You report meals with portions and effects with times; the app counts, and shows what you ate for the meals or days an effect was reported for, beside all the others: fat, carbs, lactose, fibre, alcohol, caffeine and the compounds the food carried. It reports. It doesn't interpret, recommend or warn.

- **The page:** https://v3ktor.org/threshold/
- **The app:** https://v3ktor.org/threshold/app/ (installs on a phone, works offline, English and French in one file)

## What's here

| File | What it is |
|---|---|
| `index.html` | the web page, both languages |
| `img/` | the page's pictures, from a made-up person's six weeks |
| `app/index.html` | the whole app: styles, food table, reading rules and screens in one file, built from `tools/threshold/src/` |
| `app/sw.js`, `app/manifest.webmanifest`, `app/icons/` | the offline copy, the install file and the icons |

## The source, and building the app

The app ships as one file, but it is written in parts, in `tools/threshold/src/`:

| Part | What it is |
|---|---|
| `shell_head.html`, `style.css`, `shell_mid.html`, `shell_tail.html` | the page around the app, and its styles |
| `engine.js` | the reading rules: no screen, no storage; the tests run it on plain Node |
| `app_a.js`, `app_b.js`, `app_c.js` | the screens |

`node tools/threshold/build.js --write` puts them together into `app/index.html`, with the food table from `data/foods.csv` and the shared Nutrition pieces from `shared/`. Run alone, it checks that `app/index.html` is exactly what the parts build; the test run does the same, so a change made only in the built file fails. Inside `app/index.html`, the food table sits between `/* DATA:START */` and `/* DATA:END */`, and the reading rules between `/* ENGINE:START */` and `/* ENGINE:END */`. The tests read both straight out of the file.

After building, run `node tools/stamp_cache.js` so the offline copy gets a new name and phones fetch the new file.

The page's pictures: `node tools/threshold/pictures.js <folder>` takes them from the made-up people in `tests/fixtures/threshold-varied.json` and `threshold-steady.json`, and `python3 tools/threshold/pictures_webp.py <folder>` puts the ones that changed into `img/` (it needs Pillow).

## Where the numbers come from

Every food figure is in `data/foods.csv`, the food file the three apps share (since 0.5.2 the Threshold Log reads it too, when it is built). `data/README.md` says what each column holds and where each figure comes from: Health Canada's Canadian Nutrient File, the EFSA estimates, the measured polyols, the Harvard oxalate list, the USDA purine database, and the lists counted in portions.

- **What a flavouring can hold** (the Flavourings sheet): Food and Drug Regulations, section B.01.009(2) and (3): a label may name a flavouring preparation without its components, and salt, glutamic acid or its salts, hydrolyzed plant protein, aspartame, potassium chloride and any component that has an effect on the food are still shown. Health Canada, List of Permitted Solvents, as modified on 2025-10-20, for the carrier solvents permitted in flavours. Canadian Food Inspection Agency, *List of ingredients and allergens on food labels*, for what is still declared inside a flavouring: priority allergens, gluten sources and added sulphites at 10 parts per million or more. The sheet says what a flavouring can hold and nothing about what any of it does.
- **A food added from its label** carries what the person ticks on its form: a flavour, a sweetener, sulphites, nitrites.
- **Left out:** phenethylamine, salicylates, lectins and phytates. No source read for this version gives them food by food.
- **Reference amounts:** Health Canada's Dietary Reference Intakes, shown for comparison only. Since 0.5.2 they come from `shared/nutrition.js`, the same rules as The Patch and the Food Trial Log: by sex and age, the pregnancy and lactation columns, iron and zinc for a vegetarian or vegan diet, vitamin C for smoking, protein at 0.8 g per kg when a weight is given (the RDA without one). The line above the table says what they're worked out from; its wrench changes it. The answers are shared with the other v3ktor.org apps on the phone (`v3k.profile.v1`): the newer answer wins, and what this app doesn't ask (the kind of day, drinking most days) is kept as another app gave it.

Nothing is guessed: a value with no source stays "not listed" or "no figure", and a meal that holds one stays out of the line it would have fed.

To change a food: edit its row in `data/foods.csv`, then

```
node tools/foods/pack.js --write      # The Patch and the Food Trial Log
node tools/threshold/build.js --write # the Threshold Log
node tools/stamp_cache.js
```

`tools/threshold/make_icons.js` draws the icons: a plain glass, filled below a mark. It is a threshold drawn as a level and a line, with nothing shown crossing it. (Until November 2026 the icon was the app's old bar, five steps turning dark at the fourth, which the app no longer draws.)

## The hours after a meal, and luck

"After a meal" reads a meal beside the effects reported in the hours after it. The person sets how many with a slider, from 1 to 8; it starts at 4. The app gives no time for any food or compound to act.

Windows can overlap. With the slider at 8, an effect at 2 p.m. counts for a 7 a.m. meal and for a noon meal. Nothing picks one of them.

The app puts no number on luck. Version 0.2 gave Fisher's exact test for one tapped amount, which misleads a person who looks at a hundred amounts. Version 0.3.0 counted them all by dealing whole days again, which was unfair to a person who tests one thing at a time and blind to anything that repeats every day. Since 0.3.1 an opened line gives its counts on both sides and one fixed statement, the same for everyone: what leaves luck more room (few entries, several things eaten together, meals closer together than the hours set) and what leaves it less.

## The Threshold tab

Since 0.3.7 the tab holds the lists and two buttons. **Filter** picks the effects the lists are read for; the picks are kept. **Settings** holds the reading ("After a meal" or "Over a day") and, for "After a meal", the slider.

Since 0.4.0 each line is a row of dots. Every counted meal (or day) is one dot, placed by how much it held: filled if the picked effects were reported for it, empty if not. Meals with the same amount stand one over the other. The lists of shares ("67%, 31 of 46") said only whether a meal held any of a thing; the amount was a tap away, one line at a time. Nothing is averaged.

A row appears only when a counted meal or day held some of it (since 0.4.1 this holds for fat, carbs, sugars, lactose and fibre too): a person who has no dairy sees no lactose row. When no counted meal held anything, one line says so.

**The mark.** A row gets a mark at the amount that leaves the fewest meals on the wrong side of it: a meal with the effect under the mark, or one without it at the mark or over. The mark is one of the amounts the person ate, never the lowest, and the lowest such amount when several do as well. It is kept only when it leaves fewer on the wrong side than the smaller of the two sides holds, since a mark at either end separates nothing. Since 0.4.8 a mark is read both ways: the meals with the effect from the mark up ("From 8.4 g up: 17 of 46 with"), or under it, for an effect that comes with less of a thing ("Under 80 mg: 4 of 4 with. From 80 mg up: 3 of 4 without."). Every amount is tried both ways and the reading with the fewest on the wrong side is kept. The sentence under the row gives the counts: "From 8.4 g up: 17 of 46 with. Under 8.4 g: 104 of 110 without." `E.split` in the engine does the count; `tests/threshold/oracle.js` recounts it.

**The order.** The rows with a mark come first, by the share of their meals on the wrong side of it; the rows with none follow in their fixed order, under a heading that says no amount separates them. This holds from the first meal on: with three meals almost every row has a mark, and the order settles as meals are added. Earlier versions ranked nothing; the order is by a count the person can check on the row, and the app still says nothing about what a row means.

**The view.** Since 0.4.2, "Rows shown" under Settings sets how many rows the tab draws. **Full** (the default) draws every row. **Medium** draws the rows with a mark. **Minimal** draws only the rows with a clear mark: more than half of the meals with the effect at the mark or over, and more than half of the others under it (`E.clear`). Under the rows, one line counts what the view leaves out and links to Settings. The choice is kept (`tview` in the saved data).

**When nothing is clear.** Since 0.4.3, when meals sit on both sides and no row has a clear mark, the tab says the whole log can be copied for an AI, with a button that opens Ask AI on "Everything". The app still writes no question and sends nothing.

**What Ask AI copies.** Since 0.4.10 the copied text carries what the tab counts: each meal's other compounds ("Compounds: tyramine 1 portion, gluten 2 portions"), a tally for every row the person had some of, and the marks in the tab's own sentences, for any effect and for each effect reported, after a meal and over a day. Before, the 18 compounds beyond histamine, alcohol and caffeine never reached the copy. The app still writes no question.

**A long log.** Since 0.4.11 each lane of a row is one shape, with a circle for each entry and at most eight for entries that share an amount (past that they cover one another). A year of entries used to be about 32,000 elements; it is now two a row. The mark is found in one pass over the entries in the order of their amounts, what was reported after each meal is worked out once for all rows, and the tab reads its rows once. On a processor slowed four times, a year of made-up entries (the same six weeks, nine times over) redraws in about a quarter of a second, down from about one second. When a redraw was slow on this phone and the log is long, the next one waits a frame and shows "Counting…" first, since the page cannot draw while it counts.

**One name.** Since 0.4.12 the app calls the things the tab draws "rows" everywhere on screen (door, Home, Filter, Help, sheets), where it had said "lists" and "lines" as well. Help's section on the tab is seven short paragraphs. This file and the code comments still use "line" for a row in places.

**The description.** Since 0.4.15 the first screen says what the app does in compounds and amounts: it tracks every compound in every meal and shows, for each, the amounts that came before an effect beside the amounts that didn't (English reworded in 0.4.16 after a second reader). It names no compound ahead of the others, says the app doesn't judge, and takes its count of compounds from the engine's rows. What a threshold is (a bucket for each compound; near zero, a little higher, higher still; foods that look unrelated in the same bucket) and what the rows don't count (fight or flight, and the stomach's volume, gas and temperature) are on the app's page, `index.html`, with their sources, each read in November 2026. They are not in the app; the first screen links to the page. The front page asks the same question the app's page opens on. Tests hold the count on the first screen, the app's page and the front page to the engine's number.

**Tu and vous.** Since 0.4.17 the app's page says « vous », as the front page does: public pages say « vous », the app says « tu » because it is a private place. The French of both pages is a second reader's (Argon), kept as written except where a test or a rule holds the words: the five statements (the app's, in the first person), the attribution line, the labels on screen (Seuil, Inconfort au ventre, Douleur aux articulations, Peu d'énergie, relevé, Qu'on me laisse tranquille) and the no-break space before « : ». A test checks the page for a stray « tu ».

**The kinds, and the mark in your own foods.** Since 0.5.0 the tab can have 35 rows: the kinds of fat and of sugar sit under their row (`E.KIDS`, `E.grouped`): a group stands where its best row would, and a kind is indented only when its row is in the same list just above it. Under a mark in grams or milligrams, the line `.dfd` gives the same amount in the person's own foods: for the two foods that held it on the most meals or days, about how many servings come to it (between ¼ and 30, to the half under 2). Amounts closer than a thousandth of a row's highest (to a power of ten) count as one amount (`E.snap`), so no mark falls between two amounts the picture can't tell apart. The kinds and the minerals are rows, not compounds: they don't count toward "5 compounds or more" and aren't in the copied text's list of compounds per meal.

**How to read it.** The first time the tab is opened, a card at its top shows two made-up rows (one an amount separates, one it doesn't), says what the dots are, and ends with "The more meals you report, the more accurate it gets." It stays until "Got it" is tapped (`seenThr` in the saved data); "How to read this tab", under the rows, brings it back. Since 0.4.6 the paragraph under the heading is one line once the card is closed ("Each dot is a meal: the further right, the more it had."); while the card is up it also says where the mark stands and which rows come first.

"Eaten together" is still a small table of shares and counts, and an opened line still lists every amount with how many sat on each side. Since 0.4.9 an opened row names the foods it came from at once, above the amounts: every food the person ate that held it, with how many of the counted meals (or days) it was in, the most frequent first, eight shown and a link for the rest. Each opens that food. Tapping an amount still gives the foods of that amount alone. Since 0.4.7 their two columns are headed "With effect" and "Without", each with how many meals or days it holds: "With" alone, beside a food's name, read as "with that food".

**Over a day, and the day after.** A day is read with the next day's effects. Since 0.4.5, when nothing at all is reported for the next day (no effect, no tap on "No effects today"), a day with none of the picked effects is not settled, so it waits, as a meal whose hours are not over does. A day that already has the picked effects is counted. The tab says how many days wait for that reason. "One food" follows the same rule.

An effect read alone keeps its own hours. Any effect, or several together, use the general hours. An effect opened from Home is read with the same hours the lists use for it.

"Eaten together" has a third line: the meals or days that held 5 compounds or more. Alcohol, caffeine, histamine food and each of the other compounds count once. It is there for the person whose trouble follows the load and not one food.

## Home

Since 0.3.4, Home is the two buttons and today's entries, in order. It has no period choice, no ring and no Effects bar. The ring, with alcohol, caffeine and the other compounds under it, is on the Nutrition tab.

Tapping an effect opens the meals reported in the hours before it, the nearest first, each with how long before. The hours are the ones set on the Threshold slider, so the sheet lists exactly the meals the lists set that effect beside. Earlier meals of the same day that fall outside those hours are named, not listed. Poor sleep is counted with the day before, so it opens that day's meals. Nothing on the sheet says what any of it means.

An effect's sheet lists the meals in the hours before it. Since 0.4.4 each of those meals says what it held, of the things the Threshold rows count ("fat 12 g · lactose 5 g · caffeine 80 mg"), so the amounts are in view where the effect was reported.

## Drinks, and flavourings

A drink is entered like a meal. Since 0.3.3 the table carries water, plain sparkling water and flavoured sparkling water as three entries, so a person can report which one it was. Water alone is a meal that holds nothing: it sits on a side of every line with an amount of zero.

"Flavourings" is a line of the "Added" family, counted in portions. Its sheet says what a flavouring is, what it can hold, what a label is allowed to leave out, and that two products listing "natural flavour" can hold different preparations, so what a person reports after one says nothing about another. It is a description of a label, with its sources. The app carries no warning about any drink or ingredient.

The table tags flavourings by the kind of drink, because Health Canada's file has no ingredient lists. Foods in the table that can list a flavour and are not tagged sit on the "Without" side. A food added from its label is tagged when the person ticks "A flavour".

## Tests

`node tests/run.js`. See [tests/README.md](../tests/README.md). Not tested: a real iPhone.

## The how-to is a separate page

`how-soon/index.html` is the how-to: what published sources say about how soon an effect follows eating or drinking, from minutes to weeks, one source a line, in English and French. It is kept out of the app on purpose. The app counts and gives no time for anything to act, so a copy of the app stays an instrument; the page can be read, corrected or left behind without touching it. The app holds no link to that page and none of its sources, and a test checks that.

Each line was read at its source in November 2026: Mayo Clinic (food allergy; reactive hypoglycemia), Cleveland Clinic (gastrocolic reflex; food coma), Harvard Health (lactose intolerance), the International Classification of Headache Disorders, 3rd edition (8.1.4.1, 8.1.4.2, 8.3.1), the Centers for Disease Control and Prevention (alpha-gal syndrome), Monash University (two blog pages on the timing of FODMAP symptoms), Drake et al., J Clin Sleep Med 2013;9(11):1195, and Jacka et al., BMC Medicine 2017;15:23. It is one source a line, not a review of the research.

## License

Copyright (C) 2026 Tobie David. GNU Affero General Public License, version 3 or later, with the same two extra terms as the other apps here (the full wording is at the top of `app/index.html`). Every copy keeps this line in its About screen: "Made by Tobie and Claude. Free version at v3ktor.org/threshold."
