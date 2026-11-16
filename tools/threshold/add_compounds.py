"""Threshold Log data, step 3 of 3. Adds what each food carries beyond the ring: f['c'] = {compound: amount per serving}, or 1 where only "a portion of it" is known.
f['x'] lists what a food holds with no figure: a meal with one of these sits out of that row, as a meal with a caffeine pill sits out of caffeine.
A number only where a source gives one:
  caffeine, theobromine .. Health Canada, Canadian Nutrient File 2015 (mg per 100 g), times the serving's weight; energy drinks from their labels
  nitrate ............... EFSA Journal 2008;689, Tables 2 to 10: the median for the vegetable (mg/kg), times the serving's weight
  the kinds of fat ...... Health Canada: saturated (606), monounsaturated (645), polyunsaturated (646), per serving. Not trans fat: Health Canada
                          gives it for about half the foods, and a meal with any of the others would sit out.
  the kinds of sugar .... Health Canada: fructose (212), glucose (211), sucrose (210), maltose (214), galactose (287), per serving.
                          Lactose stays The Patch's figure (build_data.py).
  excess fructose ....... Health Canada: fructose minus glucose, when fructose is the larger
  sodium ................ Health Canada (307); a label food or a typical value: The Patch's table
  selenium .............. the Food Trial Log's table (the same figure the Nutrition tab shows)
  sorbitol, mannitol .... measured, g per 100 g, times the serving's weight: Muir and others, J Agric Food Chem 2009;57:554, and Yao and others,
                          J Hum Nutr Diet 2014;27 Suppl 2:263, both as listed in Liljebo and others, BMC Nutrition 2020;6:47, Additional file 1 (CC BY);
                          Chumpitazi and others, J Pediatr 2018;199:252, Table 1 (not detected = 0)
  tyramine, estimated ... EFSA Journal 2011;9(10):2393, Table 11: the mean for the food's type (midpoint of the lower and upper bound),
                          times the serving's weight. The same food types as the histamine estimate (build_data.py).
Portions only (the food is one the source names as carrying it; no per-serving figure entered yet):
  oxalates (the Harvard list's High band, 30 mg a serving or more), glycoalkaloids (EFSA 2020: potato foods),
  capsaicin, fructans / galacto-oligosaccharides (Monash University; green peas: Biesiekierski and others 2011, 1.88 g per 100 g, via Liljebo and others 2020),
  sulphites (Health Canada's list), added nitrites (cured meats), sweeteners and gluten (the Food Trial Log's own tags),
  purines (Kaneko 2014: beef liver, chicken liver, sardine),
  flavourings (by the kind of drink, not from a label: colas, energy drinks, the ready-to-drink protein shake, flavoured sparkling water;
  Health Canada's file has no ingredient lists, so no other food in the table is tagged)."""
import json, csv, sys
#   python3 -I add_compounds.py <the table from build_data.py> <folder with Health Canada's CSV files> <tables.json from dump_tables.js>
P, CNF, TABLES = sys.argv[1:4]; d=json.load(open(P)); F={f['id']:f for f in d['foods']}
# the Food Trial Log merged these Health Canada foods into one each (build_data.py); the other three are Health Canada foods under an id of their own
MERGED={920001:[501869,501872],920002:[6146],920004:[3183,3187]}
STRAIGHT={920109:420,920110:501828,930001:2933,930002:2918,930003:2918}
want={c for cs in MERGED.values() for c in cs}|set(STRAIGHT.values())|set(F)
NUT={'262':'caf','263':'theo','606':'sat','645':'mono','646':'poly','605':'trans','212':'frs','211':'gluc','210':'sucr','214':'malt','287':'gal','307':'na'}
cnf={k:{} for k in NUT}
with open(CNF+'/NUTRIENT AMOUNT.csv',encoding='latin-1') as fh:
    r=csv.reader(fh); next(r)
    for row in r:
        if row[1] in cnf and row[0].isdigit() and int(row[0]) in want: cnf[row[1]][int(row[0])]=float(row[2])
by={NUT[k]:v for k,v in cnf.items()}
def per100(fid,key):
    """Health Canada's figure per 100 g for a food of the table, or None. A merged food takes the average of its parts, when every part has one."""
    if fid in MERGED:
        vs=[by[key].get(c) for c in MERGED[fid]]
        return None if any(v is None for v in vs) else sum(vs)/len(vs)
    return by[key].get(STRAIGHT.get(fid,fid))
for f in d['foods']: f['c']={}
def put(ids,key,val=1):
    for i in ids: assert i in F,(key,i); F[i]['c'][key]=val
