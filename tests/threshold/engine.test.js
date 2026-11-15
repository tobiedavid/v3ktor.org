// Threshold Log: one test (or more) for each reading rule. Runs on plain Node, no packages:  node tests/threshold/engine.test.js
// The rules are read out of the shipped app file, between its ENGINE markers, so what is tested is what people open.
const fs = require('fs'), path = require('path'), vm = require('vm');
const file = process.env.TL_ENGINE || path.join(__dirname, '..', '..', 'threshold', 'app', 'index.html');
let src = fs.readFileSync(file, 'utf8');
if (file.endsWith('.html')) { const a = src.indexOf('/* ENGINE:START */'), b = src.indexOf('/* ENGINE:END */'); if (a < 0 || b < 0) throw new Error('ENGINE markers not found in ' + file); src = src.slice(a, b); }
const box = { module: { exports: {} } }; vm.runInNewContext(src + '\n;module.exports=TLE;', box); const E = box.module.exports;

let pass = 0, fail = 0;
const eq = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) pass++; else { fail++; console.log('FAIL ' + name + '\n   got  ' + g + '\n   want ' + w); } };
const near = (name, got, want, tol) => { if (Math.abs(got - want) <= (tol || 1e-6)) pass++; else { fail++; console.log('FAIL ' + name + ': got ' + got + ', want ' + want); } };

// a small food table: per serving
const F = {
  steak:  { kcal: 250, prot: 30, fat: 14, carb: 0,  sug: 0,    fib: 0, lact: 0, alc: 0, b: [] },
  rice:   { kcal: 200, prot: 4,  fat: 0,  carb: 45, sug: 0.1,  fib: 1, lact: 0, alc: 0, b: [] },
  milk:   { kcal: 130, prot: 8,  fat: 5,  carb: 12, sug: 12,   fib: 0, lact: 12, alc: 0, b: ['dairy'] },
  icecr:  { kcal: 145, prot: 2,  fat: 8,  carb: 17, sug: 15,   fib: 0.5, lact: 4, alc: 0, b: ['dairy', 'sugar'] },
  donut:  { kcal: 200, prot: 2,  fat: 10, carb: 25, sug: null, fib: 1, lact: 0, alc: 0, b: ['sugar'] },          // sugars not listed
  gouda:  { kcal: 107, prot: 7,  fat: 8,  carb: 1,  sug: 1,    fib: 0, lact: 0, alc: 0, h: true, hist: 1.35, b: ['dairy', 'hist'] },
  pizza:  { kcal: 300, prot: 12, fat: 12, carb: 33, sug: 3,    fib: 2, lact: 1, alc: 0, h: true, hist: null, b: ['hist'] },   // a histamine food with no figure
  husk:   { kcal: 0, prot: 0, fat: 0, carb: 0, sug: 0, fib: 0, lact: 0, alc: 0, b: ['fibre', 'sup'], x: ['fib'] },     // fibre: no figure, brands vary
  typed:  { none: true },                                                                                           // a food with no numbers
};
const food = k => F[k];
const T = (d, hm) => { const [y, mo, da] = d.split('-').map(Number), [h, mi] = hm.split(':').map(Number); return new Date(y, mo - 1, da, h, mi).getTime(); };
let n = 0; const meal = (d, hm, items) => ({ id: 'm' + (++n), k: 'meal', t: T(d, hm), items: items.map(([key, q]) => ({ key, q })) });
const fx = (d, hm, c) => ({ id: 'e' + (++n), k: 'fx', t: T(d, hm), c });
const none = d => ({ id: 'n' + (++n), k: 'none', t: T(d, '21:00'), d });
const NOW = T('2026-11-30', '12:00');

// ---- days ----
eq('a day key', E.dayKey(T('2026-11-10', '08:00'), 0), '2026-11-10');
eq('before the day-start hour belongs to the day before', E.dayKey(T('2026-11-10', '01:30'), 4), '2026-11-09');
eq('adding days crosses a month', E.keyAdd('2026-10-31', 1), '2026-11-01');
eq('poor sleep belongs to the night before', E.fxDay(fx('2026-11-10', '07:00', 'sleep'), 0), '2026-11-09');
eq('a headache belongs to its own day', E.fxDay(fx('2026-11-10', '07:00', 'head'), 0), '2026-11-10');

