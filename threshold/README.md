# Threshold Log

Step two of the system, after the [Food Trial Log](../gut/). You report meals with portions and effects with times; the app counts, and shows what you ate for the meals or days an effect was reported for, beside all the others: fat, carbs, lactose, fibre, alcohol, caffeine and the compounds the food carried. It reports. It doesn't interpret, recommend or warn.

- **The page:** https://v3ktor.org/threshold/
- **The app:** https://v3ktor.org/threshold/app/ (installs on a phone, works offline, English and French in one file)

## What's here

| File | What it is |
|---|---|
| `index.html` | the web page, both languages |
| `img/` | the page's pictures, from a made-up person's six weeks |
| `app/index.html` | the whole app: styles, food table, reading rules and screens in one file. No build step. |
| `app/sw.js`, `app/manifest.webmanifest`, `app/icons/` | the offline copy, the install file and the icons |

Inside `app/index.html`, the food table sits between `/* DATA:START */` and `/* DATA:END */`, and the reading rules between `/* ENGINE:START */` and `/* ENGINE:END */`. The tests read both straight out of the file.

After any change to `app/index.html`, run `node tools/stamp_cache.js` so the offline copy gets a new name and phones fetch the new file.

## Where the numbers come from

- **Names, servings, groups, vitamins and minerals:** the Food Trial Log's table (205 foods), itself from The Patch. The Threshold Log adds three entries of its own, from Health Canada's file: water ("Water, municipal"), plain sparkling water and flavoured sparkling water (both "Water, mineral, carbonated, bottled"). Sparkling water's minerals carry no figure, because a mineral water and carbonated tap water differ many times over.
- **Energy, protein, fat, carbohydrate, sugars, fibre, alcohol:** Health Canada's Canadian Nutrient File, 2015, per serving, for the 186 foods that carry its FoodID. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). Fourteen foods come from a label or a typical value; their sugars are "not listed".
- **Lactose:** The Patch's table.
- **Histamine, estimated:** the serving's weight times the average for its food type in Table 10 of EFSA Journal 2011;9(10):2393 (EFSA Panel on Biological Hazards, *Scientific Opinion on risk based control of biogenic amine formation in fermented foods*). An average by food type, not a measurement of any food. Four histamine foods fit no category and carry no figure.
- **Caffeine, theobromine:** Health Canada's Canadian Nutrient File, 2015, per serving. Branded cans carry the figure on their label, as The Patch's table has it. A caffeine pill has no figure.
- **Nitrate, estimated:** the serving's weight times the median for the vegetable in EFSA Journal 2008;689, Tables 2 to 10.
- **Counted in portions, with no figure per serving:** tyramine (the histamine foods), oxalates (the Harvard oxalate list's foods at 30 mg a serving or more, as reprinted by The Kidney Dietitian, 2020), potato glycoalkaloids (EFSA Journal 2020;18(8):6222), capsaicin, fructans, galacto-oligosaccharides, sorbitol, mannitol and excess fructose (Monash University's list of where FODMAPs are found), sulphites (Health Canada's list of foods that often contain them), added nitrites (cured meats), sweeteners and gluten (the Food Trial Log's own tags), purines (beef liver, chicken liver and sardines: the foods at 200 mg per 100 g or more in Kaneko et al., Biol. Pharm. Bull. 2014;37(5):709), and flavourings (tagged by the kind of drink, not from a label: colas, energy drinks, the ready-to-drink protein shake and flavoured sparkling water; Health Canada's file has no ingredient lists, so other foods that can list a flavour are not tagged). `tools/threshold/add_compounds.py` holds each list.
- **What a flavouring can hold** (the Flavourings sheet): Food and Drug Regulations, section B.01.009(2) and (3): a label may name a flavouring preparation without its components, and salt, glutamic acid or its salts, hydrolyzed plant protein, aspartame, potassium chloride and any component that has an effect on the food are still shown. Health Canada, List of Permitted Solvents, as modified on 2025-10-20, for the carrier solvents permitted in flavours. Canadian Food Inspection Agency, *List of ingredients and allergens on food labels*, for what is still declared inside a flavouring: priority allergens, gluten sources and added sulphites at 10 parts per million or more. The sheet says what a flavouring can hold and nothing about what any of it does.
- **A food added from its label** carries what the person ticks on its form: a flavour, a sweetener, sulphites, nitrites.
- **Left out:** phenethylamine, salicylates, lectins and phytates. No source read for this version gives them food by food.
- **Reference amounts:** Health Canada's Dietary Reference Intakes, shown for comparison only.

Nothing is guessed: a value with no source stays "not listed" or "no figure", and a meal that holds one stays out of the line it would have fed.

To rebuild the table (Health Canada's CSV files are not in this repository; the download address is at the top of `build_data.py`):

```
node tools/threshold/dump_tables.js . tables.json
python3 -I tools/threshold/build_data.py tables.json <folder with Health Canada's CSV files> data.json
python3 -I tools/threshold/add_compounds.py data.json <folder with Health Canada's CSV files> tables.json
node tools/threshold/pack_data.js data.json --write
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
