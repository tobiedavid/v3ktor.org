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

- **Names, servings, groups, vitamins and minerals:** the Food Trial Log's table (205 foods), itself from The Patch.
- **Energy, protein, fat, carbohydrate, sugars, fibre, alcohol:** Health Canada's Canadian Nutrient File, 2015, per serving, for the 183 foods that carry its FoodID. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). Fourteen foods come from a label or a typical value; their sugars are "not listed".
- **Lactose:** The Patch's table.
- **Histamine, estimated:** the serving's weight times the average for its food type in Table 10 of EFSA Journal 2011;9(10):2393 (EFSA Panel on Biological Hazards, *Scientific Opinion on risk based control of biogenic amine formation in fermented foods*). An average by food type, not a measurement of any food. Four histamine foods fit no category and carry no figure.
- **Caffeine, theobromine:** Health Canada's Canadian Nutrient File, 2015, per serving. Branded cans carry the figure on their label, as The Patch's table has it. A caffeine pill has no figure.
- **Nitrate, estimated:** the serving's weight times the median for the vegetable in EFSA Journal 2008;689, Tables 2 to 10.
- **Counted in portions, with no figure per serving:** tyramine (the histamine foods), oxalates (the Harvard oxalate list's foods at 30 mg a serving or more, as reprinted by The Kidney Dietitian, 2020), potato glycoalkaloids (EFSA Journal 2020;18(8):6222), capsaicin, fructans, galacto-oligosaccharides, sorbitol, mannitol and excess fructose (Monash University's list of where FODMAPs are found), sulphites (Health Canada's list of foods that often contain them), added nitrites (cured meats), sweeteners and gluten (the Food Trial Log's own tags), and purines (beef liver, chicken liver and sardines: the foods at 200 mg per 100 g or more in Kaneko et al., Biol. Pharm. Bull. 2014;37(5):709). `tools/threshold/add_compounds.py` holds each list.
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

`tools/threshold/make_icons.js` draws the icons.

## The hours after a meal, and luck

"After a meal" reads a meal beside the effects reported in the hours after it. The person sets how many with a slider, from 1 to 8; it starts at 4. The app gives no time for any food or compound to act.

Windows can overlap. With the slider at 8, an effect at 2 p.m. counts for a 7 a.m. meal and for a noon meal. Nothing picks one of them.

The app puts no number on luck. Version 0.2 gave Fisher's exact test for one tapped amount, which misleads a person who looks at a hundred amounts. Version 0.3.0 counted them all by dealing whole days again, which was unfair to a person who tests one thing at a time and blind to anything that repeats every day. Since 0.3.1 an opened line gives its counts on both sides and one fixed statement, the same for everyone: what leaves luck more room (few entries, several things eaten together, meals closer together than the hours set) and what leaves it less.

## The how-to is a separate page

`how-soon/index.html` is the how-to: what published sources say about how soon an effect follows eating or drinking, from minutes to weeks, one source a line, in English and French. It is kept out of the app on purpose. The app counts and gives no time for anything to act, so a copy of the app stays an instrument; the page can be read, corrected or left behind without touching it. The app holds no link to that page and none of its sources, and a test checks that.

Each line was read at its source in November 2026: Mayo Clinic (food allergy; reactive hypoglycemia), Cleveland Clinic (gastrocolic reflex; food coma), Harvard Health (lactose intolerance), the International Classification of Headache Disorders, 3rd edition (8.1.4.1, 8.1.4.2, 8.3.1), the Centers for Disease Control and Prevention (alpha-gal syndrome), Monash University (two blog pages on the timing of FODMAP symptoms), Drake et al., J Clin Sleep Med 2013;9(11):1195, and Jacka et al., BMC Medicine 2017;15:23. It is one source a line, not a review of the research.

## Tests

`node tests/run.js`. See [tests/README.md](../tests/README.md). Not tested: a real iPhone.

## License

Copyright (C) 2026 Tobie David. GNU Affero General Public License, version 3 or later, with the same two extra terms as the other apps here (the full wording is at the top of `app/index.html`). Every copy keeps this line in its About screen: "Made by Tobie and Claude. Free version at v3ktor.org/threshold."