// ---- what a food holds ----
{ const a = E.amounts(F.milk, 2); eq('milk x2: sugars, lactose, other sugars, complex', [a.sug, a.lact, a.sugo, a.cplx, a.unk], [24, 24, 0, 0, 0]); }
{ const a = E.amounts(F.icecr, 1); eq('ice cream: lactose is part of the sugars', [a.sug, a.lact, a.sugo, a.cplx], [15, 4, 11, 1.5]); }
{ const a = E.amounts(F.rice, 1); near('rice: complex carbs are carbohydrate less fibre less sugars', a.cplx, 43.9); }
{ const a = E.amounts(F.donut, 1); eq('sugars not listed: nothing is guessed', [a.sug, a.cplx, a.unk], [0, 0, 24]); }
{ const a = E.amounts(F.gouda, 3); near('histamine estimate scales with portions', a.hist, 4.05); eq('and counts as a histamine food', [a.histN, a.histUnk], [3, 0]); }
{ const a = E.amounts(F.pizza, 1); eq('a histamine food with no figure', [a.hist, a.histN, a.histUnk], [0, 1, 1]); }
{ const a = E.amounts(F.typed, 1); eq('a food with no numbers', a.noNum, 1); }
{ const a = E.amounts(F.husk, 2), t = E.addInto(E.addInto(E.ZERO(), a), E.amounts(F.husk, 1)); eq('a value with no figure is carried as portions, never as zero', [a.x, t.x], [{ fib: 2 }, { fib: 3 }]);
  eq('a fibre supplement with no figure sits out of the fibre bar only', [E.usable(a, 'fib'), E.usable(a, 'fat')], [false, true]); }

// ---- rule 1: a day counts once it is closed ----
{ const S = { roll: 0, ev: [meal('2026-11-01', '08:00', [['steak', 1]]), meal('2026-11-02', '08:00', [['steak', 1]]), none('2026-11-02'), fx('2026-11-03', '10:00', 'head'), meal('2026-11-04', '08:00', [['rice', 1]]), fx('2026-11-04', '10:00', 'head')] };
  const I = E.index(S, food, NOW);
  eq('a meal alone does not close a day', I.D['2026-11-01'].closed, false);
  eq('a meal and "No effects today" close it', I.D['2026-11-02'].closed, true);
  eq('an effect with no meal does not', I.D['2026-11-03'].closed, false);
  eq('a meal and an effect do', I.D['2026-11-04'].closed, true);
  eq('reported days', E.reportedDays(I), 2); }

// ---- rule 3, after a meal: the next 4 hours ----
{ const S = { roll: 0, ev: [
    meal('2026-11-05', '08:00', [['steak', 2]]), fx('2026-11-05', '07:30', 'naus'), fx('2026-11-05', '11:59', 'head'), fx('2026-11-05', '12:01', 'gut'),
    meal('2026-11-05', '18:00', [['rice', 1]]),
    meal('2026-11-06', '23:00', [['steak', 1]]), fx('2026-11-07', '01:00', 'head'), none('2026-11-06'),
    meal('2026-11-07', '09:00', [['donut', 1]]), meal('2026-11-08', '09:00', [['steak', 1]]) ] };
  const I = E.index(S, food, NOW), U = E.mealUnits(I, 'fat');
  eq('meals read for fat: only on closed days', U.units.map(u => u.x), [28, 0, 14, 10]);
  eq('an effect before the meal does not count; one inside 4 hours does; one after does not', U.units[0].fx, ['head']);
  eq('a meal with nothing after it', U.units[1].fx, []);
  eq('the 4 hours can run past midnight', U.units[2].fx, ['head']);
  const C = E.mealUnits(I, 'cplx'); eq('carbs of a kind not listed sit out of the complex-carb bar', [C.units.length, C.left.length], [3, 1]);
  const early = E.mealUnits(E.index(S, food, T('2026-11-05', '09:00')), 'fat'); eq('a meal whose 4 hours have not passed is not read yet', early.units.length, 0); }

