// The food table: data/foods.csv is the one source. This writes it into The Patch and the Food Trial Log (English and French).
//   node tools/foods/pack.js           check that each app holds exactly what the CSV gives (exits 1 if not)
//   node tools/foods/pack.js --write   write the CSV's table into the apps
// The Threshold Log reads the CSV itself when it is built (tools/threshold/build.js).
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..'), CSV = path.join(R, 'data', 'foods.csv');
const PATCH = path.join(R, 'patch', 'app', 'index.html'), GUT = path.join(R, 'gut', 'app', 'index.html'), GUTFR = path.join(R, 'gut', 'fr', 'app', 'index.html');

// a CSV reader: quoted cells may hold commas, quotes ("") and line breaks
function readCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift(); return rows.map((r, n) => { if (r.length !== head.length) throw new Error(`foods.csv line ${n + 2}: ${r.length} cells, the header has ${head.length}`); return Object.fromEntries(head.map((h, i) => [h, r[i]])); });
}

// the nutrients per serving, in the order The Patch keeps them; vitamin E is in mg here, and the Food Trial Log shows it in IU (× 1.49)
const NUT = ['kcal', 'prot', 'ca', 'fe', 'mg', 'k', 'na', 'zn', 'd', 'c', 'b1', 'fol', 'b12', 'vk', 'va', 'ret', 'mn', 'caf', 'fib', 'se', 'e', 'b2', 'b3', 'b6', 'sd', 'cu', 'fat', 'lact', 'o3', 'ala'];
const NK = ['prot', 'fib', 'fe', 'mg', 'k', 'b1', 'b2', 'b3', 'b6', 'b12', 'fol', 'zn', 'se', 'cu', 'ca', 'c', 'e', 'd', 'va', 'ret', 'mn', 'vk'];
const GROUPS = ['dairy', 'meat', 'grain', 'proc', 'drink', 'energy', 'alc', 'fruit', 'veg', 'sea', 'sup'], TAGS = ['hist', 'glu', 'swt'];
const plain = s => s.replace(/ /g, ' '), list = s => s.trim() ? s.trim().split(/\s+/) : [];
const THR_MEAS = ['theo', 'nit', 'tyr', 'ox', 'pur', 'sat', 'mono', 'poly', 'frs', 'gluc', 'sucr', 'malt', 'gal', 'fruc', 'sorb', 'mann'];
const THR_PORT = ['ga', 'cap', 'fru', 'gos', 'sulph', 'nitr', 'swt', 'flav', 'glu'], THR_NOFIG = THR_MEAS.concat(THR_PORT, ['caf', 'na']);
const HIST_TYPES = ['beer', 'wine_red', 'wine_white', 'fish', 'sausage', 'ripened_meat', 'meat', 'cheese', 'hard_cheese', 'dairy_other', 'sauce_other', 'veg_fermented'];

function check(f, n) { const where = `foods.csv, ${f.name_en || 'line ' + (n + 2)}`;
  if (!/^\d+$/.test(f.id)) throw new Error(`${where}: the id must be a whole number`);
  if (!GROUPS.includes(f.group)) throw new Error(`${where}: group "${f.group}" is not one of ${GROUPS.join(', ')}`);
  for (const k of ['in_patch', 'in_ftl']) if (!['0', '1'].includes(f[k])) throw new Error(`${where}: ${k} must be 1 or 0`);
  if (!f.name_en || !f.name_fr || !f.serving_en || !f.serving_fr) throw new Error(`${where}: a name and a serving in English and French are needed`);
  for (const k of NUT) if (f[k] !== '' && !(isFinite(+f[k]) && +f[k] >= 0)) throw new Error(`${where}: ${k} must be a number, 0 or more, or blank`);
  if (f.in_patch === '1') { if (f.grams === '' || !(+f.grams >= 0)) throw new Error(`${where}: The Patch needs the serving's grams (0 for a pill or a label food)`); for (const k of NUT) if (f[k] === '') throw new Error(`${where}: The Patch needs ${k} (0 if none; list it under lack if the file has no figure)`); }
  if (f.in_ftl === '1') { if (!/^[0-4]$/.test(f.ftl_mark)) throw new Error(`${where}: ftl_mark must be 0 to 4`); for (const k of NK) if (f[k] === '') throw new Error(`${where}: the Food Trial Log needs ${k}`); }
  for (const g of list(f.also_groups)) if (!GROUPS.includes(g)) throw new Error(`${where}: also_groups lists "${g}", which is not a group`);
  if (!['', '1'].includes(f.label)) throw new Error(`${where}: label is 1 (values from a product label) or blank`);
  for (const t of list(f.tags)) if (!TAGS.includes(t)) throw new Error(`${where}: tag "${t}" is not one of ${TAGS.join(', ')}`);
  for (const k of list(f.lack)) if (!NUT.includes(k)) throw new Error(`${where}: lack lists "${k}", which is not a nutrient column`);
  // the Threshold Log's columns (in_threshold): amounts per serving, as for the rest
  if (!['0', '1'].includes(f.in_threshold)) throw new Error(`${where}: in_threshold must be 1 or 0`);
  for (const k of ['carb', 'sug', 'alc', 'hist'].concat(THR_MEAS)) if (f[k] !== '' && !(isFinite(+f[k]) && +f[k] >= 0)) throw new Error(`${where}: ${k} must be a number, 0 or more, or blank`);
  for (const k of list(f.portions)) if (!THR_PORT.includes(k)) throw new Error(`${where}: portions lists "${k}", which is not one of ${THR_PORT.join(', ')}`);
  for (const k of list(f.no_figure)) if (!THR_NOFIG.includes(k)) throw new Error(`${where}: no_figure lists "${k}", which is not one of ${THR_NOFIG.join(', ')}`);
  if (f.hist_type && !HIST_TYPES.includes(f.hist_type)) throw new Error(`${where}: hist_type "${f.hist_type}" is not one of ${HIST_TYPES.join(', ')}`);
  if (f.in_threshold === '1') { if (!['hc', 'label', 'none'].includes(f.src)) throw new Error(`${where}: src must be hc, label or none`);
    if (f.src !== 'none') { for (const k of ['grams', 'kcal', 'prot', 'fat', 'fib', 'lact', 'alc', 'carb', 'ca', 'fe', 'mg', 'k', 'zn', 'c', 'b1', 'b2', 'b3', 'b6', 'fol', 'b12', 'd', 'vk', 'va', 'mn', 'cu', 'e', 'se']) if (f[k] === '') throw new Error(`${where}: the Threshold Log needs ${k}`);
      if (f.sug !== '' && +f.lact > +f.sug + 1e-9) throw new Error(`${where}: more lactose than sugars`);
      if (+f.lact > Math.max(0, +f.carb - +f.fib) + 1e-9) throw new Error(`${where}: more lactose than carbohydrate (less fibre)`); } } }

