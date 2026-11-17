"""The purine column of data/foods.csv, worked out again from release 3 of the purine database (September 2026). Kept as the record of
where each figure came from; it replaces the purine tables of add_compounds.py and new_foods_2026_11.py, which used release 1 (2023).

    python3 -I tools/foods/history/purines_2026.py <PURINEDATABASEANDDATASOURCES2026.xlsx>            (prints what would change)
    python3 -I tools/foods/history/purines_2026.py <PURINEDATABASEANDDATASOURCES2026.xlsx> --write    (writes data/foods.csv)

Source: USDA and ODS-NIH Database for the Purine Content of Foods, Release 3, September 2026, the total of the four purine bases, mg per
100 g (Tables 1 and 2) or per 100 ml (Table 3), times the serving's weight or volume. The file is not in this repository; the download
address is in data/README.md.

How a food gets its rows:
  1. Table 1 (North American samples) when it has the food, else Table 2. Alcohol from Table 3.
  2. The row's state matches the food's: a cooked row for a cooked food when the table has one, else the raw (unprepared) row, as before.
     Frozen counts as raw. Never a dried row for a cooked or soaked food, and never a canned row for a food boiled from dry (the
     database's own chickpeas differ two-fold between the two).
  3. Several rows for the food in that state: their mean. Release 3 keeps the older published rows next to USDA's own new measurements;
     both count the same.
  4. A food named loosely (no cut, kind or fat level) takes every row of that food; a food named as one kind takes that kind's rows.
     Fat level doesn't make another food: the purines are in the cells, not the fat.
  5. A food made of parts: the parts by the weights this file gives them (an egg is 33 g of white and 17 g of yolk), or, for the
     Threshold Log's merged rows, the mean of the foods merged.
  6. No row: no figure, and a meal with that food sits out of the purine row. Butter, oils, sugar, water and supplements hold no cells: 0.
"""
import csv, io, sys
import openpyxl

XLSX = sys.argv[1]; WRITE = '--write' in sys.argv; OUT = 'data/foods.csv'

# ---------- the database's rows: (table, food description exactly as printed) -> total of the four bases ----------
TOT = {}
wb = openpyxl.load_workbook(XLSX, data_only=True)
for t in (0, 1, 2):
    ws = wb.worksheets[t]; col = None
    for row in ws.iter_rows(values_only=True):
        if col is None:
            col = next((j for j, v in enumerate(row) if isinstance(v, str) and v.strip().startswith('Total')), None); continue
        d = row[0]
        if d is None or all(v is None for v in row[1:]): continue
        key = ('T%d' % (t + 1), str(d).strip())
        v = row[col]
        if not isinstance(v, (int, float)): continue
        TOT.setdefault(key, []).append(float(v))
def rows(*keys):
    vals = []
    for k in keys:
        assert k in TOT, ('no such row', k)
        vals += TOT[k]
    return sum(vals) / len(vals)
T1 = lambda *d: [('T1', x) for x in d]
T2 = lambda *d: [('T2', x) for x in d]