// ---- rule 3, over a day: that day, that night, the next day ----
{ const S = { roll: 0, ev: [
    meal('2026-11-10', '08:00', [['milk', 1]]), none('2026-11-10'), fx('2026-11-11', '07:00', 'sleep'),
    meal('2026-11-11', '08:00', [['milk', 2]]), fx('2026-11-11', '15:00', 'head'),
    meal('2026-11-12', '08:00', [['steak', 1]]), none('2026-11-12'),
    meal('2026-11-30', '08:00', [['milk', 1]]), none('2026-11-30') ] };
  const I = E.index(S, food, NOW), U = E.dayUnits(I, 'lact');
  eq('days read for lactose: closed days that have ended', U.units.map(u => [u.id, u.x]), [['2026-11-10', 12], ['2026-11-11', 24], ['2026-11-12', 0]]);
  eq('that night (poor sleep reported next morning) and the next day both count', U.units[0].fx.sort(), ['head', 'sleep']);
  eq('the day itself', U.units[1].fx, ['head']);
  eq('a day with nothing that day, that night or the next', U.units[2].fx, []); }

// ---- rule 6 and 8: steps, each shown from its first entry ----
eq('step width for a 60 g range', E.stepWidth(60), 10);
eq('step width for a 3 mg range', E.stepWidth(3), 0.5);
{ const units = []; for (let i = 0; i < 6; i++) units.push({ x: 5, fx: [], id: 'a' + i }); for (let i = 0; i < 2; i++) units.push({ x: 35, fx: ['head'], id: 'b' + i }); units.push({ x: 60, fx: ['head', 'gut'], id: 'c' }); units.push({ x: 60, fx: [], id: 'd' });
  const B = E.steps(units);
  eq('six steps of 10 g', [B.w, B.steps.length, B.max], [10, 6, 60]);
  eq('entries land in their step, the top edge included', B.steps.map(s => s.n), [6, 0, 0, 2, 0, 2]);
  eq('share of entries followed by an effect', B.steps.map(s => s.share), [0, null, null, 1, null, 0.5]);
  eq('a step shows from its first entry', E.steps([{ x: 5, fx: ['head'], id: 1 }]).steps.filter(s => s.n).map(s => [s.n, s.k, s.share]), [[1, 1, 1]]);
  eq('effects counted by kind, once per entry', B.steps[5].fx, { head: 1, gut: 1 });
  eq('no amounts, no bar', E.steps([{ x: 0, fx: [], id: 1 }]).steps.length, 0); }
// "none of it" has its own cell, so a meal with no lactose is never counted as a meal with a little
{ const B = E.steps([{ x: 0, fx: [], id: 1 }, { x: 0, fx: ['gut'], id: 2 }, { x: 0.001, fx: [], id: 3 }, { x: 4, fx: ['gut'], id: 4 }, { x: 12, fx: ['gut'], id: 5 }]);
  eq('the none cell: its entries, and how many were followed by an effect', [B.zero.n, B.zero.k, B.zero.share], [3, 1, 1 / 3]);
  eq('the steps hold only the entries with some of it', B.steps.map(s => s.n), [0, 0, 1, 0, 0, 1]);
  eq('everything is counted once', B.zero.n + B.steps.reduce((t, s) => t + s.n, 0), B.n);
  eq('with no amounts at all, the none cell still holds the entries', E.steps([{ x: 0, fx: ['head'], id: 1 }]).zero.k, 1); }

// ---- rule 9: the luck number ----
near('5 of 5 against 0 of 5 happens by luck 1 time in 252', E.luck(5, 0, 0, 5), 1 / 252, 1e-9);
near('no difference is no evidence', E.luck(2, 2, 2, 2), 0.757142857, 1e-6);
eq('nothing to compare with', E.luck(3, 0, 0, 0), null);
{ const B = E.steps([{ x: 5, fx: [], id: 1 }, { x: 5, fx: [], id: 2 }, { x: 5, fx: [], id: 3 }, { x: 35, fx: ['head'], id: 4 }, { x: 35, fx: ['head'], id: 5 }, { x: 35, fx: ['head'], id: 6 }]);
  near('one step against the rest of its bar', E.stepLuck(B, B.steps.length - 1, 'head'), 1 / 20, 1e-9); }
{ const B = E.steps([{ x: 0, fx: [], id: 1 }, { x: 0, fx: [], id: 2 }, { x: 0, fx: ['head'], id: 3 }, { x: 35, fx: ['head'], id: 4 }, { x: 35, fx: ['head'], id: 5 }, { x: 35, fx: [], id: 6 }]);
  eq('the rest of the bar includes the none cell', E.stepRest(B, B.steps.length - 1, 'head'), { y: 1, n: 3 });
  eq('the none cell is read against all the steps', E.stepRest(B, -1, 'head'), { y: 2, n: 3 });
  near('2 of 3 against 1 of 3', E.stepLuck(B, B.steps.length - 1, 'head'), 0.5, 1e-9); }

