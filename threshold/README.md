# Threshold Log

Step two of the system, after the [Food Trial Log](../gut/). You report meals with portions and effects with times; the app counts, and shows what you reported after each amount of fat, complex carbs, sugars, lactose, fibre and histamine. It reports. It doesn't interpret, recommend or warn.

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
- **Reference amounts:** Health Canada's Dietary Reference Intakes, shown for comparison only.

Nothing is guessed: a value with no source stays "not listed" or "no figure", and a meal that holds one stays out of the bar it would have fed.

To rebuild the table (Health Canada's CSV files are not in this repository; the download address is at the top of `build_data.py`):

```
node tools/threshold/dump_tables.js . tables.json
python3 -I tools/threshold/build_data.py tables.json <folder with Health Canada's CSV files> data.json
node tools/threshold/pack_data.js data.json --write
node tools/stamp_cache.js
```

`tools/threshold/make_icons.js` draws the icons.

## Tests

`node tests/run.js`. See [tests/README.md](../tests/README.md). Not tested: a real iPhone.

## License

Copyright (C) 2026 Tobie David. GNU Affero General Public License, version 3 or later, with the same two extra terms as the other apps here (the full wording is at the top of `app/index.html`). Every copy keeps this line in its About screen: "Made by Tobie and Claude. Free version at v3ktor.org/threshold."