def nofig(i,key):
    f=F[i]; f.setdefault('x',[])
    if key not in f['x']: f['x'].append(key)
for i,v in cnf['262'].items():
    if i in F and v>0 and F[i]['g']: F[i]['c']['caf']=round(v*F[i]['g']/100,0)
for i,v in cnf['263'].items():
    if i in F and v>0 and F[i]['g']: F[i]['c']['theo']=round(v*F[i]['g']/100,0)
T=json.load(open(TABLES)); TF={f['id']:f for f in T['TF']}
for f in d['foods']:
    t=TF.get(f['id'])
    if t and t.get('label') and t['n'].get('caf',0)>0: f['c']['caf']=t['n']['caf']     # a branded can: the figure on its label, as The Patch's table carries it
nofig(920103,'caf')                                                                     # a caffeine pill: brands vary, so no figure
NIT={2214:785,2213:785,2116:1097,2398:844,2501:1100,2386:693,2361:223,2062:223,2105:267,2375:209,2380:125,2506:106,2460:26,2462:26,2363:156,2046:122,2019:293,2412:1,2401:60,2484:28,2413:28,2225:297,1991:24,2028:1,2399:43,2306:392}
for i,v in NIT.items(): assert i in F; F[i]['c']['nit']=round(v*F[i]['g']/1000,1)

# ---------- the kinds of fat and of sugar, sodium, excess fructose: Health Canada, per serving ----------
# Below half a gram of fat in a serving, a kind Health Canada leaves blank is taken as none; at half a gram or more it has no figure, and the meal
# sits out of that row. Sugars: the same, below 2 g of sugars whose kinds aren't listed (the app lets up to 2 g of carbs of a kind not listed
# by in the same way). A food whose sugars Health Canada doesn't list at all ("kind not listed") counts its carbs less fibre and lactose.
SUGARS=['frs','gluc','sucr','malt','gal']; FATS=['sat','mono','poly']; LOW=0.5; LOWSUG=2.0
counts={'fig':{},'none':{}}
for f in d['foods']:
    i, g = f['id'], f['g'] or 0
    if f['src']=='none': continue                                       # the supplements: nothing to count
    hc = f['src']=='hc' and g>0
    def put_or_nofig(key, big):
        v = per100(i,key) if hc else None
        if v is not None:
            x = round(v*g/100, 3 if key!='na' else 0)
            if x>0: f['c'][key]=x
            counts['fig'][key]=counts['fig'].get(key,0)+1
        elif big: nofig(i,key); counts['none'][key]=counts['none'].get(key,0)+1
    for k in FATS: put_or_nofig(k, (f['fat'] or 0)>=LOW)
    sug=f.get('sug'); avail=max(0,(f['carb'] or 0)-(f['fib'] or 0))
    big = (sug-(f['lact'] or 0)>=LOWSUG) if sug is not None else (avail-(f['lact'] or 0)>=LOWSUG)
    for k in SUGARS: put_or_nofig(k, big)
    # excess fructose: fructose beyond glucose, from the same two figures
    fr_, gl_ = (per100(i,'frs'), per100(i,'gluc')) if hc else (None, None)
    if fr_ is not None and gl_ is not None:
        x=round(max(0,fr_-gl_)*g/100,3)
        if x>0: f['c']['fruc']=x
    elif big: nofig(i,'fruc')
    # sodium: Health Canada; otherwise the figure in The Patch's table (a label or a typical value)
    na = per100(i,'na') if hc else None
    if na is not None: x=round(na*g/100)
    else:
        t=TF.get(i); x=t['n'].get('na') if t else None
    if x is None: nofig(i,'na')
    elif x>0: f['c']['na']=round(x)
    # selenium: the table's own figure, in µg; a blank stays a blank (it is in the food's x list already)
    se=f['m'][d['micro'].index('se')]
    if se>0 and 'se' not in (f.get('x') or []): f['c']['se']=round(se,1)
for i in (930002,930003):   # sparkling water: a mineral water and carbonated tap water differ many times over in sodium too (build_data.py leaves its minerals blank)
    F[i]['c'].pop('na',None); nofig(i,'na')
# what Health Canada's sugars add up to beside its total: a check that the right figures were read
for f in d['foods']:
    if f.get('sug') and all(k in f['c'] or k not in (f.get('x') or []) for k in SUGARS) and not any(k in (f.get('x') or []) for k in SUGARS):
        s=sum(f['c'].get(k,0) for k in SUGARS)+(f['lact'] or 0)
        assert s<=f['sug']*1.35+0.6, ('the kinds of sugar add up to more than the total', f['n'][0], s, f['sug'])