// ---- the data view: the meals or days an effect was reported for, beside all the others. Nothing is averaged. ----
{ const F2 = { a: { kcal: 100, fat: 10, prot: 5, carb: 0, fib: 0, sug: 0, lact: 0, alc: 0, c: { caf: 50, ox: 1 } }, b: { kcal: 50, fat: 2, prot: 1, carb: 0, fib: 0, sug: 0, lact: 0, alc: 10, h: true, hist: 1.5 } };
  const S = { roll: 0, ev: [ meal('2026-11-10', '12:00', [['a', 1]]), fx('2026-11-10', '13:00', 'head'),
    meal('2026-11-11', '12:00', [['a', 2], ['b', 1]]), none('2026-11-11'),
    meal('2026-11-12', '12:00', [['b', 3]]), fx('2026-11-12', '13:00', 'gut'),
    meal('2026-11-13', '12:00', [['a', 1]]), none('2026-11-13') ] };
  const I = E.index(S, k => F2[k], NOW);
  eq('a food carries its compounds, times the portions', [E.amounts(F2.a, 2).caf, E.amounts(F2.a, 2).ox], [100, 2]);
  // over a day, an effect counts for its own day and for the day before it: Nov 10, 11 and 12 are "with", Nov 13 is "without"
  eq('grams: how many on each side, and the lowest and highest', E.line(I, 'fat', 'day'), { b: 'fat', hit: { n: 3, ate: 3, lo: 6, hi: 22 }, rest: { n: 1, ate: 1, lo: 10, hi: 10 }, left: 0, n: 4 });
  eq('milligrams: a day with none of it sets the lowest at zero', [E.line(I, 'caf', 'day').hit, E.line(I, 'caf', 'day').rest], [{ n: 3, ate: 2, lo: 0, hi: 100 }, { n: 1, ate: 1, lo: 50, hi: 50 }]);
  eq('portions: how many held any', [E.line(I, 'ox', 'day').hit.ate, E.line(I, 'ox', 'day').hit.n, E.line(I, 'ox', 'day').rest.ate, E.line(I, 'ox', 'day').rest.n], [2, 3, 1, 1]);
  eq('one effect picked: only that effect puts a day on the "with" side', [E.line(I, 'fat', 'day', ['head']).hit.n, E.line(I, 'fat', 'day', ['head']).rest.n], [1, 3]);
  eq('after a meal: the 4 hours after it', [E.line(I, 'fat', 'meal').hit, E.line(I, 'fat', 'meal').rest], [{ n: 2, ate: 2, lo: 6, hi: 10 }, { n: 2, ate: 2, lo: 10, hi: 22 }]);
  eq('every line of every family is there', E.table(I, 'day').map(f => [f.f, f.rows.length]), E.FAMS.map(f => [f[0], f[1].length]));
  eq('eaten together: 3 or more aged or fermented portions, and alcohol with one', E.together(I, 'day'), { nHit: 3, nRest: 1, three: { hit: 1, rest: 0 }, both: { hit: 2, rest: 0 } });
  eq('a line opened with one effect picked counts only that effect', (() => { const B = E.bar(I, 'fat', 'day', ['gut']); return [B.n, [B.zero].concat(B.steps).reduce((t, s) => t + s.k, 0)]; })(), [4, 2]);
  eq('a meal entered just now waits for its 4 hours, and today waits for tomorrow', (() => { const J = E.index(S, k => F2[k], T('2026-11-13', '13:00')); return [E.waiting(J, 'meal'), E.waiting(J, 'day'), E.line(J, 'fat', 'meal').n, E.line(J, 'fat', 'day').n]; })(), [{ soon: 1, open: 0 }, { soon: 1, open: 0 }, 3, 3]);
  eq('a day left open keeps its meal out, and says so', (() => { const J = E.index({ roll: 0, ev: [meal('2026-11-10', '12:00', [['a', 1]])] }, k => F2[k], NOW); return [E.waiting(J, 'meal'), E.waiting(J, 'day'), E.line(J, 'fat', 'meal').n]; })(), [{ soon: 0, open: 1 }, { soon: 0, open: 1 }, 0]);
  eq('a caffeine pill has no figure, so its meal sits out of the caffeine line', E.usable(E.amounts({ kcal: 0, fat: 0, prot: 0, carb: 0, fib: 0, x: ['caf'] }, 1), 'caf'), false); }

