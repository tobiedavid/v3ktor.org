/* ==== shared/nutrition.js */
/* ==== end of shared/nutrition.js ==== */
/* ===================== APP: the screens. Data in, data out: the app reports what was entered and never interprets it. ===================== */
const VER='0.5.2', CONSENT=1, KEY='v3k.threshold.v1', GUTKEYS=['v3k.gut.v1','v3k.gut.fr.v1'];   /* the Food Trial Log keeps its English and its French copy apart */
const E=TLE, H=36e5;
const FRAMED=(()=>{ try{ return window.self!==window.top; }catch(e){ return true; } })();
const STANDALONE=(()=>{ try{ return !!(navigator.standalone||matchMedia('(display-mode: standalone)').matches); }catch(e){ return false; } })();
const UA=navigator.userAgent||'', IOS=/iPad|iPhone|iPod/.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1), ANDROID=/Android/.test(UA), SAFARI=IOS&&/Safari\//.test(UA)&&!/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram/.test(UA), CHROME=ANDROID&&/Chrome\//.test(UA)&&!/SamsungBrowser|EdgA|OPR\/|Firefox|; wv\)|FBAN|FBAV|Instagram/.test(UA);
const LBT=['flav','swt','sulph','nitr'];     /* what a label's ingredient list can name: ticked on the label form */
function S0(){ return {v:1,lang:null,ack:false,ackAt:null,cv:null,roll:0,p:{},list:[],amt:{},imp:null,custom:[],ev:[],own:{phys:[],psy:[]},concl:{},tab:'home',nper:'week',tmode:'meal',twin:4,tsel:[],tall:true,fxw:{},seenThr:false,tview:'all',bkAt:null}; }
let S=S0(), STORE='ok', UI={}, V=null, UNDO=null, IXM=null;
/* saved data, or a backup, read back in: every list is a list again, whatever the file held */
function clean(o){ const n=Object.assign(S0(),o), arr=x=>Array.isArray(x)?x:[], obj=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
  const idOk=x=>typeof x==='string'&&/^[\w.-]{1,40}$/.test(x), pos=x=>typeof x==='number'&&isFinite(x)&&x>0, seen=new Set(), num0=x=>{ x=+x; return isFinite(x)&&x>=0?x:0; };
  n.ev=arr(n.ev).filter(e=>e&&typeof e==='object'&&typeof e.t==='number'&&isFinite(e.t)&&((e.k==='meal'&&Array.isArray(e.items)&&e.items.length&&e.items.every(i=>i&&typeof i.key==='string'&&pos(i.q)))||(e.k==='fx'&&typeof e.c==='string'&&e.c)||(e.k==='none'&&/^\d{4}-\d\d-\d\d$/.test(e.d))))
    .map(e=>{ if(!idOk(e.id)||seen.has(e.id)) e.id='i'+Math.random().toString(36).slice(2,10); seen.add(e.id); return e; }).sort((a,b)=>a.t-b.t);        /* every entry has its own plain id */
  n.list=arr(n.list).filter(k=>typeof k==='string'); n.p=obj(n.p); n.p.life=arr(n.p.life).filter(v=>typeof v==='string');
  n.custom=arr(n.custom).filter(c=>c&&idOk(c.id)&&typeof c.n==='string'&&c.n.trim()).map(c=>({id:c.id,n:c.n.slice(0,60),s:String(c.s||'').slice(0,60),kcal:num0(c.kcal),fat:num0(c.fat),carb:num0(c.carb),prot:num0(c.prot),fib:num0(c.fib),sug:c.sug==null?null:num0(c.sug),lact:num0(c.lact),h:!!c.h,t:arr(c.t).filter((k,i,a)=>LBT.indexOf(k)>=0&&a.indexOf(k)===i)}));
  { const a={}, src=obj(n.amt); for(const k of Object.keys(src)) if(pos(src[k])) a[k]=src[k]; n.amt=a; const c={}, cs=obj(n.concl); for(const k of Object.keys(cs)) if(typeof cs[k]==='string'&&cs[k].trim()) c[k]=cs[k].slice(0,200); n.concl=c; }
  n.own={phys:arr(obj(n.own).phys).filter(w=>typeof w==='string'),psy:arr(obj(n.own).psy).filter(w=>typeof w==='string')};
  n.roll=Math.min(23,Math.max(0,Math.round(+n.roll||0))); { const rows=x=>arr(x).filter(r=>r&&typeof r.key==='string'&&typeof r.d==='string'); n.imp=n.imp&&typeof n.imp==='object'?Object.assign(n.imp,{out:rows(n.imp.out),aside:rows(n.imp.aside),fine:arr(n.imp.fine).filter(k=>typeof k==='string')}):null; }
  delete n.per; if(!['today','week','month'].includes(n.nper)) n.nper='week'; if(n.tmode!=='day') n.tmode='meal'; if(E.WINS.indexOf(n.twin)<0) n.twin=4; n.tsel=arr(n.tsel).filter(c=>typeof c==='string'&&c).slice(0,20); n.tall=n.tall!==false; n.seenThr=n.seenThr===true; if(['min','med','all'].indexOf(n.tview)<0) n.tview='all'; { const w={}, src=obj(n.fxw); for(const c of Object.keys(src)) if(E.WINS.indexOf(src[c])>=0) w[c]=src[c]; n.fxw=w; } n.tab='home'; if(n.cv!==CONSENT) n.ack=false;   /* the five statements changed since this person agreed: ask again */ n.lang=n.lang==='fr'||n.lang==='en'?n.lang:null; return n; }
{ let raw=null; try{ raw=localStorage.getItem(KEY); }catch(e){ STORE='none'; }
  if(raw){ try{ const o=JSON.parse(raw); if(o&&o.v===1&&Array.isArray(o.ev)) S=clean(o); else STORE='bad'; }catch(e){ STORE='bad'; } } }
