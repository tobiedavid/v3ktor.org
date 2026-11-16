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
  oxalate ............... the Harvard oxalate list, Kidney Stone Diet (Jill Harris), version 2.3.1, mg per household serving: the 2023 revised list,
                          else the original list in the same file; brought to the app's serving by weight (OX below)
  purines ............... USDA & ODS-NIH Database for the Purine Content of Foods, 2023, the total of the four bases, mg per 100 g (mg per 100 ml
                          for beer, wine and whiskey), times the serving's weight (PUR below)
  Water, sugar and oils with no row in these two count as none: no plant or animal cells.
Portions only (the food is one the source names as carrying it; no per-serving figure entered yet):
  glycoalkaloids (EFSA 2020: potato foods),
  capsaicin, fructans / galacto-oligosaccharides (Monash University; green peas: Biesiekierski and others 2011, 1.88 g per 100 g, via Liljebo and others 2020),
  sulphites (Health Canada's list), added nitrites (cured meats), sweeteners and gluten (the Food Trial Log's own tags),
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

put([2506,2185,4407,501999],'ga')                                    # potato foods: the ones EFSA 2020 has figures for
put([4963],'cap')
put([4066,4067,3671,3893,3915,501819,3812,501975,501976,4650,4635,4617,4962,1055,4903,502357,4464,4049,6248,2401,2546],'fru')   # wheat foods, onion, cashews
put([3248,3379,3393,3390,3253,4870,2546,2412],'gos')                   # beans, lentils, chickpeas, hummus, cashews; green peas (Biesiekierski 2011)
put([2850,2852,2943,2835,1745,1718,2185,501999,2494,2201,2062,2462],'sulph')
put([5407,1859,1148,1185,5684,4086,501975,4650,4962],'nitr')
put([f['id'] for f in d['foods'] if 'swt' in f['b']],'swt')
put([f['id'] for f in d['foods'] if 'gluten' in f['b']],'glu')
put([5288,2926,502444,930003]+[f['id'] for f in d['foods'] if f['grp']=='energy'],'flav')   # colas, the protein shake, flavoured sparkling water, energy drinks
# ---------- oxalate: the Harvard oxalate list, mg per household serving ----------
# Kidney Stone Diet (Jill Harris), Harvard Oxalate Food List v2.3.1: the 2023 revised list where it names the food, else the original list in
# the same file (marked O). The list gives mg for its own serving; the app's serving is converted by weight:
#   ('n', mg, k): the app's serving is k of the list's servings (the same unit: one apple, one slice, 1 tbsp)
#   ('g', mg, grams): the list's serving weighs that much. Ounces: 28.35 g. A US cup (236.6 ml), fluid ounce (29.57 ml) or tbsp (14.79 ml):
#   the weight of that volume of the same food from Health Canada's measures for it (V below).
OZ=28.35
def V(ml, g, per_ml):   # grams in ml of a food whose Health Canada measure of per_ml weighs g
    return g*ml/per_ml
