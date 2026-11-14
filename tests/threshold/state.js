// Builds the data the app would hold after one of the made-up people's six weeks, without tapping through them.
// The walkthrough test (people.test.js) proves that tapping gives this same data; the other tests start from it to save time.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const O = require('./oracle.js'), P = require('./people.js');
function engine() { const src = fs.readFileSync(O.APP, 'utf8'), a = src.indexOf('/* ENGINE:START */'), b = src.indexOf('/* ENGINE:END */'); const box = { module: { exports: {} } }; vm.runInNewContext(src.slice(a, b) + '\n;module.exports=TLE;', box); return box.module.exports; }
function build(person, table, lang) {
  const want = P.expected(person, table); let n = 0;
  const custom = person.labels.map((l, i) => ({ id: 'c' + (i + 1), n: l.n, s: l.s, kcal: l.kcal, fat: l.fat, carb: l.carb, fib: l.fib, sug: l.sug, prot: l.prot, lact: l.lact || 0, h: !!l.h }));
  const key = ref => typeof ref === 'number' ? 'f' + ref : 'L' + custom.find(c => c.n === ref).id;
  const ev = want.map(e => e.k === 'meal' ? { id: 'm' + (++n), k: 'meal', t: e.t, items: e.items.map(i => ({ key: key(i.ref), q: i.q })) } : e.k === 'fx' ? { id: 'x' + (++n), k: 'fx', t: e.t, c: e.c } : { id: 'n' + (++n), k: 'none', d: e.d, t: O.dayBegins(O.dayPlus(e.d, 1), person.roll) - 60000 }).sort((a, b) => a.t - b.t);
  const own = { phys: [], psy: [] }; for (const a of person.plan) for (const o of a.own || []) if (!own[o.tab].includes(o.word)) own[o.tab].push(o.word);
  let list = [], imp = null, p = {}, gut = null;
  if (person.gut) { gut = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', person.gut), 'utf8')); const r = engine().importGut(gut.state);
    list = r.list.map(x => x.key).concat(person.listAdd.map(key)); imp = { at: new Date(person.start).toISOString(), from: 'phone', saved: null, out: r.out, aside: r.aside, fine: r.fine }; p = { sex: r.p.sex === 'm' || r.p.sex === 'f' ? r.p.sex : undefined, age: r.p.age || undefined, life: r.p.life || [] }; }
  const concl = {}; for (const a of person.plan) if (a.do === 'conclusions') { concl[a.bar] = a.text; concl['food:' + key(a.food)] = a.text; }
  return { state: { v: 1, lang, ack: true, ackAt: new Date(person.start).toISOString(), cv: 1, roll: person.roll, p, list, amt: {}, imp, custom, ev, own, concl, tab: 'home', per: 'today', nper: 'week', tmode: 'meal', bkAt: null }, gut, want, key };
}
module.exports = { build, engine };
