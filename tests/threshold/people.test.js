// Threshold Log: two made-up people use the app for six weeks, through the screen, one tap at a time, with the clock moved for them.
// A steady eater who came from the Food Trial Log (English, day starts at 4 a.m.) and a varied eater who starts here (French, the
// clocks go back in the middle). At the end every count on screen is checked against an independent recount of what they did.
//   node tests/threshold/people.test.js            (needs Playwright with Chromium)
//   node tests/threshold/people.test.js --save DIR  also writes each person's saved data to DIR, for making the pictures
'use strict';
process.env.TZ = 'America/Edmonton';           // the same zone the browser is given below, so both sides read a time the same way
const fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const { serve } = require('../lib/serve.js'), O = require('./oracle.js'), P = require('./people.js');
const ROOT = path.join(__dirname, '..', '..'), FIX = path.join(__dirname, '..', 'fixtures');
const saveDir = process.argv.includes('--save') ? process.argv[process.argv.indexOf('--save') + 1] : null;

let pass = 0, fail = 0; const fails = [];
function ok(name, cond, detail) { if (cond) pass++; else { fail++; fails.push(name + (detail ? '\n     ' + detail : '')); console.log('FAIL ' + name + (detail ? '\n     ' + detail : '')); } }
const same = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), 'got  ' + JSON.stringify(got) + '\n     want ' + JSON.stringify(want));
const two = n => (n < 10 ? '0' : '') + n, hm = t => { const d = new Date(t); return two(d.getHours()) + ':' + two(d.getMinutes()); };
const PHYS = ['infl', 'joint', 'gut', 'diar', 'loose', 'head', 'naus', 'sleep'];
const BARS = ['fat', 'cplx', 'sug', 'lact', 'fib', 'hist'];
// the coverage list: its order, and how many decimals each line shows
const TN = [['prot', 0], ['fib', 0], ['fe', 1], ['mg', 0], ['k', 0], ['b1', 2], ['b2', 1], ['b3', 0], ['b6', 1], ['b12', 1], ['fol', 0], ['zn', 1], ['se', 0], ['cu', 1], ['ca', 0], ['c', 0], ['e', 0], ['d', 0], ['va', 0], ['mn', 1], ['vk', 0]];