CUP, FLOZ, TBSP = 236.6, 29.57, 14.79
OX={130:('n',0,1),          # egg, raw whole: one
    5407:('n',0.5,1),       # bacon: 2 slices
    1859:('g',0.7,5*OZ),    # back bacon (cured pork): ham, canned, 5 oz
    1414:('n',0,1),         # instant oatmeal: Quaker instant, 2/3 cup: 0
    1242:('g',0.8,V(1.5*CUP,26.4,250)),   # corn flakes, 1 1/2 cup
    1256:('g',6.6,V(CUP,39.4,250)),       # Cheerios honey nut, 1 cup
    4066:('n',4.4,1), 4067:('n',13.6,1),  # bread, white / whole wheat: 1 slice
    3671:('n',9,1),         # O: plain bagel, 1 bagel
    3893:('n',4.4,1),       # donut, glazed: one
    3915:('n',7,1),         # muffin, blueberry: one
    3399:('n',19.2,2),      # peanut butter: 1 tbsp
    118:('n',0,1),          # butter: 1 tsp
    502170:('g',0.5,6*OZ),  # yogurt, plain, whole milk: 6 oz
    502158:('g',0.8,6*OZ),  # yogurt, nonfat with fruit: 6 oz
    25:('n',0.1,1),         # cottage cheese: 1/2 cup
    61:('g',0.7,V(8*FLOZ,257.8,250)),     # milk, 2%: 8 oz
    113:('g',0.5,V(8*FLOZ,257.8,250)),    # milk, whole: 8 oz
    70:('g',7,V(CUP,264.2,250)),          # O: chocolate milk, 1 cup
    1620:('g',1.1,V(6*FLOZ,263.1,250)),   # orange juice: 6 oz
    1704:('n',10.3,1), 1696:('n',0.7,1), 1722:('n',23.3,1),   # banana, apple, orange: one
    2873:('g',1.7,V(8*FLOZ,250.2,250)),   # coffee, brewed: 8 oz
    2877:('g',2.2,V(8*FLOZ,252.8,250)),   # coffee, prepared instant decaf: 8 oz
    136:('n',0,1),          # cream, fluid light: 1 tbsp: 0
    4318:('n',0,1),         # sugar, granulated: 1 tsp
    2909:('g',6.4,V(8*FLOZ,250.4,250)),   # tea, brewed: 8 oz
    910001:('n',0,1), 910002:('n',0,1), 910003:('n',0,1),     # Red Bull, Red Bull sugar free: 0
    5288:('n',0,1),         # cola, caffeinated: 12 oz: 0
    2926:('n',0.4,1),       # diet soda with caffeine: 12 oz (a 355 ml can)
    2943:('g',3.9,V(12*FLOZ,356.6,355)), 2835:('g',3.9,V(12*FLOZ,354.2,355)),   # beer regular, light: 12 oz
    2850:('g',1.2,V(5*FLOZ,149.6,150)), 2852:('g',0.3,V(5*FLOZ,149.6,150)),    # wine, red / white: 5 oz
    2846:('n',0,1), 2844:('n',0,1),       # spirits: 1 1/2 oz: 0
    502447:('n',1.5,1),     # whey powder high protein drink: 1 scoop
    4407:('g',12.1,OZ), 4127:('g',7.1,OZ),  # potato chips / corn chips, tortilla: 1 oz
    4124:('n',4,2),         # O: rice cake, 1 cake
    501819:('n',6.1,2),     # snack bar, granola: one
    4186:('g',7,1.5*OZ),    # candies, milk chocolate: 1 1/2 oz
    6230:('g',35.4,2*OZ),   # candy bar: 2 oz
    3812:('n',6,2),         # cookie, chocolate chip: 1 cookie
    2536:('g',72,OZ), 2546:('g',63.5,OZ), 2577:('g',45.2,OZ), 2590:('g',11.7,OZ),   # almonds, cashews, mixed nuts, walnuts: 1 oz
    3302:('g',29,OZ),       # peanuts, oil roasted, salted: 1 oz
    2516:('g',7.7,V(CUP/4,35.0,60)),      # pumpkin and squash seed kernels: 1/4 cup
    2526:('g',2.9,V(CUP/4,11.7,60)),      # sunflower seed kernels, dried: 1/4 cup
    2593:('n',16.2,1),      # tahini: 1 tbsp
    4528:('n',0.2,1),       # flaxseed, ground: 1 tbsp
    1148:('g',0.7,5*OZ),    # ham, canned: 5 oz
    1154:('g',0.1,5*OZ), 920002:('g',0.1,5*OZ),   # beef, top market cuts: 5 oz
    2696:('g',0.2,3*OZ),    # beef patty, 80% lean: 3 oz
    2657:('g',0.1,4*OZ),    # beef liver: 4 oz
    5335:('g',0.1,OZ),      # chicken liver: 1 oz
    1787:('g',0.1,5*OZ),    # pork loin/chops: 5 oz
    1816:('g',0,5*OZ),      # O: pork, 5 oz
    691:('g',0,3*OZ),       # turkey meat, roasted: 3 oz
    920001:('g',0.2,3*OZ),  # chicken (meat and skin), roasted: 3 oz
    3588:('g',0,3*OZ), 3580:('g',0,3*OZ), 3572:('g',0,3*OZ),   # O: moose, venison, buffalo: 3 oz
    502213:('g',0.3,OZ),    # cheese, American, processed: 1 oz
    119:('g',0.1,OZ), 110:('g',0.1,OZ), 28:('g',0.1,OZ),     # cheddar, mozzarella, cream cheese: 1 oz
    4617:('n',13,1),        # O: cheeseburger with bun
    2185:('g',48.6,6*OZ),   # french fries, fast food: 6 oz
    4962:('n',8.5,0.5),     # pizza, cheese: 2 slices
    6248:('n',3,1),         # O: chicken nuggets, 6 nuggets
    1185:('n',0.7,1),       # beef hot dog: one
    502357:('g',15.3,V(CUP,199.7,250)),   # macaroni and cheese: 1 cup
    4963:('g',24,V(CUP,255.7,250)),       # O: chili with beans, 1 cup
    3248:('g',57.5,V(CUP/2,268.4,250)),   # beans, baked: 1/2 cup
    3379:('g',9.9,V(CUP/2,135.2,125)),    # beans, red kidney: 1/2 cup
    3253:('g',10.5,V(CUP/2,97.7,125)),    # beans, black: 1/2 cup
    3393:('g',2.4,V(CUP/2,104.6,125)),    # lentils: 1/2 cup
    4870:('g',39.1,V(CUP/4,62.4,60)),     # hummus: 1/4 cup
    3404:('g',13,3.5*OZ),   # O: tofu, 3.5 oz (the revised list has soft tofu only)
    5968:('n',5,1),         # burger, vegetable: one
    3203:('g',0.3,4*OZ),    # sardines, canned: 4 oz
    5965:('g',0.3,4*OZ),    # salmon, pink, canned with bones: 4 oz
    920004:('g',0.2,4*OZ),  # salmon, Atlantic, farmed: 4 oz
    3081:('g',1.5,3.5*OZ),  # tuna, light, canned in water: 3.5 oz
    3212:('g',0.1,3*OZ),    # shrimp: 3 oz
    3118:('n',0.1,1),       # oysters, raw: 6 medium
    3111:('g',0.1,3*OZ),    # clams, cooked: 3 oz
    3094:('g',0,3*OZ),      # O: Alaskan king crab, 3 oz
    3022:('g',0,4*OZ), 3015:('g',0.7,4*OZ), 3037:('g',0,4*OZ),   # mackerel, herring, cod: 4 oz
    501948:('n',0,1),       # egg yolk: one
    920110:('n',0,1),       # Egg Beaters (egg white): 0
    4163:('g',1,V(CUP,139.5,250)),        # ice cream, vanilla: 1 cup
    502188:('g',0.6,5.3*OZ),              # yogurt, Greek, plain, nonfat: 5.3 oz
    5917:('g',54.4,V(CUP,195.5,250)),     # quinoa: 1 cup
    4523:('g',3.8,V(CUP,166.9,250)), 4497:('g',18.7,V(CUP,206.4,250)),   # rice, white / brown: 1 cup
    4464:('g',16.5,V(CUP,147.9,250)),     # spaghetti: 1 cup
    1439:('n',0,1),         # oats: 0
    4049:('n',9,0.5),       # tortillas, flour: two
    2506:('n',91.7,1),      # potato, baked, flesh and skin: one
    2375:('g',6,V(CUP/2,82.4,125)),       # broccoli, boiled: 1/2 cup
    2214:('g',547.4,V(CUP/2,95.1,125)),   # spinach, boiled: 1/2 cup
    2213:('g',316.2,V(CUP,31.7,250)),     # spinach, raw: 1 cup
    2380:('g',4.5,72/2),    # carrots, raw: 1/2 large (a large carrot: 72 g)
    2460:('n',7,1),         # O: tomato, 1 medium (the revised list's 2 slices have no weight)
    2401:('n',2.1,0.5),     # onions, raw: one
    2399:('n',0,1),         # mushrooms, white raw: 0
    1511:('n',9.5,1),       # avocado: 1/2 fruit
    2105:('g',1.1,V(CUP/2,68.7,125)),     # kale, boiled: 1/2 cup
    2116:('g',0.3,V(CUP,59.2,250)), 2398:('g',0.4,V(CUP,58.1,250)),   # lettuce, romaine / iceberg: 1 cup
    2019:('g',13.6,V(CUP/2,71.3,125)),    # green beans: 1/2 cup
    2412:('g',0.5,V(CUP/2,84.5,125)),     # peas: 1/2 cup
    2272:('g',4.5,V(CUP/2,96.2,125)),     # mixed frozen vegetables: 1/2 cup
    2028:('g',17,V(CUP/2,81.9,125)),      # Brussels sprouts: 1/2 cup
    2046:('g',0.5,V(CUP/2,65.5,125)),     # cauliflower: 1/2 cup
    1991:('g',8.7,V(CUP/2,95.1,125)),     # asparagus: 1/2 cup
    2361:('g',1,V(CUP/2,37.0,125)),       # O: cabbage, 1/2 cup
    2062:('g',2.4,V(CUP/2,63.4,125)),     # coleslaw: 1/2 cup
    2201:('g',1,V(CUP/2,75.0,125)),       # O: sauerkraut, 1/2 cup
    2363:('n',1,2),         # cucumber: 1/4 cuke
    2484:('g',2.2,20), 2413:('g',2.2,20), # peppers, raw: 2 rings (a ring: 10 g)
    2386:('g',7.6,20),      # celery, raw: 1/2 medium stalk (a medium stalk: 40 g)
    2241:('g',54.2,V(CUP/2,105.7,125)),   # sweet potato, baked: 1/2 cup
    2306:('g',4,V(CUP/2,108.3,125)),      # winter squash: 1/2 cup
    2501:('g',76.4,V(CUP/2,89.8,125)),    # beets: 1/2 cup
    2209:('g',48,V(CUP/2,95.1,125)),      # soybeans, green: 1/2 cup
    2068:('g',0.8,V(CUP/2,86.6,125)),     # corn: 1/2 cup
    2225:('g',1,V(CUP/2,65.5,125)),       # O: zucchini, 1/2 cup
    1749:('g',1.2,V(CUP/2,80.3,125)),     # strawberries: 1/2 cup
    1706:('g',18.5,V(CUP/2,81.9,125)),    # blueberries: 1/2 cup
    1718:('g',1.2,V(CUP/2,79.8,125)),     # grapes: 1/2 cup
    1734:('g',5.2,V(CUP/2,87.2,125)),     # pineapple, raw: 1/2 cup
    1721:('g',1.4,552/4),   # cantaloupe: 1/4 melon (a medium melon: 552 g)
    1585:('n',16,1),        # O: kiwi, 1 fruit
    1731:('n',1.8,1),       # pear: one
    1603:('n',0.3,1),       # mango: 1/2 fruit
    1745:('g',2.5,OZ),      # raisins: 1 oz
    2494:('n',1.5,1), 3403:('n',2.9,1),   # ketchup, soy sauce: 1 tbsp
    4148:('g',67.7,1.5*OZ), # chocolate, dark: 1 1/2 oz
    501527:('g',9.6,V(8*FLOZ,258.9,250)), # soymilk: 8 oz
    509001:('n',20.1,1),    # bars, high protein: one
    900007:('n',0,1),       # O: cod liver oil, 1 tsp
    930001:('n',0,1)}       # water, tap
