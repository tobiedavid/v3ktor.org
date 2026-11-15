# Threshold Log data, step 2 of 3: build the app's food table.
#
#   python3 -I build_data.py <tables.json from dump_tables.js> <folder with Health Canada's CSV files> <out.json>
#
# Health Canada's files: "Canadian Nutrient File (CNF), 2015", the CSV zip under "Entire database":
#   https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-2015-download-files.html
# Contains information licensed under the Open Government Licence - Canada.
#
# Where each number comes from:
#   names, servings, groups ............ the Food Trial Log's table (the names a person saw in step one)
#   vitamins and minerals .............. the Food Trial Log's table (itself copied from The Patch; blanks filled from USDA SR28)
#   energy, protein, fat, carbohydrate,
#   total sugars, fibre, alcohol ....... Health Canada's file, per serving, for every food that carries its FoodID
#   lactose ............................ The Patch's table (Health Canada's figure where it has one, USDA SR28 where it is blank)
#   histamine, estimated ............... EFSA Journal 2011;9(10):2393, Table 10: the mean for the food's category
#                                        (midpoint of the lower and upper bound), times the serving weight
# Nothing is guessed: a value with no source is None, and the app shows it as "not listed".
import csv, io, json, sys

tables_path, cnf_dir, out_path = sys.argv[1:4]
T = json.load(io.open(tables_path, encoding='utf8'))
TF = {f['id']: f for f in T['TF']}            # The Patch
FD = T['FD']; FDfr = {a[0]: a for a in T['FDfr']}; NK = T['NK']
RETIRED = {842, 854, 501869, 501872, 6146, 133, 3183, 3187}     # merged into 920001, 920002, 130 and 920004 by the Food Trial Log 1.2.0
MERGED = {920001: [501869, 501872], 920002: [6146], 920004: [3183, 3187]}   # checked below against the Food Trial Log's protein figure

# ---------- Health Canada's file ----------
MAC = {208: 'kcal', 203: 'prot', 204: 'fat', 205: 'carb', 269: 'sug', 291: 'fib', 221: 'alc', 213: 'lact'}
cnf_name = {}; code_to_id = {}
with io.open(cnf_dir + '/FOOD NAME.csv', encoding='latin1', newline='') as f:
    for r in csv.DictReader(f):
        cnf_name[int(r['FoodID'])] = r['FoodDescription']; code_to_id[int(r['FoodCode'])] = int(r['FoodID'])
cnf = {}
with io.open(cnf_dir + '/NUTRIENT AMOUNT.csv', encoding='latin1', newline='') as f:
    for r in csv.DictReader(f):
        cnf.setdefault(int(r['FoodID']), {})[int(r['NutrientID'])] = float(r['NutrientValue'])

def hc_id(fid):
    """The table's id is Health Canada's FoodID when the description matches the table's own 'cnf' field."""
    p = TF.get(fid)
    if p and fid in cnf_name and cnf_name[fid].strip().lower() == (p.get('cnf') or '').strip().lower(): return fid
    return None

