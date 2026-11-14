// Food Trial Log: the repair of saves made before version 1.4.8, when one bad day could take two foods off the list.
// fixFalls() is read straight out of the shipped files; the English and the French copy must behave the same. Plain Node, no packages.
//   node tests/gut/repair.test.js
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..', '..'); let cases = 0;
for (const rel of ['gut/app/index.html', 'gut/fr/app/index.html']) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8'), i = src.indexOf('function fixFalls(n){'); assert(i > 0, 'fixFalls not found in ' + rel);
  const end = '\n  return n; }', j = src.indexOf(end, i), fixFalls = new Function(src.slice(i, j + end.length) + '; return fixFalls;')();
  const clone = o => JSON.parse(JSON.stringify(o));
  const base = () => ({ route: 'fast', fast: { start: '2026-10-20' }, tests: [],
    adds: [{ key: 'fA', d: '2026-10-28', at: 100, why: 's2' }, { key: 'fB', d: '2026-10-29', at: 200, why: 's2' }, { key: 'fC', d: '2026-11-05', at: 300, why: 's2' }, { key: 'fD', d: '2026-11-06', at: 400, why: 's2' }],
    cuts: [{ key: 'fX', d: '2026-10-21', at: 50, why: 'cut' }, { key: 'fB', d: '2026-10-29', at: 210, why: 'fall' }, { key: 'fA', d: '2026-10-29', at: 220, why: 'fall' }, { key: 'fD', d: '2026-11-06', at: 410, why: 'fall' }, { key: 'fC', d: '2026-11-06', at: 420, why: 'fall' }] });
  const keys = n => n.cuts.map(c => c.key + '@' + c.d).join(',');
  let n, t;
  // 1 two days with two foods off each: the food added the day before goes back, the newest stays off
  n = fixFalls(base()); assert.strictEqual(keys(n), 'fX@2026-10-21,fB@2026-10-29,fD@2026-11-06'); assert.deepStrictEqual(n.fixed, [{ key: 'fA', d: '2026-10-29' }, { key: 'fC', d: '2026-11-06' }]);
  // 2 running it again changes nothing
  const once = clone(n); n = fixFalls(n); assert.deepStrictEqual(n, once);
  // 3 nothing wrong: untouched, and no note
  const fine = base(); fine.cuts = fine.cuts.filter(c => c.key !== 'fA' && c.key !== 'fC'); const fine0 = clone(fine); n = fixFalls(fine); assert.deepStrictEqual(n, fine0); assert.strictEqual(n.fixed, undefined);
  // 4 a food tried again since it came off is left alone (its trial decides); the other day is still repaired
  t = base(); t.tests = [{ key: 'fA', d1: '2026-11-01', res: 'react', route: 'fast' }]; n = fixFalls(t); assert.strictEqual(keys(n), 'fX@2026-10-21,fB@2026-10-29,fA@2026-10-29,fD@2026-11-06'); assert.deepStrictEqual(n.fixed, [{ key: 'fC', d: '2026-11-06' }]);
  // 5 a trial of the food that rightly came off does not block the repair of the other one
  t = base(); t.tests = [{ key: 'fB', d1: '2026-11-01', res: 'none', route: 'fast' }]; n = fixFalls(t); assert.strictEqual(keys(n), 'fX@2026-10-21,fB@2026-10-29,fD@2026-11-06');
  // 6 while a trial is running nothing is touched; once it has a result the repair goes ahead
  t = base(); t.tests = [{ key: 'fX', d1: '2026-11-10', route: 'fast' }]; const t0 = clone(t); n = fixFalls(t); assert.deepStrictEqual(n, t0); t.tests[0].res = 'none'; n = fixFalls(t); assert.strictEqual(keys(n), 'fX@2026-10-21,fB@2026-10-29,fD@2026-11-06');
  // 7 not on the fast route, or no trial: untouched
  for (const mod of [x => { x.route = 'slow'; }, x => { x.route = null; }, x => { x.fast = null; }, x => { x.route = 'log'; }]) { const b = base(); mod(b); const b0 = clone(b); assert.deepStrictEqual(fixFalls(b), b0); }
  // 8 the records of an earlier trial (before this trial's start) are not touched
  t = base(); t.fast.start = '2026-11-01'; n = fixFalls(t); assert.strictEqual(keys(n), 'fX@2026-10-21,fB@2026-10-29,fA@2026-10-29,fD@2026-11-06'); assert.deepStrictEqual(n.fixed, [{ key: 'fC', d: '2026-11-06' }]);
  // 9 no record of what was added: the food that came off first stays off, the later one goes back
  t = base(); t.adds = []; n = fixFalls(t); assert.strictEqual(keys(n), 'fX@2026-10-21,fB@2026-10-29,fD@2026-11-06');
  // 10 the order of the records doesn't matter
  t = base(); t.cuts.reverse(); n = fixFalls(t); assert.strictEqual(keys(n), 'fD@2026-11-06,fB@2026-10-29,fX@2026-10-21');
  // 11 three on one day (never produced, but handled): only the newest stays off
  t = base(); t.adds.push({ key: 'fE', d: '2026-10-29', at: 205, why: 's2' }); t.cuts.push({ key: 'fE', d: '2026-10-29', at: 230, why: 'fall' }); n = fixFalls(t); assert(n.cuts.some(c => c.key === 'fE') && !n.cuts.some(c => c.key === 'fA') && !n.cuts.some(c => c.key === 'fB'));
  // 12 odd data never throws
  for (const bad of [{ route: 'fast', fast: { start: '2026-10-20' } }, { route: 'fast', fast: { start: '2026-10-20' }, cuts: [null, { why: 'fall' }, { why: 'fall', d: '2026-10-29' }, { why: 'fall', d: '2026-10-29' }], adds: [null], tests: [null] }, { route: 'fast', fast: { start: '2026-10-20' }, cuts: 'x' }]) fixFalls(bad);
  // 13 an earlier note is kept and added to
  t = base(); t.fixed = [{ key: 'fZ', d: '2026-10-22' }]; n = fixFalls(t); assert.strictEqual(n.fixed.length, 3);
  cases += 13;
}
console.log(`gut repair: all ${cases} checks passed (13 cases, English and French)`);
