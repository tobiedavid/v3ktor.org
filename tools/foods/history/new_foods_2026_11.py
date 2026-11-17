"""31 foods added to data/foods.csv in November 2026, for all three apps. Kept as the record of where each figure came from.

    python3 -I tools/foods/history/new_foods_2026_11.py <folder with Health Canada's CSV files>

Health Canada's Canadian Nutrient File (2015) gives every nutrient, per 100 g, times the serving's weight. Which of its nutrients is which
column was found by matching the 186 foods already in the file (omega-3 is EPA plus DHA). A nutrient it leaves blank is listed under `lack`
(The Patch's other foods had their blanks filled from the USDA's SR28, which wasn't at hand). Plain dairy with no lactose figure (feta, brie,
ricotta, sour cream) takes its sugars as its lactose. The rest, as for the foods before them:
  the Food Trial Log's gut groups ... the written rules in data/README.md; the mark is the highest mark of the groups
  histamine, tyramine ............. EFSA Journal 2011;9(10):2393, Tables 10 and 11, by food type, times the serving's weight
  sorbitol ........................ Yao and others 2014, as listed by Liljebo and others 2020, Supplementary Table 6 (plum); peach (sorbitol and
                                    mannitol given together) and fresh cherries (only a recipe value for canned) have no figure
  oxalate ......................... the Harvard oxalate list (Kidney Stone Diet, version 2.3.1), as for the foods before
  purines ......................... the USDA and ODS-NIH Database for the Purine Content of Foods, 2023, as for the foods before
  portions ........................ fructans: wheat and rye foods, and pistachios (with galacto-oligosaccharides), from Monash University's list;
                                    gluten: wheat, barley and rye; sulphites: dried fruit and bottled sauces (Health Canada's list); capsaicin: salsa
"""
import csv, sys, io
CNF = sys.argv[1]; OUT = 'data/foods.csv'
amt = {}
for r in csv.reader(io.open(CNF + '/NUTRIENT AMOUNT.csv', encoding='latin-1')):
    if r[0].isdigit(): amt.setdefault(int(r[0]), {})[int(r[1])] = float(r[2])
cnf_name = {int(r['FoodID']): r['FoodDescription'] for r in csv.DictReader(io.open(CNF + '/FOOD NAME.csv', encoding='latin-1'))}
# Health Canada's nutrient numbers, as found on the foods already in the file
N = {'kcal': 208, 'prot': 203, 'ca': 301, 'fe': 303, 'mg': 304, 'k': 306, 'na': 307, 'zn': 309, 'd': 324, 'c': 401, 'b1': 404, 'fol': 417, 'b12': 418,
     'vk': 430, 'va': 814, 'ret': 319, 'mn': 315, 'caf': 262, 'fib': 291, 'se': 317, 'e': 323, 'b2': 405, 'b3': 409, 'b6': 415, 'cu': 312, 'fat': 204,
     'lact': 213, 'ala': 619, 'carb': 205, 'sug': 269, 'alc': 221, 'theo': 263, 'sat': 606, 'mono': 645, 'poly': 646, 'frs': 212, 'gluc': 211,
     'sucr': 210, 'malt': 214, 'gal': 287}
