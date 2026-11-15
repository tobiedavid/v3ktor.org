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

  // A day is read with its own effects, that night's and the next day's. So it is read once the day after it is over (the start of the day two later has come).
  const over = k => dayBegins(dayPlus(k, 2), roll) <= now;
  // pick: the effects that count. Empty means any effect.
  // together: with several effects picked, all of them have to be there. Otherwise any one is enough.
  // hours: after a meal, how many hours count. It is the person's own setting on the slider, 4 unless they moved it.
  function units(bar, mode, pick, together, hours) { const span = (hours || 4) * HOUR;
    const out = [], field = BARS[bar], amt = am => field ? am[field] : (am.also[bar] || 0), keep = fx => { if (!pick || !pick.length) return fx; const f = fx.filter(c => pick.includes(c)); return together && !pick.every(c => f.includes(c)) ? [] : f; }; let left = 0;
    for (const k of keys) { const d = days[k]; if (!d.complete) continue;
      if (mode === 'meal') { for (const m of d.meals) { if (!canRead(m.am, bar)) { left++; continue; }
          const fx = keep(allFx.filter(e => e.c !== 'sleep' && e.t >= m.t && e.t <= m.t + span).map(e => e.c));
          if (m.t + span > now && !fx.length) continue;      // its hours are not over and nothing is reported after it yet: its side is not settled
          out.push({ x: amt(m.am), alc: m.am.alcohol, fx, meal: m }); } }
      else { if (!over(k)) continue; if (!canRead(d.total, bar)) { left++; continue; }
        const next = days[dayPlus(k, 1)]; out.push({ x: amt(d.total), alc: d.total.alcohol, fx: keep(d.fx.map(e => e.c).concat(next ? next.fx.filter(e => e.c !== 'sleep').map(e => e.c) : [])), day: k }); } }
    return { list: out, left };
  }
  function cells(bar, mode, pick, all, hours) {
    const u = units(bar, mode, pick, all, hours), tally = () => ({ n: 0, k: 0, fx: {} }), add = (c, x) => { c.n++; if (x.fx.length) { c.k++; for (const f of new Set(x.fx)) c.fx[f] = (c.fx[f] || 0) + 1; } };
    const zero = tally(), some = u.list.filter(x => x.x > 0.005); for (const x of u.list) if (!(x.x > 0.005)) add(zero, x);
    if (!some.length) return { zero, steps: [], width: 0, top: 0, left: u.left, n: u.list.length };
    const max = Math.max(...some.map(x => x.x)), nice = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const width = nice.find(w => w * 8 >= max - 1e-9) || Math.ceil(max / 8), count = Math.max(1, Math.min(8, Math.ceil(max / width - 1e-9))), steps = Array.from({ length: count }, tally);
    for (const x of some) add(steps[Math.min(count - 1, Math.floor(x.x / width + 1e-9))], x);
    return { zero, steps, width, top: count * width, left: u.left, n: u.list.length };
  }
  // the two sides of one line: the meals or days the picked effects were reported for, and all the others. Nothing is averaged.
  function sides(bar, mode, pick, all, hours) {
    const u = units(bar, mode, pick, all, hours), side = () => ({ n: 0, ate: 0, lo: null, hi: null }), hit = side(), rest = side();
    for (const x of u.list) { const s = x.fx.length ? hit : rest; s.n++; if (x.x > 0.005) s.ate++; if (s.lo === null || x.x < s.lo) s.lo = x.x; if (s.hi === null || x.x > s.hi) s.hi = x.x; }
    return { hit, rest, left: u.left };
  }
  // eaten together: 3 or more portions of the aged and fermented foods, and alcohol with one of them
  function together(mode, pick, all, hours) {
    const o = { nHit: 0, nRest: 0, three: { hit: 0, rest: 0 }, both: { hit: 0, rest: 0 } };
    for (const x of units('histN', mode, pick, all, hours).list) { const k = x.fx.length ? 'hit' : 'rest'; if (k === 'hit') o.nHit++; else o.nRest++; if (x.x >= 3) o.three[k]++; if (x.x > 0 && x.alc > 0.005) o.both[k]++; }
    return o;
  }
  // Nutrition and Home: what went in and what was reported, over a period that ends today
  function period(per) {
    const am = nothing(); let meals = 0, mealDays = 0, fx = [];
    const n = { today: 1, week: 7, month: 30 }[per], T = dayOf(now, roll);
    for (let i = 0; i < n; i++) { const d = days[dayPlus(T, -i)]; if (!d) continue; if (d.meals.length) { plus(am, d.total); meals += d.meals.length; mealDays++; } fx = fx.concat(d.said); }
    const by = {}; for (const e of fx) by[e.c] = (by[e.c] || 0) + 1;
    return { am, meals, mealDays, effects: fx.length, by };
  }
  // Home: today's meals and effects, in the order they happened
  function todayList() { const d = days[dayOf(now, roll)]; return d ? d.meals.map(m => ['meal', m.t]).concat(d.said.map(e => ['fx', e.t])).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? 1 : -1)) : []; }
  // an effect, opened: the meals in the hours before it, the nearest first. Poor sleep is counted with the day before: that day's meals, in order.
  const allMeals = keys.reduce((a, k) => a.concat(days[k].meals), []).sort((a, b) => a.t - b.t);
  function before(e, hours) {
    if (e.c === 'sleep') { const d = days[dayPlus(dayOf(e.t, roll), -1)]; return d ? d.meals.filter(m => m.t <= e.t).map(m => m.t) : []; }
    return allMeals.filter(m => m.t <= e.t && m.t >= e.t - hours * HOUR).map(m => m.t).reverse();
  }
  // and the earlier meals of the same day that fall outside those hours
  function outside(e, hours) { if (e.c === 'sleep') return []; const k = dayOf(e.t, roll); return allMeals.filter(m => m.t < e.t - hours * HOUR && dayOf(m.t, roll) === k).map(m => m.t); }
  // one food: the complete days it was eaten on, by the amount eaten that day
  function oneFood(same, onList) {
    const rows = {}, without = { n: 0, fx: {} }; let times = 0, clean = 0, waiting = 0;
    for (const k of keys) { const d = days[k]; if (!d.complete) continue; let q = 0, first = null, othersOnList = true;
      for (const m of d.meals) for (const it of m.items) { if (same(it.food)) { q += it.q; if (first === null || m.t < first) first = m.t; } else if (onList && !onList(it.food)) othersOnList = false; }
      if (!over(k)) { if (q) waiting++; continue; }      // the day after it is not over: not read yet
      const next = days[dayPlus(k, 1)], carried = next ? next.fx.filter(e => e.c !== 'sleep').map(e => e.c) : [];
      // a day without the food is read over the same span as a day with it: that day, that night and the next day
      if (!q) { without.n++; for (const c of new Set(d.fx.map(e => e.c).concat(carried))) without.fx[c] = (without.fx[c] || 0) + 1; continue; }
      times++; if (othersOnList) clean++;
      const r = rows[q] || (rows[q] = { q, n: 0, k: 0, same: {}, night: {}, next: {}, any: {} }); r.n++; const seen = new Set(), put = (o, c) => { o[c] = (o[c] || 0) + 1; seen.add(c); };
      for (const c of new Set(d.fx.filter(e => e.c !== 'sleep' && e.t >= first).map(e => e.c))) put(r.same, c);
      if (d.fx.some(e => e.c === 'sleep')) put(r.night, 'sleep');
      for (const c of new Set(carried)) put(r.next, c);
      if (seen.size) r.k++; for (const c of seen) r.any[c] = (r.any[c] || 0) + 1; }
    return { times, clean, rows: Object.values(rows).sort((a, b) => a.q - b.q), without, waiting };
  }
  return { days, keys, complete: keys.filter(k => days[k].complete).length, cells, sides, together, period, todayList, before, outside, effects: allFx.slice().sort((a, b) => a.t - b.t), oneFood };
}

module.exports = { loadTable, holds, plus, nothing, recount, dayOf, dayPlus, dayBegins, MICRO, APP };