# ---------- which Health Canada nutrient is which vitamin or mineral: found by matching the table, not typed by hand ----------
MICRO = ['ca', 'fe', 'mg', 'k', 'zn', 'c', 'b1', 'b2', 'b3', 'b6', 'fol', 'b12', 'd', 'vk', 'va', 'mn', 'cu', 'e', 'se']
matched = [(fid, TF[fid]) for fid in TF if hc_id(fid)]
def find_nutrient(key):
    best = None
    ids = set(); [ids.update(cnf[fid].keys()) for fid, _ in matched]
    for n in ids:
        for scale in (1.0, 1.49, 40.0):
            errs = []
            for fid, p in matched:
                tv = p['n'].get(key, 0)
                if tv <= 0 or n not in cnf[fid]: continue
                cv = cnf[fid][n] * p['g'] / 100.0 * scale
                errs.append(abs(cv - tv) / max(tv, 1e-9))
            if len(errs) < 40: continue
            errs.sort(); med = errs[len(errs) // 2]
            if best is None or med < best[0]: best = (med, n, scale, len(errs))
    return best
micro_map = {}
for k in MICRO:
    med, n, scale, cnt = find_nutrient(k); micro_map[k] = (n, scale)
    print('  %-4s <- Health Canada nutrient %-4d x%-5s median difference %.1f%% over %d foods' % (k, n, scale, med * 100, cnt))
    assert med < 0.08, 'no confident match for ' + k      # the table rounds to one or two decimals, so a few percent is rounding

def per_serving(dbid, g):
    v = cnf.get(dbid, {}); k = g / 100.0
    return {name: round(v[n] * k, 2) for n, name in MAC.items() if n in v}

# ---------- histamine: EFSA 2011, Table 10, mean in mg/kg as lower bound - upper bound ----------
EFSA = {'beer': (1.4, 1.4), 'wine_red': (3.6, 3.7), 'wine_white': (0.8, 0.9), 'fish': (26.8, 31.2), 'sausage': (23.0, 23.6),
        'ripened_meat': (5.9, 6.4), 'meat': (3.9, 4.4), 'cheese': (20.9, 62.0), 'hard_cheese': (25.2, 65.1),
        'dairy_other': (0.3, 0.3), 'sauce_other': (0.5, 10.1), 'veg_fermented': (39.4, 42.6)}
HIST_CAT = {5407: 'meat', 1859: 'meat', 2943: 'beer', 2835: 'beer', 2850: 'wine_red', 2852: 'wine_white', 4086: 'ripened_meat',
            1148: 'meat', 1154: 'meat', 502213: 'cheese', 119: 'hard_cheese', 1185: 'meat', 3203: 'fish', 5965: 'fish', 3081: 'fish',
            2201: 'veg_fermented', 2985: 'fish', 1159: 'meat', 5684: 'sausage', 109: 'hard_cheese', 40: 'hard_cheese', 6291: 'dairy_other',
            3403: 'sauce_other'}
HIST_NONE = {4650, 4962, 3321, 509003}       # a cold-cut sub, pepperoni pizza, tempeh, the leftovers marker: no category fits, so no figure

# ---------- the Threshold Log's own entries: water, which the Food Trial Log's table doesn't carry ----------
# id: (Health Canada's food, its name there, grams in the serving). A 355 ml can of sparkling water is taken as 355 g.
STRAIGHT = {920109: (420, 'Vegetable oil, coconut', 13.6),                       # 1 tbsp of oil is 13.6 g
            920110: (501828, 'Egg, chicken, white, fresh or frozen, cooked', 33.0),   # the white of one large egg is 33 g
            930001: (2933, 'Water, municipal', 250.0),
            930002: (2918, 'Water, mineral, carbonated, bottled', 355.0),
            930003: (2918, 'Water, mineral, carbonated, bottled', 355.0)}           # the flavouring adds nothing Health Canada's file counts
MINERALS = ('ca', 'fe', 'mg', 'k', 'zn', 'mn', 'cu', 'se')
OWN = [(930001, 'Water', 'Eau', '1 glass (250 ml)', '1 verre (250 ml)'),
       (930002, 'Sparkling water, plain', 'Eau pétillante nature', '1 can (355 ml)', '1 canette (355 ml)'),
       (930003, 'Sparkling water, flavoured', 'Eau pétillante aromatisée', '1 can (355 ml)', '1 canette (355 ml)')]
assert not any(a[0] in {o[0] for o in OWN} for a in FD)
for fid, en, fr, sen, sfr in OWN:
    FD.append([fid, en, sen, 'drink', 0, '', [0] * len(NK)]); FDfr[fid] = [fid, fr, sfr]

# ---------- build the rows ----------
rows = []; notes = {'kind_not_listed': [], 'hist_none': [], 'micro_differs': 0, 'blank': []}
for a in FD:
    fid, name, serving, grp, _mark, buckets, vals = a[0], a[1], a[2], a[3], a[4], a[5], a[6]
    blanks = [k for k in (a[7] if len(a) > 7 else []) if k in MICRO or k == 'fib']     # the Food Trial Log's own list of values it has no figure for
    if fid in RETIRED: continue
    fr = FDfr[fid]; micro = dict(zip(NK, vals)); p = TF.get(fid); dbid = hc_id(fid)
    row = {'id': fid, 'n': [name, fr[1]], 's': [serving, fr[2]], 'grp': grp, 'b': buckets.split(' ') if buckets else []}
    if p:   # in The Patch: grams per serving and every number are there
        g = p['g']; mac = per_serving(dbid, g) if dbid else {}
        row['g'] = g
        row['kcal'] = mac.get('kcal', p['n']['kcal']); row['prot'] = mac.get('prot', p['n']['prot']); row['fat'] = mac.get('fat', p['n']['fat'])
        row['fib'] = mac.get('fib', p['n']['fib']); row['lact'] = p['n']['lact']
        row['alc'] = mac.get('alc', round((p['n'].get('sd') or 0) * 13.45, 2))
        if dbid: row['carb'] = mac['carb']; row['sug'] = mac.get('sug')
        elif fid == 900007:   # cod liver oil: its own note names Health Canada's food code 457
            oil = per_serving(code_to_id[457], g); assert cnf_name[code_to_id[457]].lower().startswith('fish oil, cod liver')
            row['kcal'] = oil['kcal']; row['fat'] = oil['fat']; row['carb'] = oil.get('carb', 0); row['sug'] = oil.get('sug', 0)
        elif fid == 900006:   # a 1 g capsule of fish oil is 1 g of fat
            row['fat'] = 1.0; row['carb'] = 0.0; row['sug'] = 0.0
        else:    # a label or a typical value: carbohydrate by difference, the kind of carbohydrate not listed
            row['carb'] = round(max(0.0, (row['kcal'] - 4 * row['prot'] - 9 * row['fat'] - 7 * row['alc']) / 4), 1); row['sug'] = None
        row['src'] = 'hc' if dbid else 'label'
        for k in MICRO:
            pv = p['n'].get(k, 0) * (1.49 if k == 'e' else 1)       # The Patch keeps vitamin E in mg, the Food Trial Log in IU
            if abs(micro.get(k, 0) - pv) > max(0.05, 0.03 * abs(pv)): notes['micro_differs'] += 1
    elif fid in MERGED:   # chicken, lean beef, oily fish: the average of the foods the Food Trial Log merged, per 100 g
        comps = MERGED[fid]; g = 100.0; row['g'] = g
        prot = sum(TF[c]['n']['prot'] * 100 / TF[c]['g'] for c in comps) / len(comps)
        assert abs(prot - micro['prot']) < 0.6, ('merge check failed', fid, prot, micro['prot'])
        def avg(key, fromcnf=True):
            xs = []
            for c in comps:
                d = hc_id(c); v = cnf.get(d, {}) if d else {}
                n = [n for n, nm in MAC.items() if nm == key][0]
                xs.append(v[n] if (fromcnf and n in v) else TF[c]['n'].get(key, 0) * 100 / TF[c]['g'])
            return round(sum(xs) / len(xs), 2)
        for key in ('kcal', 'prot', 'fat', 'carb', 'fib', 'alc'): row[key] = avg(key)
        row['lact'] = round(sum(TF[c]['n']['lact'] * 100 / TF[c]['g'] for c in comps) / len(comps), 2)
        sug = [cnf.get(hc_id(c), {}).get(269) for c in comps]; row['sug'] = round(sum(sug) / len(sug), 2) if all(s is not None for s in sug) else None
        row['src'] = 'hc'
    elif fid in STRAIGHT:   # coconut oil, egg white and water: straight from Health Canada's file
        dbid, hcname, g = STRAIGHT[fid]
        assert cnf_name[dbid] == hcname, cnf_name[dbid]
        mac = per_serving(dbid, g); row['g'] = g
        for key in ('kcal', 'prot', 'fat', 'carb', 'fib'): row[key] = mac.get(key, 0)
        row['sug'] = mac.get('sug'); row['lact'] = mac.get('lact', 0); row['alc'] = 0; row['src'] = 'hc'
        for k in MICRO:
            n, scale = micro_map[k]; micro[k] = round(cnf[dbid].get(n, 0) * g / 100.0 * scale * (1.49 if k == 'e' else 1), 3)   # the Food Trial Log's table keeps vitamin E in IU
        blanks = [k for k in MICRO if micro_map[k][0] not in cnf[dbid]]     # only what Health Canada itself leaves blank for this food
        if fid in (930002, 930003):   # sparkling water: a mineral water and carbonated tap water differ many times over, so the minerals get no figure
            for k in MINERALS: micro[k] = 0
            blanks = [k for k in MICRO if k in MINERALS or k in blanks]
    else:   # the supplements: nothing to count, brands vary
        row.update({'g': 0, 'kcal': 0, 'prot': 0, 'fat': 0, 'carb': 0, 'sug': 0, 'fib': 0, 'lact': 0, 'alc': 0, 'src': 'none'})
    # sugars can't exceed the carbohydrate that isn't fibre (the two are measured differently); lactose can't exceed sugars
    if row['sug'] is not None:
        row['sug'] = round(min(row['sug'], max(0.0, row['carb'] - row['fib'])), 2); row['lact'] = round(min(row['lact'], row['sug']), 2)
    else:
        row['lact'] = round(min(row['lact'], max(0.0, row['carb'] - row['fib'])), 2)
        if row['carb'] - row['fib'] - row['lact'] > 0.5: notes['kind_not_listed'].append(name)
    row['m'] = [micro.get(k, 0) for k in MICRO]
    if blanks: row['x'] = blanks; notes['blank'].append('%s (%s)' % (name, ' '.join(blanks)))
    if 'hist' in row['b']:
        cat = HIST_CAT.get(fid)
        if cat: lo, hi = EFSA[cat]; row['hist'] = round((lo + hi) / 2 * row['g'] / 1000.0, 2); row['hcat'] = cat
        else: assert fid in HIST_NONE, ('histamine food with no decision', fid, name); row['hist'] = None; notes['hist_none'].append(name)
    rows.append(row)

assert len(rows) == 208, len(rows)
print('foods:', len(rows), '| from Health Canada:', sum(r['src'] == 'hc' for r in rows), '| from a label or typical value:', sum(r['src'] == 'label' for r in rows), '| supplements:', sum(r['src'] == 'none' for r in rows))
print('carbohydrate of a kind not listed (%d):' % len(notes['kind_not_listed']), ', '.join(notes['kind_not_listed']))
print('histamine foods:', sum('hist' in r['b'] for r in rows), '| with an estimate:', sum(r.get('hist') is not None for r in rows if 'hist' in r['b']), '| no figure:', ', '.join(notes['hist_none']))
print('vitamin and mineral values that differ between The Patch\'s table and the Food Trial Log\'s (after the vitamin E unit):', notes['micro_differs'])
print('foods with a value the Food Trial Log has no figure for (%d):' % len(notes['blank']), '; '.join(notes['blank']))
for r in rows:
    if r['id'] in (920001, 920002, 920004, 920109, 920110, 930001, 930002, 930003, 109, 3203, 4163):
        print('  %-44s %-10s kcal %6s prot %5s fat %5s carb %5s sug %5s fib %4s lact %4s hist %s' % (r['n'][0][:44], r['s'][0][:10], r['kcal'], r['prot'], r['fat'], r['carb'], r['sug'], r['fib'], r['lact'], r.get('hist')))
json.dump({'micro': MICRO, 'foods': rows}, io.open(out_path, 'w', encoding='utf8'), ensure_ascii=False)
