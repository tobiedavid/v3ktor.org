// Threshold Log: puts the parts in src/ together into the one file that ships, threshold/app/index.html, with the shared pieces from
// shared/ (as tools/shared.js puts them in every app).
//   node tools/threshold/build.js            check that threshold/app/index.html is what src/ builds (exits 1 if not)
//   node tools/threshold/build.js --write    write it
//   node tools/threshold/build.js <file>     write the build somewhere else
// The food table comes from data/foods.csv: the rows marked in_threshold (data/README.md says what each column holds).
//   node tools/threshold/build.js --json     the food table as the app holds it, as JSON
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..'), APP = path.join(R, 'threshold', 'app', 'index.html');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/\s+$/, '') + '\n';
// the food table, from data/foods.csv: the rows marked in_threshold, in their order
const { readCsv, CSV } = require(path.join(R, 'tools', 'foods', 'pack.js'));
const MICRO = ['ca', 'fe', 'mg', 'k', 'zn', 'c', 'b1', 'b2', 'b3', 'b6', 'fol', 'b12', 'd', 'vk', 'va', 'mn', 'cu', 'e', 'se'];
const MEAS = ['theo', 'nit', 'sat', 'mono', 'poly', 'frs', 'gluc', 'sucr', 'malt', 'gal', 'fruc'], MEAS2 = ['sorb', 'mann', 'tyr'], PORT = ['ga', 'cap', 'fru', 'gos', 'sulph', 'nitr', 'swt', 'glu', 'flav'];
const plain = t => t.replace(/ /g, ' '), list = t => t.trim() ? t.trim().split(/\s+/) : [], n = t => t === '' ? 0 : +t;
function food(r) { const none = r.src === 'none', x = list(r.lack).filter(k => MICRO.includes(k) || k === 'fib').concat(list(r.no_figure)), b = list(r.ftl_gut_groups);
  const f = { id: +r.id, n: [r.ftl_name_en || plain(r.name_en), r.ftl_name_fr || plain(r.name_fr)], s: [r.ftl_serving_en || plain(r.serving_en), r.ftl_serving_fr || plain(r.serving_fr)], grp: r.group, b,
    g: none ? 0 : n(r.grams), kcal: none ? 0 : n(r.kcal), prot: none ? 0 : n(r.prot), fat: none ? 0 : n(r.fat), fib: none ? 0 : n(r.fib), lact: none ? 0 : n(r.lact), alc: none ? 0 : n(r.alc), carb: none ? 0 : n(r.carb),
    sug: none ? 0 : r.sug === '' ? null : +r.sug, src: r.src, m: MICRO.map(k => k === 'e' ? Math.round(n(r.e) * 1.49 * 1000) / 1000 : n(r[k])), c: {} };
  const put = (k, v) => { if (v > 0) f.c[k] = v; };
  put('caf', n(r.caf)); for (const k of MEAS) put(k, n(r[k])); if (!x.includes('na')) put('na', n(r.na));
  const se = f.m[MICRO.indexOf('se')]; if (!x.includes('se')) put('se', Math.round(se * 10) / 10);
  for (const k of MEAS2) put(k, n(r[k])); for (const k of PORT) if (list(r.portions).includes(k)) f.c[k] = 1; put('ox', n(r.ox)); put('pur', n(r.pur));
  if (x.length) f.x = x;
  if (b.includes('hist')) { f.hist = r.hist === '' ? null : +r.hist; if (r.hist_type) f.hcat = r.hist_type; }
  return f; }
const d = { micro: MICRO, foods: readCsv(fs.readFileSync(CSV, 'utf8')).filter(r => r.in_threshold === '1').map(food) };
const rows = d.foods.map(f => JSON.stringify([f.id, f.n[0], f.n[1], f.s[0], f.s[1], f.grp, f.b.join(' '), f.g, f.kcal, f.prot, f.fat, f.carb, f.sug == null ? -1 : f.sug, f.fib, f.lact, f.alc, f.b.includes('hist') ? (f.hist == null ? -1 : f.hist) : -2, f.m].concat(Object.keys(f.c).length ? [f.x ? f.x.join(' ') : '', f.c] : f.x ? [f.x.join(' ')] : [])));
if (process.argv[2] === '--json') { process.stdout.write(JSON.stringify(d)); process.exit(0); }
const data = `/* DATA:START */
/* The food table: ${d.foods.length} foods, the rows of data/foods.csv marked in_threshold (data/README.md says where each figure comes from).
   [number, name EN, name FR, serving EN, serving FR, group, the Food Trial Log's groups, grams, kcal, protein, fat, carbohydrate,
    sugars (-1 = not listed), fibre, lactose, alcohol, histamine in mg (-2 = not a histamine food, -1 = no figure),
    [calcium, iron, magnesium, potassium, zinc, C, B1, B2, B3, B6, folate, B12, D, K, A, manganese, copper, E, selenium],
    the values with no figure, if any,
    what else it carries, per serving: caffeine, theobromine, nitrate, tyramine, sodium, oxalate and purines in mg; selenium in µg; the kinds of fat
    and sugar, sorbitol, mannitol and excess fructose in g; 1 = a portion of it, where no figure is entered] */
const DATA=[
${rows.join(',\n')}
];
/* DATA:END */
`;
let built = src('shell_head.html') + src('style.css') + src('shell_mid.html') + data + '/* ENGINE:START */\n' + src('engine.js') + '/* ENGINE:END */\n' + src('app_a.js') + src('app_b.js') + src('app_c.js') + src('shell_tail.html');
for (const piece of ['nutrition.css', 'nutrition.js']) { const head = `/* ==== shared/${piece}`, tail = `/* ==== end of shared/${piece} ==== */`, a = built.indexOf(head), b = built.indexOf(tail);
  if (a < 0 || b < a) throw new Error('no place for shared/' + piece); built = built.slice(0, a) + fs.readFileSync(path.join(R, 'shared', piece), 'utf8').replace(/\n+$/, '') + built.slice(b + tail.length); }
const arg = process.argv[2];
if (arg && arg !== '--write') { fs.mkdirSync(path.dirname(arg), { recursive: true }); fs.writeFileSync(arg, built); console.log(arg, built.length, 'bytes'); }
else if (arg === '--write') { fs.writeFileSync(APP, built); console.log('threshold/app/index.html: written,', built.split('\n').length, 'lines'); }
else if (fs.readFileSync(APP, 'utf8') === built) console.log('threshold/app/index.html: what tools/threshold/src builds');
else { console.log('threshold/app/index.html differs from what tools/threshold/src builds; run node tools/threshold/build.js --write'); process.exit(1); }