OZ, CUP = 28.35, 236.6
# id, group, grams, name EN, name FR, serving EN, serving FR, Patch tags, gut groups, histamine type,
# oxalate (mg, how: ('n', k) = k of the list's servings, ('g', grams of the list's serving), or None: the list doesn't name it), purines mg/100 g or None,
# sorbitol g/100 g (None = no figure, 0 = none), portions, Patch also_groups
F = [
 (4065, 'grain', 27, 'Rye bread', 'Pain de seigle', '1 slice', '1 tranche', 'glu', 'gluten', '', (6.3, ('n', 1)), None, 0, 'fru glu'),            # BREAD, RYE 1 slice
 (4063, 'grain', 35, 'Sourdough or French bread', 'Pain au levain ou pain français', '1 slice', '1 tranche', 'glu', 'gluten', '', None, 15.7, 0, 'fru glu'),   # purines: bread, crusty (baguette), Table 1
 (3708, 'grain', 60, 'Pita bread', 'Pain pita', '1 pita (16 cm)', '1 pita (16 cm)', 'glu', 'gluten', '', None, None, 0, 'fru glu'),
 (3900, 'grain', 57, 'English muffin', 'Muffin anglais', '1 muffin', '1 muffin', 'glu', 'gluten', '', (7.3, ('n', 1)), None, 0, 'fru glu'),            # MUFFIN, ENGLISH, PLAIN, ENRICHED one
 (3872, 'grain', 18, 'Soda crackers (saltines)', 'Biscuits soda', '6 crackers', '6 biscuits', 'glu', 'gluten', '', (5.1, ('n', 1)), None, 0, 'fru glu'),   # CRACKER, REGULAR REFINED GRAIN 5-6 crackers
 (3935, 'grain', 76, 'Pancakes', 'Crêpes à l’américaine (pancakes)', '2 (10 cm)', '2 (10 cm)', 'glu', 'gluten dairy', '', (9.7, ('n', 1)), None, 0, 'fru glu'),   # PANCAKE & WAFFLES 2 small
 (1222, 'grain', 64.5, 'Granola', 'Granola', '½ cup', '½ tasse', '', 'sugar fat fibre nuts', '', (13, ('g', 128.9 * CUP * 2 / 3 / 250)), None, 0, ''),   # 100% NATURAL GRANOLA 2/3 cup
 (4110, 'grain', 25.5, 'Popcorn, air-popped', 'Maïs soufflé à air chaud', '3 cups', '3 tasses', '', '', '', (3.5, ('g', 8.5 * 3 * CUP / 250)), None, 0, ''),   # POPCORN, AIR POPPED 3 cups
 (1728, 'fruit', 150, 'Peach', 'Pêche', '1 medium', '1 moyenne', '', 'fruit', '', (0.4, ('n', 1)), None, None, ''),
 (1740, 'fruit', 66, 'Plum', 'Prune (fraîche)', '1', '1', '', 'fruit', '', (0.1, ('n', 1)), None, 2.40, ''),
 (1531, 'fruit', 164, 'Cherries', 'Cerises', '1 cup (about 20)', '1 tasse (environ 20)', '', 'fruit', '', (1.7, ('g', 162.8 * CUP / 2 / 250)), None, None, ''),   # ½ cup
 (1747, 'fruit', 130, 'Raspberries', 'Framboises', '1 cup', '1 tasse', '', 'fibre fruit', '', (2.5, ('g', 130 * CUP / 2 / 250)), None, 0, ''),   # ½ cup
 (1714, 'fruit', 128, 'Grapefruit', 'Pamplemousse', '½', '½', '', 'fruit', '', (13.2, ('n', 1)), None, 0, ''),                        # ½ medium
 (1623, 'fruit', 88, 'Mandarin or clementine', 'Mandarine ou clémentine', '1 medium', '1 moyenne', '', 'fruit', '', (15.7, ('n', 1)), None, 0, ''),   # TANGERINES, RAW one
 (5401, 'fruit', 48, 'Dates (medjool)', 'Dattes (medjool)', '2', '2', '', 'sugar', '', (25.5, ('g', 5 * 7.1)), None, 0, 'sulph'),            # DATES 5 dates: a dried date is 7.1 g
 (108, 'dairy', 30, 'Feta', 'Feta', '30 g', '30 g', 'hist', 'dairy hist', 'cheese', None, None, 0, ''),
 (47, 'dairy', 30, 'Swiss (emmental)', 'Suisse (emmental)', '30 g', '30 g', 'hist', 'dairy hist', 'hard_cheese', None, None, 0, ''),
 (20, 'dairy', 30, 'Brie', 'Brie', '30 g', '30 g', 'hist', 'dairy hist', 'cheese', None, None, 0, ''),
 (139, 'dairy', 29.2, 'Sour cream, 14%', 'Crème sure 14 %', '2 tbsp', '2 c. à soupe', '', 'dairy', '', (0.1, ('n', 2)), None, 0, ''),   # CREAM, SOUR 1 tbsp
 (43, 'dairy', 131, 'Ricotta', 'Ricotta', '½ cup', '½ tasse', '', 'dairy fat', '', None, None, 0, ''),
 (4782, 'meat', 100, 'Lamb', 'Agneau', '100 g cooked', '100 g, cuit', '', '', '', None, 127.5, 0, ''),               # purines: lamb chops and roast, raw, Table 1
 (1199, 'meat', 54, 'Pork sausage, breakfast', 'Saucisse de porc (déjeuner)', '2 links', '2 saucisses', '', 'proc fat', '', (1.8, ('g', 2 * OZ)), None, 0, ''),   # SAUSAGE, COOKED PORK & BEEF 2 oz
 (816, 'meat', 100, 'Ground turkey', 'Dinde hachée', '100 g cooked', '100 g, cuite', '', '', '', (0, ('g', 3 * OZ)), 96, 0, ''),   # TURKEY, COOKED GROUND 3 oz; purines: turkey, ground, raw
 (422, 'grain', 13.7, 'Olive oil', 'Huile d’olive', '1 tbsp', '1 c. à soupe', '', 'fat', '', 'none', 0, 0, ''),          # an oil: no list row, none
 (451, 'grain', 14.2, 'Canola oil', 'Huile de canola', '1 tbsp', '1 c. à soupe', '', 'fat', '', 'none', 0, 0, ''),
 (531, 'proc', 14, 'Mayonnaise', 'Mayonnaise', '1 tbsp', '1 c. à soupe', '', 'proc fat', '', (0, ('n', 1)), 0.6, 0, ''),
 (4326, 'drink', 20, 'Maple syrup', 'Sirop d’érable', '1 tbsp', '1 c. à soupe', '', 'sugar', '', None, None, 0, ''),
 (4294, 'drink', 21.5, 'Honey', 'Miel', '1 tbsp', '1 c. à soupe', '', 'sugar', '', (0, ('n', 1)), 0.8, 0, ''),          # O: Honey 1 tbs 0
 (1025, 'proc', 65.7, 'Salsa', 'Salsa', '¼ cup', '¼ tasse', '', 'proc veg onion', '', (2.8, ('g', 65.7 * CUP / 4 / 60)), None, 0, 'cap sulph'),
 (2588, 'grain', 30, 'Pistachios', 'Pistaches', '1 handful (30 g)', '1 poignée (30 g)', '', 'nuts', '', (9, ('g', OZ)), None, 0, 'fru gos'),
 (2582, 'grain', 30, 'Pecans', 'Pacanes', '¼ cup (30 g)', '¼ tasse (30 g)', '', 'fat nuts', '', (15.7, ('g', OZ)), None, 0, ''),
]
EFSA_H = {'cheese': (20.9, 62.0), 'hard_cheese': (25.2, 65.1)}; EFSA_T = {'cheese': (68.5, 104), 'hard_cheese': (82.9, 113)}
BK = {'alc': 4, 'caf': 4, 'proc': 4, 'swt': 4, 'sup': 4, 'dairy': 3, 'fat': 3, 'sugar': 3, 'rawsea': 3, 'gluten': 2, 'fibre': 2, 'legume': 2, 'onion': 2,
      'spicy': 2, 'hist': 2, 'veg': 1, 'fruit': 1, 'nuts': 1}
