// Threshold Log: puts the parts in src/ together into the one file that ships, threshold/app/index.html, with the shared pieces from
// shared/ (as tools/shared.js puts them in every app).
//   node tools/threshold/build.js            check that threshold/app/index.html is what src/ builds (exits 1 if not)
//   node tools/threshold/build.js --write    write it
//   node tools/threshold/build.js <file>     write the build somewhere else
// The food table, src/data.json, is made by dump_tables.js, build_data.py and add_compounds.py (threshold/README.md).
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..'), APP = path.join(R, 'threshold', 'app', 'index.html');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/\s+$/, '') + '\n';
const d = JSON.parse(src('data.json'));
const rows = d.foods.map(f => JSON.stringify([f.id, f.n[0], f.n[1], f.s[0], f.s[1], f.grp, f.b.join(' '), f.g, f.kcal, f.prot, f.fat, f.carb, f.sug == null ? -1 : f.sug, f.fib, f.lact, f.alc, f.b.includes('hist') ? (f.hist == null ? -1 : f.hist) : -2, f.m].concat(f.c && Object.keys(f.c).length ? [f.x ? f.x.join(' ') : '', f.c] : f.x ? [f.x.join(' ')] : [])));
const data = `/* DATA:START */
/* The food table: ${d.foods.length} foods, from the Food Trial Log’s table. Names, servings, groups and the 19 vitamins and minerals are its own (The Patch's table:
   Canadian Nutrient File 2015, blanks from USDA SR28, vitamins D and E in IU). Energy, protein, fat, carbohydrate, sugars, fibre and alcohol are
   Health Canada's, per serving; lactose is The Patch's. The histamine estimate is the serving's weight times the average for its food type in
   EFSA Journal 2011;9(10):2393, Table 10. Made by tools/threshold/build_data.py.
   [number, name EN, name FR, serving EN, serving FR, group, the Food Trial Log's groups, grams, kcal, protein, fat, carbohydrate,
    sugars (-1 = not listed), fibre, lactose, alcohol, histamine in mg (-2 = not a histamine food, -1 = no figure),
    [calcium, iron, magnesium, potassium, zinc, C, B1, B2, B3, B6, folate, B12, D, K, A, manganese, copper, E, selenium],
    the values with no figure, if any,
    what else it carries, per serving: caffeine, theobromine, nitrate, tyramine and sodium in mg; selenium in µg; the kinds of fat and sugar,
    sorbitol, mannitol and excess fructose in g; 1 = a portion of it, where no figure is entered (tools/threshold/add_compounds.py)] */
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
