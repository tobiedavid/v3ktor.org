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
  // together: with several effects picked, all of them have to be there. Otherwise any one is enough.
  // hours: after a meal, how many hours count. It is the person's own setting on the slider, 4 unless they moved it.
  function units(bar, mode, pick, together, hours) { const span = (hours || 4) * HOUR;
    const out = [], field = BARS[bar], amt = am => field ? am[field] : (am.also[bar] || 0), keep = fx => { if (!pick || !pick.length) return fx; const f = fx.filter(c => pick.includes(c)); return together && !pick.every(c => f.includes(c)) ? [] : f; }; let left = 0;
    for (const k of keys) { const d = days[k]; if (!d.complete) continue;
      if (mode === 'meal') { for (const m of d.meals) { if (!canRead(m.am, bar)) { left++; continue; }
          const fx = keep(allFx.filter(e => e.c !== 'sleep' && e.t >= m.t && e.t <= m.t + span).map(e => e.c));
          if (m.t + span > now && !fx.length) continue;      // its hours are not over and nothing is reported after it yet: its side is not settled
          out.push({ x: amt(m.am), alc: m.am.alcohol, fx, meal: m }); } }
      else { if (dayBegins(dayPlus(k, 1), roll) > now) continue; if (!canRead(d.total, bar)) { left++; continue; }
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
  // ---- the luck sentence, recounted ----
  // The sentence does not speak for one amount alone. It counts every amount of every line and, after a meal, every setting of the slider:
  // the effects of each complete day are dealt to another complete day, 300 times, and each time the smallest luck number anywhere is kept.
  // What the screen says is how often that smallest number came out at least as small as the luck number of the amount pressed.
  // The rules of a deal, which this file follows in its own way:
  //   - the complete days stand in date order. A deal shuffles them: a = last down to 1, b = a whole number from 0 to a drawn from the generator, swap a and b.
  //     Every deal starts from the days in order. The generator is seeded once, with 20261114, for all 300 deals.
  //   - after a meal: each effect reported on complete day i moves to the day the shuffle put in place i, at the same time past that day's start.
  //     An effect reported on a day that is not complete stays where it is. Poor sleep never counts after a meal.
  //   - over a day: complete day i takes the effects of the day the shuffle put in place i. The next day's effects count too, as in the lists:
  //     the dealt ones when the next day is complete, its own when it is not.
  //   - the meals and days counted, and the amounts they fall in, stay as they are now. Only "with" and "without" are dealt.
  const LINES = ['fat', 'cplx', 'sug', 'lact', 'fib', 'alc', 'caf', 'hist', 'tyr', 'ox', 'nit', 'ga', 'cap', 'fru', 'gos', 'sorb', 'mann', 'fruc', 'sulph', 'nitr', 'swt', 'glu', 'pur', 'theo'];
  function generator(seed) { let a = seed; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // which amount each counted meal or day falls in: -1 for none of it, then the steps from the lowest
  function place(list) { const some = list.filter(x => x.x > 0.005); if (!some.length) return list.map(() => -1);
    const max = Math.max(...some.map(x => x.x)), nice = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000], width = nice.find(w => w * 8 >= max - 1e-9) || Math.ceil(max / 8), count = Math.max(1, Math.min(8, Math.ceil(max / width - 1e-9)));
    return list.map(x => x.x > 0.005 ? Math.min(count - 1, Math.floor(x.x / width + 1e-9)) : -1); }
  function dealt(mode, pick, together) {
    const done = keys.filter(k => days[k].complete), n = done.length; if (n < 2) return null;
    const where = {}; done.forEach((k, i) => { where[k] = i; });
    const counts = c => !pick || !pick.length || pick.includes(c), yes = codes => { const f = codes.filter(counts); return pick && pick.length && together ? pick.every(c => f.includes(c)) : f.length > 0; };
    const chances = new Map(), chance = (k, size, K, N) => { const key = k + '/' + size + '/' + K + '/' + N; if (!chances.has(key)) chances.set(key, luck(k, size - k, K - k, (N - size) - (K - k))); return chances.get(key); };
    // the smallest luck number among the amounts of one line, given which of its meals or days are "with"
    const smallest = (line, withIt, best) => { const N = line.length, K = line.filter(u => withIt(u)).length; if (!K || K === N) return best;
      const groups = {}; for (const u of line) (groups[u.at] || (groups[u.at] = [])).push(u);
      for (const g of Object.values(groups)) { const k = g.filter(u => withIt(u)).length; if (k * N <= K * g.length) continue; const p = chance(k, g.length, K, N); if (p !== null && p < best) best = p; }
      return best; };
    const settings = mode === 'meal' ? [1, 2, 3, 4, 5, 6, 7, 8] : [4];
    const lines = settings.map(h => LINES.map(b => { const list = units(b, mode, pick, together, h).list, at = place(list); return list.map((u, i) => ({ meal: u.meal, day: u.day, at: at[i] })); }).filter(l => l.length));
    const next = generator(20261114), least = [];
    for (let deal = 0; deal < 300; deal++) {
      const order = done.map((k, i) => i); for (let a = n - 1; a > 0; a--) { const b = Math.floor(next() * (a + 1)), x = order[a]; order[a] = order[b]; order[b] = x; }
      let best = 1;
      if (mode === 'meal') {
        const moved = allFx.filter(e => e.c !== 'sleep' && counts(e.c)).map(e => { const k = dayOf(e.t, roll), i = where[k]; return { c: e.c, t: i === undefined ? e.t : dayBegins(done[order[i]], roll) + (e.t - dayBegins(k, roll)) }; });
        settings.forEach((h, s) => { const seen = new Map(), withIt = u => { if (!seen.has(u.meal)) seen.set(u.meal, yes(moved.filter(e => e.t >= u.meal.t && e.t <= u.meal.t + h * HOUR).map(e => e.c))); return seen.get(u.meal); };
          for (const line of lines[s]) best = smallest(line, withIt, best); });
      } else {
        const own = k => days[k].fx.map(e => e.c), carried = k => days[k] ? days[k].fx.filter(e => e.c !== 'sleep').map(e => e.c) : [];
        const seen = new Map(), withIt = u => { if (!seen.has(u.day)) { const i = where[u.day], after = dayPlus(u.day, 1), j = where[after]; seen.set(u.day, yes(own(done[order[i]]).concat(j === undefined ? carried(after) : carried(done[order[j]])))); } return seen.get(u.day); };
        for (const line of lines[0]) best = smallest(line, withIt, best);
      }
      least.push(best);
    }
    return least.sort((a, b) => a - b);
  }
  // how often, in those deals, the smallest luck number anywhere was at least as small as p (one is added to both counts)
  const across = (least, p) => least === null || p === null ? null : (least.filter(x => x <= p * (1 + 1e-9)).length + 1) / (least.length + 1);
  return { days, keys, complete: keys.filter(k => days[k].complete).length, cells, sides, together, period, busiest, oneFood, dealt, across };
}

// Fisher's exact test, one-sided, by brute force over the table (no logarithms): the chance of at least `a` hits inside by luck alone
const CHOSEN = new Map();
function luck(a, b, c, d) {
  const inside = a + b, outside = c + d, N = inside + outside, K = a + c; if (!inside || !outside) return null;
  const choose = (n, k) => { if (k < 0 || k > n) return 0; const key = n * 4001 + k; let r = CHOSEN.get(key); if (r === undefined) { r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; CHOSEN.set(key, r); } return r; };
  let p = 0; for (let x = a; x <= Math.min(K, inside); x++) p += choose(K, x) * choose(N - K, inside - x) / choose(N, inside); return Math.min(1, p);
}
module.exports = { loadTable, holds, plus, nothing, recount, dayOf, dayPlus, dayBegins, luck, MICRO, APP };
