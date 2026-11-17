# The food table

`foods.csv` is the one list of foods for The Patch, the Food Trial Log (English and French) and the Threshold Log, with every figure each of them uses. Open it in any spreadsheet, change it, save it as CSV (UTF-8), then run:

    node tools/foods/pack.js --write          # writes the table into The Patch and the Food Trial Log
    node tools/threshold/build.js --write     # builds the Threshold Log with it
    node tools/stamp_cache.js                 # so phones pick up the new version

`node tools/foods/pack.js` alone checks that every app holds what the CSV says, and stops on a broken row (a missing number, an unknown group). The test run (`node tests/run.js`) does the same check. The Threshold Log reads it when it is built, and `node tools/threshold/build.js` alone checks that it holds the current table.

One row per food. Amounts are **per serving**, as Health Canada's Canadian Nutrient File (2015) gives them for the serving's weight, with blanks filled from the USDA's SR28 where `fill` says so.

| Column | What it holds |
|---|---|
| `id` | Health Canada's food number; 9xxxxx for foods made here (merged foods, supplements, label foods). Never reuse an id: people's logs point at it. |
| `group` | dairy, meat, grain, proc, drink, energy, alc, fruit, veg, sea, sup |
| `grams` | the serving's weight (0 for a pill or a label food) |
| `name_en`, `name_fr`, `serving_en`, `serving_fr` | as The Patch shows them |
| `in_patch`, `in_ftl`, `in_threshold` | 1 if the app carries the food, 0 if not |
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
| `no_figure` | the Threshold Log: what the food holds with no figure (a meal with it sits out of that row), separated by spaces |
| `carb`, `sug`, `alc` | carbohydrate, sugars (blank: the kinds aren't listed) and alcohol, in g |
| `theo`, `nit`, `tyr`, `ox`, `pur` | theobromine, nitrate (estimated), tyramine (estimated), oxalate and purines, in mg |
| `sat`, `mono`, `poly` | saturated, monounsaturated and polyunsaturated fat, in g |
| `frs`, `gluc`, `sucr`, `malt`, `gal`, `fruc` | fructose, glucose, sucrose, maltose, galactose, and excess fructose (fructose beyond glucose), in g |
| `sorb`, `mann` | sorbitol and mannitol, in g |
| `portions` | what the food is counted as a portion of, where no figure is entered: ga (potato glycoalkaloids), cap (capsaicin), fru (fructans), gos (galacto-oligosaccharides), sulph (sulphites), nitr (added nitrites), swt (sweeteners), flav (flavourings), glu (gluten) |
| `hist`, `hist_type` | the histamine estimate, in mg, and the food type it comes from (EFSA 2011, Table 10: beer, wine_red, wine_white, fish, sausage, ripened_meat, meat, cheese, hard_cheese, dairy_other, sauce_other, veg_fermented). Tyramine uses the same types, Table 11. |
| `src` | the Threshold Log: hc (Health Canada's file), label (a label or a typical value), none (a pill: nothing counted) |

Every amount is for the serving: a row whose grams change needs every amount changed with them.

## Where the figures come from

- **Names, servings, groups, vitamins and minerals:** The Patch's table: Health Canada's file per serving, blanks filled from the USDA's SR28 where `fill` says so. The Threshold Log adds three rows of its own, from Health Canada's file: water ("Water, municipal"), plain sparkling water and flavoured sparkling water (both "Water, mineral, carbonated, bottled"). Sparkling water's minerals carry no figure, because a mineral water and carbonated tap water differ many times over.
- **Energy, protein, fat, carbohydrate, sugars, fibre, alcohol:** Health Canada's Canadian Nutrient File, 2015, per serving, unrounded, for the 186 foods that carry its FoodID. Chicken, lean beef and oily fish (the Food Trial Log's merged foods): the average of the foods merged, per 100 g. Coconut oil and egg white: straight from Health Canada's file, every vitamin and mineral included. Contains information licensed under the [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada). Fourteen foods come from a label or a typical value; their sugars are "not listed".
- **Lactose:** The Patch's figure, never more than the food's carbohydrate less fibre (milk: 12.38 g a cup, its carbohydrate); a food's sugars are at least its lactose.
- **Histamine, estimated:** the serving's weight times the average for its food type in Table 10 of EFSA Journal 2011;9(10):2393 (EFSA Panel on Biological Hazards, *Scientific Opinion on risk based control of biogenic amine formation in fermented foods*). An average by food type, not a measurement of any food. Four histamine foods fit no category and carry no figure.
- **Caffeine, theobromine:** Health Canada's Canadian Nutrient File, 2015, per serving. Coffee and tea: Health Canada's [Caffeine in Foods](https://www.canada.ca/en/health-canada/services/food-nutrition/food-safety/food-additives/caffeine-foods.html) page, per 237 ml, times 250/237 for the 250 ml mug: brewed coffee 135 mg (142), instant 76 to 106 mg (the middle, 96), instant decaf 5 mg (5), tea 30 to 50 mg (the middle, 42). Branded cans carry the figure on their label. A caffeine pill has no figure.
- **Nitrate, estimated:** the serving's weight times the median for the vegetable in EFSA Journal 2008;689, Tables 2 to 10.
- **The kinds of fat and sugar, sodium, excess fructose:** Health Canada's file, per serving: saturated, monounsaturated and polyunsaturated fat; fructose, glucose, sucrose, maltose and galactose (lactose stays The Patch's); sodium; excess fructose is fructose minus glucose, where fructose is the larger. Below half a gram of fat, or below 2 g of sugars whose kinds aren't listed, a blank kind counts as none; above that the food has no figure and a meal holding it sits out of that row, as a meal with a caffeine pill sits out of caffeine. Trans fat is left out: Health Canada gives it for 88 of the 186 foods. A label food's sodium is The Patch's figure; sparkling water's sodium has no figure, like its other minerals. **Selenium:** the table's own figure, the one the Nutrition tab shows.
- **Sorbitol, mannitol:** measured, grams per 100 g, times the serving's weight: Muir et al., J Agric Food Chem 2009;57:554, and Yao et al., J Hum Nutr Diet 2014;27 Suppl 2:263, as listed in Liljebo et al., BMC Nutrition 2020;6:47, Additional file 1 (CC BY 4.0); Chumpitazi et al., J Pediatr 2018;199:252, Table 1, where not detected counts as none. Avocado and bell peppers have no figure for either: the source gives their polyols together.
- **Tyramine, estimated:** the serving's weight times the average for its food type in Table 11 of the same EFSA opinion, with the same food types as histamine.
- **Oxalate:** measured, mg per household serving, in the Harvard oxalate list, Kidney Stone Diet (Jill Harris), version 2.3.1: its 2023 revised list where it names the food, else the original list in the same file. The list's serving is brought to the app's by weight: an ounce is 28.35 g; a US cup, fluid ounce or tablespoon is weighed with Health Canada's own measure of the same food; "one", "a slice" or "1 tbsp" counts as the app's own unit. 38 foods the list doesn't name have no figure, and a meal with one sits out of the row (instant coffee: the list has instant decaf only; almond, cashew or oat milk: the list's almond milk and its other plant milks differ a hundredfold; watermelon: its slice has no weight).
- **Purines:** measured, mg per 100 g, times the serving's weight, in the USDA and ODS-NIH Database for the Purine Content of Foods, 2023: the total of the four purine bases. Table 1 (North American samples) where it has the food, else Table 2; beer, wine and whiskey from Table 3, mg per 100 ml, where the regular beer's blank total is its four bases added up. Two rows for one food: their mean. The raw figure where the database has no cooked one; bacon is counted on its raw weight. Peanut butter takes the peanut figure and tahini the sesame figure. 99 foods the database doesn't name have no figure, coffee, tea, colas and most fruit among them.
- **Water, sugar and oils** (water, sparkling water, sugar, coconut oil, fish oil) count as no oxalate and no purines where the source has no row for them: the list gives water and sugar as 0, the database gives butter as not detected, and none of the five holds plant or animal cells.
- **Counted in portions, with no figure per serving:** potato glycoalkaloids (EFSA Journal 2020;18(8):6222), capsaicin, fructans and galacto-oligosaccharides (Monash University's list of where FODMAPs are found; green peas from Biesiekierski et al. 2011 via Liljebo et al. 2020), sulphites (Health Canada's list of foods that often contain them), added nitrites (cured meats), sweeteners and gluten (the Food Trial Log's own tags), and flavourings (tagged by the kind of drink, not from a label: colas, energy drinks, the ready-to-drink protein shake and flavoured sparkling water; Health Canada's file has no ingredient lists, so other foods that can list a flavour are not tagged). The `portions` column holds each list.

`tools/foods/history/` holds the scripts that first worked these figures out, in November 2026, from Health Canada's files and the lists above. They read the apps' tables as they were then and aren't part of any build; `add_compounds.py` is the record of which source row each oxalate and purine figure came from, food by food.