# no list row, and not a fat, sugar or water: a meal with one sits out of the oxalate row
NOOX=[502393,502395,910004,910005,910006,910007,   # energy drinks other than Red Bull
      2875,                 # instant coffee, regular (the list has instant decaf only)
      502444,502442,509002, # the ready-to-drink protein shake; almond, cashew or oat milk (the list's almond and other plant milks differ a hundredfold); sugar-free candy
      4086,501975,501976,4650,4635,501999,1055,4903,   # jerky, the sandwiches, the sub, the hamburger, poutine, chicken noodle soup, instant ramen
      3116,5634,3210,2985,2654,2655,2669,577,1159,5684,   # mussels, scallops, lobster, anchovies, the organ meats, pâté, salami
      109,40,6291,          # Gouda, Parmesan, kefir
      3390,3321,2511,503362,2544,   # chickpeas, tempeh, chia, hemp, Brazil nut
      2462,1691]            # canned tomatoes; watermelon (the list's slice has no weight)
# ---------- purines: USDA & ODS-NIH Database for the Purine Content of Foods, 2023, total of the four bases, mg per 100 g ----------
# Table 1 (North American samples) where it has the food, else Table 2; alcohol from Table 3, mg per 100 ml. Where Table 3 leaves the total
# blank, the four bases added up. Two rows for one food: their mean. The source's raw figure where it has no cooked one.
PUR={130:0, 501948:0, 920110:0,          # egg, chicken, raw (T2): 0, so its parts hold none either
     5407:61.8,             # bacon, unprepared (T2), on the raw weight: 2 raw slices weigh 52 g (Health Canada)
     1859:69.3, 1148:69.3,  # ham, pressed (T2)
     1242:1,                # corn cereal (T1)
     4066:12.2,             # bread, white (T1)
     3399:49.1, 3302:49.1,  # peanuts, raw (T2)
     118:0,                 # butter: not detected (T2)
     502170:7, 25:8, 502213:2,   # yogurt plain, cottage cheese, processed cheese (T1)
     502158:5.2,            # yogurt, not further specified (T2)
     61:0, 113:0,           # milk (T2)
     136:0.2,               # cream, animal, fresh (T2)
     1620:1.06,             # fruit juice (T2)
     1704:3, 1749:2.2, 1511:18.4,   # banana, strawberries, avocado (T2)
     4318:0,                # sugar: no cells
     4186:8.1,              # chocolate (T2)
     2536:31.4, 2590:19.6, 2511:58.64, 2593:36.3,   # almonds, walnuts, chia, sesame (T2)
     1154:124.8, 920002:124.8,   # beef roast, cooked (T1)
     2696:89.9,             # beef, ground, cooked (T1)
     1185:49.9,             # frankfurter (T2)
     3203:399, 5965:88, 3081:142, 3212:234, 3022:194, 2985:321,   # sardine, salmon, tuna canned; shrimp; mackerel; anchovy canned (T1)
     3118:122,              # oysters, raw (T2; T1 has canned)
     3111:136,              # clams, raw (T1)
     3094:118.05,           # crab, red king (T2)
     5634:76.5, 3015:139.2, 3037:97.9,   # scallops, herring raw, cod (T2)
     920004:(250+181)/2,    # salmon, mixed species (T1) and trout, rainbow (T2)
     3404:31.1,             # tofu, raw (nigari) (T2)
     2657:197, 2654:171, 2655:230.8, 577:125.4,   # beef liver, heart, kidney cooked; chicken heart (T1)
     5335:(243+236.1)/2,    # chicken liver, two rows (T1)
     2669:90.4, 1159:80, 5684:120.4,   # beef tongue, liver pâté, salami (T2)
     1787:119.8, 1816:119.8,   # pork roast and chops, cooked (T1)
     691:96,                # turkey, ground, raw (T1)
     920001:(178.5+148.9)/2,   # chicken breast and thigh, roasted (T1)
     2506:6.5, 2241:17, 2306:56.7,   # potato, sweet potato, pumpkin (T2)
     4523:5.9,              # rice, white, cooked (T1)
     4464:6.8,              # spaghetti (T2)
     2375:51.8, 2214:39.2, 2213:102.7,   # broccoli boiled, spinach boiled / raw (T2)
     2380:2.1, 2460:6.6, 2401:2.2, 2363:9.4, 2225:13.1, 2068:11.8, 2361:3.2, 2484:5.1,   # carrots, tomato, onion, cucumber, zucchini, corn, cabbage, red pepper (T2)
     2399:46.9,             # mushrooms, raw (T1)
     2116:4.7, 2398:4.7,    # lettuce (T2)
     2019:7.5, 2412:21.9, 2046:57.2, 1991:32.9, 2209:48,   # green beans, peas, cauliflower, asparagus, green soybeans (T2)
     2494:10.6, 3403:50.2,  # ketchup, soy sauce (T2)
     40:13.0,               # cheese, grated (T2)
     3390:26.1,             # chickpeas, not further specified (T2)
     501527:21.91,          # soy milk (T2)
     5968:65.49,            # veggie burgers or soyburgers (T2)
     900007:0, 920109:0,    # cod liver oil, coconut oil: fat, no cells
     930001:0, 930002:0, 930003:0}   # water: no cells
