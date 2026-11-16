// The Patch: the wrench above the Nutrition bars, and the answers shared with the other v3ktor.org apps on the phone.
//   node tests/patch/wrench.test.js      (needs Playwright with Chromium)
'use strict';
const path = require('path'), { chromium } = require('playwright'), { serve } = require('../lib/serve.js');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0; const same = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { fail++; console.log('FAIL ' + name + '\n     got  ' + JSON.stringify(got) + '\n     want ' + JSON.stringify(want)); } };
const ready = (lang, extra) => Object.assign({ lang, ack: true, mode: 'tank', tstep: 99, a: { safety: ['none'] }, tank: { p: { sex: 'm', age: 'a2', wt: '90', work: 'feet', life: ['none'] }, day: {}, view: 'today' } }, extra || {});
const SHARE = 'v3k.profile.v1';

(async () => {
  const srv = await serve(ROOT), browser = await chromium.launch();
  const open = async (seed, lang) => { const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: lang === 'fr' ? 'fr-CA' : 'en-CA', serviceWorkers: 'block' }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(seed => { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, seed);
    await page.goto(srv.url + '/patch/app/'); await page.waitForSelector('#topbar');
    await page.evaluate(() => { S.mode = 'tank'; S.tstep = tqList().length + 1; S.tank.view = 'today'; render(); }); return { ctx, page, errors }; };
  const shared = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SHARE);
  const line = page => page.locator('.nprof p').innerText();
  try {
    for (const lang of ['en', 'fr']) { const fr = lang === 'fr', T = `[${lang}] `;
      // 1. the line and the wrench, and the answers go out to the other apps on the first save
      let { ctx, page, errors } = await open({ 'thepatch.v1': JSON.stringify(ready(lang)) }, lang);
      same(T + 'the line above the bars says what the needs are worked out from', (await line(page)).replace(/\s+/g, ' '), fr ? 'Besoins calculés pour : Homme · 31 à 50 · 80–100 kg · debout' : 'Needs worked out for: Male · 31 to 50 · 80–100 kg · on my feet');
      same(T + 'the wrench has a name for screen readers', await page.locator('.nprof .wrench').getAttribute('aria-label'), fr ? 'Changer ce qui sert à calculer les besoins' : 'Change what the needs are worked out from');
      await page.evaluate(() => save()); same(T + 'the answers are shared on this phone', (await shared(page)).p, { sex: 'm', age: 'a2', wt: '90', work: 'feet', life: ['none'] });
      // 2. the wrench: change sex, and smoking; the needs move with them
      await page.click('.nprof .wrench'); await page.waitForSelector('#sheet.on [data-pw]');
      same(T + 'the sheet asks the five things', await page.locator('#sheet fieldset.pw').count(), 5);
      await page.click('#sheet [data-pw="sex"][data-v="f"]'); await page.click('#sheet [data-pw="life"][data-v="smoke"]');
      same(T + 'the answers change in The Patch', await page.evaluate(() => [S.tank.p.sex, S.tank.p.life, tankTargets().fe, tankTargets().c]), ['f', ['smoke'], 18, 110]);
      same(T + 'and in what is shared', (await shared(page)).p, { sex: 'f', age: 'a2', wt: '90', work: 'feet', life: ['smoke'] });
      same(T + 'the button tapped stays pressed and keeps the focus', await page.evaluate(() => [document.activeElement.dataset.v, document.activeElement.getAttribute('aria-pressed')]), ['smoke', 'true']);
      await page.click('#sheet [data-pw="life"][data-v="none"]'); same(T + '"none of these" clears the list', await page.evaluate(() => S.tank.p.life), ['none']);
      await page.click('#sheet [data-pw="life"][data-v="veg"]'); await page.click('#sheet [data-pw="life"][data-v="vegan"]');
      same(T + 'vegetarian and vegan exclude each other, and the Patch’s own diet answer follows', await page.evaluate(() => [S.tank.p.life, S.a.safety]), [['vegan'], ['vegan']]);
      await page.click('#sheet #closeSheet'); same(T + 'the line follows', (await line(page)).includes(fr ? 'Femme' : 'Female') && (await line(page)).includes(fr ? 'végane' : 'vegan'), true);
      same(T + 'no script error', errors, []); await ctx.close();
      // 3. a newer answer from another app wins when The Patch opens; an older one doesn't
      const later = Date.now() + 60e3, mine = ready(lang); mine.tank.pt = Date.now(); mine.a.safety = ['preg'];
      ({ ctx, page, errors } = await open({ 'thepatch.v1': JSON.stringify(mine), [SHARE]: JSON.stringify({ v: 1, t: later, p: { sex: 'f', age: 'a1', life: ['none'] } }) }, lang));
      same(T + 'a newer answer from another app wins, and a field it doesn’t ask stays as it was', await page.evaluate(() => [S.tank.p.sex, S.tank.p.age, S.tank.p.wt, S.tank.p.life]), ['f', 'a1', '90', ['none']]);
      same(T + 'not pregnant any more there: The Patch’s own pregnancy answer follows', await page.evaluate(() => [S.a.safety, tankLife().preg]), [['none'], false]);
      await ctx.close();
      const older = ready(lang); older.tank.pt = Date.now();
      ({ ctx, page, errors } = await open({ 'thepatch.v1': JSON.stringify(older), [SHARE]: JSON.stringify({ v: 1, t: 1000, p: { sex: 'f', age: 'a4' } }) }, lang));
      same(T + 'an older one doesn’t', await page.evaluate(() => [S.tank.p.sex, S.tank.p.age]), ['m', 'a2']); await ctx.close();
      // 4. the Patch's own pregnancy answer goes out too
      const preg = ready(lang); preg.tank.p.sex = 'f'; preg.a.safety = ['preg'];
      ({ ctx, page, errors } = await open({ 'thepatch.v1': JSON.stringify(preg) }, lang)); await page.evaluate(() => save());
      same(T + 'pregnancy from The Patch’s questions is shared', (await shared(page)).p.life, ['preg']);
      // 5. another app changes the answers while The Patch is open
      await page.evaluate(k => { const o = { v: 1, t: Date.now() + 120e3, p: { sex: 'f', age: 'a3', wt: '55', work: 'sit', life: ['bf'] } }; localStorage.setItem(k, JSON.stringify(o)); window.dispatchEvent(new StorageEvent('storage', { key: k })); }, SHARE);
      same(T + 'a change from another app shows at once', await page.evaluate(() => [S.tank.p.age, tankLife().bf, tankLife().preg]), ['a3', true, false]);
      // 6. sharing off: nothing read, nothing written; erase removes the shared answers
      await page.evaluate(() => { S.share = false; save(); }); await page.evaluate(k => localStorage.setItem(k, JSON.stringify({ v: 1, t: Date.now() + 9e6, p: { sex: 'm' } })), SHARE);
      await page.evaluate(() => { pullProfile(); S.tank.p.age = 'a4'; save(); });
      same(T + 'sharing off: nothing read, nothing written', [await page.evaluate(() => S.tank.p.sex), (await shared(page)).p], ['f', { sex: 'm' }]);
      await page.evaluate(() => { S.share = true; eraseAll(); }); same(T + 'erasing everything removes the shared answers', await shared(page), null);
      same(T + 'no script error', errors, []); await ctx.close(); }
  } catch (e) { fail++; console.log('STOPPED: ' + (e.stack || e)); }
  await browser.close(); await srv.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `patch wrench: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
})();
