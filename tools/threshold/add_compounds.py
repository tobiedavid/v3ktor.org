"""Threshold Log data, step 3 of 3. Adds what each food carries beyond the ring: f['c'] = {compound: amount per serving}, or 1 where only "a portion of it" is known.
A number only where a source gives one:
  caffeine, theobromine .. Health Canada, Canadian Nutrient File 2015 (mg per 100 g), times the serving's weight; energy drinks from their labels
  nitrate ............... EFSA Journal 2008;689, Tables 2 to 10: the median for the vegetable (mg/kg), times the serving's weight
Portions only (the food is one the source names as carrying it; no per-serving figure entered yet):
  tyramine (the histamine foods, EFSA 2011), oxalates (the Harvard list's High band, 30 mg a serving or more), glycoalkaloids (EFSA 2020: potato foods),
  capsaicin, fructans / galacto-oligosaccharides / sorbitol / mannitol / excess fructose (Monash University), sulphites (Health Canada's list),
  added nitrites (cured meats), sweeteners and gluten (the Food Trial Log's own tags), purines (Kaneko 2014: beef liver, chicken liver, sardine)."""
import json, csv, sys
#   python3 -I add_compounds.py <the table from build_data.py> <folder with Health Canada's CSV files> <tables.json from dump_tables.js>
P, CNF, TABLES = sys.argv[1:4]; d=json.load(open(P)); F={f['id']:f for f in d['foods']}
cnf={'262':{}, '263':{}}
with open(CNF+'/NUTRIENT AMOUNT.csv',encoding='latin-1') as fh:
    r=csv.reader(fh); next(r)
    for row in r:
        if row[1] in cnf and row[0].isdigit() and int(row[0]) in F: cnf[row[1]][int(row[0])]=float(row[2])
for f in d['foods']: f['c']={}
def put(ids,key,val=1):
    for i in ids: assert i in F,(key,i); F[i]['c'][key]=val
for i,v in cnf['262'].items():
    if v>0 and F[i]['g']: F[i]['c']['caf']=round(v*F[i]['g']/100,0)
for i,v in cnf['263'].items():
    if v>0 and F[i]['g']: F[i]['c']['theo']=round(v*F[i]['g']/100,0)
T=json.load(open(TABLES)); TF={f['id']:f for f in T['TF']}
for f in d['foods']:
    t=TF.get(f['id'])
    if t and t.get('label') and t['n'].get('caf',0)>0: f['c']['caf']=t['n']['caf']     # a branded can: the figure on its label, as The Patch's table carries it
F[920103].setdefault('x',[]); 
if 'caf' not in F[920103]['x']: F[920103]['x'].append('caf')                                                           # a caffeine pill: brands vary, so no figure
NIT={2214:785,2213:785,2116:1097,2398:844,2501:1100,2386:693,2361:223,2062:223,2105:267,2375:209,2380:125,2506:106,2460:26,2462:26,2363:156,2046:122,2019:293,2412:1,2401:60,2484:28,2413:28,2225:297,1991:24,2028:1,2399:43,2306:392}
for i,v in NIT.items(): assert i in F; F[i]['c']['nit']=round(v*F[i]['g']/1000,1)
put([f['id'] for f in d['foods'] if 'hist' in f['b']],'tyr')
put([2214,2213,2501,2536,2546,2506,2185,501999,3671],'ox')          # the list's High band: 30 mg a serving or more
put([2506,2185,4407,501999],'ga')                                    # potato foods: the ones EFSA 2020 has figures for
put([4963],'cap')
put([4066,4067,3671,3893,3915,501819,3812,501975,501976,4650,4635,4617,4962,1055,4903,502357,4464,4049,6248,2401,2546],'fru')   # wheat foods, onion, cashews
put([3248,3379,3393,3390,3253,4870,2546],'gos')                        # beans, lentils, chickpeas, hummus, cashews
put([1696,1731],'sorb'); put([2399,2386],'mann'); put([1696,1731,1603,1691,1745],'fruc')
put([2850,2852,2943,2835,1745,1718,2185,501999,2494,2201,2062,2462],'sulph')
put([5407,1859,1148,1185,5684,4086,501975,4650,4962],'nitr')
put([f['id'] for f in d['foods'] if 'swt' in f['b']],'swt')
put([f['id'] for f in d['foods'] if 'gluten' in f['b']],'glu')
put([2657,5335,3203],'pur')                                             # Kaneko's high and very high groups: 200 mg per 100 g or more
json.dump(d,open(P,'w'),ensure_ascii=False)
import collections
n=collections.Counter(k for f in d['foods'] for k in f['c']); print(dict(n)); print('foods with any:',sum(1 for f in d['foods'] if f['c']))
for i in (2873,4148,2214,2506,910007): print(F[i]['n'][0],F[i]['c'])
