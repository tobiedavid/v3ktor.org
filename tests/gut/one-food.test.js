// Food Trial Log: in step 2, a bad day takes ONE food off the list, the newest one, however many times the screen is drawn again;
// undoing the report puts the food back, and so does changing the report to a formed stool. English and French.
//   node tests/gut/one-food.test.js      (needs Playwright with Chromium)
'use strict';
process.env.TZ = 'America/Edmonton';
const fs = require('fs'), path = require('path'), { chromium } = require('playwright'), { serve } = require('../lib/serve.js');
const ROOT = path.join(__dirname, '..', '..'), FIX = path.join(__dirname, '..', 'fixtures');
let pass = 0, fail = 0; const same = (name, got, want) => { if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { fail++; console.log('FAIL ' + name + '\n     got  ' + JSON.stringify(got) + '\n     want ' + JSON.stringify(want)); } };

(async () => {
  const srv = await serve(ROOT), browser = await chromium.launch();
  try { for (const [lang, url, file] of [['en', '/gut/app/', 'gut-day-9.json'], ['fr', '/gut/fr/app/', 'gut-fr-day-9.json']]) {
    const fx = JSON.parse(fs.readFileSync(path.join(FIX, file), 'utf8')), T = `[${lang}] `;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang === 'fr' ? 'fr-CA' : 'en-CA', timezoneId: 'America/Edmonton', reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 29, 8, 0)); await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [fx.key, JSON.stringify(fx.state)]);
    await page.goto(srv.url + url); await page.waitForSelector('#topbar');
    const info = () => page.evaluate(() => ({ falls: S.cuts.filter(c => c.why === 'fall').map(c => c.key + '@' + c.d), list: baseNow(), stage: D.fi && D.fi.stage }));
    const tap = async sel => { await page.locator(sel + ':visible').first().click(); };
    const watery = async () => { await tap('[data-act="stool"]:not([data-day])'); await tap('[data-act="sh"][data-v="4"]'); await tap('[data-act="stdone"]'); };
    const start = await info(); same(T + 'starts in step 2 with nothing taken off for a bad day', [start.stage, start.falls], [2, []]);
    await tap('[data-act="s2add"]'); const added = await info(), newest = added.list.find(k => !start.list.includes(k)); same(T + 'one food is added today', added.list.length, start.list.length + 1);
    await page.clock.setFixedTime(new Date(2026, 9, 29, 18, 45)); await watery(); const bad = await info();
    same(T + 'a watery stool takes one food off: the newest', bad.falls, [newest + '@2026-10-29']); same(T + 'and the list is the one from before today', bad.list, start.list);
    for (let i = 0; i < 3; i++) await page.evaluate(() => render()); same(T + 'drawing the screen again takes nothing more off', (await info()).falls, [newest + '@2026-10-29']);
    await page.reload(); await page.waitForSelector('#topbar'); same(T + 'nor does opening the app again', (await info()).falls, [newest + '@2026-10-29']);
    await page.evaluate(() => { const e = S.ev.filter(x => x.k === 'st').pop(); S.ev = S.ev.filter(x => x !== e); save(); render(); }); const undone = await info();
    same(T + 'with the report gone, the food is back on the list', [undone.falls, undone.list.slice().sort()], [[], added.list.slice().sort()]);
    await watery(); same(T + 'reported again: one food off again', (await info()).falls, [newest + '@2026-10-29']);
    await page.evaluate(() => { const e = S.ev.filter(x => x.k === 'st').pop(); e.sh = 1; save(); render(); }); same(T + 'changed to a formed stool: the food is back', (await info()).falls, []);
    same(T + 'no script error', errors, []); await ctx.close(); } }
  catch (e) { fail++; console.log('STOPPED: ' + (e.stack || e)); }
  await browser.close(); await srv.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `gut one food: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
})();
