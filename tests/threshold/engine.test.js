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
  const early = E.bar(E.index({ roll: 0, ev: [meal('2026-11-05', '08:00', [['steak', 2]]), fx('2026-11-05', '07:30', 'naus')] }, food, T('2026-11-05', '09:00')), 'fat', 'meal');
  eq('a meal whose 4 hours have not passed, with nothing reported after it, is not read yet', early.n, 0); }

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

// ---- over a day: when nothing is reported for the day after, a day with no effect of its own is not settled ----
{ const F = { a: { kcal: 100, fat: 10, prot: 5, carb: 0, fib: 0, sug: 0, lact: 0, alc: 0 } };
  const ev = [meal('2026-11-10', '12:00', [['a', 1]]), none('2026-11-10'),                  // nothing at all on the 11th
    meal('2026-11-12', '12:00', [['a', 2]]), fx('2026-11-12', '13:00', 'head'),              // nothing on the 13th, but its own headache is there
    meal('2026-11-14', '12:00', [['a', 3]]), none('2026-11-14'), none('2026-11-15')];        // the 15th: a tap, and no meal
  const I = E.index({ roll: 0, ev }, k => F[k], NOW);
  eq('a day with no effect is not counted when nothing is reported for the day after; a day with its effect is; a day followed by a “No effects” tap is', E.bar(I, 'fat', 'day').units.map(u => [u.id, u.fx.length]), [['2026-11-12', 1], ['2026-11-14', 0]]);
  eq('the tab is told how many days wait for that reason', E.waiting(I, 'day'), { soon: 0, open: 0, next: 1 });
  eq('with another effect picked, the day with the headache is not settled either', [E.bar(I, 'fat', 'day', ['gut']).units.map(u => u.id), E.waiting(I, 'day', ['gut'])], [['2026-11-14'], { soon: 0, open: 0, next: 2 }]);
  eq('an effect entered on the day after is a report for it, even poor sleep, which belongs to the night before', (() => { const J = E.index({ roll: 0, ev: ev.concat([fx('2026-11-11', '07:00', 'sleep')]) }, k => F[k], NOW); return E.bar(J, 'fat', 'day').units.map(u => [u.id, u.fx.length]); })(), [['2026-11-10', 1], ['2026-11-12', 1], ['2026-11-14', 0]]);
  eq('after a meal nothing changes: the three meals are counted', E.bar(I, 'fat', 'meal').n, 3);
  eq('one food: the unsettled day with it waits', [E.foodReading(I, 'a', null).times, E.foodReading(I, 'a', null).wait], [2, 1]); }

// ---- rule 9: the app puts no number on luck ----
eq('the reading rules hold nothing that works out a luck number', ['luck', 'stepLuck', 'stepRest', 'foodLuck', 'dealt', 'across', 'DEALS'].filter(k => k in E), []);