// ---- rules 2, 4 and 7: one food ----
{ const S = { roll: 0, ev: [
    meal('2026-11-14', '12:00', [['icecr', 1], ['steak', 1]]), fx('2026-11-14', '09:00', 'naus'), fx('2026-11-14', '15:00', 'head'), fx('2026-11-15', '07:00', 'sleep'), fx('2026-11-15', '10:00', 'lowen'),
    meal('2026-11-15', '12:00', [['steak', 1]]),
    meal('2026-11-16', '12:00', [['icecr', 2], ['donut', 1]]), none('2026-11-16'),
    meal('2026-11-17', '12:00', [['icecr', 0.5]]), meal('2026-11-17', '19:00', [['icecr', 0.5]]), fx('2026-11-17', '20:00', 'head'),
    meal('2026-11-18', '12:00', [['steak', 1]]), fx('2026-11-18', '13:00', 'gut') ] };
  const I = E.index(S, food, NOW), R = E.foodReading(I, 'icecr', new Set(['steak', 'icecr']));
  eq('days it was eaten on', R.times, 3);
  eq('rows by the amount eaten that day', R.rows.map(r => [r.q, r.n]), [[1, 2], [2, 1]]);
  eq('same day: only effects reported after the food', R.rows[0].same, { head: 2 });
  eq('that night', R.rows[0].night, { sleep: 1 });
  eq('next day', R.rows[0].next, { lowen: 1, gut: 1 });
  eq('the days without it stay on screen', [R.without.n, R.without.fx], [2, { lowen: 1, gut: 1 }]);
  eq('how clean it was: days where nothing else was new', R.clean, 2);
  eq('days with any effect that day, that night or the next day, at each amount', R.rows.map(r => r.k), [2, 1]); }

// ---- Home: what went in, what came out ----
{ const S = { roll: 0, ev: [] }; for (let d = 1; d <= 9; d++) { const k = '2026-11-' + (d < 10 ? '0' + d : d); S.ev.push(meal(k, '08:00', [['steak', 1]])); for (let i = 0; i < (d === 5 ? 4 : 1); i++) S.ev.push(fx(k, '1' + i + ':00', 'head')); }
  S.ev.push(meal('2026-11-10', '08:00', [['milk', 1]]), fx('2026-11-10', '09:00', 'gut'), fx('2026-11-10', '09:30', 'naus'), fx('2026-11-10', '10:00', 'sleep'));
  const now = T('2026-11-10', '11:00'), I = E.index(S, food, now);
  eq('today: what went in', [E.went(I, 'today').am.lact, E.went(I, 'today').meals], [12, 1]);
  eq('last 4 hours: what went in', E.went(I, 'h4').meals, 1);
  eq('this week: days with meals', E.went(I, 'week').days, 7);
  eq('today: effects reported today, poor sleep included', E.came(I, 'today').n, 3);
  eq('by kind', E.came(I, 'today').by, { gut: 1, naus: 1, sleep: 1 });
  eq('the busiest day so far', E.cameMax(I, 'today'), 4);
  eq('the busiest 7 days so far', E.cameMax(I, 'week'), 12);
  eq('the busiest 4 hours so far', E.cameMax(I, 'h4'), 4);
  eq('reported days, for the 7-day rule', E.reportedDays(I) >= E.BAR_DAYS, true); }

// ---- the pie ----
{ const P = E.pie({ fat: 140, prot: 95, cplx: 55, lact: 0, sugo: 5, fib: 6, unk: 0, alc: 0 });
  eq('slices with nothing in them are left out', P.slices.map(s => s.k), ['fat', 'prot', 'cplx', 'sugo', 'fib']);
  eq('the slices add up to exactly 100', P.slices.reduce((s, x) => s + x.pct, 0), 100);
  eq('an empty plate has no pie', E.pie(E.ZERO()).slices.length, 0); }
