// The Patch: the daily needs for many made-up people, the bands and the nutrient list, against the figures recorded before the
// nutrition rules moved to shared/nutrition.js. Any difference is a change in what someone is told they need.
//   node tests/patch/needs.test.js            check   (needs Playwright with Chromium)
//   node tests/patch/needs.test.js --record   write tests/fixtures/patch-needs.json from the app as it is now
'use strict';
const fs = require('fs'), path = require('path'), { chromium } = require('playwright'), { serve } = require('../lib/serve.js');
const ROOT = path.join(__dirname, '..', '..'), FIX = path.join(__dirname, '..', 'fixtures', 'patch-needs.json');

// the people: every sex and age, weights and work, and each answer that changes a need, alone and together
const people = [];
for (const sex of ['m', 'f', undefined]) for (const age of ['a1', 'a2', 'a3', 'a4', 'minor']) people.push({ p: { sex, age, wt: '70', work: 'feet', life: ['none'] } });
for (const wt of ['55', '70', '90', '115', undefined]) for (const work of ['sit', 'feet', 'heavy', undefined]) people.push({ p: { sex: 'm', age: 'a2', wt, work, life: ['none'] } });
const lives = [['smoke'], ['drink'], ['veg'], ['vegan'], ['preg'], ['bf'], ['preg', 'bf'], ['smoke', 'veg'], ['veg', 'preg'], ['vegan', 'bf'], []];
for (const sex of ['m', 'f', undefined]) for (const life of lives) for (const age of ['a1', 'a3']) people.push({ p: { sex, age, wt: '62', work: 'sit', life } });
// answers from the questionnaire (S.a) that the needs read: pregnancy, breastfeeding, diet, kidney disease, the muscle goal, coffee
const answers = [{ safety: ['preg'] }, { safety: ['bf'] }, { safety: ['preg', 'bf'] }, { safety: ['veg'] }, { safety: ['vegan'] }, { goals: ['muscle'] }, { goals: ['muscle'], safety: ['kidney'] }, { goals: ['muscle'], safety: ['bf'] }, { goals: ['muscle'], safety: ['preg'] }, { fuel: ['coffee', 'smoke'] }];
for (const sex of ['m', 'f']) for (const a of answers) people.push({ p: { sex, age: 'a2', wt: '80', work: 'heavy' }, a });
for (const a of answers) people.push({ p: { sex: 'f', age: 'a2', wt: '80', work: 'heavy', life: ['none'] }, a });

(async () => {
  const srv = await serve(ROOT), browser = await chromium.launch(); let got, errors = [];
  try { const ctx = await browser.newContext({ serviceWorkers: 'block' }), page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(srv.url + '/patch/app/'); await page.waitForFunction(() => typeof tankTargets === 'function');
    got = await page.evaluate(people => {
      const needs = people.map(({ p, a }) => { S.tank.p = JSON.parse(JSON.stringify(p)); S.a = JSON.parse(JSON.stringify(a || {})); return { life: tankLife(), needs: tankTargets() }; });
      const bands = []; for (const k of ['fe', 'na', 'caf', 'sd', 'kcal']) for (const pct of [0, 0.2, 0.25, 0.5, 0.59, 0.6, 0.84, 0.85, 0.99, 1, 1.3, 1.31, 2]) bands.push([k, pct, band(k, pct)]);
      return { needs, bands, nutrients: TN, bandNames: BAND };
    }, people); await ctx.close(); }
  finally { await browser.close(); await srv.close(); }
  if (process.argv.includes('--record')) { fs.writeFileSync(FIX, JSON.stringify(got, null, 1) + '\n'); console.log(`recorded ${got.needs.length} people`); return; }
  const want = JSON.parse(fs.readFileSync(FIX, 'utf8')); let fail = 0, pass = 0;
  const same = (name, g, w) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++; else { fail++; console.log('FAIL ' + name + '\n     got  ' + JSON.stringify(g).slice(0, 600) + '\n     want ' + JSON.stringify(w).slice(0, 600)); } };
  got.needs.forEach((n, i) => same(`needs for ${JSON.stringify(people[i])}`, n, want.needs[i]));
  same('the bands', got.bands, want.bands); same('the nutrient list', got.nutrients, want.nutrients); same('the band names', got.bandNames, want.bandNames); same('no script error', errors, []);
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `patch needs: all ${pass} checks passed (${people.length} people)`); process.exit(fail ? 1 : 0);
})();
