// Runs every test in this folder, one after the other, and says which passed.
//   node tests/run.js               everything (the screen tests need Playwright with Chromium)
//   node tests/run.js --no-browser  only the tests that run on plain Node
//   node tests/run.js --browser     only the tests that drive a browser
const { spawnSync } = require('child_process'), path = require('path');
const TESTS = [
  ['threshold/engine.test.js', false, 'Threshold Log: one check or more for each reading rule'],
  ['gut/repair.test.js', false, 'Food Trial Log: the 13 repair cases, English and French'],
  ['../tools/foods/pack.js', false, 'The Patch and the Food Trial Log hold the foods in data/foods.csv'],
  ['../tools/shared.js', false, 'every app holds the current copy of shared/ (the Nutrition rules)'],
  ['../tools/stamp_cache.js', false, 'every app’s offline cache carries its file’s name', ['--check']],
  ['apps/load.test.js', true, 'every page and app loads, with no script error and no request to another site'],
  ['patch/needs.test.js', true, 'The Patch: the daily needs of 131 made-up people, unchanged'],
  ['gut/one-food.test.js', true, 'Food Trial Log: one food comes off per bad day'],
  ['threshold/import.test.js', true, 'Threshold Log: the import equals the Food Trial Log’s own lists'],
  ['threshold/screens.test.js', true, 'Threshold Log: every screen, both languages, 320 pixels, keyboard, offline'],
  ['threshold/people.test.js', true, 'Threshold Log: two made-up people, six weeks each, every count recounted'],
];
const only = process.argv.includes('--no-browser') ? false : process.argv.includes('--browser') ? true : null; let failed = 0;
for (const [file, browser, what, args] of TESTS) { if (only !== null && browser !== only) continue;
  const t0 = Date.now(), r = spawnSync(process.execPath, [path.join(__dirname, file)].concat(args || []), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || ''), last = out.trim().split('\n').pop() || '';
  if (r.status === 0) console.log(`ok    ${what}  (${last.replace(/^ok\s+/, '')}, ${Math.round((Date.now() - t0) / 1000)} s)`);
  else { failed++; console.log(`FAIL  ${what}\n${out.trim().split('\n').map(l => '      ' + l).join('\n')}`); } }
console.log(failed ? `\n${failed} test file${failed > 1 ? 's' : ''} failed` : '\nall tests passed'); process.exit(failed ? 1 : 0);