if(!S.lang){ let fp=null; try{ fp=localStorage.getItem('v3ktor-lang'); }catch(e){}   /* the language picked on the v3ktor.org front page, if there is one */
  S.lang=(fp==='fr'||fp==='en')?fp:(navigator.language||'en').toLowerCase().startsWith('fr')?'fr':'en'; }
const L=(en,fr)=>S.lang==='fr'?fr:en;
function save(){ IXM=null; if(STORE==='bad') return; try{ pushProf(); }catch(e){} try{ localStorage.setItem(KEY,JSON.stringify(S)); if(STORE==='none') STORE='ok'; }catch(e){ STORE='none'; } }

/* ---------- foods ---------- */
const FOODS=DATA.map(a=>({id:a[0],key:'f'+a[0],n:[a[1],a[2]],s:[a[3],a[4]],grp:a[5],b:a[6]?a[6].split(' '):[],g:a[7],kcal:a[8],prot:a[9],fat:a[10],carb:a[11],sug:a[12]<0?null:a[12],fib:a[13],lact:a[14],alc:a[15],h:a[16]!==-2,hist:a[16]<0?null:a[16],m:a[17],x:a[18]?a[18].split(' '):[],c:a[19]||null}));
const FB={}; for(const f of FOODS) FB[f.key]=f;
const GROUPS=[['fruit','Fruit','Fruits'],['veg','Vegetables','Légumes'],['meat','Meat & poultry','Viande et volaille'],['sea','Fish & seafood','Poisson et fruits de mer'],['dairy','Eggs & dairy','Œufs et produits laitiers'],['grain','Grains, beans & nuts','Grains, haricots et noix'],['proc','Processed & fast food','Aliments transformés'],['drink','Drinks','Boissons'],['energy','Energy drinks','Boissons énergisantes'],['alc','Alcohol','Alcool'],['sup','Supplements','Suppléments']];
/* the Food Trial Log's 18 groups, for "in common" */
const BKN={alc:['Alcohol','Alcool'],caf:['Caffeine and coffee','Caféine et café'],proc:['Processed or packaged food','Aliments transformés ou emballés'],swt:['Sugar-free sweeteners','Édulcorants sans sucre'],sup:['Supplements','Suppléments'],dairy:['Dairy','Produits laitiers'],fat:['Fatty or fried food','Aliments gras ou frits'],sugar:['Sugar and fructose','Sucre et fructose'],rawsea:['Raw shellfish','Fruits de mer crus'],gluten:['Wheat, barley and rye','Blé, orge et seigle'],fibre:['Bran and high-fibre food','Son et aliments riches en fibres'],legume:['Beans and lentils','Haricots et lentilles'],onion:['Onion and garlic','Oignon et ail'],spicy:['Spicy food','Aliments épicés'],hist:['Histamine food','Aliment à histamine'],veg:['Vegetables','Légumes'],fruit:['Fruit','Fruits'],nuts:['Nuts and seeds','Noix et graines']};
function food(key){ if(!key) return null; if(key[0]==='f') return FB[key]||{key,n:['(food no longer listed)','(aliment retiré de la liste)'],s:['',''],none:true,b:[]};
  if(key[0]==='L'){ const c=S.custom.find(x=>'L'+x.id===key); if(!c) return {key,n:['(food removed)','(aliment retiré)'],s:['',''],none:true,b:[]};
    return {key,label:true,n:[c.n,c.n],s:[c.s,c.s],grp:'label',b:c.h?['hist']:[],g:0,kcal:c.kcal,prot:c.prot,fat:c.fat,carb:c.carb,sug:c.sug,fib:c.fib,lact:c.lact||0,alc:0,h:!!c.h,hist:null,m:null,x:[],c:c.t&&c.t.length?Object.fromEntries(c.t.map(k=>[k,1])):null}; }
  const [n,b]=key.slice(2).split('|'); return {key,n:[n,n],s:['',''],none:true,b:b&&BKN[b]?[b]:[]}; }   /* a food typed by name in the Food Trial Log: it has no numbers */
const fname=f=>f.n[S.lang==='fr'?1:0], fserv=f=>f.s[S.lang==='fr'?1:0];
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/œ/g,'oe');

/* ---------- effects: two groups, plus the person's own words ---------- */
const FX={phys:[['infl','Inflammation','Inflammation'],['joint','Joint pain','Douleur aux articulations'],['gut','Gut discomfort','Inconfort au ventre'],['diar','Diarrhea','Diarrhée','watery','liquide'],['loose','Loose stool','Selles molles','soft, falls apart','molles, qui se défont'],['head','Headache','Mal de tête'],['naus','Nausea','Nausée'],['sleep','Poor sleep','Mauvais sommeil','last night','la nuit dernière']],
  psy:[['dep','Depressed','Déprime'],['lowen','Low energy','Peu d’énergie'],['nomot','No motivation','Pas de motivation'],['angry','Angry','Colère'],['edgy','Edgy','À cran']]};
const FXN={}; for(const g of ['phys','psy']) for(const r of FX[g]) FXN[r[0]]=r;
const fxName=c=>c.startsWith('o:')?c.slice(2):FXN[c]?L(FXN[c][1],FXN[c][2]):c;
const fxLow=c=>{ const n=fxName(c); return c.startsWith('o:')?n:n.charAt(0).toLowerCase()+n.slice(1); };

