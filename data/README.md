# The food table

`foods.csv` is the one list of foods for The Patch, the Food Trial Log (English and French) and the Threshold Log. Open it in any spreadsheet, change it, save it as CSV (UTF-8), then run:

    node tools/foods/pack.js --write     # writes the table into the apps
    node tools/stamp_cache.js            # so phones pick up the new version

`node tools/foods/pack.js` alone checks that every app holds what the CSV says, and stops on a broken row (a missing number, an unknown group). The test run (`node tests/run.js`) does the same check. The Threshold Log reads its foods from the two apps (`tools/threshold/`), so a change here reaches it on its next data build.

One row per food. Amounts are **per serving**, as Health Canada's Canadian Nutrient File (2015) gives them for the serving's weight, with blanks filled from the USDA's SR28 where `fill` says so.

| Column | What it holds |
|---|---|
| `id` | Health Canada's food number; 9xxxxx for foods made here (merged foods, supplements, label foods). Never reuse an id: people's logs point at it. |
| `group` | dairy, meat, grain, proc, drink, energy, alc, fruit, veg, sea, sup |
| `grams` | the serving's weight (0 for a pill or a label food) |
| `name_en`, `name_fr`, `serving_en`, `serving_fr` | as The Patch shows them |
| `in_patch`, `in_ftl` | 1 if the app carries the food, 0 if not |
| `ftl_name_en` … `ftl_serving_fr` | only where the Food Trial Log words it differently; blank means the same as The Patch (with plain spaces) |
| `ftl_mark` | the Food Trial Log's mark, 0 to 4 |
| `ftl_gut_groups` | the Food Trial Log's gut groups, separated by spaces |
| `tags` | hist (histamine food), glu (gluten), swt (sweetener) |
| `also_groups` | other groups The Patch also lists the food under |
| `label` | 1 when the values come from a product label |
| `kcal` … `ala` | the nutrients: kcal; protein, fat, fibre, lactose in g; `sd` standard drinks; caffeine, sodium, potassium, calcium, iron, magnesium, zinc, copper, manganese in mg; selenium, vitamin A, retinol, folate, B12, vitamin K in µg; vitamin D in IU; B1, B2, B3, B6, C and E in mg; omega-3 (`o3`) and ALA in g. Vitamin E is in mg here and both apps show it in IU (× 1.49). |
| `lack` | nutrients the file has no figure for (shown as ?, counted as 0), separated by spaces |
| `fill` | where a filled-in blank came from, one `nutrient: source` per line |
| `cnf_name` | Health Canada's own name for the food |