async function play(browser, base, person, table) {
  const fr = person.lang === 'fr', roll = person.roll, N = name => `[${person.name}] ${name}`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: fr ? 'fr-CA' : 'en-CA', timezoneId: 'America/Edmonton', reducedMotion: 'reduce' });
  const page = await ctx.newPage(), errors = [], outside = [];
  page.on('pageerror', e => errors.push('script error: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/sw\.js|service worker|404/i.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('request', r => { if (!r.url().startsWith(base)) outside.push(r.url()); });
  const num = s => { s = String(s).replace(/[\u00a0\u202f\s≈]/g, ''); s = fr ? s.replace(',', '.') : s.replace(/,/g, ''); return parseFloat(s); };
  const close = (name, shown, want, d) => ok(name, Math.abs(shown - want) <= 0.5 * Math.pow(10, -d) + 1e-9, `screen ${shown}, recount ${want}`);
  const setNow = async t => { await page.clock.setFixedTime(t); await page.evaluate(() => { const t = document.getElementById('toast'); t.classList.remove('show', 'live'); document.dispatchEvent(new Event('visibilitychange')); }); };   // the phone is picked up again
  const S = () => page.evaluate(() => JSON.parse(JSON.stringify(S)));
  const nameOf = ref => typeof ref === 'number' ? (fr ? table[ref].fr : table[ref].en) : ref;
  const labelKey = {}; const keyOf = ref => typeof ref === 'number' ? 'f' + ref : labelKey[ref];

  // ---- first open: the Food Trial Log is already in this browser (if the person used it), then the door ----
  await page.clock.setFixedTime(person.start);
  if (person.gut) { const g = JSON.parse(fs.readFileSync(path.join(FIX, person.gut), 'utf8')); await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [g.key, JSON.stringify(g.state)]); }
  await page.goto(base + '/threshold/app/'); await page.waitForSelector('[data-act=enter]');
  same(N('opens in the browser’s language'), await page.evaluate(() => document.documentElement.lang), fr ? 'fr-CA' : 'en-CA');
  same(N('nothing but the menu, the title and the language switch before the door'), await page.locator('#topbar [data-act=ai]').count(), 0);
  same(N('the door has the five statements'), await page.locator('.card.gate ol li').count(), 5);
  await page.click('[data-act=enter]');
  if (person.gut) { await page.click('[data-act=tab][data-v=nut]'); await page.click('[data-act=impread]'); await page.click('[data-act=impgo]'); await page.click('[data-act=tab][data-v=home]'); }
  for (const l of person.labels) { await page.click('[data-act=menu]'); await page.click('#sheet [data-act=label]');
    for (const [k, v] of [['n', l.n], ['s', l.s], ['kcal', l.kcal], ['fat', l.fat], ['carb', l.carb], ['fib', l.fib], ['sug', l.sug == null ? '' : l.sug], ['prot', l.prot]]) await page.fill(`#sheet [data-in=lb][data-k=${k}]`, fr ? String(v).replace('.', ',') : String(v));   // a French keyboard types a comma
    if (l.h) await page.click('#sheet [data-act=lbh]'); await page.click('#sheet [data-act=lbsave]'); }
  for (const c of (await S()).custom) labelKey[c.n] = 'L' + c.id;
  for (const ref of person.listAdd) { await page.click('[data-act=menu]'); await page.click('#sheet [data-act=list]'); await page.fill('#mQ', nameOf(ref)); await page.click(`#mRows [data-act=mq][data-k="${keyOf(ref)}"]`); await page.click('[data-act=mealdone]'); await page.click('[data-act=tab][data-v=home]'); }

  // ---- the six weeks ----
  async function pick(ref, q, via) {
    const key = keyOf(ref), plusSel = `#mRows [data-act=mq][data-k="${key}"][data-v="0.5"]`, minusSel = `#mRows [data-act=mq][data-k="${key}"][data-v="-0.5"]`; let shown = false;
    if (via !== 'search') { const tab = via === 'group' ? (typeof ref === 'number' ? table[ref].grp : 'label') : via, btn = page.locator(`#mTabs [data-act=mgrp][data-v="${tab}"]`);
      if (await btn.count()) { await btn.click(); shown = (await page.locator(plusSel).count()) > 0; } }
    if (!shown) { await page.fill('#mQ', nameOf(ref)); await page.waitForSelector(plusSel); }
    const val = () => page.evaluate(k => V.items[k] || 0, key);
    await page.click(plusSel); let cur = await val(), guard = 0;
    while (cur < q && guard++ < 40) { await page.click(plusSel); cur = await val(); }
    while (cur > q && guard++ < 40) { await page.click(minusSel); cur = await val(); }
    if (cur !== q) throw new Error(`could not set ${nameOf(ref)} to ${q} (got ${cur})`);
    if (!shown) await page.fill('#mQ', '');
  }
  async function logMeal(a) { const at = a.logAt || a.t, mealDay = O.dayOf(a.t, roll);
    await page.click('.mb.meal'); if (mealDay !== O.dayOf(at, roll)) await page.click(`[data-act=mday][data-v="${mealDay}"]`); if (a.logAt) await page.fill('#mAt', hm(a.t));
    for (const [ref, q] of a.items) await pick(ref, q, a.via); await page.click('[data-act=mealdone]'); }
  async function logFx(a) { await page.click('.mb.fx');
    for (const c of a.codes) { await page.click(`#sheet [data-act=fxtab][data-v=${PHYS.includes(c) ? 'phys' : 'psy'}]`); await page.click(`#sheet [data-act=fxk][data-v="${c}"]`); }
    for (const o of a.own || []) { await page.click(`#sheet [data-act=fxtab][data-v=${o.tab}]`); const chip = page.locator(`#sheet [data-act=fxk][data-v="o:${o.word}"]`);
      if (await chip.count()) await chip.click(); else { await page.fill('#fxOwn', o.word); await page.press('#fxOwn', 'Enter'); } }
    await page.click('#sheet [data-act=fxdone]'); }
  const idAt = (k, t) => page.evaluate(([k, t]) => { const e = S.ev.find(x => x.k === k && x.t === t); return e ? e.id : null; }, [k, t]);
  async function script(a) {
    if (a.do === 'addToMeal') { await page.click(`#app [data-act=entry][data-v="${await idAt('meal', a.target)}"]`); await page.click('#sheet [data-act=mealedit]'); await pick(a.item[0], a.item[1], 'search'); await page.click('[data-act=mealdone]'); }
    else if (a.do === 'effectUndoRemove') { await logFx({ codes: [a.code] }); const id = await idAt('fx', a.at);
      await page.click(`#app [data-act=entry][data-v="${id}"]`); await page.click('#sheet [data-act=del]'); same(N('an entry that is removed is gone'), await idAt('fx', a.at), null);
      await page.click('#toast [data-act=undo]'); same(N('and Undo brings it back'), await idAt('fx', a.at), id);
      await page.click(`#app [data-act=entry][data-v="${id}"]`); await page.click('#sheet [data-act=del]'); }
    else if (a.do === 'moveEffect') { await page.click(`#app [data-act=entry][data-v="${await idAt('fx', a.from)}"]`); await page.fill('#enAt', hm(a.to)); await page.click('#sheet [data-act=ensave]'); }
    else if (a.do === 'conclusions') { await page.click('[data-act=tab][data-v=thr]'); await page.click(`#bar-${a.bar} button.step`); await page.fill('#cIn', a.text); await page.click('#sheet [data-act=close]');
      ok(N('a conclusion shows under its bar once the sheet closes'), (await page.locator(`#bar-${a.bar}`).innerText()).includes(a.text));
      await page.fill('#tQ', nameOf(a.food)); await page.click(`#tqRows [data-act=foodrd][data-v="${keyOf(a.food)}"]`); await page.fill('#cIn', a.text); await page.click('#sheet [data-act=close]'); await page.click('[data-act=tab][data-v=home]'); }
    else if (a.do === 'removeMeal') { await page.click('[data-act=menu]'); await page.click('#sheet [data-act=hist]'); await page.click(`#app [data-act=entry][data-v="${await idAt('meal', a.target)}"]`); await page.click('#sheet [data-act=del]'); await page.click('#bar [data-act=back]'); }
    else if (a.do === 'closeOldest') { await page.click('[data-act=menu]'); await page.click('#sheet [data-act=hist]'); const open = page.locator('#app [data-act=none]'), n = await open.count();
      if (n) { same(N('the oldest open day in History is the one the recount expects'), await open.nth(n - 1).getAttribute('data-v'), a.day); await open.nth(n - 1).click(); } await page.click('#bar [data-act=back]'); }
  }
  const want = P.expected(person, table);          // worked out before the first tap: what the app should hold at the end
  let lastDay = null, done = 0;
  for (const a of person.plan) { const at = a.logAt || a.at || a.t; await setNow(at);
    if (a.k === 'meal') await logMeal(a); else if (a.k === 'fx') await logFx(a); else if (a.k === 'none') await page.click(a.from === 'today' ? '#app button.none[data-act=none]' : `#app p [data-act=none][data-v="${a.day}"]`); else await script(a);
    const d = O.dayOf(at, roll); if (d !== lastDay) { lastDay = d; if (errors.length) throw new Error(errors.join('\n')); } done++; }
  await setNow(person.now);

  // ---- what the app holds is what was done ----
  const st = await S();
  const flat = list => list.map(e => e.k === 'meal' ? 'meal ' + e.t + ' ' + e.items.map(i => (i.key || keyOf(i.ref)) + '*' + i.q).sort().join(',') : e.k === 'fx' ? 'fx ' + e.t + ' ' + e.c : 'none ' + e.d).sort();
  same(N(`every entry is saved as it was entered (${want.length} entries from ${done} actions)`), flat(st.ev), flat(want));
  same(N('nothing is saved twice'), new Set(st.ev.map(e => e.id)).size, st.ev.length);

  // ---- the recount ----
  const R = O.recount(want, roll, person.now), today = O.dayOf(person.now, roll);
  same(N('complete days'), await page.evaluate(() => TLE.reportedDays(IX())), R.complete);
  for (const mode of ['meal', 'day']) for (const b of BARS) {
    const c = R.cells(b, mode), B = await page.evaluate(([b, m]) => { const B = TLE.bar(IX(), b, m), cut = s => ({ n: s.n, k: s.k, fx: s.fx }); return { zero: cut(B.zero), steps: B.steps.map(cut), width: B.w, top: B.max, left: B.left, n: B.n }; }, [b, mode]);
    same(N(`${b}, ${mode}: every step's entries, entries with effects and effects by kind`), B, c);
  }
  // ...and the same numbers as they are drawn
  await page.click('[data-act=tab][data-v=thr]');
  for (const mode of ['meal', 'day']) { await page.click(`[data-act=tmode][data-v=${mode}]`);
    for (const b of BARS) { const c = R.cells(b, mode), labels = await page.locator(`#bar-${b} .stepsrow .step`).evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
      const read = l => { const m = /(\d+) [^\d,]+, [^\d]*?(\d+)$/.exec(l); return m ? [+m[1], +m[2]] : [0, 0]; }, cells = c.n ? [c.zero].concat(c.steps) : [];
      same(N(`${b}, ${mode}: the steps on screen`), c.n && c.steps.length ? labels.map(read) : labels.slice(0, 1).map(read), c.n && c.steps.length ? cells.map(s => [s.n, s.k]) : c.n ? [[c.zero.n, c.zero.k]] : [[0, 0]]);
      const drawn = await page.locator(`#bar-${b} .stepsrow .step`).evaluateAll(els => els.map(e => ({ none: e.classList.contains('none'), pale: e.classList.contains('pale'), mark: e.classList.contains('mk'), s: ['s0', 's1', 's2', 's3'].find(x => e.classList.contains(x)) || null })));
      const paint = s => ({ none: !s.n, pale: s.n > 0 && s.n < 5, mark: s.k > 0, s: !s.n ? null : s.k === 0 ? 's0' : s.k / s.n < 0.5 ? 's1' : s.k < s.n ? 's2' : 's3' });
      if (c.n && c.steps.length) same(N(`${b}, ${mode}: colour, pale and mark of every step`), drawn, cells.map(paint)); } }
  // one step's sheet, and the luck number, by brute force
  { const c = R.cells('lact', 'meal'), B = await page.evaluate(() => { const B = TLE.bar(IX(), 'lact', 'meal'); return { zero: B.zero, steps: B.steps }; }), all = [c.zero].concat(c.steps);
    let i = all.findIndex((s, j) => j > 0 && s.k > 0), code = i > 0 ? Object.keys(all[i].fx)[0] : null;
    if (code) { const s = all[i], y = s.fx[code], rest = all.filter((_, j) => j !== i), ry = rest.reduce((t, x) => t + (x.fx[code] || 0), 0), rn = rest.reduce((t, x) => t + x.n, 0);
      const p = await page.evaluate(([i, c]) => TLE.stepLuck(TLE.bar(IX(), 'lact', 'meal'), i, c), [i - 1, code]), q = O.luck(y, s.n - y, ry, rn - ry);
      ok(N('the luck number matches a brute-force count'), Math.abs(p - q) < 1e-9, `app ${p}, brute force ${q}`);
      await page.click('[data-act=tmode][data-v=meal]'); await page.click(`#bar-lact button.step[data-v="${i - 1}"]`); await page.click(`#sheet [data-act=stfx][data-v="${code}"]`);
      const line = await page.locator('#luckLine').innerText(); ok(N('the step sheet states both counts'), line.includes(String(y)) && line.includes(String(s.n)) && line.includes(String(ry)) && line.includes(String(rn)), line);
      ok(N('every reading says whose it is'), (await page.locator('#sheet').innerText()).includes(fr ? 'Ton propre relevé. Pas un conseil.' : 'Your own report. Not advice.')); await page.click('#sheet [data-act=close]'); } }

  // ---- Home: the ring, its key, the middle, and the Effects bar, over each period ----
  await page.click('[data-act=tab][data-v=home]');
  const SL = { fat: 'fat', prot: 'prot', cplx: 'complex', lact: 'lactose', sugo: 'otherSugars', fib: 'fibre', unk: 'carbsUnlisted', alc: 'alcohol' };
  for (const per of ['h4', 'today', 'week', 'month']) { await page.click(`[data-act=per][data-v=${per}]`); const w = R.period(per);
    same(N(`Home, ${per}: effects`), +(await page.locator('.fxbar b').innerText()), w.effects);
    const key = await page.locator('.key .keyrow').evaluateAll(els => els.map(e => [getComputedStyle(e.querySelector('.sw')).backgroundColor, e.querySelector('.am').textContent]));
    const colours = await page.evaluate(ks => { const o = {}; for (const k of ks) { const i = document.createElement('i'); i.style.background = `var(--s-${k})`; document.body.appendChild(i); o[getComputedStyle(i).backgroundColor] = k; i.remove(); } return o; }, Object.keys(SL));
    const wantKey = Object.keys(SL).filter(k => w.am[SL[k]] >= 0.05);
    same(N(`Home, ${per}: the slices in the key`), key.map(r => colours[r[0]]), wantKey);
    key.forEach((r, i) => { const v = w.am[SL[wantKey[i]]]; if (v !== undefined) close(N(`Home, ${per}: ${wantKey[i]} in grams`), num(r[1]), v, v < 10 ? 1 : 0); });
    const pcts = (await page.locator('.ring svg').getAttribute('aria-label')).match(/\d+(?=\s*%)/g) || []; if (wantKey.length) same(N(`Home, ${per}: the slices add up to 100`), pcts.reduce((t, x) => t + +x, 0), 100);
    const mid = await page.locator('.ring .mid b').innerText(); close(N(`Home, ${per}: histamine in the middle`), num(mid), w.am.hist, w.am.hist < 1 ? 2 : w.am.hist < 10 ? 1 : 0);
    const fill = await page.locator('.fxbar .trk i').evaluate(e => parseFloat(e.style.height)), top = R.busiest(per);
    same(N(`Home, ${per}: the Effects bar against the person's own highest (${top})`), fill, top ? Math.round(Math.min(1, w.effects / top) * 100) : 0); }
  await page.click('[data-act=per][data-v=today]');

  // ---- Nutrition: a day's amounts beside the reference ----
  await page.click('[data-act=tab][data-v=nut]');
  for (const per of ['today', 'week', 'month']) { await page.click(`[data-act=nper][data-v=${per}]`); const w = R.period(per), div = Math.max(1, w.mealDays);
    const rows = await page.locator('#cov tbody tr').evaluateAll(els => els.map(e => [...e.querySelectorAll('td')].map(td => td.textContent)));
    same(N(`Nutrition, ${per}: 21 lines`), rows.length, 21);
    TN.forEach(([k, d], i) => { const v = (k === 'prot' ? w.am.prot : k === 'fib' ? w.am.fibre : w.am.micro[O.MICRO.indexOf(k)]) / div; if (w.mealDays) close(N(`Nutrition, ${per}: ${k}`), num(rows[i][0]), v, d);
      same(N(`Nutrition, ${per}: ${k} is marked when a pill has no figure`), /\+/.test(rows[i][0]), !!(w.am.microNoFigure[k] > 0)); }); }
  ok(N('the reference line is there, word for word'), (await page.locator('#app').innerText()).includes(fr ? 'Santé Canada n’a aucun lien avec cette app.' : 'Health Canada has no connection with this app.'));

  // ---- one food ----
  const foods = person.name === 'steady' ? [1414, 1787, 920104, 'Bone broth'] : [109, 61, 4163, 2850, 'Kombucha'];
  const onList = st.list.length ? f => st.list.includes(f.label ? labelKey[f.en] : 'f' + f.id) : null;
  for (const ref of foods) { const key = keyOf(ref), isIt = typeof ref === 'number' ? f => f.id === ref : f => f.label && f.en === ref, w = R.oneFood(isIt, onList);
    const got = await page.evaluate(k => { const r = TLE.foodReading(IX(), k, S.list.length ? new Set(S.list) : null); return { times: r.times, clean: r.clean, rows: r.rows.map(x => ({ q: x.q, n: x.n, k: x.k, same: x.same, night: x.night, next: x.next, any: x.any })), without: r.without }; }, key);
    same(N(`one food, ${nameOf(ref)}: days, amounts and effects in each row`), got, w); }
  { await page.click('[data-act=tab][data-v=thr]'); const ref = foods[0], w = R.oneFood(f => f.id === ref, onList); await page.fill('#tQ', nameOf(ref)); await page.click(`#tqRows [data-act=foodrd][data-v="f${ref}"]`);
    const txt = await page.locator('#sheet').innerText(); ok(N('one food on screen: its day count'), txt.includes(fr ? `Noté ${w.times} journée` : `Reported on ${w.times} complete day`), txt.slice(0, 300));
    same(N('one food on screen: a row for each amount'), await page.locator('#sheet .rd > li').count(), w.rows.length);
    if (person.gut) ok(N('a food the Food Trial Log rejected says so at the top'), txt.includes('Rejected in the Food Trial Log'), txt.slice(0, 200));
    await page.click('#sheet [data-act=close]'); await page.fill('#tQ', ''); }

  // ---- the import ----
  if (person.gut) { const g = JSON.parse(fs.readFileSync(path.join(FIX, person.gut), 'utf8')).state;
    same(N('the day starts at the Food Trial Log’s hour'), st.roll, g.roll);
    ok(N('my list came from the Food Trial Log, plus the food she added'), st.list.length > 5 && st.list.includes(labelKey[person.listAdd[0]]), JSON.stringify(st.list));
    same(N('the Food Trial Log itself was not changed'), await page.evaluate(k => localStorage.getItem(k), 'v3k.gut.v1'), JSON.stringify(g)); }

  // ---- Ask AI ----
  await page.click('#topbar [data-act=ai]'); await page.click('#sheet [data-act=aiscope][data-v=all]');
  const ai = await page.locator('#sheet textarea').inputValue();
  ok(N('Ask AI opens with the one line'), ai.startsWith(fr ? 'Mon propre journal du Threshold Log. Pas un avis médical.' : 'My own log from Threshold Log. Not medical advice.'), ai.slice(0, 80));
  same(N('Ask AI: a line for every meal'), (ai.match(fr ? /^ {2}\d\d:\d\d repas\u00a0: /gm : /^ {2}\d\d:\d\d meal: /gm) || []).length, want.filter(e => e.k === 'meal').length);
  same(N('Ask AI: a line for every effect'), (ai.match(fr ? /^ {2}\d\d:\d\d effet\u00a0: /gm : /^ {2}\d\d:\d\d effect: /gm) || []).length, want.filter(e => e.k === 'fx').length);
  ok(N('Ask AI writes no question'), !/\?/.test(ai), (ai.match(/.*\?.*/) || [''])[0]);
  ok(N('Ask AI says where a paste goes'), (await page.locator('#sheet').innerText()).includes(fr ? 'il a quitté ton téléphone' : 'it has left your phone'));
  await page.click('#sheet [data-act=aiscope][data-v=month]'); const ai30 = await page.locator('#sheet textarea').inputValue(), from = O.dayPlus(today, -29);
  same(N('Ask AI, this month: only the last 30 days'), (ai30.match(/^\d{4}-\d\d-\d\d(?=,)/gm) || []).filter(d => d < from).length, 0); await page.click('#sheet [data-act=close]');

  // ---- History ----
  await page.click('[data-act=menu]'); await page.click('#sheet [data-act=hist]');
  let rows = await page.locator('#app ul.tl li').count(); while (await page.locator('[data-act=histmore]').count()) { await page.click('[data-act=histmore]'); rows = await page.locator('#app ul.tl li').count(); }
  same(N('History lists every entry'), rows, want.length); await page.click('#bar [data-act=back]');

  // ---- backup, erase, restore ----
  await page.click('[data-act=menu]'); await page.click('#sheet [data-act=backup]'); const backup = await page.locator('#sheet textarea').inputValue(); await page.click('#sheet [data-act=close]');
  await page.click('[data-act=menu]'); await page.click('#sheet [data-act=erase]'); await page.click('#sheet [data-act=erase]');
  same(N('erase: nothing left, and the door is back'), [(await S()).ev.length, await page.locator('[data-act=enter]').count()], [0, 1]);
  await page.click('[data-act=menu]'); await page.click('#sheet [data-act=restore]'); await page.fill('#restoreText', backup); await page.click('#sheet [data-act=usetext]'); await page.click('#sheet [data-act=dorestore]');
  const back = await S(); same(N('restore: every entry, list, label food and conclusion is back'), [flat(back.ev), back.list, back.custom, back.concl, back.imp, back.roll, back.ack], [flat(st.ev), st.list, st.custom, st.concl, st.imp, st.roll, true]);
  await page.click('[data-act=menu]'); await page.click('#sheet [data-act=restore]'); await page.fill('#restoreText', '{"app":"threshold-log","state":{"v":1,"ev":"oops"}}'); await page.click('#sheet [data-act=usetext]');
  same(N('a broken backup changes nothing'), flat((await S()).ev), flat(st.ev)); await page.click('#sheet [data-act=close]');
  await page.reload(); await page.waitForSelector('.mb.meal'); same(N('after a reload the data is still there'), flat((await S()).ev), flat(st.ev));

  same(N('no script error in six weeks'), errors, []); same(N('no request to another site in six weeks'), outside, []);
  if (saveDir) { fs.mkdirSync(saveDir, { recursive: true }); fs.writeFileSync(path.join(saveDir, person.name + '.json'), JSON.stringify({ key: 'v3k.threshold.v1', state: st, now: person.now, lang: person.lang, gut: person.gut })); }
  await ctx.close();
}

(async () => {
  const table = O.loadTable(), s = await serve(ROOT), browser = await chromium.launch();
  try { for (const person of [P.steady(), P.varied(table)]) { const t0 = Date.now(); await play(browser, s.url, person, table); console.log(`  ${person.name}: ${person.plan.length} actions played in ${Math.round((Date.now() - t0) / 1000)} s`); } }
  catch (e) { fail++; console.log('STOPPED: ' + (e.stack || e)); }
  await browser.close(); await s.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `people: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
})();