/* ---------- small helpers ---------- */
const now=()=>Date.now(), p2=n=>(n<10?'0':'')+n;
const today=()=>E.dayKey(now(),S.roll), kAdd=E.keyAdd;
const hm=t=>{ const d=new Date(t); return p2(d.getHours())+':'+p2(d.getMinutes()); };
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
const LOC=()=>S.lang==='fr'?'fr-CA':'en-CA';
function num(x,d){ if(x==null||!isFinite(x)) return '?'; if(d==null) d=Math.abs(x)<10?1:0; return (+x.toFixed(d)).toLocaleString(LOC(),{maximumFractionDigits:d}); }
const U=(x,u,d)=>num(x,d)+'\u00a0'+u;                                    /* a number and its unit never split across lines */
const qtxt=q=>{ const w=Math.floor(q), h=q-w>=0.25; return (w||!h?String(w):'')+(h?'½':''); };
function dLabel(k){ const T=today(); if(k===T) return L('Today','Aujourd’hui'); if(k===kAdd(T,-1)) return L('Yesterday','Hier'); const [y,m,d]=k.split('-').map(Number); const s=new Date(y,m-1,d).toLocaleDateString(LOC(),{weekday:'long',month:'long',day:'numeric'}); return s.charAt(0).toUpperCase()+s.slice(1); }
function atTime(day,at){ const [y,m,d]=day.split('-').map(Number), [h,mi]=(at||'12:00').split(':').map(Number); return new Date(y,m-1,d+(h<(S.roll||0)?1:0),h,mi).getTime(); }   /* 1 a.m. on a day that starts at 4 is the next calendar morning: the next date on the calendar, not 24 hours on, so a clock change in between can't move it */
const uid=p=>p+now().toString(36)+Math.random().toString(36).slice(2,6);
/* the hours after a meal that count are the person's own setting; moving it changes the reading, never the entries */
const winH=()=>E.WINS.indexOf(S.twin)>=0?S.twin:4;
/* an effect read alone keeps its own hours; any effect, or several together, use the general ones */
const winFor=c=>{ const h=S.fxw&&S.fxw[c]; return E.WINS.indexOf(h)>=0?h:winH(); }, thrH=()=>{ const s=S.tsel||[]; return s.length===1?winFor(s[0]):winH(); };
function IX(){ const I=IXM||(IXM=E.index(S,food,now())); I.win=thrH()*E.H; return I; }
const mine=()=>new Set(S.list);
function toast(m,undoable){ const t=document.getElementById('toast'); t.innerHTML=esc(m)+(undoable?` <button type="button" class="undo" data-act="undo">${L('Undo','Annuler')}</button>`:''); t.classList.add('show'); t.classList.toggle('live',!!undoable); clearTimeout(toast.h); toast.h=setTimeout(()=>t.classList.remove('show','live'),undoable?6000:2200); }
async function copyText(s){ try{ await navigator.clipboard.writeText(s); return true; }catch(e){ try{ const ta=document.createElement('textarea'); ta.value=s; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); return ok; }catch(_){ return false; } } }

/* ---------- entries ---------- */
function addEv(list,msg){ S.ev.push(...list); S.ev.sort((a,b)=>a.t-b.t); UNDO={add:list.map(e=>e.id)}; save(); render(true); if(msg) toast(msg,true); }
function delEv(id){ const e=S.ev.find(x=>x.id===id); if(!e) return; UNDO={del:[e]}; S.ev=S.ev.filter(x=>x.id!==id); save(); render(true); toast(L('Removed','Retiré'),true); }
function undo(){ if(!UNDO) return; if(UNDO.add) S.ev=S.ev.filter(x=>!UNDO.add.includes(x.id)); if(UNDO.del) S.ev.push(...UNDO.del); if(UNDO.none) S.ev.push(...UNDO.none); S.ev.sort((a,b)=>a.t-b.t); UNDO=null; save(); render(true); document.getElementById('toast').classList.remove('show','live'); }
const mealText=e=>e.items.map(it=>`${qtxt(it.q)}\u00a0×\u00a0${esc(fname(food(it.key)))}`).join(' · ');

/* ---------- the frame: top bar, tabs, bottom bar ---------- */
const app=document.getElementById('app'), bar=document.getElementById('bar');
function view(){ return !S.ack?'door':V?V.v:'tabs'; }
/* after a redraw, the keyboard focus goes back to the control it was on */
function focusSig(el){ return el&&el.dataset&&(el.id||el.dataset.act||el.dataset.in)?{id:el.id,act:el.dataset.act,v:el.dataset.v,k:el.dataset.k,inn:el.dataset.in}:null; }
function refocus(root,g){ if(!g) return false; let el=g.id?document.getElementById(g.id):null;
  if(!el) el=[...root.querySelectorAll(g.act?'[data-act="'+g.act+'"]':'[data-in="'+g.inn+'"]')].find(x=>(x.dataset.v||'')===(g.v||'')&&(x.dataset.k||'')===(g.k||''));
  if(el&&!el.disabled){ try{ el.focus({preventScroll:true}); return true; }catch(e){} } return false; }
function renderTop(){ document.documentElement.lang=S.lang==='fr'?'fr-CA':'en-CA';
  document.getElementById('topbar').innerHTML=`<div class="in"><button type="button" class="tb" id="menuBtn" data-act="menu" aria-haspopup="dialog" aria-label="Menu"><span aria-hidden="true">☰</span></button><button type="button" class="tb ttl" data-act="home">Threshold<span class="t2"> Log</span></button><span class="sp"></span>${S.ack?`<button type="button" class="tb gls" data-act="ai" aria-haspopup="dialog" aria-label="${L('Ask AI','Demander à l’IA')}">${L('Ask AI','<span class="lg">Demander à l’</span>IA')}</button>`:''}<span class="lang"><button type="button" data-act="lang" data-v="fr" aria-pressed="${S.lang==='fr'}">FR</button><button type="button" data-act="lang" data-v="en" aria-pressed="${S.lang==='en'}">EN</button></span></div>`; }