// ---- the mark: the amount that leaves the fewest meals on the wrong side of it, and the order of the rows ----
{ const U = (x, hit) => ({ x, fx: hit ? ['head'] : [] }), many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  // 200 meals, a headache after 40. Lactose: those 40 held 52 g and up; 30 of the others held under 50 g and 130 held none.
  const lact = many(40, i => U(52 + i, true)).concat(many(30, i => U(3 + i * 1.5, false)), many(130, () => U(0, false)));
  eq('an amount separates the two: the mark is the lowest amount a meal with the effect held, and nothing is on the wrong side', E.split(lact), { at: 52, below: 46.5, wrong: 0, up: 40, under: 160, nHit: 40, nRest: 160 });
  // fat: the 40 between 8 and 69 g, the 160 others between 3 and 79 g
  const fat = many(40, i => U(8 + i * 61 / 39, true)).concat(many(160, i => U(3 + i * 76 / 159, false)));
  eq('the two are spread over the same amounts: no mark', [E.split(fat).at, E.split(fat).wrong], [null, 40]);
  eq('several amounts do as well: the lowest of them is the mark', E.split([U(60, true), U(70, true), U(10, false), U(65, false)]), { at: 60, below: 10, wrong: 1, up: 2, under: 1, nHit: 2, nRest: 2 });
  eq('a mark that only splits off the top of the larger side is not kept', E.split(many(15, () => U(100, true)).concat([U(10, true)], many(5, () => U(100, false)))).at, null);
  eq('the lowest amount is never the mark: something has to sit under it', E.split([U(4, true), U(4, false)]).at, null);
  eq('with nothing on one side there is no mark', [E.split([U(5, true), U(9, true)]).at, E.split([U(5, false), U(9, false)]).at, E.split([]).at], [null, null, null]);
  eq('a trace of it counts as none', E.split([U(0.004, false), U(0, false), U(3, true)]), { at: 3, below: 0, wrong: 0, up: 1, under: 2, nHit: 1, nRest: 2 });
  // from the first meals on: one meal with an effect after it, two without
  const Z = { kcal: 0, fat: 0, prot: 0, carb: 0, fib: 0, sug: 0, lact: 0, alc: 0 }, W = { rich: Object.assign({}, Z, { fat: 20 }), milk: Object.assign({}, Z, { fat: 5, lact: 10 }), bran: Object.assign({}, Z, { fat: 5, fib: 9 }), both: Object.assign({}, Z, { fat: 20, fib: 9 }) };
  const first = E.rows(E.index({ roll: 0, ev: [meal('2026-11-10', '08:00', [['milk', 1]]), meal('2026-11-10', '13:00', [['rich', 1]]), fx('2026-11-10', '14:00', 'head'), meal('2026-11-11', '12:00', [['milk', 1]]), none('2026-11-11')] }, k => W[k], NOW), 'meal');
  eq('three meals are enough for a mark, and the row with one comes first', [first[0].b, first[0].s.at, first[0].s.wrong, first.find(r => r.b === 'lact').s.at], ['fat', 20, 0, null]);
  eq('the rows with no mark keep their own order', first.slice(1).map(r => r.b), E.FAMS.reduce((a, f) => a.concat(f[1]), []).filter(b => b !== 'fat'));
  eq('every row carries its meals, the top of its scale and whether any meal held it', [first.length, first[0].units.length, first[0].max, first[0].any, first.find(r => r.b === 'fib').any], [E.FAMS.reduce((t, f) => t + f[1].length, 0), 3, 20, true, false]);
  // eight days, one meal each. Fibre: the 3 with the effect held 9 g, the 5 others none. Fat: 2 of the 3 held 20 g, and so did 1 of the 5.
  const days = [['both', 1], ['both', 1], ['bran', 1], ['milk', 0], ['milk', 0], ['milk', 0], ['milk', 0], ['rich', 0]], ev = [];
  days.forEach(([k, hit], i) => { const d = '2026-11-' + String(i + 1).padStart(2, '0'); ev.push(meal(d, '12:00', [[k, 1]]), hit ? fx(d, '13:00', 'head') : none(d)); });
  const R = E.rows(E.index({ roll: 0, ev }, k => W[k], NOW), 'meal');
  eq('the row with the fewest on the wrong side comes first, whatever its place in the fixed order', R.slice(0, 3).map(r => [r.b, r.s.at, r.s.wrong]), [['fib', 9, 0], ['fat', 20, 2], ['cplx', null, 3]]);
  // a clear mark: more than half of each kind on its own side
  eq('a mark is clear when more than half of the meals with the effect are at it or over, and more than half of the others under it', [E.clear({ at: 1, up: 21, under: 112, nHit: 27, nRest: 118 }), E.clear({ at: 8, up: 17, under: 104, nHit: 46, nRest: 110 }), E.clear({ at: 3, up: 40, under: 70, nHit: 46, nRest: 160 })], [true, false, false]);
  eq('exactly half is not more than half, and no mark is not a clear mark', [E.clear({ at: 3, up: 1, under: 2, nHit: 2, nRest: 2 }), E.clear({ at: 3, up: 2, under: 1, nHit: 2, nRest: 2 }), E.clear({ at: null, up: 0, under: 0, nHit: 2, nRest: 2 })], [false, false, false]);
  eq('every row says whether its mark is clear', R.slice(0, 3).map(r => [r.b, r.clear]), [['fib', true], ['fat', true], ['cplx', false]]);
  eq('with one effect picked that was never reported, nothing is on the "with" side and no row has a mark', E.rows(E.index({ roll: 0, ev }, k => W[k], NOW), 'meal', ['gut']).filter(r => r.s.at != null).length, 0); }

