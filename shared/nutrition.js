/* ==== shared/nutrition.js: the Nutrition rules every V3KTOR food app uses. Edit it in shared/, then run node tools/shared.js --write. ==== */
const NUTRI=(()=>{
  const NUT=[ /* key, unit, label [en, fr], what it's for [en, fr], decimals; cap: a limit, not a need; ceil: too much can hurt; gl: the glossary entry */
    {k:'prot',u:'g',l:['Protein','Protéines'],w:['muscle, repair, steady energy','muscles, réparation, énergie stable'],d:0},
    {k:'fib',u:'g',l:['Fibre','Fibres'],w:['gut, fullness, steadier stools','intestin, satiété, selles plus régulières'],d:0,gl:'fibre'},
    {k:'fe',u:'mg',l:['Iron','Fer'],w:['oxygen, energy','oxygène, énergie'],d:1},
    {k:'mg',u:'mg',l:['Magnesium','Magnésium'],w:['sleep, muscles, energy','sommeil, muscles, énergie'],d:0},
    {k:'k',u:'mg',l:['Potassium','Potassium'],w:['blood pressure, cramps','pression, crampes'],d:0},
    {k:'b1',u:'mg',l:['Thiamine (B1)','Thiamine (B1)'],w:['turning carbs and alcohol into energy','transformer glucides et alcool en énergie'],d:2},
    {k:'b2',u:'mg',l:['Riboflavin (B2)','Riboflavine (B2)'],w:['turning food into energy','transformer la nourriture en énergie'],d:1,gl:'bvits'},
    {k:'b3',u:'mg',l:['Niacin (B3)','Niacine (B3)'],w:['energy from food — counts what protein makes too','énergie tirée des aliments — compte ce que les protéines fabriquent'],d:0,gl:'bvits'},
    {k:'b6',u:'mg',l:['Vitamin B6','Vitamine B6'],w:['protein, blood, nerves — too much can hurt','protéines, sang, nerfs — trop peut nuire'],d:1,gl:'b6'},
    {k:'b12',u:'mcg',l:['B12','B12'],w:['nerves, blood, fog','nerfs, sang, brouillard'],d:1},
    {k:'fol',u:'mcg',l:['Folate','Folate'],w:['blood, repair','sang, réparation'],d:0},
    {k:'zn',u:'mg',l:['Zinc','Zinc'],w:['healing, taste, immune','guérison, goût, immunité'],d:1},
    {k:'se',u:'mcg',l:['Selenium','Sélénium'],w:['thyroid, antioxidant enzymes — too much can hurt','thyroïde, enzymes antioxydantes — trop peut nuire'],d:0,gl:'selenium'},
    {k:'cu',u:'mg',l:['Copper','Cuivre'],w:['moving iron, making energy, nerves','déplacer le fer, produire l’énergie, les nerfs'],d:1,gl:'copper'},
    {k:'ca',u:'mg',l:['Calcium','Calcium'],w:['bone, muscle','os, muscles'],d:0},
    {k:'c',u:'mg',l:['Vitamin C','Vitamine C'],w:['iron absorption, repair','absorption du fer, réparation'],d:0},
    {k:'e',u:'IU',l:['Vitamin E','Vitamine E'],w:['antioxidant in fats and cell walls','antioxydant dans les gras et les membranes'],d:0,gl:'vite'},
    {k:'d',u:'IU',l:['Vitamin D','Vitamine D'],w:['bone, immune — almost none from the sun October to March','os, immunité — presque rien du soleil d’octobre à mars'],d:0},
    {k:'va',u:'mcg',l:['Vitamin A','Vitamine A'],w:['eyes, skin, immune — too much can hurt','yeux, peau, immunité — trop peut nuire'],d:0,ceil:true},
    {k:'mn',u:'mg',l:['Manganese','Manganèse'],w:['enzymes for bone, blood sugar and clotting','enzymes des os, de la glycémie et de la coagulation'],d:1,gl:'manganese'},
    {k:'vk',u:'mcg',l:['Vitamin K','Vitamine K'],w:['clotting; the proteins that put calcium in bone','coagulation; les protéines qui mettent le calcium dans l’os'],d:0},
    {k:'na',u:'mg',l:['Sodium','Sodium'],w:['a cap, not a target','un plafond, pas une cible'],d:0,cap:true},
    {k:'caf',u:'mg',l:['Caffeine','Caféine'],w:['Health Canada’s daily limit','la limite quotidienne de Santé Canada'],d:0,cap:true,gl:'caffeine'},
    {k:'sd',u:'',l:['Alcohol — standard drinks','Alcool — consommations standard'],w:['Canada’s guidance: no more than 2 on any day','repère canadien : pas plus de 2 par jour'],d:1,cap:true,gl:'drinks'},
    {k:'kcal',u:'kcal',l:['Fuel (calories)','Carburant (calories)'],w:['rough — by weight and work','approximatif — selon poids et travail'],d:0,fuel:true}
  ];

  /* The daily needs. Health Canada's Dietary Reference Intakes (elements, vitamins; sodium and potassium as revised in 2019), by sex and age;
     the pregnancy and lactation columns; vitamin E in IU of the natural form (1 mg = 1.49 IU). Protein: 0.8 g per kg (1.1 pregnant, 1.3
     breastfeeding; 1.6 with a muscle goal). Calories: kg × 28, 32 or 36 by the kind of day, + 340 pregnant or 350 breastfeeding: rough, not a DRI.
     The person (every answer can be missing):
       sex 'm' | 'f' (missing: the higher of the two)   age 'a1' 19–30 | 'a2' 31–50 | 'a3' 51–70 | 'a4' 71+ | 'minor' under 19
       kg  a number (missing: 70)   work 'sit' | 'feet' | 'heavy' (missing: 'feet')
       smoke, preg, bf, veg, muscle  true or false (muscle: the goal is muscle, and nothing rules out more protein) */
  function needs(p){ p=p||{};
    const sex=p.sex||'hi'; const age=p.age==='minor'?'a1':(p.age||'a2'); const kg=(Number.isFinite(+p.kg)&&+p.kg>0)?+p.kg:70; const work=p.work||'feet';
    const M={ca:age==='a4'?1200:1000, fe:8, mg:age==='a1'?400:420, k:3400, zn:11, c:90, b1:1.2, fol:400, b12:2.4, d:age==='a4'?800:600, vk:120, va:900, mn:2.3, cu:0.9, fib:(age==='a3'||age==='a4')?30:38, e:15, b2:1.3, b3:16, b6:(age==='a3'||age==='a4')?1.7:1.3, se:55};
    const F={ca:(age==='a3'||age==='a4')?1200:1000, fe:(age==='a1'||age==='a2')?18:8, mg:age==='a1'?310:320, k:2600, zn:8, c:75, b1:1.1, fol:400, b12:2.4, d:age==='a4'?800:600, vk:90, va:700, mn:1.8, cu:0.9, fib:(age==='a3'||age==='a4')?21:25, e:15, b2:1.1, b3:14, b6:(age==='a3'||age==='a4')?1.5:1.3, se:55};
    let T={}; for(const k of Object.keys(M)) T[k]= sex==='m'?M[k] : sex==='f'?F[k] : Math.max(M[k],F[k]);
    if(p.preg){ T.fe=27; T.mg=age==='a1'?350:360; T.k=2900; T.zn=11; T.c=85; T.b1=1.4; T.fol=600; T.b12=2.6; T.vk=90; T.va=770; T.mn=2.0; T.cu=1.0; T.fib=28; T.b2=1.4; T.b3=18; T.b6=1.9; T.se=60; }
    /* lactation column: iron drops back to 9; vitamin A, C, zinc, folate, B12 and manganese go up */
    else if(p.bf){ T.ca=1000; T.fe=9; T.mg=age==='a1'?310:320; T.k=2800; T.zn=12; T.c=120; T.b1=1.4; T.fol=500; T.b12=2.8; T.vk=90; T.va=1300; T.mn=2.6; T.cu=1.3; T.fib=29; T.e=19; T.b2=1.6; T.b3=17; T.b6=2.0; T.se=70; }
    T.e=Math.round(T.e*1.49*10)/10; /* vitamin E in IU (food, natural form): 15 mg is 22 IU, 19 mg is 28 */
    if(p.smoke) T.c+=35;
    /* vegetarian and vegan: NIH/IOM: iron 1.8× (plant iron absorbs less), zinc up to 1.5×. Not in pregnancy: 27 mg is already the need. */
    if(p.veg){ if(!p.preg) T.fe=Math.round(T.fe*1.8); T.zn=Math.round(T.zn*1.5); }
    /* plant omega-3 (ALA) adequate intake, g/day */
    T.ala = p.preg?1.4 : p.bf?1.3 : sex==='f'?1.1 : 1.6;
    /* upper limits (Health Canada DRI tables): D 4,000 IU, iron 45 mg, zinc 40 mg, vitamin C 2,000 mg, calcium 2,500 mg (2,000 over 50).
       Vitamin E's ceiling counts supplements only: 1,100 IU, the synthetic form's, so it holds for either form. */
    T.ul={d:4000, fe:45, zn:40, c:2000, ca:(age==='a3'||age==='a4')?2000:2500, mn:11, cu:10, e:1100, b6:100, se:400};
    /* caffeine: Health Canada maximums: 400 mg adults, 300 pregnant or breastfeeding, 2.5 mg/kg under 18 */
    T.caf = p.age==='minor' ? Math.round(2.5*kg) : (p.preg||p.bf) ? 300 : 400;
    /* alcohol: Canada's Guidance on Alcohol and Health (2023): no more than 2 on any day; none in pregnancy, while breastfeeding, or under 18 */
    T.sd = (p.preg||p.bf||p.age==='minor') ? 0 : 2;
    T.na=2300; T.prot=Math.round((p.muscle?Math.max(1.6,p.bf?1.3:p.preg?1.1:0.8):(p.bf?1.3:p.preg?1.1:0.8))*kg); T.kcal=Math.round(kg*(work==='sit'?28:work==='feet'?32:36))+(p.bf?350:p.preg?340:0);
    return T;
  }
  /* a total against its need: a limit (sodium, caffeine, alcohol) is only over or not; calories are fine from 85% to 130% */
  function band(k,pct){ if(k==='na'||k==='caf'||k==='sd') return pct>1?'over':'ok'; if(k==='kcal') return pct>1.3?'over':pct>=0.85?'ok':pct>=0.5?'low':'empty'; return pct>=1?'full':pct>=0.6?'ok':pct>=0.25?'low':'empty'; }
  const BAND={empty:['Empty','Vide'],low:['Low','Bas'],ok:['Okay','Correct'],full:['Full','Plein'],over:['Over','Dépassé']};
  const ASK=[ /* the answers the needs rest on; s: the short form for the line above the bars */
    {id:'sex', n:['sex','sexe'], t:['Sex','Sexe'], h:['Daily needs — iron, protein and the rest — are listed by sex. If you’d rather not say, pick the higher of the two.','Les besoins de chaque jour — fer, protéines et le reste — sont fixés par sexe. Si tu préfères ne pas le dire, prends le plus élevé des deux.'], opts:[{l:['Male','Homme'],v:'m',s:['Male','Homme']},{l:['Female','Femme'],v:'f',s:['Female','Femme']},{l:['Rather not say — use the higher needs','Je préfère ne pas le dire — prends les besoins les plus élevés'],v:'hi',s:['sex not given','sexe non précisé']}]},
    {id:'age', n:['age','âge'], t:['Age','Âge'], opts:[{l:['19 to 30','19 à 30'],v:'a1',s:['19 to 30','19 à 30']},{l:['31 to 50','31 à 50'],v:'a2',s:['31 to 50','31 à 50']},{l:['51 to 70','51 à 70'],v:'a3',s:['51 to 70','51 à 70']},{l:['71 or over','71 ou plus'],v:'a4',s:['71 or over','71 ou plus']},{l:['Under 19','Moins de 19'],v:'minor',s:['under 19','moins de 19']}]},
    {id:'wt', n:['weight','poids'], t:['Weight, roughly','Poids, à peu près'], h:['Only protein and calories use it.','Seules les protéines et les calories s’en servent.'], opts:[{l:['Under 60 kg (130 lb)','Moins de 60 kg (130 lb)'],v:'55',s:['under 60 kg','moins de 60 kg']},{l:['60–80 kg (130–175 lb)','60–80 kg (130–175 lb)'],v:'70',s:['60–80 kg','60–80 kg']},{l:['80–100 kg (175–220 lb)','80–100 kg (175–220 lb)'],v:'90',s:['80–100 kg','80–100 kg']},{l:['Over 100 kg (220 lb)','Plus de 100 kg (220 lb)'],v:'110',s:['over 100 kg','plus de 100 kg']}]},
    {id:'work', n:['kind of day','type de journée'], t:['Your days','Tes journées'], opts:[{l:['Mostly sitting','Assis la plupart du temps'],v:'sit',s:['mostly sitting','assis la plupart du temps']},{l:['On my feet','Debout'],v:'feet',s:['on my feet','debout']},{l:['Heavy work, or sweating a lot','Travail dur, ou beaucoup de sueur'],v:'heavy',s:['heavy work','travail dur']}]},
    {id:'life', t:['Also true?','Aussi vrai?'], h:['These change the needs.','Ça change les besoins.'], multi:true, opts:[{l:['I smoke or vape','Je fume ou je vapote'],v:'smoke',s:['smoke or vape','tabac ou vapotage']},{l:['I drink most days','Je bois presque tous les jours'],v:'drink',s:['drink most days','alcool presque tous les jours']},{l:['Pregnant','Enceinte'],v:'preg',s:['pregnant','enceinte']},{l:['Breastfeeding','J’allaite'],v:'bf',s:['breastfeeding','allaitement']},{l:['Vegetarian — eggs or dairy, no meat or fish','Végétarien — œufs ou produits laitiers, pas de viande ni de poisson'],v:'veg',s:['vegetarian','végé'],ex:'diet'},{l:['Vegan — no animal foods','Végane — aucun aliment animal'],v:'vegan',s:['vegan','végane'],ex:'diet'},{l:['None of these','Aucun de ces choix'],v:'none',none:true}]}
  ];
  /* a tap on an answer: one answer replaces the last; in a list, "none" clears the rest, and vegetarian and vegan exclude each other */
  function pick(p,id,v){ const q=ASK.find(x=>x.id===id); if(!q) return p; const o=Object.assign({},p);
    if(!q.multi){ o[id]=v; return o; }
    let arr=Array.isArray(o[id])?o[id].slice():[]; const opt=q.opts.find(x=>x.v===v)||{};
    if(arr.includes(v)) arr=arr.filter(x=>x!==v);
    else if(opt.none) arr=[v];
    else { arr=arr.filter(x=>!(q.opts.find(y=>y.v===x)||{}).none); if(opt.ex) arr=arr.filter(x=>(q.opts.find(y=>y.v===x)||{}).ex!==opt.ex); arr.push(v); }
    o[id]=arr; return o; }
  /* the line above the bars: what the needs are worked out from. fr: French. hide: answers an app doesn't ask. */
  function summary(p,fr,hide){ p=p||{}; hide=hide||[]; const i=fr?1:0, out=[];
    for(const q of ASK){ if(hide.includes(q.id)) continue; const val=p[q.id];
      if(q.multi){ for(const o of q.opts) if(!o.none&&!hide.includes(o.v)&&Array.isArray(val)&&val.includes(o.v)) out.push(o.s[i]); }
      else { const o=q.opts.find(x=>x.v===val); out.push(o?o.s[i]:q.n[i]+(fr?' non précisé':' not given')); } }
    return out.join(' · '); }
  /* the answers as buttons, for a sheet: data-pw is the question, data-v the answer */
  function askHTML(p,fr,hide){ p=p||{}; hide=hide||[]; const i=fr?1:0, esc=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    return ASK.filter(q=>!hide.includes(q.id)).map(q=>{ const val=p[q.id], on=v=>q.multi?(Array.isArray(val)&&val.includes(v)):val===v;
      return `<fieldset class="pw"><legend><b>${esc(q.t[i])}</b></legend>${q.h?`<p class="small muted" style="margin:2px 0 0">${esc(q.h[i])}</p>`:''}<div class="chips ${q.multi?'pickn':'pick1'}">${q.opts.filter(o=>!hide.includes(o.v)).map(o=>`<button type="button" class="chip" data-pw="${q.id}" data-v="${o.v}" aria-pressed="${on(o.v)}"><span>${esc(o.l[i])}</span></button>`).join('')}</div></fieldset>`; }).join(''); }
  /* shared by every V3KTOR app on this phone, in its browser storage (nothing leaves the phone): the answers and when they last changed.
     Each app keeps its own copy too; the newer one wins. */
  const SHARE='v3k.profile.v1';
  function shared(){ try{ const o=JSON.parse(localStorage.getItem(SHARE)||'null'); return o&&o.p&&typeof o.p==='object'&&typeof o.t==='number'?o:null; }catch(e){ return null; } }
  function share(p){ const t=Date.now(); try{ localStorage.setItem(SHARE,JSON.stringify({v:1,t,p})); }catch(e){} return t; }
  function unshare(){ try{ localStorage.removeItem(SHARE); }catch(e){} }
  return {NUT, needs, band, BAND, ASK, pick, summary, askHTML, SHARE, shared, share, unshare};
})();
/* ==== end of shared/nutrition.js ==== */
