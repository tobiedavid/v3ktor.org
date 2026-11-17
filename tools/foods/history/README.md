# How the figures in data/foods.csv were first worked out

These scripts made the Threshold Log's figures in November 2026, before they moved into `data/foods.csv`. They are kept as the record of where each figure came from; they aren't part of any build, and running them again would read the apps' tables of that time.

- `dump_tables.js` copied the food tables out of The Patch and the Food Trial Log.
- `build_data.py` added energy, protein, fat, carbohydrate, sugars, fibre and alcohol from Health Canada's Canadian Nutrient File (2015), the histamine estimates (EFSA 2011, Table 10), the merged foods and the Threshold Log's own rows. Health Canada's CSV files are not in this repository; the download address is at the top of the script.
- `add_compounds.py` added the rest: caffeine, theobromine, nitrate, the kinds of fat and sugar, sodium, selenium, sorbitol, mannitol, tyramine, oxalate, purines and the lists counted in portions. Its tables say, food by food, which source row each oxalate and purine figure came from and how the serving was converted. Its purine table is replaced by `purines_2026.py`.
- `new_foods_2026_11.py` added 31 foods from Health Canada's files, with the same sources.
- `purines_2026.py` worked the purine column out again from release 3 of the USDA and ODS-NIH purine database (September 2026). It reads the database's spreadsheet, given as an argument, and lists the rows each food's figure comes from. Northern pike lost the cod figures it had carried by mistake (purines and oxalate); neither source names pike.
- `oxalate_2026.py` set plain animal foods the Harvard list doesn't name to no oxalate (a rule, with the list's own figures as its grounds) and took watermelon and canned tomatoes from a 2023 review (Salgado and others, Foods 2023;12(17):3201, CC BY 4.0).

Since then, figures are changed in `data/foods.csv` itself (`data/README.md`).