// ---- a drink is an entry like any other: water alone is a meal that holds nothing, and a flavoured one holds a portion of flavouring ----
{ const Z = { kcal: 0, fat: 0, prot: 0, carb: 0, fib: 0, sug: 0, lact: 0, alc: 0 }, W = { water: Z, fizz: Object.assign({ c: { flav: 1 } }, Z) };
  const S = { roll: 0, ev: [meal('2026-11-10', '08:00', [['water', 2]]), meal('2026-11-10', '12:00', [['fizz', 1]]), fx('2026-11-10', '12:45', 'gut'), meal('2026-11-11', '12:00', [['fizz', 2]]), none('2026-11-11')] };
  const I = E.index(S, k => W[k], NOW), fat = E.line(I, 'fat', 'meal'), fl = E.line(I, 'flav', 'meal');
  // 08:00 water: nothing in its 4 hours. 12:00 flavoured: an effect 45 minutes later. The next day's flavoured: a day with none.
  eq('water alone sits on a side of every line, with an amount of zero', [fat.n, fat.hit.n, fat.hit.lo, fat.hit.hi, fat.rest.n, fat.rest.lo, fat.rest.hi], [3, 1, 0, 0, 2, 0, 0]);
  eq('the flavouring line counts the entries that held any, on each side', [fl.hit.ate, fl.hit.n, fl.rest.ate, fl.rest.n], [1, 1, 1, 2]);
  eq('and it counts portions', [E.amounts(W.fizz, 2).flav, E.amounts(W.water, 2).flav], [2, 0]); }

