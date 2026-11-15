// An independent recount for the Threshold Log tests.
// It shares no code with the app: it reads the food table out of the shipped file and counts in its own way,
// from the list of things a made-up person did. If the app and this file agree, the app's counts are the entries' counts.
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'threshold', 'app', 'index.html');

function loadTable(file) {
  const html = fs.readFileSync(file || APP, 'utf8'), a = html.indexOf('const DATA=['), b = html.indexOf('/* DATA:END */');
  if (a < 0 || b < 0) throw new Error('DATA markers not found');
  const rows = JSON.parse(html.slice(a + 'const DATA='.length, html.lastIndexOf(']', b) + 1)), byId = {};
  for (const r of rows) byId[r[0]] = { id: r[0], en: r[1], fr: r[2], servEn: r[3], servFr: r[4], grp: r[5], tags: r[6] ? r[6].split(' ') : [], grams: r[7], kcal: r[8], prot: r[9], fat: r[10], carb: r[11],
    sugars: r[12] < 0 ? null : r[12], fibre: r[13], lactose: r[14], alcohol: r[15], histFood: r[16] !== -2, hist: r[16] >= 0 ? r[16] : null, micro: r[17], noFigure: r[18] ? r[18].split(' ') : [], carries: r[19] || {} };
  return byId;
}
const MICRO = ['ca', 'fe', 'mg', 'k', 'zn', 'c', 'b1', 'b2', 'b3', 'b6', 'fol', 'b12', 'd', 'vk', 'va', 'mn', 'cu', 'e', 'se'];
const HOUR = 3600e3;
const two = n => (n < 10 ? '0' : '') + n;
const ymd = d => d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
// a day starts at the person's own hour on the wall clock
function dayOf(t, roll) { const d = new Date(t); return ymd(d.getHours() < (roll || 0) ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1) : d); }
function dayPlus(k, n) { const [y, m, d] = k.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); }
function dayBegins(k, roll) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, roll || 0).getTime(); }

// what a number of portions of one food holds. A person's own label foods are passed in the same shape as the table's.
function holds(f, q) {
  const o = { kcal: 0, fat: 0, prot: 0, complex: 0, sugars: 0, lactose: 0, otherSugars: 0, fibre: 0, carbsUnlisted: 0, alcohol: 0, hist: 0, histPortions: 0, histNoFigure: 0, noNumbers: 0, fibreNoFigure: 0, micro: MICRO.map(() => 0), microNoFigure: {}, also: {} };
  if (!f || f.noNumbers) { o.noNumbers = q; return o; }
  const carbLessFibre = Math.max(0, f.carb - f.fibre);
  if (f.sugars === null) { const lac = Math.min(f.lactose || 0, carbLessFibre); o.lactose = lac * q; o.carbsUnlisted = (carbLessFibre - lac) * q; }
  else { const sug = Math.min(f.sugars, carbLessFibre), lac = Math.min(f.lactose || 0, sug); o.sugars = sug * q; o.lactose = lac * q; o.otherSugars = (sug - lac) * q; o.complex = (carbLessFibre - sug) * q; }
  o.kcal = f.kcal * q; o.fat = f.fat * q; o.prot = f.prot * q; o.fibre = f.fibre * q; o.alcohol = (f.alcohol || 0) * q;
  if (f.histFood) { o.histPortions = q; if (f.hist === null || f.hist === undefined) o.histNoFigure = q; else o.hist = f.hist * q; }
  if (f.micro) o.micro = f.micro.map(v => v * q);
  for (const k of Object.keys(f.carries || {})) o.also[k] = f.carries[k] * q;      // caffeine, theobromine and nitrate in mg; the rest in portions
  for (const k of f.noFigure || []) { if (k === 'fib') o.fibreNoFigure = q; else o.microNoFigure[k] = q; }
  return o;
}
function plus(a, b) { for (const k of Object.keys(b)) { if (k === 'also') { for (const j of Object.keys(b.also)) a.also[j] = (a.also[j] || 0) + b.also[j]; } else if (k === 'micro') a.micro = a.micro.map((v, i) => v + b.micro[i]); else if (k === 'microNoFigure') { for (const j of Object.keys(b.microNoFigure)) a.microNoFigure[j] = (a.microNoFigure[j] || 0) + b.microNoFigure[j]; } else a[k] += b[k]; } return a; }
const nothing = () => holds({ kcal: 0, fat: 0, prot: 0, carb: 0, sugars: 0, fibre: 0, lactose: 0 }, 0);