# ---------- sorbitol and mannitol: measured, g per 100 g ----------
SORB={1696:0.77,   # apple: Muir 2009, via Liljebo 2020 Suppl. Table 1
      1731:4.1,    # pear: Muir 2009, via Liljebo 2020 Suppl. Table 6
      2375:0.04,   # broccoli, frozen: Chumpitazi 2018
      2019:0.01,   # green beans, frozen: Chumpitazi 2018
      2068:0.04}   # corn, frozen: Chumpitazi 2018
MANN={2386:1.5,    # celery: Yao 2014, via Liljebo 2020 Suppl. Table 6
      2046:2.96,   # cauliflower: Muir 2009, via Liljebo 2020 Suppl. Table 6
      2399:2.74,   # mushrooms: Muir 2009, via Liljebo 2020 Suppl. Table 6, where sorbitol and mannitol are given together
      2019:0.02}   # green beans, frozen: Chumpitazi 2018
for i,v in SORB.items(): F[i]['c']['sorb']=round(v*F[i]['g']/100,3)
for i,v in MANN.items(): F[i]['c']['mann']=round(v*F[i]['g']/100,3)
for i in (1511,2484,2413):   # avocado and bell peppers: the source gives polyols without saying which
    nofig(i,'sorb'); nofig(i,'mann')
# Chumpitazi 2018 found neither in these, so they hold none (as every other food in the table): banana, grapes, orange, pineapple, strawberries, tomato,
# lettuce, spinach, white and brown rice, potato chips, fries, peanut butter, butter, cheddar.

# ---------- tyramine, estimated: EFSA 2011, Table 11, mg per kg (lower bound, upper bound) ----------
TYR={'beer':(6.1,6.1),'wine_red':(2.7,2.9),'wine_white':(1.1,1.2),'fish':(6.8,14.6),'sausage':(136,136),'ripened_meat':(44.0,44.2),
     'meat':(16.1,16.2),'cheese':(68.5,104),'hard_cheese':(82.9,113),'dairy_other':(0.3,0.3),'sauce_other':(1.5,10.5),'veg_fermented':(45,47.4)}
for f in d['foods']:
    if 'hist' not in f['b']: continue
    cat=f.get('hcat')
    if cat: lo,hi=TYR[cat]; f['c']['tyr']=round((lo+hi)/2*f['g']/1000,2)
    else: nofig(f['id'],'tyr')        # no food type fits (as for histamine): a cold-cut sub, pepperoni pizza, tempeh, the leftovers marker

put([2214,2213,2501,2536,2546,2506,2185,501999,3671],'ox')          # the list's High band: 30 mg a serving or more
put([2506,2185,4407,501999],'ga')                                    # potato foods: the ones EFSA 2020 has figures for
put([4963],'cap')
put([4066,4067,3671,3893,3915,501819,3812,501975,501976,4650,4635,4617,4962,1055,4903,502357,4464,4049,6248,2401,2546],'fru')   # wheat foods, onion, cashews
put([3248,3379,3393,3390,3253,4870,2546,2412],'gos')                   # beans, lentils, chickpeas, hummus, cashews; green peas (Biesiekierski 2011)
put([2850,2852,2943,2835,1745,1718,2185,501999,2494,2201,2062,2462],'sulph')
put([5407,1859,1148,1185,5684,4086,501975,4650,4962],'nitr')
put([f['id'] for f in d['foods'] if 'swt' in f['b']],'swt')
put([f['id'] for f in d['foods'] if 'gluten' in f['b']],'glu')
put([5288,2926,502444,930003]+[f['id'] for f in d['foods'] if f['grp']=='energy'],'flav')   # colas, the protein shake, flavoured sparkling water, energy drinks
put([2657,5335,3203],'pur')                                             # Kaneko's high and very high groups: 200 mg per 100 g or more
json.dump(d,open(P,'w'),ensure_ascii=False)
import collections
n=collections.Counter(k for f in d['foods'] for k in f['c']); print(dict(n)); print('foods with any:',sum(1 for f in d['foods'] if f['c']))
nx=collections.Counter(k for f in d['foods'] for k in (f.get('x') or [])); print('no figure:',dict(nx))
print('Health Canada figures read:',counts['fig']); print('no figure, at half a gram or more:',counts['none'])
for i in (2873,4148,2214,2506,910007,1731,119,5684,920001,61): print(F[i]['n'][0],F[i]['c'],F[i].get('x'))
