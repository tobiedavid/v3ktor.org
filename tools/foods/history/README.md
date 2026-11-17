# How the figures in data/foods.csv were first worked out

These scripts made the Threshold Log's figures in November 2026, before they moved into `data/foods.csv`. They are kept as the record of where each figure came from; they aren't part of any build, and running them again would read the apps' tables of that time.

- `dump_tables.js` copied the food tables out of The Patch and the Food Trial Log.
- `build_data.py` added energy, protein, fat, carbohydrate, sugars, fibre and alcohol from Health Canada's Canadian Nutrient File (2015), the histamine estimates (EFSA 2011, Table 10), the merged foods and the Threshold Log's own rows. Health Canada's CSV files are not in this repository; the download address is at the top of the script.
- `add_compounds.py` added the rest: caffeine, theobromine, nitrate, the kinds of fat and sugar, sodium, selenium, sorbitol, mannitol, tyramine, oxalate, purines and the lists counted in portions. Its tables say, food by food, which source row each oxalate and purine figure came from and how the serving was converted.

Since then, figures are changed in `data/foods.csv` itself (`data/README.md`).