const TABS=[['home','Home','Accueil'],['nut','Nutrition','Nutrition'],['thr','Threshold','Seuil']];
const tabsHTML=()=>`<div class="gtabs seg toptabs" role="tablist">${TABS.map(([k,en,fr])=>`<button type="button" role="tab" data-act="tab" data-v="${k}" aria-selected="${S.tab===k}" aria-pressed="${S.tab===k}">${L(en,fr)}</button>`).join('')}</div>`;
function renderBar(v){ if(v==='hist'){ bar.classList.remove('hidden'); bar.innerHTML=`<div class="in"><button type="button" class="btn ghost sm" data-act="back">← ${L('Back','Retour')}</button><span class="small muted">${L('History','Historique')}</span><span style="width:44px;flex:none"></span></div>`; return; }
  if(v!=='meal'){ bar.innerHTML=''; bar.classList.add('hidden'); return; }
  const n=Object.keys(V.items).length; bar.classList.remove('hidden');
  bar.innerHTML=`<div class="in"><button type="button" class="btn ghost sm" data-act="back">← ${L('Back','Retour')}</button><span class="small muted">${V.mode==='list'?L(`My list · ${n}`,`Ma liste · ${n}`):n?L(`${n} food${n>1?'s':''}`,`${n} aliment${n>1?'s':''}`):L('Meal','Repas')}</span><button type="button" class="btn primary sm" data-act="mealdone" ${V.mode==='list'||n?'':'disabled'}>${L('Done','Terminé')}</button></div>`; }
/* ---------- a long log: the Threshold tab can take a moment to count, and the page cannot draw while it counts. When the last count was slow
   on this phone and the log is long, the next one is put off by one frame, so that "Counting…" shows first. A newer change replaces one that
   has not run yet, so a drag on the slider counts once. ---------- */
let thrMs=0, BUSY_MS=250, BUSY_FROM=600, busyJob=null;
function soon(f){ if(!(thrMs>=BUSY_MS&&S.ev.length>=BUSY_FROM)){ f(); return; }
  const el=document.getElementById('busy'); el.textContent=L('Counting…','Calcul en cours…'); el.hidden=false;
  if(busyJob){ cancelAnimationFrame(busyJob.r); clearTimeout(busyJob.t); }
  const job=busyJob={}; job.r=requestAnimationFrame(()=>{ job.t=setTimeout(()=>{ if(busyJob===job) busyJob=null; try{ f(); } finally{ if(!busyJob) el.hidden=true; } },0); }); }
const thrShown=()=>S.tab==='thr'&&['door','meal','hist'].indexOf(view())<0;
function render(keep){ save(); if(thrShown()) soon(()=>draw(keep)); else draw(keep); }
function draw(keep){ const t0=performance.now(), thr=thrShown(), y=window.scrollY, g=keep&&!document.getElementById('sheet').classList.contains('on')?focusSig(document.activeElement):null; renderTop(); const v=view();
  app.innerHTML=(STORE==='ok'?'':`<div class="card" style="border-color:var(--warn)"><p class="small" style="margin:0">${STORE==='bad'?L('<b>Your saved data couldn’t be read.</b> It hasn’t been overwritten, so nothing new is being saved either. Menu → Restore from a backup brings a saved copy back.','<b>Tes données n’ont pas pu être lues.</b> Elles n’ont pas été écrasées, alors rien de nouveau n’est enregistré non plus. Menu → Restaurer à partir d’une sauvegarde ramène une copie.'):L('<b>Not saved.</b> This browser is blocking storage (private mode?). What you enter stays until you close this page.','<b>Pas enregistré.</b> Ce navigateur bloque la mémoire (mode privé?). Ce que tu entres reste jusqu’à ce que tu fermes la page.')}</p></div>`)
    +(v==='door'?vDoor():v==='meal'?vMeal():v==='hist'?vHist():tabsHTML()+(S.tab==='nut'?vNut():S.tab==='thr'?vThr():vHome()));
  renderBar(v); { const pill=document.getElementById('installPill'); if(pill) pill.innerHTML=pillHTML(); } window.scrollTo(0,keep?y:0); refocus(document,g); if(thr) thrMs=performance.now()-t0; }

/* ---------- the door: the only place the app mentions allergy, medicine or eating disorders ---------- */
const AGREE=()=>[L('I am 18 or older.','J’ai 18 ans ou plus.'),
  L('This is my own experiment and my own log. It isn’t medical or dietitian advice, and what I do with it is my decision.','C’est ma propre expérience et mon propre journal. Ce n’est pas un avis médical ou de diététiste, et je décide quoi en faire.'),
  L('The app shows what I report. It doesn’t check whether anything is serious. If something worries me, I get care.','L’app montre ce que je note. Elle ne vérifie pas si quelque chose est grave. Si quelque chose m’inquiète, je vais chercher des soins.'),
  L('I won’t eat a food I’m allergic to, or change a medicine or a diet that a doctor or dietitian gave me, to test something.','Je ne mangerai pas un aliment auquel je suis allergique, et je ne changerai pas un médicament ou un régime donné par un médecin ou une diététiste, pour tester quelque chose.'),
  L('I don’t have an eating disorder and I’m not recovering from one.','Je n’ai pas de trouble alimentaire et je ne suis pas en rétablissement d’un trouble alimentaire.')];
