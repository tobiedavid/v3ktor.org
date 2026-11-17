/* ===================== ENGINE: the reading rules. No screen code in here, so each rule can be tested on its own. =====================
   A reading is a count of what the person reported, set beside an amount. The app reports; it never interprets.
   Entries (S.ev):  {k:'meal', t, items:[{key,q}]}   {k:'fx', t, c}   {k:'none', t, d}   (t = milliseconds, d = a day key) */
const TLE=(function(){
const H=36e5, WIN=4*H, STEPS=8, UNK_MAX=2, ZEPS=0.005;
/* after a meal, the person sets how many hours count: one of these, 4 unless they move it */
const WINS=[1,2,3,4,5,6,7,8];
const p2=n=>(n<10?'0':'')+n;
/* a day starts at the person's own hour (the Food Trial Log's setting), so a 1 a.m. snack belongs to the evening before */
function dayKey(t,roll){ const d=new Date(t); if(d.getHours()<(roll||0)) d.setDate(d.getDate()-1); return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
function keyAdd(k,n){ const [y,m,d]=k.split('-').map(Number); const t=new Date(y,m-1,d+n); return t.getFullYear()+'-'+p2(t.getMonth()+1)+'-'+p2(t.getDate()); }
function dayStart(k,roll){ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d,roll||0).getTime(); }
/* poor sleep is reported the morning after, and belongs to the night before */
function fxDay(e,roll){ const k=dayKey(e.t,roll); return e.c==='sleep'?keyAdd(k,-1):k; }

/* ---------- what one food holds, times the portions eaten ----------
   Simple carbs are the sugars; lactose is one of them. Complex carbs are the rest of the carbohydrate, less the fibre.
   A food whose sugars Health Canada doesn't list keeps its carbs as "kind not listed": nothing is guessed. */
/* what a food carries beyond the ring (the table's last column), per serving: caffeine, theobromine, nitrate, tyramine and sodium in mg; selenium in µg;
   the kinds of fat and sugar, sorbitol, mannitol and excess fructose in g; the rest in portions, where no figure is entered */
/* NUTR: the kinds of fat and sugar, and the two minerals. Rows of their own, but not "compounds" in the counts of compounds a meal held. */
const NUTR=['sat','mono','poly','frs','gluc','sucr','malt','gal','na','se'];
const COMPS=['caf','theo','nit','tyr','ox','ga','cap','fru','gos','sorb','mann','fruc','sulph','nitr','swt','flav','glu','pur'].concat(NUTR);
const ZERO=()=>{ const a={kcal:0,fat:0,prot:0,cplx:0,sug:0,sugo:0,lact:0,fib:0,unk:0,alc:0,hist:0,histN:0,histUnk:0,noNum:0,mic:null,x:null}; for(const k of COMPS) a[k]=0; return a; };
function amounts(f,q){ const a=ZERO(); if(!f||f.none){ a.noNum=q; return a; }
  const avail=Math.max(0,f.carb-f.fib);
  if(f.sug!=null){ const st=Math.min(f.sug,avail), la=Math.min(f.lact||0,st); a.sug=st*q; a.lact=la*q; a.sugo=(st-la)*q; a.cplx=(avail-st)*q; }
  else { const la=Math.min(f.lact||0,avail); a.lact=la*q; a.unk=(avail-la)*q; }
  a.kcal=f.kcal*q; a.fat=f.fat*q; a.prot=f.prot*q; a.fib=f.fib*q; a.alc=(f.alc||0)*q;
  if(f.h){ a.histN=q; if(f.hist!=null) a.hist=f.hist*q; else a.histUnk=q; }
  if(f.m) a.mic=f.m.map(v=>v*q);
  if(f.c) for(const k in f.c) a[k]=f.c[k]*q;
  if(f.x&&f.x.length){ a.x={}; for(const k of f.x) a.x[k]=q; }      /* values the table has no figure for (a pill whose strength varies by brand): portions, by value */
  return a; }
function addInto(a,b){ for(const k in b){ if(k==='mic'){ if(b.mic){ if(!a.mic) a.mic=b.mic.map(()=>0); for(let i=0;i<b.mic.length;i++) a.mic[i]+=b.mic[i]; } }
    else if(k==='x'){ if(b.x){ if(!a.x) a.x={}; for(const j in b.x) a.x[j]=(a.x[j]||0)+b.x[j]; } } else a[k]+=b[k]; } return a; }
function mealAmounts(m,food){ const a=ZERO(); for(const it of m.items) addInto(a,amounts(food(it.key),it.q)); return a; }

/* ---------- the days, read from the entries ---------- */
function index(S,food,now){ const roll=S.roll||0, D={}, day=k=>D[k]||(D[k]={k,meals:[],fx:[],rep:[],none:false,tot:ZERO()});
  const ev=S.ev.slice().sort((a,b)=>a.t-b.t);
  for(const e of ev){
    if(e.k==='meal'){ const d=day(dayKey(e.t,roll)); const am=mealAmounts(e,food); d.meals.push({e,am}); addInto(d.tot,am); }
    else if(e.k==='fx'){ day(fxDay(e,roll)).fx.push(e); day(dayKey(e.t,roll)).rep.push(e); }   /* fx: the day it belongs to; rep: the day it was reported */
    else if(e.k==='none'){ day(e.d).none=true; } }
  /* rule 1: a day counts once it is closed. It needs at least one meal, and either an effect or a tap on "No effects today". */
  for(const d of Object.values(D)) d.closed=d.meals.length>0&&(d.fx.length>0||d.none);
  return {D,keys:Object.keys(D).sort(),roll,now:now||Date.now(),win:(WINS.indexOf(S.twin)>=0?S.twin:4)*H}; }

/* which amounts a bar can be drawn for, and when a meal or a day has to sit out */
const BUCKETS=['fat','cplx','sug','lact','fib','hist'];
function usable(am,b){ if(am.noNum>0) return false;                       /* a food with no numbers at all */
  if((b==='cplx'||b==='sug')&&am.unk>UNK_MAX) return false;                /* carbs of a kind not listed */
  if(b==='hist'&&am.histUnk>0) return false;                               /* a histamine food with no figure */
  if(am.x&&am.x[b]>0) return false;      /* a food that holds it with no figure: a fibre supplement, a caffeine pill, sugars whose kinds aren't listed */
  return true; }

/* rule 3, after a meal: the amount in that meal, beside the effects reported in the hours after it (I.win: 1 to 8 hours, the person's setting).
   Windows can overlap: an effect 2 hours after lunch and 7 after breakfast counts for both meals at 8 hours. Nothing picks one of them. */
/* what was reported after a meal does not depend on the row: it is worked out once for an index and its hours, and every row reads it.
   w: its hours are not over. Such a meal counts only once an effect is reported after it, since "no effect yet" is not "no effect" (see bar). */
function mealFx(I){ const W=I.win||WIN; if(I._mf&&I._mf.W===W&&I._mf.now===I.now) return I._mf.list; const list=[];
  for(const k of I.keys){ const d=I.D[k]; if(!d.closed) continue; const nx=I.D[keyAdd(k,1)], fx=d.fx.concat(nx?nx.fx:[]).filter(e=>e.c!=='sleep');
    for(const m of d.meals) list.push({m,fx:fx.filter(e=>e.t>=m.e.t&&e.t<=m.e.t+W).map(e=>e.c),w:m.e.t+W>I.now}); }
  I._mf={W,now:I.now,list}; return list; }
function mealUnits(I,b){ const out=[], left=[];
  for(const q of mealFx(I)){ const m=q.m; if(!usable(m.am,b)){ left.push(m.e.id); continue; } out.push({x:m.am[b],fx:q.fx,id:m.e.id,t:m.e.t,w:q.w}); }
  return {units:out,left}; }
/* rule 3, over a day: the day's total, beside the effects of that day, that night and the next day */
/* a day is read with its own effects, that night's and the next day's. So it can be read only once the day after it is over:
   before that, a day with nothing reported yet would sit on the "without" side and could still move. */
const dayDone=(I,k)=>dayStart(keyAdd(k,2),I.roll)<=I.now;
/* the day after has something reported for it: an effect, or a tap on "No effects today". When it has nothing, a day with no effect of its own
   is not settled, since the next day's effects count for it and nobody said there were none. It waits, as a meal whose hours are not over does. */
const told=(I,k)=>{ const nx=I.D[keyAdd(k,1)]; return !!nx&&(nx.fx.length>0||nx.rep.length>0||nx.none); };
function dayUnits(I,b){ const out=[], left=[];
  for(const k of I.keys){ const d=I.D[k]; if(!d.closed||!dayDone(I,k)) continue;
    if(!usable(d.tot,b)){ left.push(k); continue; }
    const nx=I.D[keyAdd(k,1)];
    out.push({x:d.tot[b],fx:d.fx.map(e=>e.c).concat(nx?nx.fx.filter(e=>e.c!=='sleep').map(e=>e.c):[]),id:k,w:!told(I,k)}); }   /* w: see bar */
  return {units:out,left}; }

/* what is not in the lists yet, and why: a meal whose hours are not over, a day whose next day is not over (soon),
   and the meals or days that sit in a day left open, with no effect and no "No effects" tap (open) */
function waiting(I,mode,sel,all){ let soon=0, open=0, next=0; const pick=c=>!sel||!sel.length||sel.indexOf(c)>=0, W=I.win||WIN;
  for(const k of I.keys){ const d=I.D[k]; if(!d.meals.length) continue;
    if(mode==='day'){ if(!dayDone(I,k)) soon++; else if(!d.closed) open++;
      else if(!told(I,k)){ const f=d.fx.map(e=>e.c).filter(pick); if(!(all&&sel&&sel.length?sel.every(c=>f.indexOf(c)>=0):f.length>0)) next++; } }   /* next: nothing reported for the day after, and no picked effect of its own */
    else { const nx=I.D[keyAdd(k,1)], fx=d.fx.concat(nx?nx.fx:[]).filter(e=>e.c!=='sleep'&&pick(e.c));
      for(const m of d.meals){ if(m.e.t+W>I.now){ const w=fx.filter(e=>e.t>=m.e.t&&e.t<=m.e.t+W); if(!(all&&sel&&sel.length?sel.every(c=>w.some(e=>e.c===c)):w.length>0)) soon++; } else if(!d.closed) open++; } } }
  return {soon,open,next}; }

/* rule 6: amounts are drawn in equal steps from zero to the person's highest. Each step is coloured by its own entries. */
const NICE=[0.1,0.2,0.25,0.5,1,2,2.5,5,10,20,25,50,100,200,250,500,1000];
function stepWidth(max){ for(const w of NICE) if(w*STEPS>=max-1e-9) return w; return Math.ceil(max/STEPS); }
function steps(units){ let max=0; for(const u of units) if(u.x>max) max=u.x;
  /* "none of it" has a cell of its own, before the steps: a meal with no lactose is not a meal with a little */
  const zero={i:-1,lo:0,hi:0,n:0,k:0,fx:{},ids:[]};
  const put=(s,u)=>{ s.n++; s.ids.push(u.id); if(u.fx.length){ s.k++; for(const c of new Set(u.fx)) s.fx[c]=(s.fx[c]||0)+1; } };
  /* rule 8: a step shows from its first entry. Its share is the part of its entries an effect was reported after. */
  const fin=s=>{ s.share=s.n?s.k/s.n:null; };
  if(!(max>ZEPS)){ for(const u of units) put(zero,u); fin(zero); return {w:0,max:0,steps:[],zero,n:units.length}; }
  const w=stepWidth(max), n=Math.max(1,Math.min(STEPS,Math.ceil(max/w-1e-9))), st=[];
  for(let i=0;i<n;i++) st.push({i,lo:i*w,hi:(i+1)*w,n:0,k:0,fx:{},ids:[]});
  for(const u of units) put(u.x>ZEPS?st[Math.min(n-1,Math.floor(u.x/w+1e-9))]:zero,u);
  for(const s of st) fin(s); fin(zero);
  return {w,max:n*w,steps:st,zero,n:units.length}; }
/* amounts are counted to a step of a thousandth of the row's highest or more, a power of ten: 0.1 g when the highest is 22 g, 1 mg when it is 900 mg.
   Two amounts closer than that sit at the same place on the row, so they count as the same amount, and a mark is never drawn between them. */
function snap(units){ let max=0; for(const u of units) if(u.x>max) max=u.x; if(!(max>ZEPS)) return units;
  const q=Math.pow(10,Math.ceil(Math.log10(max/1000))); return units.map(u=>Object.assign({},u,{x:Math.round(u.x/q)*q})); }
/* sel, when given, is a list of effect codes: only those effects count. Empty or absent means any effect. */
function bar(I,b,mode,sel,all){ const r=mode==='day'?dayUnits(I,b):mealUnits(I,b);
  /* all: every picked effect has to be there for a meal or a day to sit on the "with" side. Otherwise any one of them is enough. */
  let u=sel&&sel.length?r.units.map(x=>{ const f=x.fx.filter(c=>sel.indexOf(c)>=0); return Object.assign({},x,{fx:all&&!sel.every(c=>f.indexOf(c)>=0)?[]:f}); }):r.units;
  const s=steps(u=snap(u.filter(x=>!(x.w&&!x.fx.length)))); s.left=r.left.length; s.b=b; s.mode=mode; s.units=u; return s; }

/* ---------- the data view: every counted meal or day, on one side if the picked effects were reported for it, on the other if not ----------
   Nothing is averaged. A line carries how many there were on each side, how many of them held the thing at all, and the lowest and highest amount. */
const FAMS=[['base',['fat','sat','mono','poly','cplx','sug','frs','gluc','sucr','malt','gal','lact','fib']],['ac',['alc','caf']],['amine',['hist','tyr']],['plant',['ox','nit','ga','cap']],['ferm',['fru','gos','sorb','mann','fruc']],['added',['sulph','nitr','swt','flav']],['other',['glu','pur','theo']],['min',['na','se']]];
const TAGS=['ga','cap','fru','gos','sulph','nitr','swt','flav','glu'];     /* counted in portions */
/* the kinds of a thing sit under its row: each has its own mark, and the group stands where its best row would */
const KIDS={fat:['sat','mono','poly'],sug:['frs','gluc','sucr','malt','gal','lact']}, PARENT={};
for(const p in KIDS) for(const c of KIDS[p]) PARENT[c]=p;
function grouped(list){ const out=[], done=new Set(), by={}; for(const r of list) by[r.b]=r;
  for(const r of list){ if(done.has(r.b)) continue; const p=PARENT[r.b]||r.b;
    for(const b of [p].concat(KIDS[p]||[])) if(by[b]&&!done.has(b)){ out.push(by[b]); done.add(b); } }
  return out; }
function line(I,b,mode,sel,all){ const B=bar(I,b,mode,sel,all), side=()=>({n:0,ate:0,lo:null,hi:null}), hit=side(), rest=side();
  for(const u of B.units){ const s=u.fx.length?hit:rest; s.n++; if(u.x>ZEPS) s.ate++; if(s.lo==null||u.x<s.lo) s.lo=u.x; if(s.hi==null||u.x>s.hi) s.hi=u.x; }
  return {b,hit,rest,left:B.left,n:B.n}; }
/* ---------- the mark: the amount that leaves the fewest meals or days on the wrong side of it ----------
   A mark is read one of two ways. Up: the entries with the effect are at the mark or over, the others under it. Down: the reverse, for an
   effect that comes with less of a thing. On the wrong side is an entry that sits where the other kind belongs. The mark is one of the
   amounts the person had, never the lowest of them (something has to sit under it). Every amount is tried both ways; the reading with the
   fewest on the wrong side is kept, the lowest amount first and "up" before "down" when several do as well. A mark at the very top or the
   very bottom separates nothing: it leaves one whole side wrong. So a mark is kept only when it leaves fewer on the wrong side than the
   smaller of the two sides. hitIn and restIn: how many of each kind are on their own side. Nothing is tested and nothing is averaged. */
function split(units){ let nHit=0, nRest=0; const v=u=>u.x>ZEPS?u.x:0; for(const u of units){ if(u.fx.length) nHit++; else nRest++; }
  let best={at:null,below:null,dir:null,wrong:Math.min(nHit,nRest),hitIn:0,restIn:0,nHit,nRest}; if(!nHit||!nRest) return best;
  /* one pass over the entries in the order of their amounts: at each new amount, how many of each kind sit under it is already known */
  const a=units.map(u=>[v(u),u.fx.length>0]).sort((p,q)=>p[0]-q[0]); let hb=0, rb=0, prev=null;
  for(let i=0;i<a.length;){ const c=a[i][0];
    if(prev!==null){ const up=nHit-hb, under=rb, wUp=nHit-up+nRest-under, wDown=up+under;   /* below: the next amount down, so the mark can be drawn between the two */
      if(wUp<best.wrong) best={at:c,below:prev,dir:'up',wrong:wUp,hitIn:up,restIn:under,nHit,nRest};
      if(wDown<best.wrong) best={at:c,below:prev,dir:'down',wrong:wDown,hitIn:nHit-up,restIn:nRest-under,nHit,nRest}; }
    for(;i<a.length&&a[i][0]===c;i++){ if(a[i][1]) hb++; else rb++; } prev=c; }
  return best; }
/* every line with its entries and its mark, in the order the tab shows them: first the lines with a mark, by the share of their entries on the
   wrong side of it; then the lines with none. Ties, and the lines with no mark, keep the fixed order. This holds from the first meal on. */
/* a clear mark: more than half of the entries with the effect are on their side of it, and more than half of those without on theirs */
const clear=s=>s.at!=null&&s.hitIn*2>s.nHit&&s.restIn*2>s.nRest;
function rows(I,mode,sel,all){ const out=[]; let i=0;
  for(const [f,ks] of FAMS) for(const b of ks){ const B=bar(I,b,mode,sel,all); out.push({b,f,i:i++,units:B.units,max:B.max,w:B.w,left:B.left,n:B.n,any:B.units.some(u=>u.x>ZEPS),s:split(B.units)}); }
  for(const r of out) r.clear=clear(r.s);
  return out.sort((p,q)=>{ const a=p.s.at==null, c=q.s.at==null; if(a||c) return a-c||p.i-q.i; return p.s.wrong/p.n-q.s.wrong/q.n||p.i-q.i; }); }
function table(I,mode,sel,all){ return FAMS.map(([f,ks])=>({f,rows:ks.map(b=>line(I,b,mode,sel,all))})); }
/* eaten together: three or more portions of the aged and fermented foods, and alcohol with one of them */
/* how many of the compounds a meal or a day held: alcohol, caffeine, histamine food and each of the other compounds, one each */
const GROUPS=['alc'].concat(COMPS.filter(k=>NUTR.indexOf(k)<0)), MANY=5;
const groups=am=>GROUPS.reduce((t,k)=>t+(am[k]>ZEPS?1:0),0)+(am.histN>0?1:0);
function together(I,mode,sel,all){ const A=bar(I,'histN',mode,sel,all).units, alc={}, cnt={}; for(const u of bar(I,'alc',mode,sel,all).units) alc[u.id]=u.x;
  for(const k of I.keys){ const d=I.D[k]; if(mode==='day') cnt[k]=groups(d.tot); else for(const m of d.meals) cnt[m.e.id]=groups(m.am); }
  const three={hit:0,rest:0}, both={hit:0,rest:0}, many={hit:0,rest:0}; let nHit=0, nRest=0;
  for(const u of A){ const k=u.fx.length?'hit':'rest'; if(k==='hit') nHit++; else nRest++; if(u.x>=3) three[k]++; if(u.x>0&&alc[u.id]>ZEPS) both[k]++; if(cnt[u.id]>=MANY) many[k]++; }
  return {nHit,nRest,three,both,many}; }

/* rule 9: the app puts no number on luck. One amount's exact test misled a person who looks at a hundred amounts, and a test that counted them all
   (whole days dealt again) was unfair to a person who tests one thing at a time and blind to what repeats every day. The lists give counts on both sides. */

/* ---------- rules 2, 4 and 7: one food, by the amount eaten that day ----------
   An effect counts only if it was reported after the food. It lands in one of three rows: same day, that night, next day.
   The days without the food stay on screen. */
function foodReading(I,key,mine){ const rows={}, without={n:0,fx:{}}; let times=0, clean=0, wait=0;
  for(const k of I.keys){ const d=I.D[k]; if(!d.closed) continue;
    let q=0,t0=null,others=true; for(const m of d.meals) for(const it of m.e.items){ if(it.key===key){ q+=it.q; if(t0==null||m.e.t<t0) t0=m.e.t; } else if(mine&&!mine.has(it.key)) others=false; }
    /* wait: a complete day with the food whose next day is not over. It is not read yet, like any day (dayDone). */
    if(!dayDone(I,k)){ if(q) wait++; continue; }
    /* a day without the food is read over the same span as a day with it: that day, that night, and the next day */
    const nx=I.D[keyAdd(k,1)], nxc=nx?nx.fx.filter(e=>e.c!=='sleep').map(e=>e.c):[];
    /* nothing reported for the day after, and no effect here: the day is not settled, with the food or without it */
    if(!told(I,k)&&!d.fx.length){ if(q) wait++; continue; }
    if(!q){ without.n++; for(const c of new Set(d.fx.map(e=>e.c).concat(nxc))) without.fx[c]=(without.fx[c]||0)+1; continue; }
    times++; if(others) clean++;
    const r=rows[q]||(rows[q]={q,n:0,k:0,same:{},night:{},next:{},any:{}}); r.n++;
    const seen=new Set(), put=(o,c)=>{ o[c]=(o[c]||0)+1; seen.add(c); };
    for(const c of new Set(d.fx.filter(e=>e.c!=='sleep'&&e.t>=t0).map(e=>e.c))) put(r.same,c);
    if(d.fx.some(e=>e.c==='sleep')) put(r.night,'sleep');
    for(const c of new Set(nxc)) put(r.next,c);
    if(seen.size) r.k++; for(const c of seen) r.any[c]=(r.any[c]||0)+1; }
  const list=Object.values(rows).sort((a,b)=>a.q-b.q);
  return {key,times,clean,rows:list,without,wait}; }

/* ---------- Home: what went in and what came out, over one period ---------- */
const PERIODS={today:1,week:7,month:30};
function inPeriod(I,per){ const T=dayKey(I.now,I.roll), n=PERIODS[per], ks=[]; for(let i=n-1;i>=0;i--) ks.push(keyAdd(T,-i)); return ks; }
function went(I,per){ const a=ZERO(); let days=0, meals=0; const ks=inPeriod(I,per);
  for(const k of ks){ const d=I.D[k]; if(d&&d.meals.length){ addInto(a,d.tot); days++; meals+=d.meals.length; } }
  return {am:a,days,meals}; }
function reportedDays(I){ let n=0; for(const k of I.keys) if(I.D[k].closed) n++; return n; }

/* ---------- the pie: by grams, so every slice is a share of one whole ---------- */
const SLICES=['fat','prot','cplx','lact','sugo','fib','unk'];      /* grams of food; alcohol has its own line beside caffeine */
function pie(am){ const g=SLICES.map(k=>[k,am[k]||0]).filter(x=>x[1]>=0.05); const tot=g.reduce((s,x)=>s+x[1],0); if(!tot) return {tot:0,slices:[]};
  /* whole percents that add up to exactly 100: round down, then hand the leftover points to the largest remainders */
  const raw=g.map(([k,v])=>({k,g:v,p:v/tot*100})); let used=0; for(const s of raw){ s.pct=Math.floor(s.p); used+=s.pct; }
  const order=raw.slice().sort((a,b)=>(b.p-b.pct)-(a.p-a.pct)); for(let i=0;i<100-used;i++) order[i%order.length].pct++;
  return {tot,slices:raw}; }

/* the vitamins and minerals in the food table, in its order. Their reference amounts come from shared/nutrition.js (0.5.2). */
const MICRO=['ca','fe','mg','k','zn','c','b1','b2','b3','b6','fol','b12','d','vk','va','mn','cu','e','se'];

/* ---------- the import: the Food Trial Log's lists, read from its saved data (same browser) or from its backup file.
   Its own rules are copied here so its file is never changed; a test compares the two on saved examples. ---------- */
function gutBase(o){ const F=o.fast; if(!F) return []; const b=new Set(o.base0||[]), ops=[];
  for(const c of o.cuts||[]) if(c.d>=F.start) ops.push({at:c.at,del:c.key});
  for(const a of o.adds||[]) if(a.d>=F.start) ops.push({at:a.at,add:a.key});
  for(const t of o.tests||[]) if(t.route==='fast'&&t.res==='none'&&t.d1>=F.start) ops.push({at:t.endAt,add:t.key});
  ops.sort((x,y)=>x.at-y.at); for(const x of ops){ if(x.del) b.delete(x.del); else b.add(x.add); } return [...b]; }
function importGut(o){ if(!o||typeof o!=='object'||!Array.isArray(o.ev)) return null;
  const res={list:[],out:[],aside:[],fine:[],p:{sex:(o.p||{}).sex||null,age:(o.p||{}).age||null,life:((o.p||{}).life||[]).slice()},roll:o.roll||0,route:o.route||null};
  const F=o.fast; if(o.route!=='fast'||!F) return res;
  const bn=gutBase(o), amt=o.amt||{}; res.list=bn.map(key=>({key,q:amt[key]||1}));
  /* "rejected" means the food failed a trial. Foods only swapped out or stopped in step 1 are set aside, and not counted. */
  const m=new Map(), hit=(key,d,why)=>{ const r=m.get(key)||{key,d,why,times:0,allergy:false}; r.times++; if(d>=r.d){ r.d=d; r.why=why; } m.set(key,r); };
  const aside=new Map();
  for(const c of (o.cuts||[]).filter(c=>c.d>=F.start)){ if(c.why==='fall') hit(c.key,c.d,'fall'); else if(c.why==='roll') hit(c.key,c.d,'roll'); else aside.set(c.key,{key:c.key,d:c.d,why:c.why==='swap'?'swap':'stop'}); }
  for(const t of (o.tests||[]).filter(t=>t.route==='fast'&&t.d1>=F.start)){ if(t.res==='react') hit(t.key,t.end||t.d1,'react'); if(t.allergy){ const r=m.get(t.key)||{key:t.key,d:t.end||t.d1,why:'react',times:0}; r.allergy=true; m.set(t.key,r); } }
  res.out=[...m.values()].filter(r=>!bn.includes(r.key)).sort((a,b)=>b.d.localeCompare(a.d)||a.key.localeCompare(b.key));
  res.aside=[...aside.values()].filter(r=>!bn.includes(r.key)&&!m.has(r.key));
  const added=(o.adds||[]).filter(a=>a.why==='s2'&&a.d>=F.start&&bn.includes(a.key)).map(a=>a.key);
  res.fine=[...new Set(added.concat((o.tests||[]).filter(t=>t.route==='fast'&&t.res==='none'&&t.d1>=F.start).map(t=>t.key)))].filter(k=>bn.includes(k));
  return res; }
/* what the rejected foods have in common: counts only. The person reads the common denominator. */
function common(outKeys,listKeys,food){ const cnt=(keys)=>{ const c={}; let n=0; for(const k of keys){ const f=food(k); if(!f||f.none) continue; n++; for(const b of f.b||[]) c[b]=(c[b]||0)+1; } return {c,n}; };
  const O=cnt(outKeys), L=cnt(listKeys), rows=[];
  for(const b of Object.keys(O.c)){ const o=O.c[b], l=L.c[b]||0; if(o>=2||(O.n===1&&o===1)) rows.push({b,o,on:O.n,l,ln:L.n,d:o/O.n-(L.n?l/L.n:0)}); }
  rows.sort((a,b)=>b.d-a.d||b.o-a.o);
  const med=(keys,fn)=>{ const v=keys.map(k=>food(k)).filter(f=>f&&!f.none).map(fn).filter(x=>x!=null).sort((a,b)=>a-b); return v.length?v[Math.floor((v.length-1)/2)]:null; };
  const typ=[['lact',f=>amounts(f,1).lact],['fat',f=>f.fat],['sug',f=>f.sug==null?null:amounts(f,1).sug],['fib',f=>f.fib]].map(([k,fn])=>({k,o:med(outKeys,fn),l:med(listKeys,fn)})).filter(r=>r.o!=null&&r.l!=null);
  return {rows:rows.slice(0,5),typ,on:O.n,ln:L.n}; }

return {H,WIN,WINS,STEPS,ZEPS,MANY,snap,groups,BUCKETS,COMPS,NUTR,FAMS,TAGS,KIDS,PARENT,grouped,line,table,split,clear,rows,together,waiting,SLICES,MICRO,dayKey,keyAdd,dayStart,fxDay,amounts,addInto,mealAmounts,ZERO,index,usable,mealUnits,dayUnits,stepWidth,steps,bar,foodReading,went,reportedDays,pie,gutBase,importGut,common};
})();
if(typeof module!=='undefined') module.exports=TLE;