for (const am of [{ fat: 1, prot: 1, cplx: 1 }, { fat: 33.3, prot: 33.3, cplx: 33.4, fib: 0.2 }, { fat: 7, prot: 2, lact: 3, sugo: 1, fib: 0.1, unk: 5, alc: 9 }]) eq('always 100: ' + JSON.stringify(am), E.pie(am).slices.reduce((s, x) => s + x.pct, 0), 100);

// ---- Health Canada's reference amounts ----
{ const m = E.reference({ sex: 'm', age: 'a2', life: [] }), f = E.reference({ sex: 'f', age: 'a1', life: [] }), pg = E.reference({ sex: 'f', age: 'a2', life: ['preg'] }), hi = E.reference({}), vg = E.reference({ sex: 'm', age: 'a2', life: ['veg'] });
  eq('a man of 31 to 50', [m.ca, m.fe, m.fib, m.prot], [1000, 8, 38, 56]);
  eq('a woman of 18 to 30', [f.ca, f.fe, f.fib, f.prot], [1000, 18, 25, 46]);
  eq('pregnant', [pg.fe, pg.fol, pg.prot], [27, 600, 71]);
  eq('skipped: the higher of the two', [hi.fe, hi.mg], [18, 420]);
  eq('vegetarian: iron 1.8 times', vg.fe, 14); }

// ---- the import from the Food Trial Log ----
{ const o = { v: 4, route: 'fast', roll: 4, p: { sex: 'm', age: 'a2', life: ['veg'] }, amt: { rice: 2 }, ev: [], fast: { start: '2026-10-01' }, base0: ['steak', 'rice', 'milk'],
    adds: [{ key: 'gouda', d: '2026-10-05', at: 5, why: 's2' }, { key: 'icecr', d: '2026-10-06', at: 6, why: 's2' }],
    cuts: [{ key: 'milk', d: '2026-10-02', at: 2, why: 'swap' }, { key: 'icecr', d: '2026-10-07', at: 7, why: 'fall' }, { key: 'donut', d: '2026-10-09', at: 9, why: 'roll' }, { key: 'old', d: '2026-09-01', at: 1, why: 'fall' }],
    tests: [{ key: 'icecr', route: 'fast', d1: '2026-10-12', end: '2026-10-13', endAt: 13, res: 'react' }, { key: 'pizza', route: 'fast', d1: '2026-10-15', end: '2026-10-18', endAt: 18, res: 'none' }, { key: 'typed', route: 'fast', d1: '2026-10-20', end: '2026-10-20', endAt: 20, res: 'react', allergy: true }] };
  const r = E.importGut(o);
  eq('my list, with usual amounts', r.list, [{ key: 'steak', q: 1 }, { key: 'rice', q: 2 }, { key: 'gouda', q: 1 }, { key: 'pizza', q: 1 }]);
  eq('rejected: failed a trial, with how many times', r.out.map(x => [x.key, x.why, x.times, !!x.allergy]), [['typed', 'react', 1, true], ['icecr', 'react', 2, false], ['donut', 'roll', 1, false]]);
  eq('set aside: only swapped out or stopped in step 1', r.aside.map(x => [x.key, x.why]), [['milk', 'swap']]);
  eq('the foods that held', r.fine, ['gouda', 'pizza']);
  eq('profile and day start come over', [r.p, r.roll], [{ sex: 'm', age: 'a2', life: ['veg'] }, 4]);
  eq('not a Food Trial Log save', E.importGut({ foo: 1 }), null);
  eq('a log-only save brings the profile, no lists', E.importGut({ ev: [], route: 'log', p: { sex: 'f' } }).list, []);
  const c = E.common(['icecr', 'milk', 'gouda'], ['steak', 'rice'], food);
  eq('in common: counts only', c.rows.map(x => [x.b, x.o, x.on, x.l, x.ln]), [['dairy', 3, 3, 0, 2]]);
  eq('typical serving, rejected against my list', c.typ.find(x => x.k === 'lact'), { k: 'lact', o: 4, l: 0 }); }

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `engine: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