const MINE=()=>L('Your own report. Not advice.','Ton propre relevé. Pas un conseil.');
function instBig(){ if(FRAMED||STANDALONE) return ''; try{ if(localStorage.getItem(KEY+'.noinst')) return ''; }catch(e){ return ''; }
  return `<div class="instbig inst" style="margin:14px 0"><button type="button" data-act="install">↓ ${L('Install Threshold Log','Installer Threshold Log')}</button><p style="margin:6px 0 0;text-align:center;font-size:.85rem;opacity:.72">${L('Home-screen icon · full screen · works offline','Icône d’accueil · plein écran · fonctionne hors ligne')}</p><p style="margin:0;text-align:center"><button type="button" class="lnk" data-act="instno">${L('Not now','Pas maintenant')}</button></p></div>`; }
const NROWS=E.FAMS.reduce((n,f)=>n+f[1].length,0);   /* how many rows the Threshold tab can have: the number the first screen and the pages give */
function vDoor(){ return `<p class="tagline">${L('See how much of each compound you had eaten before each negative effect you reported.','Vois combien de chaque composé tu avais mangé avant chaque effet négatif que tu as noté.')}</p>
  <p>${L(`Report a meal when you eat, with its portions. Report a negative effect when you have one, with its time. The app tracks ${NROWS} compounds and nutrients in every meal. For each one, you see the amounts that came before an effect beside the amounts that didn’t. The app doesn’t judge. It counts, and shows where things land.`,`Note un repas quand tu manges, avec ses portions. Note un effet négatif quand tu en as un, avec son heure. L’app suit ${NROWS} composés et nutriments dans chaque repas. Pour chacun, tu vois les quantités prises avant un effet à côté de celles où il n’y en a pas eu. L’app ne juge pas. Elle compte, et montre où les choses tombent.`)}</p>
  <p class="small muted">${L('How a threshold works is on the app’s page: <a href="https://v3ktor.org/threshold/">v3ktor.org/threshold</a>.','Le fonctionnement d’un seuil est expliqué sur la page de l’app : <a href="https://v3ktor.org/threshold/">v3ktor.org/threshold</a>.')}</p>
  <p class="small muted">${L('It is step two, after the <a href="https://v3ktor.org/gut/">Food Trial Log</a>. It works without it too.','C’est la deuxième étape, après le <a href="https://v3ktor.org/gut/fr/">Food Trial Log</a>. Elle fonctionne aussi sans lui.')}</p>
  <div class="card gate"><p class="small" style="margin:0 0 6px"><b>${L('Tapping “Enter” means I agree:','Appuyer sur «\u00a0Entrer\u00a0» signifie que j’accepte\u00a0:')}</b></p><ol class="small" style="margin:0;padding-left:1.3em">${AGREE().map(l=>`<li>${l}</li>`).join('')}</ol>
  <button type="button" class="btn primary" style="width:100%;margin-top:12px" data-act="enter">${L('Enter','Entrer')}</button></div>
  ${instBig()}<p class="small muted" style="margin-top:16px">${L('Everything stays on this phone. No account, no tracking.','Tout reste sur ce téléphone. Pas de compte, pas de suivi.')} v${VER} · <button type="button" class="lnk" data-act="about">${L('About and privacy','À propos et confidentialité')}</button></p>`; }

/* ---------- the ring and its key: what went in, by grams. The key carries the amounts. ---------- */
const SLN={fat:['Fat','Gras'],prot:['Protein','Protéines'],cplx:['Complex carbs','Glucides complexes'],lact:['Lactose','Lactose'],sugo:['Other sugars','Autres sucres'],fib:['Fibre','Fibres'],unk:['Carbs, kind not listed','Glucides, sorte non indiquée'],alc:['Alcohol','Alcool']};
const BARN={fat:['Fat','Gras','g'],cplx:['Complex carbs','Glucides complexes','g'],sug:['Sugars','Sucres','g'],lact:['Lactose','Lactose','g'],fib:['Fibre','Fibres','g'],hist:['Histamine, estimated','Histamine, estimée','mg'],
  alc:['Alcohol','Alcool','g'],caf:['Caffeine','Caféine','mg'],theo:['Theobromine','Théobromine','mg'],nit:['Nitrate, estimated','Nitrate, estimé','mg'],
  tyr:['Tyramine, estimated','Tyramine, estimée','mg'],ox:['Oxalates','Oxalates','mg'],ga:['Glycoalkaloids','Glycoalcaloïdes','p'],cap:['Capsaicin','Capsaïcine','p'],
  fru:['Fructans','Fructanes','p'],gos:['Galacto-oligosaccharides','Galacto-oligosaccharides','p'],sorb:['Sorbitol','Sorbitol','g'],mann:['Mannitol','Mannitol','g'],fruc:['Excess fructose','Fructose en excès','g'],
  sulph:['Sulphites','Sulfites','p'],nitr:['Nitrites, added','Nitrites ajoutés','p'],swt:['Sweeteners','Édulcorants','p'],flav:['Flavourings','Arômes','p'],glu:['Gluten','Gluten','p'],pur:['Purines','Purines','mg'],
  sat:['Saturated fat','Gras saturés','g'],mono:['Monounsaturated fat','Gras monoinsaturés','g'],poly:['Polyunsaturated fat','Gras polyinsaturés','g'],
  frs:['Fructose','Fructose','g'],gluc:['Glucose','Glucose','g'],sucr:['Sucrose','Sucrose','g'],malt:['Maltose','Maltose','g'],gal:['Galactose','Galactose','g'],
  na:['Sodium','Sodium','mg'],se:['Selenium','Sélénium','µg']};
