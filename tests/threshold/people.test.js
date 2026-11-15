// Threshold Log: two made-up people use the app for six weeks, through the screen, one tap at a time, with the clock moved for them.
// A steady eater who came from the Food Trial Log (English, day starts at 4 a.m.) and a varied eater who starts here (French, day
// starts at midnight). At the end every count on screen is checked against an independent recount of what they did.
//   node tests/threshold/people.test.js            (needs Playwright with Chromium)
//   node tests/threshold/people.test.js --save DIR  also writes each person's saved data to DIR, for making the pictures
'use strict';
const { ZONE } = require('../lib/zone.js');     // one fixed-offset zone for Node and for the browser, so both read a clock time the same way
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: fr ? 'fr-CA' : 'en-CA', timezoneId: ZONE, reducedMotion: 'reduce' });
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
    else if (a.do === 'conclusions') { await page.click('[data-act=tab][data-v=thr]'); await page.click(`#app [data-act=rowsheet][data-k=${a.bar}]`); await page.fill('#cIn', a.text); await page.click('#sheet [data-act=close]');
      await page.click(`#app [data-act=rowsheet][data-k=${a.bar}]`); ok(N('a conclusion is on its line when the sheet opens again'), (await page.inputValue('#cIn')) === a.text); await page.click('#sheet [data-act=close]');
      await page.fill('#tQ', nameOf(a.food)); await page.click(`#tqRows [data-act=foodrd][data-v="${keyOf(a.food)}"]`); await page.fill('#cIn', a.text); await page.click('#sheet [data-act=close]'); await page.click('[data-act=tab][data-v=home]'); }
    else if (a.do === 'removeMeal') { await page.click('[data-act=menu]'); await page.click('#sheet [data-act=hist]'); await page.click(`#app [data-act=entry][data-v="${await idAt('meal', a.target)}"]`); await page.click('#sheet [data-act=del]'); await page.click('#bar [data-act=back]'); }
    else if (a.do === 'closeOldest') { await page.click('[data-act=menu]'); await page.click('#sheet [data-act=hist]');       // the oldest day before today that History offers to close
      const days = (await page.locator('#app [data-act=none]').evaluateAll(els => els.map(e => e.dataset.v))).filter(k => k < O.dayOf(a.at, roll)).sort(), oldest = days[0] || null;
      same(N('the oldest open day in History is the one the recount expects'), oldest, a.day); if (oldest) await page.click(`#app [data-act=none][data-v="${oldest}"]`); await page.click('#bar [data-act=back]'); }
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
  // ...and the same counts as the lists show them: for any effect, then for the effect reported most often
  await page.click('[data-act=tab][data-v=thr]');
  const KEYS = ['fat', 'cplx', 'sug', 'lact', 'fib', 'alc', 'caf', 'hist', 'tyr', 'ox', 'nit', 'ga', 'cap', 'fru', 'gos', 'sorb', 'mann', 'fruc', 'sulph', 'nitr', 'swt', 'glu', 'pur', 'theo'], BASE = KEYS.slice(0, 5);
  const PORTIONS = ['tyr', 'ox', 'ga', 'cap', 'fru', 'gos', 'sorb', 'mann', 'fruc', 'sulph', 'nitr', 'swt', 'glu', 'pur'];
  const tally = want.filter(e => e.k === 'fx').reduce((o, e) => (o[e.c] = (o[e.c] || 0) + 1, o), {}), ranked = Object.keys(tally).sort((x, y) => tally[y] - tally[x] || x.localeCompare(y)), most = ranked[0];
  const picks = [[]].concat(most ? [[most]] : [], ranked.length > 1 ? [ranked.slice(0, 2)] : []);      // any effect, the one reported most, and the two reported most together
  const dec = x => x < 1 ? 2 : x < 10 ? 1 : 0, near = (shown, real) => Math.abs(shown - real) <= 0.5 * Math.pow(10, -dec(real)) + 1e-9;
  // after a meal, the slider sets the hours that count: where it starts (4), then its two ends
  const slide = async h => { await page.focus('#tWin'); await page.keyboard.press('Home'); for (let i = 1; i < h; i++) await page.keyboard.press('ArrowRight'); };
  same(N('the slider starts at 4 hours'), [await page.inputValue('#tWin'), await page.evaluate(() => S.twin)], ['4', 4]);
  for (const [mode, hours] of [['meal', 4], ['meal', 1], ['meal', 8], ['day', 4]]) for (const pick of picks) { const all = pick.length > 1;
    await page.click(`[data-act=tmode][data-v=${mode}]`); if (mode === 'meal') await slide(hours);
    await page.click('.fxpick [data-act=tfx][data-v=""]'); for (const c of pick) await page.click(`.fxpick [data-act=tfx][data-v="${c}"]`);
    if (all) same(N(`${mode}: two effects picked are read together unless the person switches`), await page.locator('#allAny [data-v="1"]').getAttribute('aria-pressed'), 'true');
    const tag = `${mode}${mode === 'meal' ? ', ' + hours + ' h' : ''}, ${pick.length ? pick.join(' and ') : 'any effect'}`;
    if (mode === 'meal') { const f = R.sides('fat', mode, pick, all, hours), head = await page.locator('#thrHead').innerText();
      same(N(`${tag}: the setting is kept, and the slider shows it`), [await page.evaluate(() => S.twin), await page.inputValue('#tWin')], [hours, String(hours)]);
      same(N(`${tag}: the heading counts the meals with the effect in those hours, of all the meals counted`), (head.match(/\d+/g) || []).map(Number), (hours === 1 ? [] : [hours]).concat([f.hit.n, f.hit.n + f.rest.n]));
      ok(N(`${tag}: the hours are said in words beside the slider`), (await page.locator('.twin label').innerText()).includes(fr ? (hours === 1 ? 'l’heure suivante' : `les ${hours} heures suivantes`) : (hours === 1 ? 'the hour after it' : `the ${hours} hours after it`))); }
    else same(N(`${tag}: there is no slider over a day`), await page.locator('#tWin').count(), 0);
    const shown = await page.locator('#app table.rws:not(#fam-tog) tbody tr').evaluateAll(trs => trs.map(tr => [tr.querySelector('[data-act=rowsheet]').dataset.k, tr.cells[1].textContent, tr.cells[2].textContent]));
    const lines = KEYS.map(k => [k, R.sides(k, mode, pick, all, hours)]).filter(([k, s]) => BASE.includes(k) ? s.hit.n + s.rest.n > 0 : s.hit.ate + s.rest.ate > 0);      // a line with nothing counted is not shown
    same(N(`${tag}: the lines shown`), shown.map(r => r[0]).sort(), lines.map(r => r[0]).sort());
    for (const [k, s] of lines) { const row = shown.find(r => r[0] === k); if (!row) continue;
      [[row[1], s.hit], [row[2], s.rest]].forEach(([txt, side], j) => { const nums = (txt.match(/\d[\d.,  ]*\d|\d/g) || []).map(num), name = N(`${tag}: ${k}, ${j ? 'without' : 'with'}`);
        if (!side.n) same(name, txt.trim(), '–');
        else if (PORTIONS.includes(k)) same(name, nums, [side.ate, side.n]);                                  // how many held any, of how many
        else ok(name, nums.length > 0 && near(nums[0], side.lo) && near(nums[nums.length - 1], side.hi), `screen "${txt}", recount ${side.lo} to ${side.hi}`); }); }   // the lowest and the highest, never an average
    const G = R.together(mode, pick, all, hours), cell = (x, n) => n ? [x, n] : [], tog = await page.locator('#fam-tog tbody tr').evaluateAll(trs => trs.map(tr => [tr.cells[1].textContent, tr.cells[2].textContent].map(t => (t.match(/\d+/g) || []).map(Number))));
    same(N(`${tag}: eaten together`), tog, G.three.hit + G.three.rest + G.both.hit + G.both.rest > 0 ? [[cell(G.three.hit, G.nHit), cell(G.three.rest, G.nRest)], [cell(G.both.hit, G.nHit), cell(G.both.rest, G.nRest)]] : []);
    // one line, opened: every amount, with how many sat on each side
    for (const k of ['lact', 'glu']) { if (!shown.find(r => r[0] === k)) continue; const c = R.cells(k, mode, pick, all, hours), amounts = [c.zero].concat(c.steps).filter(x => x.n > 0);
      await page.click(`#app [data-act=rowsheet][data-k=${k}]`); const got = await page.locator('#rowSteps tbody tr').evaluateAll(trs => trs.map(tr => [+tr.cells[1].textContent, +tr.cells[2].textContent]));
      same(N(`${tag}: ${k}, every amount with and without`), got, amounts.map(x => [x.k, x.n - x.k])); await page.click('#sheet [data-act=close]'); } }
  // ---- an opened line: every amount pressed states its counts on both sides, and no number is put on luck ----
  const LUCKY = /luck alone|hasard seul|times? in \d|fois sur \d|1 in \d/i;
  const note = mode => fr ? (mode === 'meal' ? 'Plus de place pour le hasard : peu d’entrées, plusieurs choses mangées ensemble, des repas plus rapprochés que les heures réglées. Moins de place : plus d’entrées, une seule chose changée à la fois, des repas plus espacés que les heures réglées.' : 'Plus de place pour le hasard : peu de jours, plusieurs choses mangées le même jour. Moins de place : plus de jours, une seule chose changée à la fois.')
    : (mode === 'meal' ? 'More room for luck: few entries, several things eaten together, meals closer together than the hours set. Less room: more entries, one thing changed at a time, meals further apart than the hours set.' : 'More room for luck: few days, several things eaten on the same day. Less room: more days, one thing changed at a time.');
  const flatten = t => t.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [mode, hours, pick] of [['meal', 4, []], ['meal', 8, most ? [most] : []], ['meal', 2, ranked.slice(0, 2)], ['day', 4, most ? [most] : []], ['day', 4, []]]) { const all = pick.length > 1, tag = `${mode}${mode === 'meal' ? ', ' + hours + ' h' : ''}, ${pick.length ? pick.join(' and ') : 'any effect'}`;
    await page.click(`[data-act=tmode][data-v=${mode}]`); if (mode === 'meal') await slide(hours); await page.click('.fxpick [data-act=tfx][data-v=""]'); for (const c of pick) await page.click(`.fxpick [data-act=tfx][data-v="${c}"]`);
    let pressed = 0;
    for (const k of ['fat', 'lact']) { if (!(await page.locator(`#app [data-act=rowsheet][data-k=${k}]`).count())) continue; const c = R.cells(k, mode, pick, all, hours), cellsAll = [c.zero].concat(c.steps), K = cellsAll.reduce((t, y) => t + y.k, 0), M = cellsAll.reduce((t, y) => t + y.n, 0);
      await page.click(`#app [data-act=rowsheet][data-k=${k}]`);
      same(N(`${tag}: ${k}: under the amounts, the same words about luck for everyone, both halves`), flatten(await page.locator('#luckNote').innerText()), note(mode));
      for (let i = 0; i < cellsAll.length; i++) { const x = cellsAll[i]; if (!x.n) continue;
        await page.click(`#sheet [data-act=rstep][data-v="${i - 1}"]`); const line = flatten(await page.locator('#stepLine').innerText()); pressed++;
        ok(N(`${tag}: ${k}, amount ${i}: states its counts on both sides`), line.endsWith(fr ? `${x.k} des ${K} avec, ${x.n - x.k} des ${M - K} sans.` : `${x.k} of the ${K} with, ${x.n - x.k} of the ${M - K} without.`), line);
        ok(N(`${tag}: ${k}, amount ${i}: the sheet puts no number on luck`), !LUCKY.test(flatten(await page.locator('#sheet').innerText())), flatten(await page.locator('#sheet').innerText()).match(LUCKY)); }
      ok(N(`${tag}: ${k}: every reading says whose it is`), (await page.locator('#sheet').innerText()).includes(fr ? 'Ton propre relevé. Pas un conseil.' : 'Your own report. Not advice.'));
      await page.click('#sheet [data-act=close]'); }
    ok(N(`${tag}: amounts were pressed`), pressed >= 2, pressed); }
  await page.click('[data-act=tmode][data-v=meal]'); await slide(4); await page.click('.fxpick [data-act=tfx][data-v=""]');
  same(N('the app holds nothing that works out a luck number'), await page.evaluate(() => ['luck', 'stepLuck', 'foodLuck', 'dealt', 'across'].filter(k => k in TLE).concat(['luckTxt', 'luckOne', 'dealtOf'].filter(k => typeof window[k] === 'function'))), []);

  // ---- Home: the ring, its key, the middle, and the Effects bar, over each period ----
  await page.click('[data-act=tab][data-v=home]');
  const SL = { fat: 'fat', prot: 'prot', cplx: 'complex', lact: 'lactose', sugo: 'otherSugars', fib: 'fibre', unk: 'carbsUnlisted' };
  const OTHERS = ['tyr', 'ox', 'nit', 'ga', 'cap', 'fru', 'gos', 'sorb', 'mann', 'fruc', 'sulph', 'nitr', 'swt', 'glu', 'pur', 'theo'];
  for (const per of ['h4', 'today', 'week', 'month']) { await page.click(`[data-act=per][data-v=${per}]`); const w = R.period(per);
    same(N(`Home, ${per}: effects`), +(await page.locator('.fxbar b').innerText()), w.effects);
    const key = await page.locator('#app .card ul.key').first().locator('.keyrow').evaluateAll(els => els.map(e => [getComputedStyle(e.querySelector('.sw')).backgroundColor, e.querySelector('.am').textContent]));
    const colours = await page.evaluate(ks => { const o = {}; for (const k of ks) { const i = document.createElement('i'); i.style.background = `var(--s-${k})`; document.body.appendChild(i); o[getComputedStyle(i).backgroundColor] = k; i.remove(); } return o; }, Object.keys(SL));
    const wantKey = Object.keys(SL).filter(k => w.am[SL[k]] >= 0.05);
    same(N(`Home, ${per}: the slices in the key`), key.map(r => colours[r[0]]), wantKey);
    key.forEach((r, i) => { const v = w.am[SL[wantKey[i]]]; if (v !== undefined) close(N(`Home, ${per}: ${wantKey[i]} in grams`), num(r[1]), v, v < 10 ? 1 : 0); });
    const pcts = (await page.locator('.ring svg').getAttribute('aria-label')).match(/\d+(?=\s*%)/g) || []; if (wantKey.length) same(N(`Home, ${per}: the slices add up to 100`), pcts.reduce((t, x) => t + +x, 0), 100);
    const grams = Object.values(SL).reduce((t, k) => t + w.am[k], 0), mid = await page.locator('.ring .mid b').innerText(); close(N(`Home, ${per}: the grams in the middle`), num(mid), grams, 0);
    if (grams >= 0.05) { close(N(`Home, ${per}: alcohol`), num(await page.locator('#app [data-act=comp][data-v=alc] .am').innerText()), w.am.alcohol, w.am.alcohol < 1 ? 2 : w.am.alcohol < 10 ? 1 : 0);
      const caf = w.am.also.caf || 0; close(N(`Home, ${per}: caffeine`), num(await page.locator('#app [data-act=comp][data-v=caf] .am').innerText()), caf, caf < 1 ? 2 : caf < 10 ? 1 : 0);
      same(N(`Home, ${per}: how many other compounds`), parseInt(await page.locator('#app .cmore .muted').innerText(), 10), OTHERS.filter(k => (w.am.also[k] || 0) > 0.005).length + (w.am.histPortions > 0 ? 1 : 0)); }
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
    const got = await page.evaluate(k => { const r = TLE.foodReading(IX(), k, S.list.length ? new Set(S.list) : null); return { times: r.times, clean: r.clean, rows: r.rows.map(x => ({ q: x.q, n: x.n, k: x.k, same: x.same, night: x.night, next: x.next, any: x.any })), without: r.without, waiting: r.wait }; }, key);
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
