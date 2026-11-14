// Threshold Log data, step 3 of 3: put the food table into the app file, between its DATA markers.
//   node tools/threshold/pack_data.js <out.json from build_data.py>            prints whether the app file already holds this table
//   node tools/threshold/pack_data.js <out.json from build_data.py> --write    writes it into threshold/app/index.html
// After --write, run  node tools/stamp_cache.js  so phones fetch the new file.
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'threshold', 'app', 'index.html'), d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
// one food to a line: [number, name EN, name FR, serving EN, serving FR, group, the Food Trial Log's groups, grams, kcal, protein, fat, carbohydrate,
//   sugars (-1 = not listed), fibre, lactose, alcohol, histamine in mg (-2 = not a histamine food, -1 = no figure), [19 vitamins and minerals], the values with no figure]
const rows = d.foods.map(f => JSON.stringify([f.id, f.n[0], f.n[1], f.s[0], f.s[1], f.grp, f.b.join(' '), f.g, f.kcal, f.prot, f.fat, f.carb, f.sug == null ? -1 : f.sug, f.fib, f.lact, f.alc, f.b.includes('hist') ? (f.hist == null ? -1 : f.hist) : -2, f.m].concat(f.x ? [f.x.join(' ')] : [])));
const table = 'const DATA=[\n' + rows.join(',\n') + '\n];\n';
const html = fs.readFileSync(APP, 'utf8'), a = html.indexOf('const DATA=['), b = html.indexOf('/* DATA:END */');
if (a < 0 || b < 0) { console.error('DATA markers not found in ' + APP); process.exit(1); }
if (html.slice(a, b) === table) { console.log('the app file already holds this table (' + rows.length + ' foods)'); process.exit(0); }
if (!process.argv.includes('--write')) { console.log('the app file holds a different table; run again with --write to replace it'); process.exit(1); }
fs.writeFileSync(APP, html.slice(0, a) + table + html.slice(b)); console.log('wrote ' + rows.length + ' foods into ' + path.relative(process.cwd(), APP));