# ---------- food -> mg per 100 g ----------
# A list of rows: their mean. ('parts', [(grams, rows), ...]): the parts added by weight. ('foods', [rows, rows]): the mean of foods.
PUR = {
    # dairy and eggs
    130: ('parts', [(33, T1('Egg, white, boiled')), (17, T1('Egg, yolk, boiled'))]),   # egg, hard-boiled: white and yolk
    501948: T1('Egg, yolk, boiled'), 920110: T1('Egg, white, boiled'),
    61: T1('Milk, 2% fat'), 113: T1('Milk, 2% fat'),                       # milk, 2% and whole (fat level, rule 4)
    502170: T1('Yogurt, plain', 'Yogurt, regular, nonfat, plain'),         # yogurt, plain, 2-3.9% (fat level, rule 4)
    502158: T2('Yogurt (not further specified)'),                          # fruit yogurt: Table 1 has only plain
    25: T1('Cheese, cottage'),
    502213: T1('Cheese, processed (unspecified)', 'Cheese, American'),     # processed cheese slices; American cheese is one
    40: T2('Cheese, grated'),                                              # parmesan
    136: T2('Cream, animal, fresh'),
    # grains, nuts and seeds
    1242: T1('Corn cereal'),
    1439: T1('Oats, plain, whole grain, uncookedᛒ'),                       # dry oats
    4066: T1('Bread, white'), 4063: T1('Bread, crusty (baguette)'),
    4523: T1('Rice, white, cooked'), 4464: T2('Spaghetti'),
    3399: T1('Peanut butter, creamy'),
    3302: T1('Peanuts, raw'),                                              # dry-roasted: the raw row (no roasted one)
    2536: T1('Almonds, whole, raw'), 2546: T1('Cashews, raw'), 2588: T1('Pistachio nuts, raw'),   # dry-roasted: the raw rows
    2590: T1('Walnuts, English, halves, raw'),
    2511: T2('Chia seeds'), 2593: T2('Sesame'),
    3390: T1('Chickpeas (garbanzo beans), cooked'),                        # boiled
    3404: T2('Tofu, raw (nigari)'), 501527: T2('Soy milk'),
    5968: T2('Veggie burgers or soyburgers, unprepared'),
    # meat
    5407: T1('Pork, cured, bacon, cooked⧗'),
    1148: T1('Luncheon meat, ham, ready-to-eat'),
    1859: T1('Luncheon meat, ham, ready-to-eat'),                          # back bacon: cured pork, matched to ham as before
    1154: T1('Beef roast, cooked (unspecified)', 'Beef shoulder roast, choice, boneless, cooked⧗'),   # deli roast beef, cut not named
    920002: T1('Beef roast, cooked (unspecified)'),                        # sirloin or round: the shoulder row is another cut
    2696: T1('Beef, ground, cooked (unspecified)', 'Beef, ground, 73% lean meat / 27% fat, cooked⧗',
             'Beef, ground, 93% lean meat / 7% fat, cooked⧗'),             # ground beef, pan-fried (fat level, rule 4)
    2657: T1('Beef, liver, cooked⧗'),                                      # pan-fried
    2654: T1('Beef heart, raw'), 2655: T1('Beef kidney, cooked'), 2669: T2('Beef tongue, raw'),
    5335: T1('Chicken liver, raw'),                                        # two raw rows, no cooked one
    577: T1('Chicken heart, raw'),
    920001: ('foods', [T1('Chicken breast, roasted', 'Chicken breast, boneless, skinless, cooked⧗'),
                       T1('Chicken thigh, roasted')]),                     # chicken: breast and thigh, roasted
    1787: T1('Pork roast and chops, cooked', 'Pork loin, boneless, skinless, cooked⧗'),   # pork chop: a loin chop
    1816: T1('Pork roast and chops, cooked'),                              # pork shoulder, roasted
    1199: T1('Pork sausage, uncured, link/patty, cooked⧗'),
    691: T1('Turkey, ground, raw'), 816: T1('Turkey, ground, raw'),        # turkey, roasted or ground: the raw ground rows, as before
    4782: T1('Lamb, chops, cooked⧗'),                                      # lamb, cooked, cuts not named
    3572: T1('Bison, ground, raw'),                                        # bison, roasted: the raw row, as for turkey
    1185: T1('Frankfurter, beef, unheated'),                               # beef wiener, as packaged
    5684: T1('Salami, genoa, pork, beef', 'Salami, dry or hard, pork, beef'),
    1159: T2('Pate, liver'),
    # fish and seafood
    3203: T1('Sardine, canned'), 5965: T1('Salmon, canned'),
    3081: T1('Tuna, canned', 'Tuna, canned, drained solids'),
    3212: T1('Shrimp, mixed species, farmed, cooked⧗,Ɨ'),                  # boiled or steamed
    3118: T2('Oysters, raw'),                                              # raw: Table 1 has only canned and steamed
    5634: T1('Scallops, bay, Patagonian, wild, frozen', 'Scallops, sea, wild, frozen'),   # bay and sea: the raw rows
    3111: T1('Clams, raw'),
    3094: T2('Crab, red king, raw'),                                       # king crab: Table 1 has blue and snow crab
    3210: T1('Lobster, cooked, steamed'),
    3022: T1('Mackerel, raw (unspecified)'), 3015: T2('Herring, raw'), 2985: T1('Anchovy, canned'),
    920004: ('foods', [T1('Salmon, Atlantic, farmed, cooked⧗,§'), T2('Trout, rainbow, raw')]),   # salmon or trout
    # vegetables
    2506: T2('Potato, raw'), 2241: T2('Sweet potato, raw'),
    2375: T2('Broccoli, boiled'), 2214: T2('Spinach, boiled'),
    2213: T2('Spinach, mature, raw', 'Spinach, young, raw'),               # raw spinach, age not named
    2380: T2('Carrots, raw'), 2460: T2('Tomatoes, no further specified'), 2401: T2('Onions, raw'),
    2399: T1('Mushrooms (not further specified), raw'),
    2116: T2('Lettuce'), 2398: T2('Lettuce'),
    2019: T2('Green beans'), 2412: T2('Peas, green'),                      # frozen peas: Table 1 has only canned
    2028: T1('Brussels sprouts, raw'), 2046: T1('Cauliflower, raw'), 1991: T1('Asparagus, raw'),   # boiled: the raw rows
    2361: T2('Cabbage, raw'), 2363: T2('Cucumber, raw'), 2484: T2('Pepper, red (capsicum)'),
    2306: T1('Squash, winter, butternut, raw'),                            # winter squash, variety not named
    2209: T2('Soybeans, green, raw'), 2068: T2('Corn, raw'), 2225: T2('Squash, zucchini, raw'),
    2494: T2('Ketchup'), 3403: T2('Soy sauce made from soy and wheat (shoyu)'),
    # fruit
    1704: T2('Bananas, raw'), 1749: T2('Strawberries, raw'), 1511: T2('Avocado, raw'), 1620: T2('Fruit juice'),
    1706: T1('Blueberries, raw'),                                          # frozen
    1718: T1('Grapes, red, seedless, raw'),                                # red or green
    1734: T1('Pineapple, raw'),
    # other
    4186: T2('Chocolate'), 531: T2('Mayonnaise'), 4294: T2('Honey'),
}
PURML = {2943: ('Beer, ‘regular’ type, various brands', 341), 2850: ('Wine', 150), 2852: ('Wine', 150), 2844: ('Whiskey', 44.4)}   # per 100 ml
ZERO = [118, 4318, 422, 451, 920109, 900006, 900007, 930001, 930002, 930003,   # butter (not detected, T2), sugar, oils, water: no cells
        900005, 900011, 920101, 920102, 920103, 920104, 920105, 920106, 920107, 920108, 509003]   # supplements; the leftovers marker
