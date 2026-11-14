// Threshold Log: the import from the Food Trial Log. The Food Trial Log's own page is opened with a saved example, and its own
// list ("what I eat now") and its own "foods that upset you" list are read from it; the import must give the same foods.
// Then the import is done through the screen: from the same browser, from a backup file, with both language copies present,
// with an old save that still carries retired food numbers, and with files that are not a Food Trial Log save.
//   node tests/threshold/import.test.js      (needs Playwright with Chromium)
'use strict';
const { ZONE } = require('../lib/zone.js');
const fs = require('fs'), path = require('path'), { chromium } = require('playwright'), { serve } = require('../lib/serve.js'), { engine } = require('./state.js');
const ROOT = path.join(__dirname, '..', '..'), FIX = path.join(__dirname, '..', 'fixtures'), E = engine();
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (detail ? '\n     ' + String(detail).slice(0, 500) : '')); } }
const same = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), 'got  ' + JSON.stringify(got) + '\n     want ' + JSON.stringify(want));
const fixture = f => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'));
const lastTime = s => s.ev.reduce((m, e) => Math.max(m, +e.t || 0), 0);

(async () => {
  const srv = await serve(ROOT), base = srv.url, browser = await chromium.launch();
  const fresh = async (store, now) => { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-CA', timezoneId: ZONE, reducedMotion: 'reduce', serviceWorkers: 'block' }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); if (now) await page.clock.setFixedTime(now);
    await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { for (const k of Object.keys(s)) localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded', '1'); } }, store || {}); return { ctx, page, errors }; };
  const enter = async page => { await page.goto(base + '/threshold/app/'); await page.waitForSelector('[data-act=enter]'); await page.click('[data-act=enter]'); await page.click('[data-act=tab][data-v=nut]'); };
  const TL = page => page.evaluate(() => JSON.parse(JSON.stringify({ list: S.list, amt: S.amt, imp: S.imp, roll: S.roll, p: S.p })));
  try {
    // ---- the import against the Food Trial Log's own lists, on five saved examples ----
    for (const [file, url] of [['gut-day-9.json', '/gut/app/'], ['gut-day-10.json', '/gut/app/'], ['gut-3-weeks.json', '/gut/app/'], ['gut-after-two-trials.json', '/gut/app/'], ['gut-fr-day-9.json', '/gut/fr/app/']]) {
      const fx = fixture(file), A = await fresh({ [fx.key]: JSON.stringify(fx.state) }, lastTime(fx.state) + 3600e3), page = A.page;
      await page.goto(base + url); await page.waitForSelector('#topbar');
      const own = await page.evaluate(k => ({ list: baseNow(), upset: sitList().map(r => ({ key: r.key, d: r.d })), amt: S.amt || {}, roll: S.roll || 0, saved: localStorage.getItem(k) }), fx.key);
      const r = E.importGut(JSON.parse(own.saved)), both = r.out.concat(r.aside);
      same(`[${file}] my list is the Food Trial Log’s list, in its order`, r.list.map(x => x.key), own.list);
      same(`[${file}] with its usual amounts`, r.list.map(x => x.q), own.list.map(k => own.amt[k] || 1));
      same(`[${file}] rejected and set aside, together, are its “foods that upset you”`, both.map(x => x.key).sort(), own.upset.map(x => x.key).sort());
      same(`[${file}] with the same dates`, both.map(x => x.key + ' ' + x.d).sort(), own.upset.map(x => x.key + ' ' + x.d).sort());
      ok(`[${file}] no food is on two lists`, new Set(r.list.map(x => x.key).concat(both.map(x => x.key))).size === r.list.length + both.length);
      // through the screen, in the same browser
      await enter(page); await page.click('[data-act=impread]'); await page.click('#sheet [data-act=impgo]'); const t = await TL(page);
      same(`[${file}] on screen: my list`, t.list, own.list); same(`[${file}] on screen: rejected`, t.imp.out.map(x => x.key), r.out.map(x => x.key)); same(`[${file}] on screen: the day starts at its hour`, t.roll, own.roll);
      same(`[${file}] the Food Trial Log’s saved data is untouched`, await page.evaluate(k => localStorage.getItem(k), fx.key), own.saved);
      same(`[${file}] the rejected foods are listed on the Nutrition tab`, await page.locator('#app ul.evs [data-act=foodrd]').count(), r.out.length);
      same(`[${file}] no script error`, A.errors, []); await A.ctx.close(); }

    // ---- both language copies in the browser: the one used last is read ----
    { const en = fixture('gut-after-two-trials.json'), fr = fixture('gut-fr-day-9.json'), A = await fresh({ [en.key]: JSON.stringify(en.state), [fr.key]: JSON.stringify(fr.state) }), page = A.page;
      await enter(page); await page.click('[data-act=impread]'); await page.click('#sheet [data-act=impgo]');
      same('[two copies] the copy with the latest entry is the one brought in', (await TL(page)).list, E.importGut(lastTime(en.state) > lastTime(fr.state) ? en.state : fr.state).list.map(x => x.key)); await A.ctx.close(); }

    // ---- from a backup file, the way an installed iPhone app has to do it ----
    { const fx = fixture('gut-3-weeks.json'), A = await fresh({}), page = A.page, file = body => ({ name: 'food-trial-log-backup-2026-11-09.json', mimeType: 'application/json', buffer: Buffer.from(body) });
      await enter(page); same('[file] with no Food Trial Log in the browser, only the file is offered', [await page.locator('[data-act=impread]').count(), await page.locator('[data-act=impfile]').count()], [0, 1]);
      await page.setInputFiles('#impFile', file(JSON.stringify({ app: 'food-trial-log', ver: '1.4.9', saved: '2026-11-09T18:00:00.000Z', state: fx.state }))); await page.waitForSelector('#sheet.on [data-act=impgo]'); await page.click('#sheet [data-act=impgo]');
      const t = await TL(page), r = E.importGut(fx.state); same('[file] the backup file gives the same list', t.list, r.list.map(x => x.key)); same('[file] and says where it came from', [t.imp.from, t.imp.saved], ['file', '2026-11-09T18:00:00.000Z']);
      // a second import replaces the list, after saying so
      const other = fixture('gut-day-9.json'); await page.setInputFiles('#impFile', file(JSON.stringify({ app: 'food-trial-log', state: other.state }))); await page.waitForSelector('#sheet.on [data-act=impgo]');
      ok('[file] a second import says it replaces the list', (await page.locator('#sheet').innerText()).includes('This replaces the ' + t.list.length + ' foods on your list now')); await page.click('#sheet [data-act=impgo]'); same('[file] and does', (await TL(page)).list, E.importGut(other.state).list.map(x => x.key));
      // files that are not a Food Trial Log save
      for (const [name, body, says] of [['text that is not a save', 'hello', 'isn’t a Food Trial Log save'], ['some other JSON', '{"a":1}', 'isn’t a Food Trial Log save'], ['a Threshold Log backup', '{"app":"threshold-log","state":{"v":1,"ev":[]}}', 'That is a Threshold Log backup']]) {
        const before = await TL(page); await page.setInputFiles('#impFile', file(body)); await page.waitForFunction(s => document.getElementById('toast').innerText.includes(s), says); same('[file] ' + name + ' changes nothing', await TL(page), before); }
      // a save from the route that only logs: no list to bring
      await page.setInputFiles('#impFile', file(JSON.stringify({ app: 'food-trial-log', state: { v: 4, route: 'log', ev: [], p: {} } }))); await page.waitForSelector('#sheet.on'); ok('[file] a save with no food list says so', (await page.locator('#sheet').innerText()).includes('Nothing to bring yet')); await page.click('#sheet [data-act=close]');
      // an old save that still carries food numbers the Food Trial Log retired in its version 1.2.0
      const old = { v: 4, route: 'fast', roll: 0, p: {}, ev: [], fast: { start: '2026-01-01' }, base0: ['f842', 'f4523', 'f133'], amt: { f842: 1 }, adds: [], cuts: [{ key: 'f501869', d: '2026-01-05', at: 5, why: 'fall' }, { key: 'f3183', d: '2026-01-06', at: 6, why: 'fall' }], tests: [] };
      await page.setInputFiles('#impFile', file(JSON.stringify({ app: 'food-trial-log', state: old }))); await page.waitForSelector('#sheet.on [data-act=impgo]'); await page.click('#sheet [data-act=impgo]'); const o = await TL(page);
      same('[old save] retired foods come in as the foods that replaced them, with the amount carried over', [o.list, o.amt.f920001, o.amt.f130], [['f920001', 'f4523', 'f130'], 2, 2]);
      same('[old save] a retired food that was rejected, and whose replacement is on the list, is not listed twice', o.imp.out.map(x => x.key), ['f920004']);
      ok('[old save] every food on the lists has a name', (await page.locator('#app').innerText()).indexOf('no longer listed') < 0);
      same('[file] no script error', A.errors, []); await A.ctx.close(); }
  } catch (e) { fail++; console.log('STOPPED: ' + (e.stack || e)); }
  await browser.close(); await srv.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `import: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
})();