function tables(rows) {
  const ids = new Set(); rows.forEach((f, n) => { check(f, n); if (ids.has(f.id)) throw new Error(`foods.csv: id ${f.id} is there twice`); ids.add(f.id); });
  const TF = rows.filter(f => f.in_patch === '1').map(f => { const o = { id: +f.id, g: +f.grams, grp: f.group, l: [f.name_en, f.name_fr], s: [f.serving_en, f.serving_fr], n: {} };
    for (const k of NUT) o.n[k] = +f[k];
    o.cnf = f.cnf_name; o.lack = list(f.lack);
    if (list(f.also_groups).length) o.also = list(f.also_groups);
    if (f.label === '1') o.label = true;
    if (list(f.tags).length) o.tags = list(f.tags);
    if (f.fill.trim()) o.fill = Object.fromEntries(f.fill.split('\n').map(l => { const i = l.indexOf(': '); return [l.slice(0, i), l.slice(i + 2)]; }));
    return o; });
  const fd = fr => rows.filter(f => f.in_ftl === '1').map(f => { const r = [+f.id, fr ? (f.ftl_name_fr || plain(f.name_fr)) : (f.ftl_name_en || plain(f.name_en)), fr ? (f.ftl_serving_fr || plain(f.serving_fr)) : (f.ftl_serving_en || plain(f.serving_en)),
      f.group, +f.ftl_mark, f.ftl_gut_groups, NK.map(k => k === 'e' ? Math.round(+f.e * 1.49 * 1000) / 1000 : +f[k])];
    if (list(f.lack).length) r.push(list(f.lack)); return r; });
  return { TF, FD: fd(false), FR: fd(true), thr: rows.filter(f => f.in_threshold === '1').length };
}

// where each table sits in its app file
const patchText = (src, TF) => src.replace(/^const TF=.*$/m, () => 'const TF=' + JSON.stringify(TF) + ';');
function gutText(src, FD) {
  const a = src.indexOf('\nconst FD=[\n') + '\nconst FD=[\n'.length, b = src.indexOf('\n];', a);
  const merged = '/* v1.2.0: merged foods (values from the rows they replace, per 100 g), and everyday items with no values yet (the nutrient they would change shows as unknown) */';
  const lines = []; FD.forEach((r, i) => { if (r[0] >= 920000 && !(FD[i - 1] && FD[i - 1][0] >= 920000)) lines.push(merged); lines.push(JSON.stringify(r) + (i < FD.length - 1 ? ',' : '')); });
  return src.slice(0, a) + lines.join('\n') + src.slice(b);
}

if (require.main !== module) { module.exports = { readCsv, CSV }; return; }
let T; try { T = tables(readCsv(fs.readFileSync(CSV, 'utf8'))); } catch (e) { console.log(e.message); process.exit(2); }
const out = [[PATCH, s => patchText(s, T.TF), T.TF.length], [GUT, s => gutText(s, T.FD), T.FD.length], [GUTFR, s => gutText(s, T.FR), T.FR.length]];
let off = 0;
for (const [file, make, n] of out) { const src = fs.readFileSync(file, 'utf8'), want = make(src), name = path.relative(R, file);
  if (src === want) { console.log(`${name}: holds the CSV's ${n} foods`); continue; }
  if (process.argv.includes('--write')) { fs.writeFileSync(file, want); console.log(`${name}: written, ${n} foods`); } else { console.log(`${name}: differs from data/foods.csv; run node tools/foods/pack.js --write`); off++; } }
console.log(`data/foods.csv: ${T.TF.length} foods in The Patch, ${T.FD.length} in the Food Trial Log, ${T.thr} in the Threshold Log`);
process.exit(off ? 1 : 0);