const FAMN={base:['Fat, carbs and fibre','Gras, glucides et fibres'],ac:['Alcohol and caffeine','Alcool et caféine'],amine:['Amines','Amines'],plant:['Plant compounds','Composés végétaux'],ferm:['Fermentable sugars','Sucres fermentescibles'],added:['Added','Ajoutés'],other:['Other','Autres'],min:['Minerals','Minéraux']};
/* an amount as it is written everywhere: grams, milligrams (≈ where it is an estimate), or portions where no figure is entered */
function amtTxt(k,x){ const u=BARN[k][2]; if(u==='p') return (+(+x).toFixed(1)).toLocaleString(LOC())+'\u00a0'+(x===1?'portion':'portions'); return (k==='hist'||k==='nit'||k==='tyr'?'≈\u00a0':'')+U(x,u,x<1?2:x<10?1:0); }
const held=(am,k)=>(am[k]||0)>0.005||(k==='hist'&&am.histN>0);
function compRow(k,am){ const plus=(k==='hist'&&am.histUnk>0)||!!(am.x&&am.x[k]>0);
  return `<li><button type="button" class="keyrow" data-act="comp" data-v="${k}"><span class="nm und">${L(BARN[k][0],BARN[k][1])}</span><span class="am">${amtTxt(k,am[k]||0)}${plus?'<span aria-hidden="true">+</span><span class="vh">'+L(' or more',' ou plus')+'</span>':''}</span></button></li>`; }
function compHomeHTML(am){ const n=E.FAMS.slice(2).reduce((t,f)=>t+f[1].filter(k=>held(am,k)).length,0);
  return `<p class="small" style="margin:12px 0 0"><b>${L(FAMN.ac[0],FAMN.ac[1])}</b></p><ul class="key" style="margin-top:2px">${compRow('alc',am)}${compRow('caf',am)}</ul>
  <div class="menu" style="margin-top:12px"><button type="button" class="cmore" data-act="comps"><span>${L('Other compounds','Autres composés')}</span><span class="muted">${n}\u00a0›</span></button></div>`; }
