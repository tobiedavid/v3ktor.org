// The pieces every V3KTOR food app shares live in shared/. Each app holds a copy of each piece it uses, between the piece's own first
// and last comment lines, so it stays one file that works offline. This keeps the copies the same.
//   node tools/shared.js           check that every app holds the current copy (exits 1 if not)
//   node tools/shared.js --write   copy shared/ into the apps
'use strict';
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const USES = { 'patch/app/index.html': ['nutrition.js'] };
let off = 0;
for (const [app, pieces] of Object.entries(USES)) { const file = path.join(R, app); let src = fs.readFileSync(file, 'utf8'); const was = src;
  for (const piece of pieces) { const text = fs.readFileSync(path.join(R, 'shared', piece), 'utf8').replace(/\n+$/, '');
    const head = `/* ==== shared/${piece}`, tail = `/* ==== end of shared/${piece} ==== */`, a = src.indexOf(head), b = src.indexOf(tail);
    if (a < 0 || b < a || src.indexOf(head, a + 1) >= 0) { console.log(`${app}: no single place for shared/${piece} (its first and last comment lines)`); off++; continue; }
    src = src.slice(0, a) + text + src.slice(b + tail.length); }
  if (src === was) { console.log(`${app}: holds the current ${pieces.join(', ')}`); continue; }
  if (process.argv.includes('--write')) { fs.writeFileSync(file, src); console.log(`${app}: written`); } else { console.log(`${app}: holds an old copy of shared/; run node tools/shared.js --write`); off++; } }
process.exit(off ? 1 : 0);