const BARS = { fat: 'fat', cplx: 'complex', sug: 'sugars', lact: 'lactose', fib: 'fibre', hist: 'hist', alc: 'alcohol', histN: 'histPortions' };   // anything else is read from what the food carries
function canRead(am, bar) {
  if (am.noNumbers > 0) return false;
  if ((bar === 'cplx' || bar === 'sug') && am.carbsUnlisted > 2) return false;
  if (bar === 'hist' && am.histNoFigure > 0) return false;
  if (bar === 'fib' && am.fibreNoFigure > 0) return false;
  if (bar === 'caf' && am.microNoFigure.caf > 0) return false;
  return true;
}

// entries: [{k:'meal', t, items:[{food, q}]}, {k:'fx', t, c}, {k:'none', d}]   (food = a record in the shape above)
function recount(entries, roll, now) {
  const days = {}, day = k => days[k] || (days[k] = { k, meals: [], fx: [], said: [], none: false, total: nothing() });
  for (const e of entries.slice().sort((a, b) => a.t - b.t)) {
    if (e.k === 'meal') { const am = nothing(); for (const it of e.items) plus(am, holds(it.food, it.q)); const d = day(dayOf(e.t, roll)); d.meals.push({ t: e.t, items: e.items, am }); plus(d.total, am); }
    else if (e.k === 'fx') { const said = dayOf(e.t, roll); day(e.c === 'sleep' ? dayPlus(said, -1) : said).fx.push(e); day(said).said.push(e); }   // poor sleep belongs to the night before
    else if (e.k === 'none') day(e.d).none = true;
  }
  const keys = Object.keys(days).sort();
  for (const k of keys) days[k].complete = days[k].meals.length > 0 && (days[k].fx.length > 0 || days[k].none);
  const allFx = entries.filter(e => e.k === 'fx');

  // pick: the effects that count. Empty means any effect.
  function units(bar, mode, pick) {
    const out = [], field = BARS[bar], amt = am => field ? am[field] : (am.also[bar] || 0), keep = fx => pick && pick.length ? fx.filter(c => pick.includes(c)) : fx; let left = 0;
    for (const k of keys) { const d = days[k]; if (!d.complete) continue;
      if (mode === 'meal') { for (const m of d.meals) { if (!canRead(m.am, bar)) { left++; continue; }
          const fx = keep(allFx.filter(e => e.c !== 'sleep' && e.t >= m.t && e.t <= m.t + 4 * HOUR).map(e => e.c));
          if (m.t + 4 * HOUR > now && !fx.length) continue;      // its 4 hours are not over and nothing is reported after it yet: its side is not settled
          out.push({ x: amt(m.am), alc: m.am.alcohol, fx }); } }
      else { if (dayBegins(dayPlus(k, 1), roll) > now) continue; if (!canRead(d.total, bar)) { left++; continue; }
        const next = days[dayPlus(k, 1)]; out.push({ x: amt(d.total), alc: d.total.alcohol, fx: keep(d.fx.map(e => e.c).concat(next ? next.fx.filter(e => e.c !== 'sleep').map(e => e.c) : [])), day: k }); } }
    return { list: out, left };
  }
  function cells(bar, mode, pick) {
    const u = units(bar, mode, pick), tally = () => ({ n: 0, k: 0, fx: {} }), add = (c, x) => { c.n++; if (x.fx.length) { c.k++; for (const f of new Set(x.fx)) c.fx[f] = (c.fx[f] || 0) + 1; } };
    const zero = tally(), some = u.list.filter(x => x.x > 0.005); for (const x of u.list) if (!(x.x > 0.005)) add(zero, x);
    if (!some.length) return { zero, steps: [], width: 0, top: 0, left: u.left, n: u.list.length };
    const max = Math.max(...some.map(x => x.x)), nice = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const width = nice.find(w => w * 8 >= max - 1e-9) || Math.ceil(max / 8), count = Math.max(1, Math.min(8, Math.ceil(max / width - 1e-9))), steps = Array.from({ length: count }, tally);
    for (const x of some) add(steps[Math.min(count - 1, Math.floor(x.x / width + 1e-9))], x);
    return { zero, steps, width, top: count * width, left: u.left, n: u.list.length };
  }
  // the two sides of one line: the meals or days the picked effects were reported for, and all the others. Nothing is averaged.
  function sides(bar, mode, pick) {
    const u = units(bar, mode, pick), side = () => ({ n: 0, ate: 0, lo: null, hi: null }), hit = side(), rest = side();
    for (const x of u.list) { const s = x.fx.length ? hit : rest; s.n++; if (x.x > 0.005) s.ate++; if (s.lo === null || x.x < s.lo) s.lo = x.x; if (s.hi === null || x.x > s.hi) s.hi = x.x; }
    return { hit, rest, left: u.left };
  }
  // eaten together: 3 or more portions of the aged and fermented foods, and alcohol with one of them
  function together(mode, pick) {
    const o = { nHit: 0, nRest: 0, three: { hit: 0, rest: 0 }, both: { hit: 0, rest: 0 } };
    for (const x of units('histN', mode, pick).list) { const k = x.fx.length ? 'hit' : 'rest'; if (k === 'hit') o.nHit++; else o.nRest++; if (x.x >= 3) o.three[k]++; if (x.x > 0 && x.alc > 0.005) o.both[k]++; }
    return o;
  }
  // Home: what went in and what was reported, over a period that ends now
  function period(per) {
    const am = nothing(); let meals = 0, mealDays = 0, fx = [];
    if (per === 'h4') { for (const k of keys) for (const m of days[k].meals) if (m.t > now - 4 * HOUR && m.t <= now) { plus(am, m.am); meals++; } fx = allFx.filter(e => e.t > now - 4 * HOUR && e.t <= now); }
    else { const n = { today: 1, week: 7, month: 30 }[per], T = dayOf(now, roll);
      for (let i = 0; i < n; i++) { const d = days[dayPlus(T, -i)]; if (!d) continue; if (d.meals.length) { plus(am, d.total); meals += d.meals.length; mealDays++; } fx = fx.concat(d.said); } }
    const by = {}; for (const e of fx) by[e.c] = (by[e.c] || 0) + 1;
    return { am, meals, mealDays, effects: fx.length, by };
  }
  // the highest count of effects in any window of the same length, so far
  function busiest(per) {
    if (per === 'h4') { const ts = allFx.map(e => e.t).sort((a, b) => a - b); let best = 0; for (let i = 0; i < ts.length; i++) { let c = 0; for (let j = 0; j <= i; j++) if (ts[i] - ts[j] < 4 * HOUR) c++; if (c > best) best = c; } return best; }
    const n = { today: 1, week: 7, month: 30 }[per], T = dayOf(now, roll); let best = 0; if (!keys.length) return 0;
    for (let end = keys[0]; end <= T; end = dayPlus(end, 1)) { let c = 0; for (let i = 0; i < n; i++) { const d = days[dayPlus(end, -i)]; if (d) c += d.said.length; } if (c > best) best = c; }
    return best;
  }
  // one food: the complete days it was eaten on, by the amount eaten that day
  function oneFood(same, onList) {
    const rows = {}, without = { n: 0, fx: {} }; let times = 0, clean = 0;
    for (const k of keys) { const d = days[k]; if (!d.complete) continue; let q = 0, first = null, othersOnList = true;
      for (const m of d.meals) for (const it of m.items) { if (same(it.food)) { q += it.q; if (first === null || m.t < first) first = m.t; } else if (onList && !onList(it.food)) othersOnList = false; }
      if (!q) { without.n++; for (const c of new Set(d.fx.map(e => e.c))) without.fx[c] = (without.fx[c] || 0) + 1; continue; }
      times++; if (othersOnList) clean++;
      const r = rows[q] || (rows[q] = { q, n: 0, k: 0, same: {}, night: {}, next: {}, any: {} }); r.n++; const seen = new Set(), put = (o, c) => { o[c] = (o[c] || 0) + 1; seen.add(c); };
      for (const c of new Set(d.fx.filter(e => e.c !== 'sleep' && e.t >= first).map(e => e.c))) put(r.same, c);
      if (d.fx.some(e => e.c === 'sleep')) put(r.night, 'sleep');
      const next = days[dayPlus(k, 1)]; if (next) for (const c of new Set(next.fx.filter(e => e.c !== 'sleep').map(e => e.c))) put(r.next, c);
      if (seen.size) r.k++; for (const c of seen) r.any[c] = (r.any[c] || 0) + 1; }
    return { times, clean, rows: Object.values(rows).sort((a, b) => a.q - b.q), without };
  }
  return { days, keys, complete: keys.filter(k => days[k].complete).length, cells, sides, together, period, busiest, oneFood };
}

// Fisher's exact test, one-sided, by brute force over the table (no logarithms): the chance of at least `a` hits inside by luck alone
function luck(a, b, c, d) {
  const inside = a + b, outside = c + d, N = inside + outside, K = a + c; if (!inside || !outside) return null;
  const choose = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
  let p = 0; for (let x = a; x <= Math.min(K, inside); x++) p += choose(K, x) * choose(N - K, inside - x) / choose(N, inside); return Math.min(1, p);
}
module.exports = { loadTable, holds, plus, nothing, recount, dayOf, dayPlus, dayBegins, luck, MICRO, APP };
