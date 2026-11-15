// Every page and every app on the site: it loads, runs no script error, asks nothing of another site, every file it asks for exists,
// every link to another page of the site leads somewhere, and every app's offline cache carries the name of the file it holds.
//   node tests/apps/load.test.js      (needs Playwright with Chromium)
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process'), { chromium } = require('playwright'), { serve } = require('../lib/serve.js');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (detail ? '\n     ' + String(detail).slice(0, 700) : '')); } }
// every folder that holds an index.html is a page of the site
function pages(dir, out) { for (const n of fs.readdirSync(dir, { withFileTypes: true })) { if (n.name.startsWith('.') || ['node_modules', 'tests', 'tools', 'docs'].includes(n.name)) continue; const p = path.join(dir, n.name); if (n.isDirectory()) pages(p, out); else if (n.name === 'index.html') out.push('/' + path.relative(ROOT, dir).split(path.sep).join('/') + (dir === ROOT ? '' : '/')); } return out; }
// Sollum asks for a word list beside it and carries on with its own when the site serves none: that one missing file is by design
const OPTIONAL = ['/sollum/app/words.json'];
const status = url => new Promise(res => http.get(url, r => { r.resume(); res(r.statusCode); }).on('error', () => res(0)));

(async () => {
  const srv = await serve(ROOT), base = srv.url, browser = await chromium.launch(), list = pages(ROOT, []).sort().concat(['/404.html']);
  ok('the site has the pages it is known to have', ['/', '/gut/', '/gut/app/', '/gut/fr/', '/gut/fr/app/', '/patch/', '/patch/app/', '/sollum/', '/sollum/app/', '/threshold/', '/threshold/app/', '/threshold/how-soon/'].every(p => list.includes(p)), list.join(' '));
  try { const links = new Map();
    for (const p of list) for (const lang of ['en-CA', 'fr-CA']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: lang, serviceWorkers: 'block' }), page = await ctx.newPage(), errors = [], outside = [], missing = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
      page.on('request', r => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); }); page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base) && !OPTIONAL.includes(r.url().slice(base.length))) missing.push(r.status() + ' ' + r.url().slice(base.length)); });
      await page.goto(base + p, { waitUntil: 'load' }); await page.waitForTimeout(300);
      const T = `${p} (${lang.slice(0, 2)}) `;
      ok(T + 'loads with something on it', (await page.evaluate(() => document.body.innerText.trim().length)) > 40);
      ok(T + 'no script error', !errors.length, errors.join(' | ')); ok(T + 'no request to another site', !outside.length, outside.join(' | ')); ok(T + 'every file it asks for exists', !missing.length, missing.join(' | '));
      for (const h of await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.href))) { if (h.startsWith(base)) { const u = h.split('#')[0]; if (!links.has(u)) links.set(u, p); } }
      await ctx.close(); }
    for (const [u, from] of links) { const s = await status(u); ok(`the link to ${u.slice(base.length)} (on ${from}) leads somewhere`, s === 200 || s === 301, 'status ' + s); }
  } catch (e) { fail++; console.log('STOPPED: ' + (e.stack || e)); }
  await browser.close(); await srv.close();
  // the offline caches
  let out = ''; try { out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'stamp_cache.js'), '--check'], { encoding: 'utf8' }); ok('every app’s offline cache carries its file’s name', true); } catch (e) { out = String(e.stdout || e); ok('every app’s offline cache carries its file’s name', false, out); }
  ok('five apps keep an offline copy', (out.match(/^ok /gm) || []).length === 5, out);
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `apps: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
})();
