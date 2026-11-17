// Threshold Log, English and French: the reference amounts on the shared rules (shared/nutrition.js), the wrench, and the answers shared with
// The Patch and the Food Trial Log on the same phone.
//   node tests/threshold/nutrition.test.js      (needs Playwright with Chromium)
'use strict';
const path = require('path'), { chromium } = require('playwright'), { serve } = require('../lib/serve.js');
const ROOT = path.join(__dirname, '..', '..'), KEY = 'v3k.threshold.v1', SHARE = 'v3k.profile.v1';
let pass = 0, fail = 0; const same = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { fail++; console.log('FAIL ' + name + '\n     got  ' + JSON.stringify(got) + '\n     want ' + JSON.stringify(want)); } };
const BAN = /\b(causes?|triggers?|safe|should|avoid|cut|too much|too little|deficient|target|suspect|cost|cause|déclench\w*|sécuritaire|devrais|devrait|éviter|évite|cible|carence|soupçonn\w*|trop peu)\b/i;
const st = (lang, p, extra) => Object.assign({ v: 1, lang, ack: true, ackAt: '2026-11-01T12:00:00.000Z', cv: 1, roll: 0, p: p || {}, list: [], amt: {}, imp: null, custom: [], ev: [], own: { phys: [], psy: [] }, concl: {}, tab: 'nut', nper: 'week', tmode: 'meal', twin: 4, tsel: [], tall: true, fxw: {}, seenThr: true, tview: 'all', bkAt: null }, extra || {});

(async () => {
  const srv = await serve(ROOT), browser = await chromium.launch();
  try { for (const lang of ['en', 'fr']) { const fr = lang === 'fr', T = `[${lang}] `;
    const open = async (state, shared) => { const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: fr ? 'fr-CA' : 'en-CA', serviceWorkers: 'block' }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(([k, v, sk, sv]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); if (sv) localStorage.setItem(sk, sv); sessionStorage.setItem('seeded', '1'); } }, [KEY, JSON.stringify(state), SHARE, shared ? JSON.stringify(shared) : null]);
      await page.goto(srv.url + '/threshold/app/'); await page.waitForSelector('#app'); await page.evaluate(() => { S.tab = 'nut'; render(); }); await page.waitForSelector('.nprof'); return { ctx, page, errors }; };
    const shared = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SHARE);
    const refOf = (page, k) => page.evaluate(k => { const i = TN.findIndex(r => r[0] === k); return document.querySelectorAll('#cov tbody tr')[i].querySelectorAll('td')[1].textContent; }, k);
    // 1. the line in the Threshold Log's own words, and the reference beside it
    let { ctx, page, errors } = await open(st(lang));
    same(T + 'the line above the table', (await page.locator('.nprof p').innerText()).replace(/\s+/g, ' '), fr ? 'Référence montrée pour : sexe non précisé · âge non précisé · poids non précisé' : 'Reference shown for: sex not given · age not given · weight not given');
    same(T + 'the wrench’s name', await page.locator('.nprof .wrench').getAttribute('aria-label'), fr ? 'Changer ce qui sert à établir la référence' : 'Change what the reference is worked out from');
    same(T + 'the reference as before: protein 56 g, iron 18 mg for the higher of the two', [await refOf(page, 'prot'), await refOf(page, 'fe')], ['56', '18']);
    // 2. the wrench: four questions, in words the app allows
    await page.click('.nprof .wrench'); await page.waitForSelector('#sheet.on [data-pw]');
    same(T + 'the sheet asks sex, age, weight and the list', await page.locator('#sheet fieldset.pw').count(), 4);
    same(T + 'the sheet’s title', await page.locator('#sheet h3').innerText(), fr ? 'Ce qui sert à établir la référence' : 'What the reference is worked out from');
    const words = await page.locator('#sheet').innerText(); same(T + 'no word the app doesn’t use', (words.match(BAN) || [null])[0], null);
    await page.click('#sheet [data-pw="sex"][data-v="f"]'); await page.click('#sheet [data-pw="wt"][data-v="90"]'); await page.click('#sheet [data-pw="life"][data-v="smoke"]');
    same(T + 'the button tapped keeps the focus', await page.evaluate(() => document.activeElement.dataset.v), 'smoke');
    await page.click('#sheet [data-act="close"]');
    same(T + 'the reference moves: protein by weight, vitamin C for a smoker', [await refOf(page, 'prot'), await refOf(page, 'c')], ['72', '110']);
    same(T + 'what was answered is shared', Object.fromEntries(Object.entries((await shared(page)).p).sort()), { life: ['smoke'], sex: 'f', wt: '90' });
    same(T + 'and kept after a reload', await page.evaluate(() => { location.reload(); return 1; }).then(() => page.waitForSelector('#app')).then(() => page.evaluate(() => [S.p.sex, S.p.wt, S.p.life])), ['f', '90', ['smoke']]);
    same(T + 'no script error', errors, []); await ctx.close();
    // 3. newer shared answers win, older don't; erasing removes them
    ({ ctx, page, errors } = await open(st(lang, { sex: 'f', age: 'a1' }, { pt: 1000 }), { v: 1, t: Date.now(), p: { sex: 'm', age: 'a3', work: 'heavy', life: ['drink', 'bf'] } }));
    same(T + 'the newer shared answers win, and what the app doesn’t ask is kept', await page.evaluate(() => [S.p.sex, S.p.age, S.p.work, S.p.life]), ['m', 'a3', 'heavy', ['drink', 'bf']]);
    same(T + 'breastfeeding for a man counts as no', await refOf(page, 'fe'), '8'); await ctx.close();
    ({ ctx, page, errors } = await open(st(lang, { sex: 'f' }, { pt: Date.now() }), { v: 1, t: 1000, p: { sex: 'm' } }));
    same(T + 'an older one doesn’t', await page.evaluate(() => S.p.sex), 'f');
    await page.evaluate(() => eraseAll()); same(T + 'erasing everything removes the shared answers', await shared(page), null);
    same(T + 'no script error', errors, []); await ctx.close(); }
    // 4. on one phone: answers set in The Patch reach the Threshold Log
    const ctx = await browser.newContext({ serviceWorkers: 'block' }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(([k, v]) => { if (!localStorage.getItem('seeded')) { localStorage.setItem(k, v); localStorage.setItem('thepatch.v1', JSON.stringify({ lang: 'en', ack: true, a: { safety: ['veg'] }, tank: { p: { sex: 'm', age: 'a2', wt: '70', work: 'sit', life: ['veg'] }, day: {} } })); localStorage.setItem('seeded', '1'); } }, [KEY, JSON.stringify(st('en'))]);
    await page.goto(srv.url + '/patch/app/'); await page.waitForSelector('#topbar'); await page.evaluate(() => save());
    await page.goto(srv.url + '/threshold/app/'); await page.waitForSelector('#app');
    same('[both] The Patch’s answers reach the Threshold Log', await page.evaluate(() => [S.p.sex, S.p.wt, myRef().fe, myRef().prot]), ['m', '70', 14, 56]);
    same('[both] no script error', errors, []); await ctx.close();
  } catch (e) { fail++; console.log('STOPPED: ' + (e.stack || e)); }
  await browser.close(); await srv.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `threshold nutrition: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
})();