# Everything else in the Threshold Log has no row (rule 6). Two that had one before:
#   3037 pike: it carried cod's purine and oxalate figures by mistake; neither list has pike.
#   3379 kidney beans, canned with their liquid: Table 1's canned beans were drained and rinsed. No figure, as before.

def per100(spec):
    if isinstance(spec, tuple) and spec[0] == 'parts':
        g = sum(p for p, _ in spec[1]); return sum(p * rows(*r) for p, r in spec[1]) / g
    if isinstance(spec, tuple) and spec[0] == 'foods':
        return sum(rows(*r) for r in spec[1]) / len(spec[1])
    return rows(*spec)
def num(v, d=2):
    v = round(v, d); return repr(int(v)) if float(v).is_integer() else repr(v)

data = list(csv.DictReader(io.open(OUT, encoding='utf8'))); head = list(data[0].keys())
changed = []
for r in data:
    i = int(r['id']); nf = r['no_figure'].split()
    if r['in_threshold'] != '1':
        assert r['pur'] == '' and i not in PUR, i; continue
    old = (r['pur'], 'pur' in nf)
    nf = [k for k in nf if k != 'pur']
    if i in PURML:
        d, ml = PURML[i]; r['pur'] = num(rows(('T3', d)) * ml / 100)
    elif i in PUR:
        g = float(r['grams'])
        v = per100(PUR[i]) * g / 100; r['pur'] = num(v) if round(v, 2) > 0 else ''
    elif i in ZERO: r['pur'] = ''
    else:
        r['pur'] = ''; nf.append('pur')
    if i == 3037:
        r['ox'] = ''
        if 'ox' not in nf: nf.insert(0, 'ox')
    r['no_figure'] = ' '.join(nf)
    new = (r['pur'], 'pur' in nf)
    if new != old: changed.append((r['id'], r['name_en'], old, new))
assert float(next(r for r in data if r['id'] == '130')['grams']) == 33 + 17   # the egg's parts, above

th = [r for r in data if r['in_threshold'] == '1']
nofig = [r for r in th if 'pur' in r['no_figure'].split()]
print('Threshold Log foods: %d; with a purine figure or 0: %d; no figure: %d' % (len(th), len(th) - len(nofig), len(nofig)))
def show(s): return ('no figure' if s[1] else (s[0] or '0'))
for c in changed: print('  %-7s %-40s %12s  ->  %s' % (c[0], c[1][:40], show(c[2]), show(c[3])))
if WRITE:
    w = csv.writer(io.open(OUT, 'w', encoding='utf8', newline=''), lineterminator='\n'); w.writerow(head)
    for r in data: w.writerow([r[h] for h in head])
    print('written', OUT)