const TOBAR={fat:'fat',cplx:'cplx',lact:'lact',sugo:'sug',fib:'fib'};
function ringHTML(am,div){ const P=E.pie(am), R=64, C=2*Math.PI*R, GAP=P.slices.length>1?2:0; let off=0, arcs='';
  for(const s of P.slices){ const len=s.g/P.tot*C; arcs+=`<circle cx="74" cy="74" r="${R}" stroke="var(--s-${s.k})" stroke-dasharray="${Math.max(0.5,len-GAP).toFixed(2)} ${(C-Math.max(0.5,len-GAP)).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off+=len; }
  return `<div class="ring"><svg viewBox="0 0 148 148" role="img" aria-label="${esc(P.slices.map(s=>L(SLN[s.k][0],SLN[s.k][1])+' '+s.pct+' %').join(', ')||L('Nothing reported','Rien de noté'))}"><circle cx="74" cy="74" r="${R}" stroke="var(--chip)"/>${arcs}</svg>
    <span class="mid"><b>${U(P.tot/(div||1),'g',0)}</b><small>${L('eaten','mangés')}</small></span></div>`; }
function keyHTML(am,div,some){ const P=E.pie(am); div=div||1; if(!P.slices.length) return `<p class="small muted" style="margin:12px 0 0;text-align:center">${some?L('What you reported in this period holds no fat, protein, carbs or fibre.','Ce que tu as noté pour cette période ne contient ni gras, ni protéines, ni glucides, ni fibres.'):L('No meal reported in this period.','Aucun repas noté pour cette période.')}</p>`;
  return `<ul class="key">${P.slices.map(s=>{ const inner=`<span class="sw" style="background:var(--s-${s.k})"></span><span class="nm">${L(SLN[s.k][0],SLN[s.k][1])}</span><span class="am">${U(s.g/div,'g')}</span>`;
    return `<li>${TOBAR[s.k]?`<button type="button" class="keyrow" data-act="rowsheet" data-k="${TOBAR[s.k]}">${inner}</button>`:`<span class="keyrow" style="cursor:default">${inner}</span>`}</li>`; }).join('')}</ul>`; }

/* ---------- Home ---------- */
/* how long before: "40 min before", "2 h 10 before" */
function gapTxt(ms){ const n=Math.round(ms/6e4); if(n<1) return L('at the same time','au même moment'); const t=n<60?n+' min':Math.floor(n/60)+' h'+(n%60?' '+p2(n%60):''); return L(t+' before',t+' avant'); }
function vHome(){ const I=IX(), T=today(), Y=kAdd(T,-1), d=I.D[T], dy=I.D[Y], hasFx=!!(d&&d.fx.length), noneOn=!!(d&&d.none);
  const evs=S.ev.filter(e=>(e.k==='none'?e.d:E.dayKey(e.t,S.roll))===T), nm=evs.filter(e=>e.k==='meal').length, nf=evs.filter(e=>e.k==='fx').length, older=S.ev.length>evs.length;
  return `<div class="mainbtns"><button type="button" class="mb meal" data-act="meal"><span class="mi" aria-hidden="true">＋</span>${L('Meal','Repas')}</button><button type="button" class="mb fx" data-act="fx"><span class="mi" aria-hidden="true">＋</span>${L('Effect','Effet')}</button></div>
  ${hasFx?'':`<button type="button" class="lnk none" data-act="none" data-v="${T}" aria-pressed="${noneOn}">${noneOn?'✓ '+L('No effects today','Aucun effet aujourd’hui'):L('No effects today','Aucun effet aujourd’hui')}</button>`}
  ${dy&&dy.meals.length&&!dy.closed?`<p class="small muted" style="text-align:center;margin:0 0 8px">${L('Yesterday has meals and no effect.','Hier : des repas notés, aucun effet négatif noté.')} <button type="button" class="lnk" data-act="none" data-v="${Y}">${L('No effects yesterday','Aucun effet hier')}</button></p>`:''}
  ${S.ev.length?'':`<div class="card soft"><p class="small" style="margin:0">${L('<b>How it works.</b> Report a meal when you eat. Report a negative effect when you have one. On a day with none, tap “No effects today”. A day with a meal and one of those is complete, and the Threshold rows count complete days.','<b>Comment ça marche.</b> Note un repas quand tu manges. Note un effet négatif quand tu en as un. Une journée sans effet, appuie sur «\u00a0Aucun effet aujourd’hui\u00a0». Une journée avec un repas et l’un des deux est complète, et les lignes de Seuil comptent les journées complètes.')}</p></div>`}
  <div class="eyebrow" style="margin:18px 0 0">${L('Today','Aujourd’hui')}</div>
  ${evs.length?`<ul class="tl" id="todayList">${evs.map(entryRow).join('')}</ul>`:`<p class="small muted" id="todayNone" style="margin:8px 0 0">${L('Nothing reported today yet.','Rien de noté aujourd’hui pour l’instant.')}</p>`}
  ${nm||nf?`<p class="small muted" id="todayCount" style="margin:14px 0 0;text-align:center">${L(`${nm} meal${nm===1?'':'s'} · ${nf} effect${nf===1?'':'s'}`,`${nm} repas · ${nf} effet${nf>1?'s':''}`)}</p>`:''}
  ${nm?`<p style="margin:6px 0 0;text-align:center"><button type="button" class="lnk" data-act="tonut">${L('What went in, under Nutrition','Ce que tu as mangé et bu, dans Nutrition')}</button></p>`:''}
  ${older?`<p style="margin:6px 0 0;text-align:center"><button type="button" class="lnk" data-act="hist">${L('Earlier days, in History','Les journées d’avant, dans l’Historique')}</button></p>`:''}
  <p class="mine">${MINE()}</p>`; }

/* ---------- a meal: foods, portions in halves, a time. The same screen edits "my list". ---------- */
function openMeal(e){ const T=today(); if(e){ const k=E.dayKey(e.t,S.roll), items={}; for(const it of e.items) items[it.key]=it.q; V={v:'meal',mode:'meal',id:e.id,day:k,at:hm(e.t),items,grp:'sel',q:''}; }
  else V={v:'meal',mode:'meal',day:T,at:hm(now()),items:{},grp:S.list.length?'mine':recentKeys().length?'recent':'fruit',q:''}; render(); }
function openList(){ const items={}; for(const k of S.list) items[k]=1; V={v:'meal',mode:'list',items,base:S.list.slice(),grp:S.list.length?'mine':'fruit',q:''}; render(); }
function recentKeys(){ const seen=new Set(), out=[]; for(let i=S.ev.length-1;i>=0&&out.length<40;i--){ const e=S.ev[i]; if(e.k!=='meal') continue; for(const it of e.items) if(!seen.has(it.key)){ seen.add(it.key); out.push(it.key); } } return out; }
function recentMeals(){ const seen=new Set(), out=[]; for(let i=S.ev.length-1;i>=0&&out.length<4;i--){ const e=S.ev[i]; if(e.k!=='meal') continue; const sig=e.items.map(it=>it.key+'*'+it.q).sort().join('|'); if(!seen.has(sig)){ seen.add(sig); out.push(e); } } return out; }
function searchFoods(q,max){ q=norm(q.trim()); if(!q) return []; const all=FOODS.map(f=>f.key).concat(S.custom.map(c=>'L'+c.id)), hit=[];
  const rk=s=>{ const i=s.indexOf(q); return i<0?9:i>0?2:(s.length===q.length||s[q.length]===',')?0:1; };
  for(const k of all){ const f=food(k), r=Math.min(rk(norm(f.n[0])),rk(norm(f.n[1]))); if(r<9) hit.push([r,k]); }
  return hit.sort((x,y)=>x[0]-y[0]).slice(0,max||60).map(x=>x[1]); }                       /* the word as the whole name comes first ("Water", "Potato, boiled"), then names that start with it, then the rest */
function pickKeys(){ if(V.q.trim()) return searchFoods(V.q);
  if(V.grp==='sel') return Object.keys(V.items);
  if(V.grp==='mine') return V.mode==='list'?[...new Set(V.base.concat(Object.keys(V.items)))]:S.list.slice();
  if(V.grp==='recent') return recentKeys();
  if(V.grp==='label') return S.custom.map(c=>'L'+c.id);
  return FOODS.filter(f=>f.grp===V.grp).map(f=>f.key); }
function mealRow(k){ const f=food(k), q=V.items[k]||0, sv=fserv(f), nm=`<div class="nm">${esc(fname(f))}${sv?`<small>${esc(sv)}</small>`:''}</div>`;
  return V.mode==='list'?`<div class="st${q?' on':''}" style="grid-template-columns:1fr auto">${nm}<button type="button" class="btn ${q?'':'ghost '}sm" data-act="mq" data-k="${esc(k)}" data-v="${q?-1:1}" aria-pressed="${!!q}">${q?'✓ '+L('On my list','Sur ma liste'):L('Add','Ajouter')}</button></div>`
    :`<div class="st${q?' on':''}">${nm}<button type="button" class="stp" data-act="mq" data-k="${esc(k)}" data-v="-0.5" aria-label="${L('Less','Moins')}: ${esc(fname(f))}" ${q?'':'disabled'}>−</button><span class="val" aria-live="polite">${q?qtxt(q):''}</span><button type="button" class="stp plus" data-act="mq" data-k="${esc(k)}" data-v="0.5" aria-label="${L('More','Plus')}: ${esc(fname(f))}">+</button></div>`; }
function mealRows(){ return pickKeys().map(mealRow).join('')||`<p class="small muted">${V.q.trim()?L('No food by that name. You can add one from its label: Menu → Add a food from its label.','Aucun aliment à ce nom. Tu peux en ajouter un selon son étiquette\u00a0: Menu → Ajouter un aliment selon son étiquette.'):V.grp==='mine'?L('Your list is empty. Pick foods from the groups, or bring your list from the Food Trial Log (Nutrition tab).','Ta liste est vide. Choisis des aliments dans les groupes, ou importe ta liste du Food Trial Log (onglet Nutrition).'):L('Nothing here yet.','Rien ici pour l’instant.')}</p>`; }
function vMeal(){ const T=today(), Y=kAdd(T,-1), list=V.mode==='list', nsel=Object.keys(V.items).length, hasQ=!!V.q.trim();
  const tabs=[...(nsel&&!list?[['sel',L(`Picked · ${nsel}`,`Choisis · ${nsel}`)]]:[]),['mine',L('My list','Ma liste')],...(list?[]:[['recent',L('Recent','Récents')]]),...(S.custom.length?[['label',L('From a label','Selon l’étiquette')]]:[]),...GROUPS.map(([k,en,fr])=>[k,L(en,fr)])];
  const rm=!list&&!nsel&&!V.id?recentMeals():[];
  return `<div class="eyebrow">${list?L('My list','Ma liste'):V.id?L('Change this meal','Modifier ce repas'):L('Meal','Repas')}</div>
  ${list?`<p class="small">${L('The foods you eat as a rule. One food’s reading uses the list to count the days when everything else you ate was on it.','Les aliments que tu manges d’habitude. Le relevé d’un aliment se sert de la liste pour compter les jours où tout le reste de ce que tu as mangé y était.')}</p>`
    :`<div class="card" style="padding:10px 14px"><div class="row"><div class="gtabs seg" style="margin:0"><button type="button" data-act="mday" data-v="${T}" aria-pressed="${V.day===T}">${L('Today','Aujourd’hui')}</button><button type="button" data-act="mday" data-v="${Y}" aria-pressed="${V.day===Y}">${L('Yesterday','Hier')}</button>${V.day!==T&&V.day!==Y?`<button type="button" aria-pressed="true">${esc(dLabel(V.day))}</button>`:''}</div><label class="vh" for="mAt">${L('Time','Heure')}</label><input type="time" id="mAt" class="sel tm" data-in="mat" value="${V.at}"></div></div>`}
  ${rm.length?`<div id="mSame" ${hasQ?'hidden':''}><div class="eyebrow" style="margin-top:10px">${L('Same as','Comme')}</div><div class="gtabs">${rm.map(e=>`<button type="button" data-act="msame" data-v="${e.id}" style="border-radius:12px;text-align:left">${mealText(e)}</button>`).join('')}</div></div>`:''}
  <div class="fsearch"><label class="vh" for="mQ">${L('Search a food','Chercher un aliment')}</label><input type="search" id="mQ" class="sel" data-in="mq" value="${esc(V.q)}" placeholder="${L('Search a food','Chercher un aliment')}" autocomplete="off"></div>
  <div class="gtabs" id="mTabs" role="group" aria-label="${L('Groups','Groupes')}" ${hasQ?'hidden':''}>${tabs.map(([k,l])=>`<button type="button" data-act="mgrp" data-v="${k}" aria-pressed="${V.grp===k}">${l}</button>`).join('')}</div>
  <div class="steps" id="mRows">${mealRows()}</div>`; }

/* ---------- an effect: two groups, one tap each, a time ---------- */
function fxSheet(){ const u=UI.fx, T=today(), Y=kAdd(T,-1), own=S.own[u.tab]||[];
  const chip=(c,l,sub)=>`<button type="button" class="chip" data-act="fxk" data-v="${esc(c)}" aria-pressed="${u.sel.includes(c)}"><span>${esc(l)}${sub?`<span class="sub">${esc(sub)}</span>`:''}</span></button>`;
  showSheet(`<h3 id="sheetTitle">${L('Effect','Effet')}</h3>
  <div class="gtabs seg toptabs" role="tablist"><button type="button" role="tab" data-act="fxtab" data-v="phys" aria-pressed="${u.tab==='phys'}">${L('Physical','Physique')}</button><button type="button" role="tab" data-act="fxtab" data-v="psy" aria-pressed="${u.tab==='psy'}">${L('Psychological','Psychologique')}</button></div>
  <div class="chips pickn fx">${FX[u.tab].map(r=>chip(r[0],L(r[1],r[2]),r[3]?L(r[3],r[4]):'')).join('')}${own.map(w=>chip('o:'+w,w,'')).join('')}</div>
  <div class="row" style="flex-wrap:nowrap"><label class="vh" for="fxOwn">${L('In your own words','Dans tes mots')}</label><input id="fxOwn" class="sel" style="flex:1;min-width:0;min-height:44px" data-in="fxown" value="${esc(u.own||'')}" maxlength="40" placeholder="${L('In your own words','Dans tes mots')}"><button type="button" class="btn ghost sm" data-act="fxadd">${L('Add','Ajouter')}</button></div>
  <div class="row" style="margin-top:12px"><div class="gtabs seg" style="margin:0"><button type="button" data-act="fxday" data-v="${T}" aria-pressed="${u.day===T}">${L('Today','Aujourd’hui')}</button><button type="button" data-act="fxday" data-v="${Y}" aria-pressed="${u.day===Y}">${L('Yesterday','Hier')}</button>${u.day!==T&&u.day!==Y?`<button type="button" aria-pressed="true">${esc(dLabel(u.day))}</button>`:''}</div><label class="vh" for="fxAt">${L('Time','Heure')}</label><input type="time" id="fxAt" class="sel tm" data-in="fxat" value="${u.at}"></div>
  <div class="row stick"><button type="button" class="btn primary" style="flex:1" data-act="fxdone" ${u.sel.length?'':'disabled'}>${L('Done','Terminé')}${u.sel.length?' · '+u.sel.length:''}</button></div>`,true); }