PURML={2943:(8.48,341), 2850:(1.19,150), 2852:(1.19,150), 2844:(0.21,44.4)}   # beer 'regular' type, wine, whiskey (T3), per 100 ml
NONE=[900006,920109,930002,930003]   # fish oil, coconut oil, sparkling water: a fat or water, no list row, none
for f in d['foods']:
    i, g = f['id'], f['g'] or 0
    if f['grp']=='sup' and i not in OX or i==509003: continue    # pills and the leftovers marker: nothing to count
    if i in OX:
        how, mg, a = OX[i]
        v = mg*a if how=='n' else mg*g/a
        if v>0: f['c']['ox']=round(v,2)
    elif i not in NONE: assert i in NOOX, ('a food with no oxalate entry', i, f['n'][0]); nofig(i,'ox')
    if i in PURML:
        per, ml = PURML[i]; v = per*ml/100
    elif i in PUR: v = PUR[i]*(52 if i==5407 else g)/100
    else: nofig(i,'pur'); continue
    if v>0: f['c']['pur']=round(v,2)
assert not set(OX)&set(NOOX)
json.dump(d,open(P,'w'),ensure_ascii=False)
import collections
n=collections.Counter(k for f in d['foods'] for k in f['c']); print(dict(n)); print('foods with any:',sum(1 for f in d['foods'] if f['c']))
nx=collections.Counter(k for f in d['foods'] for k in (f.get('x') or [])); print('no figure:',dict(nx))
print('Health Canada figures read:',counts['fig']); print('no figure, at half a gram or more:',counts['none'])
for i in (2873,4148,2214,2506,910007,1731,119,5684,920001,61): print(F[i]['n'][0],F[i]['c'],F[i].get('x'))
