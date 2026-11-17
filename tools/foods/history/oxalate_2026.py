"""Oxalate in data/foods.csv, November 2026: plain animal foods the Harvard list doesn't name count as none, and two plant foods get a figure from
a second source. Kept as the record of where these figures came from.

    python3 -I tools/foods/history/oxalate_2026.py            (prints what would change)
    python3 -I tools/foods/history/oxalate_2026.py --write    (writes data/foods.csv)

1. Plain animal foods. Oxalate is made by plants. Every plain meat, fish, seafood, egg, cheese or cultured milk the Harvard oxalate list
   (Kidney Stone Diet, version 2.3.1) names holds 0 to 2.8 mg per serving (the most: light tuna canned in oil, 2.8 mg per 3.5 oz; canned sockeye salmon with
   its bones, 1.6 mg per 4 oz). The animal foods either of its lists gives more (turkey sausage, turkey dogs, chicken
   nuggets, fish sticks, tuna salad) all hold plant ingredients.
   So a plain animal food the list doesn't name counts as none, as water, sugar and oils already do. This is a rule, not a measurement,
   and data/README.md says so. Foods with plant ingredients (salami, liver pâté, beef jerky, sandwiches) keep no figure.
2. Watermelon and canned tomatoes: total oxalate, mg per 100 g fresh weight, from the table "Occurrence of oxalate in foods" in Salgado N,
   Silva MA, Figueira ME, Costa HS, Albuquerque TG, Oxalate in Foods: Extraction Conditions, Analytical Methods, Occurrence, and Health
   Implications, Foods 2023;12(17):3201 (CC BY 4.0), times the serving's weight. Watermelon, raw: 0.3 (Hönow and Hesse, Food Chem
   2002;78:511). Tomato, canned, peeled: 12.7 (one sample; the row follows Hönow and Hesse's raw tomato row and names no other study).
   The Harvard list gives watermelon only by the slice, with no weight, and has no canned tomatoes.
"""
import csv, io, sys
WRITE = '--write' in sys.argv; OUT = 'data/foods.csv'

ANIMAL = {3116: 'mussels', 3037: 'pike', 5634: 'scallops', 3210: 'lobster', 2985: 'anchovies, canned in olive oil, drained',
          2654: 'beef heart', 2655: 'beef kidney', 2669: 'beef tongue', 577: 'chicken hearts', 4782: 'lamb',
          109: 'gouda', 40: 'parmesan', 108: 'feta', 47: 'Swiss', 20: 'brie', 43: 'ricotta', 6291: 'kefir, plain'}
REVIEW = {1691: 0.3, 2462: 12.7}   # mg per 100 g

def num(v, d=2):
    v = round(v, d); return repr(int(v)) if float(v).is_integer() else repr(v)
data = list(csv.DictReader(io.open(OUT, encoding='utf8'))); head = list(data[0].keys())
seen = set()
for r in data:
    i = int(r['id'])
    if i not in ANIMAL and i not in REVIEW: continue
    nf = r['no_figure'].split(); assert 'ox' in nf and r['ox'] == '', (i, r['ox'], nf)
    r['no_figure'] = ' '.join(k for k in nf if k != 'ox')
    r['ox'] = num(REVIEW[i] * float(r['grams']) / 100) if i in REVIEW else ''
    seen.add(i); print('%-7s %-32s no figure  ->  %s' % (r['id'], r['name_en'][:32], r['ox'] or '0'))
assert seen == set(ANIMAL) | set(REVIEW), set(ANIMAL) | set(REVIEW) - seen
th = [r for r in data if r['in_threshold'] == '1']
print('Threshold Log foods with no oxalate figure: %d' % sum('ox' in r['no_figure'].split() for r in th))
if WRITE:
    w = csv.writer(io.open(OUT, 'w', encoding='utf8', newline=''), lineterminator='\n'); w.writerow(head)
    for r in data: w.writerow([r[h] for h in head])
    print('written', OUT)
