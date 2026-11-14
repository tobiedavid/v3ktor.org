// Every app keeps an offline copy of itself under a name made of its version and the first 8 characters of its file's SHA-256.
// After changing an app's index.html, run this so its sw.js carries the new name (phones then fetch the new file):
//   node tools/stamp_cache.js          writes any name that is out of date
//   node tools/stamp_cache.js --check  only reports; exits 1 if one is out of date (the tests run this)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..'), check = process.argv.includes('--check'); let stale = 0;
function apps(dir, out) { for (const n of fs.readdirSync(dir, { withFileTypes: true })) { if (n.name.startsWith('.') || n.name === 'node_modules' || n.name === 'tests' || n.name === 'tools') continue; const p = path.join(dir, n.name);
  if (n.isDirectory()) apps(p, out); else if (n.name === 'sw.js' && /const CACHE='/.test(fs.readFileSync(p, 'utf8')) && fs.existsSync(path.join(dir, 'index.html'))) out.push(dir); } return out; }
for (const dir of apps(root, [])) {
  const sw = path.join(dir, 'sw.js'), src = fs.readFileSync(sw, 'utf8'), html = fs.readFileSync(path.join(dir, 'index.html'));
  const m = /const CACHE='([a-z]+)-([^']*)-([0-9a-f]{8})';/.exec(src), ver = (/\bVER='([^']+)'/.exec(html.toString('utf8')) || [])[1];
  if (!m || !ver) { console.log('?? ' + path.relative(root, sw) + ': no cache name or no version found'); stale++; continue; }
  const want = `${m[1]}-${ver}-${crypto.createHash('sha256').update(html).digest('hex').slice(0, 8)}`, have = `${m[1]}-${m[2]}-${m[3]}`;
  if (want === have) { console.log('ok ' + path.relative(root, sw) + ' ' + have); continue; }
  stale++; if (check) console.log('STALE ' + path.relative(root, sw) + ': has ' + have + ', the file is ' + want);
  else { fs.writeFileSync(sw, src.replace(m[0], `const CACHE='${want}';`)); console.log('stamped ' + path.relative(root, sw) + ' ' + want); }
}
process.exit(check && stale ? 1 : 0);
