// Food Trial Log, English and French: Nutrition on the shared rules (shared/nutrition.js), the wrench, and the answers shared with
// The Patch on the same phone.
//   node tests/gut/nutrition.test.js      (needs Playwright with Chromium)
'use strict';
const fs = require('fs'), path = require('path'), { chromium } = require('playwright'), { serve } = require('../lib/serve.js');
const ROOT = path.join(__dirname, '..', '..'), FIX = path.join(__dirname, '..', 'fixtures'), SHARE = 'v3k.profile.v1';
let pass = 0, fail = 0; const same = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { fail++; console.log('FAIL ' + name + '\n     got  ' + JSON.stringify(got) + '\n     want ' + JSON.stringify(want)); } };

(async () => {
  const srv = await serve(ROOT), browser = await chromium.launch();
  try { for (const [lang, url, file] of [['en', '/gut/app/', 'gut-day-9.json'], ['fr', '/gut/fr/app/', 'gut-fr-day-9.json']]) {
    const fr = lang === 'fr', T = `[${lang}] `, fx = JSON.parse(fs.readFileSync(path.join(FIX, file), 'utf8'));
    const open = async (state, shared) => { const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: fr ? 'fr-CA' : 'en-CA', serviceWorkers: 'block' }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(([k, v, sk, sv]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); if (sv) localStorage.setItem(sk, sv); sessionStorage.setItem('seeded', '1'); } }, [fx.key, JSON.stringify(state), SHARE, shared ? JSON.stringify(shared) : null]);
      await page.goto(srv.url + url); await page.waitForSelector('#topbar'); await page.evaluate(() => ACT.nut()); return { ctx, page, errors }; };
    const st = (p, extra) => Object.assign(JSON.parse(JSON.stringify(fx.state)), { p: Object.assign({}, fx.state.p, p) }, extra || {});
    const shared = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SHARE);
    // 1. the screen: the line, the wrench, the 21 rows, no calories
    let { ctx, page, errors } = await open(st({ sex: 'hi', age: 'a2', life: [] }));
    same(T + 'the line above the bars', (await page.locator('.nprof p').innerText()).replace(/\s+/g, ' '), fr ? 'Besoins calculés pour : sexe non précisé · âge non précisé · poids non précisé' : 'Needs worked out for: sex not given · age not given · weight not given');
    same(T + 'the same 21 rows as before, and no calories', await page.evaluate(() => [TN.length, TN.some(r => r[0] === 'kcal'), TN.find(r => r[0] === 'e')[2]]), [21, false, fr ? 'UI' : 'IU']);
    same(T + 'nothing is shared that wasn’t answered', [await shared(page), await page.evaluate(() => { save(); return localStorage.getItem('v3k.profile.v1'); })], [null, null]);
    same(T + 'with no weight, protein is the RDA', await page.evaluate(() => targets().prot), 56);
    // 2. the wrench: four questions (no kind of day), no "drink most days", no "under 19"
    await page.click('.nprof .wrench'); await page.waitForSelector('#sheet.on [data-pw]');
    same(T + 'the sheet asks sex, age, weight and the list', await page.locator('#sheet fieldset.pw').count(), 4);
    same(T + 'without what this app doesn’t use', await page.locator('#sheet [data-v="drink"], #sheet [data-v="minor"], #sheet [data-pw="work"]').count(), 0);
    await page.click('#sheet [data-pw="sex"][data-v="f"]'); await page.click('#sheet [data-pw="wt"][data-v="90"]'); await page.click('#sheet [data-pw="life"][data-v="smoke"]');
    same(T + 'the needs move: iron for a woman, protein by weight, vitamin C for a smoker', await page.evaluate(() => { const t = targets(); return [t.fe, t.prot, t.c]; }), [18, 72, 110]);
    same(T + 'what was answered is shared, and only that', (await shared(page)).p, { sex: 'f', wt: '90', life: ['smoke'] });
    same(T + 'the button tapped keeps the focus', await page.evaluate(() => document.activeElement.dataset.v), 'smoke');
    await page.click('#sheet [data-act="close"]');
    same(T + 'the line follows', (await page.locator('.nprof p').innerText()).includes(fr ? 'tabac ou vapotage' : 'smoke or vape'), true);
    same(T + 'no script error', errors, []); await ctx.close();
    // 3. someone who set "a woman" in the old panel: it counts as answered and is shared on the next save; the starting 31 to 50 isn't
    ({ ctx, page, errors } = await open(st({ sex: 'f', age: 'a2', life: [] })));
    await page.evaluate(() => save()); same(T + 'an answer from before counts as given', (await shared(page)).p, { sex: 'f' }); await ctx.close();
    // 4. a newer answer from another app wins, and what this app doesn't ask is kept and passed on
    ({ ctx, page, errors } = await open(st({ sex: 'f', age: 'a1', life: ['veg'] }, { pk: ['sex', 'age', 'life'], pt: 1000 }), { v: 1, t: Date.now(), p: { sex: 'm', age: 'a3', wt: '110', work: 'heavy', life: ['drink', 'smoke'] } }));
    same(T + 'the newer shared answers win', await page.evaluate(() => [S.p.sex, S.p.age, S.p.wt, S.p.work, S.p.life, targets().c, targets().prot]), ['m', 'a3', '110', 'heavy', ['drink', 'smoke'], 125, 88]);
    await page.click('.nprof .wrench'); await page.click('#sheet [data-pw="age"][data-v="a4"]');
    same(T + 'a change here keeps the kind of day and the drinking another app gave', (await shared(page)).p, { sex: 'm', age: 'a4', wt: '110', work: 'heavy', life: ['drink', 'smoke'] });
    await ctx.close();
    ({ ctx, page, errors } = await open(st({ sex: 'f', age: 'a1', life: [] }, { pk: ['sex', 'age'], pt: Date.now() }), { v: 1, t: 1000, p: { sex: 'm' } }));
    same(T + 'an older one doesn’t', await page.evaluate(() => S.p.sex), 'f');
    // 5. erasing removes the shared answers
    await page.evaluate(() => eraseAll()); same(T + 'erasing everything removes the shared answers', await shared(page), null);
    same(T + 'no script error', errors, []); await ctx.close(); }
    // 6. the round trip on one phone: set in The Patch, read in the Food Trial Log, changed there, read back in The Patch
    const ctx = await browser.newContext({ serviceWorkers: 'block' }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    const fx = JSON.parse(fs.readFileSync(path.join(FIX, 'gut-day-9.json'), 'utf8'));
    await page.addInitScript(([k, v]) => { if (!localStorage.getItem('seeded')) { localStorage.setItem(k, v); localStorage.setItem('thepatch.v1', JSON.stringify({ lang: 'en', ack: true, a: { safety: ['none'] }, tank: { p: { sex: 'f', age: 'a3', wt: '70', work: 'sit', life: ['preg'] }, day: {} } })); localStorage.setItem('seeded', '1'); } }, [fx.key, JSON.stringify(fx.state)]);
    await page.goto(srv.url + '/patch/app/'); await page.waitForSelector('#topbar'); await page.evaluate(() => save());
    await page.goto(srv.url + '/gut/app/'); await page.waitForSelector('#topbar');
    same('[both] The Patch’s answers reach the Food Trial Log', await page.evaluate(() => [S.p.sex, S.p.age, S.p.wt, myLife().preg, targets().fe]), ['f', 'a3', '70', true, 27]);
    await page.evaluate(() => { takeProf(NUTRI.pick(myProf(), 'life', 'preg')); save(); });
    await page.goto(srv.url + '/patch/app/'); await page.waitForSelector('#topbar');
    same('[both] not pregnant any more, said in the Food Trial Log: The Patch follows', await page.evaluate(() => [tankLife().preg, S.tank.p.life, tankTargets().fe]), [false, ['none'], 8]);
    same('[both] no script error', errors, []); await ctx.close();
  } catch (e) { fail++; console.log('STOPPED: ' + (e.stack || e)); }
  await browser.close(); await srv.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `gut nutrition: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
})();
