// The pictures on the Threshold Log's web page: four screens, in English and French, from the made-up people's six weeks
// (tests/fixtures/threshold-varied.json and threshold-steady.json).
//   node tools/threshold/pictures.js <folder>                     PNGs into a folder (needs Playwright with Chromium)
//   python3 tools/threshold/pictures_webp.py <that folder>       into threshold/img/, only the ones that changed
process.env.TZ='Etc/GMT+7';
const { chromium } = require('playwright'); const fs=require('fs'), path=require('path'); const R=path.join(__dirname,'..','..'); const { serve } = require(path.join(R,'tests','lib','serve.js'));
const out=process.argv[2];
(async()=>{ fs.mkdirSync(out,{recursive:true}); const s=await serve(R); const b=await chromium.launch();
  for(const lang of ['en','fr']) for(const who of ['varied','steady']){
    const P=JSON.parse(fs.readFileSync(path.join(R,'tests','fixtures','threshold-'+who+'.json'),'utf8')); let st=Object.assign({},P.state,{lang,seenThr:true});
    // the made-up person wrote their own words in French: an English picture gets them in English
    if(lang==='en') st=JSON.parse(JSON.stringify(st).split('"confusion"').join('"brain fog"').split('o:confusion').join('o:brain fog').split('1 bouteille (355 ml)').join('1 bottle (355 ml)'));
    const ctx=await b.newContext({viewport:{width:390,height:780},deviceScaleFactor:2,locale:lang==='fr'?'fr-CA':'en-CA',timezoneId:'Etc/GMT+7',reducedMotion:'reduce'});
    const page=await ctx.newPage(); await page.clock.setFixedTime(P.now);
    await page.addInitScript(([k,v])=>{ localStorage.setItem(k,v); localStorage.setItem(k+'.noinst','1'); },[P.key,JSON.stringify(st)]);
    await page.goto(s.url+'/threshold/app/'); await page.waitForSelector('.mb.meal'); const shot=n=>page.screenshot({path:path.join(out,n+'-'+lang+'.png')});
    if(who==='varied'){ await shot('home'); await page.click('[data-act=tab][data-v=thr]'); await page.evaluate(()=>{ const tabs=document.querySelector('[data-act=tab]').parentElement.getBoundingClientRect(), bar=document.getElementById('topbar').getBoundingClientRect(); window.scrollTo(0,tabs.bottom+window.scrollY-bar.bottom+2); }); await page.setViewportSize({width:390,height:780}); await shot('bars'); await page.evaluate(()=>window.scrollTo(0,0));
      await page.click('#app [data-act=rowsheet][data-k=lact]'); await page.locator('#sheet [data-act=rstep]').last().click(); await page.evaluate(()=>{ const s=document.getElementById('sheet'); s.style.maxHeight='92vh'; }); await shot('step'); }
    else { await page.click('[data-act=tab][data-v=nut]'); await page.evaluate(()=>{ const c=document.getElementById('cov'); window.scrollTo(0,c.getBoundingClientRect().top+window.scrollY-150); }); await shot('nutrition'); }
    await ctx.close(); }
  await b.close(); await s.close(); })().catch(e=>{ console.error(e); process.exit(1); });