rows = list(csv.DictReader(io.open(OUT, encoding='utf8'))); head = list(rows[0].keys())
def num(v, d=3):
    v = round(v, d); return repr(int(v)) if float(v).is_integer() else repr(v)
new = []
for (fid, grp, g, en, fr, sen, sfr, tags, gut, htype, ox, pur, sorb, portions) in F:
    a = amt[fid]; k = g / 100.0; r = {h: '' for h in head}
    r.update(id=str(fid), group=grp, grams=num(g), name_en=en, name_fr=fr, serving_en=sen, serving_fr=sfr, in_patch='1', in_ftl='1', in_threshold='1',
             tags=tags, ftl_gut_groups=gut, ftl_mark=str(max([BK[x] for x in gut.split()], default=0)), cnf_name=cnf_name[fid], src='hc', portions=portions)
    lack = []
    for key, n in N.items():
        if n in a: r[key] = num(a[n] * k)
        elif key in ('caf', 'theo', 'alc'): r[key] = '0'
        elif key in ('sug', 'frs', 'gluc', 'sucr', 'malt', 'gal', 'lact', 'sat', 'mono', 'poly'): r[key] = ''      # decided below
        else: r[key] = '0'; lack.append(key)
    r['sd'] = num((a.get(221, 0) * k) / 13.45, 2)
    r['o3'] = num((a.get(629, 0) + a.get(621, 0)) * k); r['e'] = num(a.get(323, 0) * k, 6)
    if 629 not in a and 621 not in a: lack.append('o3')
    if r['lact'] == '' and grp == 'dairy' and r['sug'] != '': r['lact'] = r['sug']   # plain dairy with no lactose figure: its sugars are its lactose
    if r['lact'] == '' and fid == 3935: lack.append('lact'); r['lact'] = '0'           # pancakes are made with milk: no lactose figure
    if r['lact'] == '': r['lact'] = '0'
    # the kinds of fat and sugar: as for the foods before, a blank kind is none below half a gram of fat or 2 g of other sugars, else no figure
    nofig = []
    for kk in ('sat', 'mono', 'poly'):
        if r[kk] == '':
            if float(r['fat']) >= 0.5: nofig.append(kk)
            else: r[kk] = '0'
    other = (float(r['sug']) if r['sug'] != '' else max(0.0, float(r['carb']) - float(r['fib']))) - float(r['lact'])
    for kk in ('frs', 'gluc', 'sucr', 'malt', 'gal'):
        if r[kk] == '':
            if other >= 2.0: nofig.append(kk)
    if r['frs'] != '' and r['gluc'] != '': r['fruc'] = num(max(0.0, float(r['frs']) - float(r['gluc'])))
    elif other >= 2.0: nofig.append('fruc')
    if r['sug'] != '' and float(r['lact']) > float(r['sug']): r['sug'] = r['lact']
    # histamine and tyramine estimates
    if htype:
        lo, hi = EFSA_H[htype]; r['hist'] = num((lo + hi) / 2 * g / 1000, 2); r['hist_type'] = htype
        lo, hi = EFSA_T[htype]; r['tyr'] = num((lo + hi) / 2 * g / 1000, 2)
    # oxalate and purines
    if ox == 'none': pass
    elif ox is None: nofig.append('ox')
    else:
        mg, (how, x) = ox; v = mg * x if how == 'n' else mg * g / x
        if v > 0: r['ox'] = num(v, 2)
    if pur is None: nofig.append('pur')
    elif pur > 0: r['pur'] = num(pur * g / 100, 2)
    if sorb is None: nofig.append('sorb')
    elif sorb > 0: r['sorb'] = num(sorb * g / 100)
    if fid == 1728: nofig.append('mann')      # peach: sorbitol and mannitol given together
    r['lack'] = ' '.join(lack); r['no_figure'] = ' '.join(nofig)
    new.append(r)
at = next(i for i, r in enumerate(rows) if int(r['id']) >= 920000)
rows = rows[:at] + new + rows[at:]
w = csv.writer(io.open(OUT, 'w', encoding='utf8', newline=''), lineterminator='\n'); w.writerow(head)
for r in rows: w.writerow([r[h] for h in head])
for r in new: print('%-28s %6s g  kcal %-7s fat %-6s fib %-5s sug %-6s lact %-5s mark %s [%s]  lack: %s  no figure: %s' % (r['name_en'][:28], r['grams'], r['kcal'], r['fat'], r['fib'], r['sug'], r['lact'], r['ftl_mark'], r['ftl_gut_groups'], r['lack'], r['no_figure']))