// ---- the data view: the meals or days an effect was reported for, beside all the others. Nothing is averaged. ----
{ const F2 = { a: { kcal: 100, fat: 10, prot: 5, carb: 0, fib: 0, sug: 0, lact: 0, alc: 0, c: { caf: 50, ox: 1 } }, b: { kcal: 50, fat: 2, prot: 1, carb: 0, fib: 0, sug: 0, lact: 0, alc: 10, h: true, hist: 1.5 } };
  const S = { roll: 0, ev: [ meal('2026-11-10', '12:00', [['a', 1]]), fx('2026-11-10', '13:00', 'head'),
    meal('2026-11-11', '12:00', [['a', 2], ['b', 1]]), none('2026-11-11'),
    meal('2026-11-12', '12:00', [['b', 3]]), fx('2026-11-12', '13:00', 'gut'),
    meal('2026-11-13', '12:00', [['a', 1]]), none('2026-11-13'), none('2026-11-14') ] };      // the 14th: a tap and no meal, so the 13th is answered for
  const I = E.index(S, k => F2[k], NOW);
  eq('a food carries its compounds, times the portions', [E.amounts(F2.a, 2).caf, E.amounts(F2.a, 2).ox], [100, 2]);
  // over a day, an effect counts for its own day and for the day before it: Nov 10, 11 and 12 are "with", Nov 13 is "without"
  eq('grams: how many on each side, and the lowest and highest', E.line(I, 'fat', 'day'), { b: 'fat', hit: { n: 3, ate: 3, lo: 6, hi: 22 }, rest: { n: 1, ate: 1, lo: 10, hi: 10 }, left: 0, n: 4 });
  eq('milligrams: a day with none of it sets the lowest at zero', [E.line(I, 'caf', 'day').hit, E.line(I, 'caf', 'day').rest], [{ n: 3, ate: 2, lo: 0, hi: 100 }, { n: 1, ate: 1, lo: 50, hi: 50 }]);
  eq('portions: how many held any', [E.line(I, 'ox', 'day').hit.ate, E.line(I, 'ox', 'day').hit.n, E.line(I, 'ox', 'day').rest.ate, E.line(I, 'ox', 'day').rest.n], [2, 3, 1, 1]);
  eq('one effect picked: only that effect puts a day on the "with" side', [E.line(I, 'fat', 'day', ['head']).hit.n, E.line(I, 'fat', 'day', ['head']).rest.n], [1, 3]);
  eq('two effects picked together: a day needs both', [E.line(I, 'fat', 'day', ['head', 'gut'], true).hit.n, E.line(I, 'fat', 'day', ['head', 'gut'], false).hit.n], [0, 3]);
  eq('after a meal: the 4 hours after it', [E.line(I, 'fat', 'meal').hit, E.line(I, 'fat', 'meal').rest], [{ n: 2, ate: 2, lo: 6, hi: 10 }, { n: 2, ate: 2, lo: 10, hi: 22 }]);
  eq('every line of every family is there', E.table(I, 'day').map(f => [f.f, f.rows.length]), E.FAMS.map(f => [f[0], f[1].length]));
  eq('flavourings are a line of the “added” family, counted in portions', [E.COMPS.includes('flav'), E.TAGS.includes('flav'), E.FAMS.find(f => f[0] === 'added')[1]], [true, true, ['sulph', 'nitr', 'swt', 'flav']]);
  eq('eaten together: 3 or more aged or fermented portions, and alcohol with one', E.together(I, 'day'), { nHit: 3, nRest: 1, three: { hit: 1, rest: 0 }, both: { hit: 2, rest: 0 }, many: { hit: 0, rest: 0 } });
  eq('a line opened with one effect picked counts only that effect', (() => { const B = E.bar(I, 'fat', 'day', ['gut']); return [B.n, [B.zero].concat(B.steps).reduce((t, s) => t + s.k, 0)]; })(), [4, 2]);
  eq('a meal entered just now waits for its 4 hours; today and yesterday wait until the day after each is over', (() => { const J = E.index(S, k => F2[k], T('2026-11-13', '13:00')); return [E.waiting(J, 'meal'), E.waiting(J, 'day'), E.line(J, 'fat', 'meal').n, E.line(J, 'fat', 'day').n]; })(), [{ soon: 1, open: 0, next: 0 }, { soon: 2, open: 0, next: 0 }, 3, 2]);
  eq('a meal counts at once when an effect is reported after it, before its 4 hours are over', (() => { const J = E.index({ roll: 0, ev: [meal('2026-11-10', '12:00', [['a', 1]]), fx('2026-11-10', '13:00', 'head')] }, k => F2[k], T('2026-11-10', '13:30')); return [E.line(J, 'fat', 'meal').hit.n, E.line(J, 'fat', 'meal').rest.n, E.waiting(J, 'meal')]; })(), [1, 0, { soon: 0, open: 0, next: 0 }]);
  eq('...but not for another effect: with gut picked, that meal still waits', (() => { const J = E.index({ roll: 0, ev: [meal('2026-11-10', '12:00', [['a', 1]]), fx('2026-11-10', '13:00', 'head')] }, k => F2[k], T('2026-11-10', '13:30')); return [E.line(J, 'fat', 'meal', ['gut']).n, E.waiting(J, 'meal', ['gut'])]; })(), [0, { soon: 1, open: 0, next: 0 }]);
  eq('picked together, a meal waits until both are reported after it', (() => { const J = E.index({ roll: 0, ev: [meal('2026-11-10', '12:00', [['a', 1]]), fx('2026-11-10', '13:00', 'head')] }, k => F2[k], T('2026-11-10', '13:30')); return [E.line(J, 'fat', 'meal', ['head', 'gut'], true).n, E.waiting(J, 'meal', ['head', 'gut'], true).soon, E.line(J, 'fat', 'meal', ['head', 'gut'], false).hit.n]; })(), [0, 1, 1]);
  eq('an effect entered at the meal’s own minute counts as after it', (() => { const J = E.index({ roll: 0, ev: [meal('2026-11-10', '12:00', [['a', 1]]), fx('2026-11-10', '12:00', 'head')] }, k => F2[k], T('2026-11-10', '12:30')); return E.line(J, 'fat', 'meal').hit.n; })(), 1);
  eq('a day left open keeps its meal out, and says so', (() => { const J = E.index({ roll: 0, ev: [meal('2026-11-10', '12:00', [['a', 1]])] }, k => F2[k], NOW); return [E.waiting(J, 'meal'), E.waiting(J, 'day'), E.line(J, 'fat', 'meal').n]; })(), [{ soon: 0, open: 1, next: 0 }, { soon: 0, open: 1, next: 0 }, 0]);
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

// ---- a day is read once the day after it is over, and a day without a food is read over the same span as a day with it ----
{ const S = { roll: 0, ev: [
    meal('2026-11-10', '12:00', [['steak', 1]]), none('2026-11-10'),
    meal('2026-11-11', '12:00', [['icecr', 1]]), fx('2026-11-11', '18:00', 'head'),
    meal('2026-11-12', '12:00', [['steak', 1]]), none('2026-11-12'),
    meal('2026-11-13', '12:00', [['icecr', 1]]), none('2026-11-13'), none('2026-11-14') ] };
  const late = E.index(S, food, NOW), R = E.foodReading(late, 'icecr', null);
  eq('a day without the food takes the next day’s effects, as a day with it does: the 10th is followed by a headache on the 11th', [R.without.n, R.without.fx], [2, { head: 1 }]);
  eq('...and the days with it are read as before', [R.times, R.rows.map(r => [r.q, r.n, r.k]), R.rows[0].same, R.rows[0].next, R.wait], [2, [[1, 2, 1]], { head: 1 }, {}, 0]);
  const mid = E.index(S, food, T('2026-11-14', '10:00')), M = E.foodReading(mid, 'icecr', null);
  eq('on the 14th the 13th is not read yet, since the 14th is not over: one day with the food waits', [M.times, M.wait, M.without.n], [1, 1, 2]);
  eq('over a day, the same: three days are read and one waits', [E.bar(mid, 'fat', 'day').n, E.waiting(mid, 'day')], [3, { soon: 1, open: 0, next: 0 }]);
  const next = E.index(S, food, T('2026-11-15', '00:01'));
  eq('one minute into the 15th, the 13th is read', [E.bar(next, 'fat', 'day').n, E.waiting(next, 'day'), E.foodReading(next, 'icecr', null).wait], [4, { soon: 0, open: 0, next: 0 }, 0]); }

// ---- Nutrition: what went in, over today, the week and the month ----
{ const S = { roll: 0, ev: [] }; for (let d = 1; d <= 9; d++) { const k = '2026-11-' + (d < 10 ? '0' + d : d); S.ev.push(meal(k, '08:00', [['steak', 1]])); for (let i = 0; i < (d === 5 ? 4 : 1); i++) S.ev.push(fx(k, '1' + i + ':00', 'head')); }
  S.ev.push(meal('2026-11-10', '08:00', [['milk', 1]]), fx('2026-11-10', '09:00', 'gut'), fx('2026-11-10', '09:30', 'naus'), fx('2026-11-10', '10:00', 'sleep'));
  const now = T('2026-11-10', '11:00'), I = E.index(S, food, now);
  eq('today: what went in', [E.went(I, 'today').am.lact, E.went(I, 'today').meals], [12, 1]);
  eq('this week: days with meals', E.went(I, 'week').days, 7);
  eq('the month: every day with a meal', [E.went(I, 'month').days, E.went(I, 'month').meals], [10, 10]);
  eq('complete days are counted', E.reportedDays(I), 10);
  eq('the reading rules hold no Effects bar and no "last 4 hours" period', ['came', 'cameMax', 'BAR_DAYS'].filter(k => k in E), []); }

// ---- eaten together: a meal or a day that held 5 compounds or more ----
{ const Z = { kcal: 100, fat: 5, prot: 5, carb: 10, fib: 1, sug: 2, lact: 0, alc: 0 };
  const F3 = { six: Object.assign({}, Z, { alc: 10, h: true, hist: 1, c: { caf: 50, tyr: 1, glu: 1, fru: 1 } }), four: Object.assign({}, Z, { c: { caf: 50, glu: 1, fru: 1, swt: 1 } }), plain: Z, one: Object.assign({}, Z, { c: { flav: 1 } }) };
  eq('alcohol, caffeine, histamine food and each other compound count once', [E.groups(E.amounts(F3.six, 2)), E.groups(E.amounts(F3.four, 1)), E.groups(E.amounts(F3.plain, 1))], [6, 4, 0]);
  const S = { roll: 0, ev: [meal('2026-11-10', '08:00', [['six', 1]]), fx('2026-11-10', '09:00', 'head'), meal('2026-11-10', '18:00', [['four', 1]]),
    meal('2026-11-11', '08:00', [['four', 1], ['one', 1]]), meal('2026-11-11', '18:00', [['plain', 1]]), none('2026-11-11'), none('2026-11-12')] };
  const I = E.index(S, k => F3[k], NOW), G = E.together(I, 'meal'), D = E.together(I, 'day');
  // after a meal: the six-compound meal is "with"; four, then four and one more (5), then none are "without"
  eq('after a meal: the meals that held 5 or more, on each side', [E.MANY, G.nHit, G.nRest, G.many], [5, 1, 3, { hit: 1, rest: 1 }]);
  // over a day: Nov 10 held 7 different ones and has the headache; Nov 11 held 5 and has none
  eq('over a day: a day’s compounds are counted once each, not added up', [D.nHit, D.nRest, D.many], [1, 1, { hit: 1, rest: 1 }]); }

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

// ---- the hours after a meal are the person's own setting, 1 to 8 on the slider, and 4 unless they move it ----
{ const d = '2026-11-02', S = { roll: 0, ev: [meal(d, '07:00', [['milk', 1]]), meal(d, '12:00', [['steak', 1]]), meal(d, '17:00', [['rice', 1]]), fx(d, '09:00', 'gut'), fx(d, '14:00', 'head'), fx(d, '16:00', 'naus'), fx(d, '18:00', 'lowen'), fx(d, '22:00', 'edgy')] };
  const at = h => E.mealUnits(E.index(Object.assign({ twin: h }, S), food, NOW), 'fat').units.map(u => u.fx.join('+'));
  eq('at 8 hours an effect can count for two meals: 2 p.m. for the 7 a.m. meal and for noon, 6 p.m. for noon and for 5 p.m.', at(8), ['gut+head', 'head+naus+lowen', 'lowen+edgy']);
  eq('at 4 hours: 4 p.m. still counts for noon, 2 p.m. no longer counts for 7 a.m.', at(4), ['gut', 'head+naus', 'lowen']);
  eq('at 1 hour: from the time on the meal to one hour after it, and no further', at(1), ['', '', 'lowen']);
  eq('with no setting, or one that is not a stop of the slider, it is 4 hours', [undefined, 0, 9, 2.5, '8'].map(h => E.index(Object.assign({ twin: h }, S), food, NOW).win / E.H), [4, 4, 4, 4, 4]);
  eq('the slider has eight stops, one hour apart', E.WINS, [1, 2, 3, 4, 5, 6, 7, 8]);
  const quiet = { roll: 0, ev: S.ev.filter(e => e.c !== 'lowen' && e.c !== 'edgy') }, soon = h => E.waiting(E.index(Object.assign({ twin: h }, quiet), food, T(d, '20:00')), 'meal').soon;
  eq('a meal waits until its own hours are over: at 8 p.m. the 5 p.m. meal has settled at 2 hours and is still waiting at 4', [soon(2), soon(4)], [0, 1]); }

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `engine: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
