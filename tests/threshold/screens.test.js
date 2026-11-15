// Threshold Log: every screen and every sheet, in English and in French, on a 320-pixel phone, with both made-up people's six weeks loaded.
// Checks the words (the app reports and never interprets), French punctuation, that nothing runs off the screen, the keyboard, offline use,
// the door, a day turning over while the app sits open, and what happens when the saved data can't be read.
//   node tests/threshold/screens.test.js      (needs Playwright with Chromium)
'use strict';
const { ZONE } = require('../lib/zone.js');
const fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const { serve } = require('../lib/serve.js'), O = require('./oracle.js'), P = require('./people.js'), { build } = require('./state.js');
const ROOT = path.join(__dirname, '..', '..'), KEY = 'v3k.threshold.v1';

let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (detail ? '\n     ' + String(detail).slice(0, 600) : '')); } }
const same = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), 'got  ' + JSON.stringify(got) + '\n     want ' + JSON.stringify(want));

// words the app never puts on a screen, in either language: it shows a count, and the person draws the conclusion
const word = list => new RegExp('(?<![\\p{L}\\p{N}])(' + list.join('|') + ')(?![\\p{L}\\p{N}])', 'iu');
const BAN = { en: word(['causes?', 'caused', 'causing', 'triggers?', 'triggered', 'triggering', 'safe', 'safely', 'safer', 'unsafe', 'should', 'shouldn’t', 'avoid', 'avoids', 'avoided', 'avoiding', 'cut', 'cuts', 'cutting', 'too much', 'too little', 'deficient', 'deficiency', 'targets?', 'suspects?', 'suspected', 'good days?', 'bad days?', 'costs?']),
  fr: word(['causes?', 'causée?s?', 'causer', 'déclenche', 'déclenchent', 'déclenchée?s?', 'déclencheurs?', 'sûre?s?', 'sécuritaires?', 'devrais', 'devrait', 'devriez', 'dois', 'doit', 'évite', 'éviter', 'évitez', 'coupe', 'couper', 'coupée?s?', 'trop', 'carences?', 'déficiente?s?', 'cibles?', 'objectifs?', 'suspecte?s?', 'bonnes? journées?', 'mauvaises? journées?', 'coûts?', 'coûte']) };
const DOOR_ONLY = { en: /allerg|medicine|medication|eating disorder/i, fr: /allerg|médicament|trouble alimentaire/i };       // the only place these are mentioned is the door
const OTHER_LANG = { en: word(['repas', 'effets?', 'aliments?', 'journée', 'aujourd’hui', 'hier', 'avec', 'fermer', 'terminé', 'enregistrer', 'chercher', 'retirer', 'semaine', 'mois', 'noté', 'jusqu’à']),
  fr: word(['the', 'and', 'your', 'meals?', 'effects?', 'reported', 'days?', 'foods?', 'with', 'from', 'close', 'done', 'save', 'remove', 'search', 'today', 'yesterday', 'week', 'month', 'up to', 'none']) };
const BROKEN = /undefined|NaN|\[object|(?<![\p{L}])null(?![\p{L}])/u;

async function open(browser, base, o) {
  const ctx = await browser.newContext({ viewport: { width: o.width || 390, height: 760 }, locale: o.lang === 'fr' ? 'fr-CA' : 'en-CA', timezoneId: o.zone || ZONE, reducedMotion: 'reduce', serviceWorkers: o.sw ? 'allow' : 'block' });
  if (o.clip) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await ctx.newPage(), errors = [], outside = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('request', r => { if (!r.url().startsWith(base)) outside.push(r.url()); });
  if (o.now) await page.clock.setFixedTime(o.now);
  if (o.font) await page.addInitScript(f => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'html,body{font-family:"' + f + '",sans-serif!important}'; document.head.appendChild(s); }); }, o.font);
  const seed = Object.assign({}, o.store || {}); if (o.state) seed[KEY] = JSON.stringify(o.state);
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { for (const k of Object.keys(s)) localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded', '1'); } }, seed);
  await page.goto(base + '/threshold/app/' + (o.query || '')); await page.waitForSelector('#topbar .in');
  return { ctx, page, errors, outside, S: () => page.evaluate(() => JSON.parse(JSON.stringify(S))) };
}

(async () => {
  const table = O.loadTable(), srv = await serve(ROOT), base = srv.url, browser = await chromium.launch();
  const people = { steady: P.steady(), varied: P.varied(table) };
  try {
    // ================= every screen, both people, both languages, 320 pixels wide =================
    // each tour once in the machine's own font and once in a wide one: phones differ, and so does the machine that runs these tests
    for (const [who, lang, font] of [['steady', 'en'], ['steady', 'fr'], ['varied', 'en'], ['varied', 'fr'], ['steady', 'en', 'DejaVu Sans'], ['steady', 'fr', 'DejaVu Sans'], ['varied', 'en', 'DejaVu Sans'], ['varied', 'fr', 'DejaVu Sans']]) {
      const person = people[who], B = build(person, table, lang), T = `[${who}, ${lang}${font ? ', wide font' : ''}] `, names = Object.values(table).map(f => lang === 'fr' ? f.fr : f.en).concat(Object.values(table).map(f => lang === 'fr' ? f.servFr : f.servEn));
      const theirs = person.labels.map(l => l.n).concat(person.labels.map(l => l.s), [...B.state.own.phys, ...B.state.own.psy], Object.values(B.state.concl), ['Threshold Log', 'Food Trial Log', 'The Patch', 'Ask AI', 'EFSA Journal', 'Scientific Opinion on risk based control of biogenic amine formation in fermented foods', 'Canadian Nutrient File', 'Open Government Licence – Canada', 'GNU Affero General Public License', 'Made by Tobie and Claude']);
      // the table's food names and servings, the person's own words and the proper names are not the app's words: they are taken out before the checks
      const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), longest = (a, b) => b.length - a.length;
      const strip = t => { for (const n of names.filter(n => n && n.length >= 4).sort(longest)) t = t.split(n).join('§'); for (const n of theirs.filter(Boolean).sort(longest)) t = t.replace(new RegExp(esc(n), 'gi'), '§'); return t; };
      const A = await open(browser, base, { state: B.state, now: person.now, lang, width: 320, font, store: B.gut ? { [B.gut.key]: JSON.stringify(B.gut.state) } : {} }), page = A.page; let seen = 0;
      const visit = async name => { seen++;
        const r = await page.evaluate(() => { const sheet = document.getElementById('sheet'), on = sheet.classList.contains('on'), parts = on ? [sheet] : ['topbar', 'app', 'bar'].map(id => document.getElementById(id)), all = sel => [].concat(...parts.map(p => [...p.querySelectorAll(sel)]));
          const attrs = all('[aria-label],[placeholder],[title]').map(e => [e.getAttribute('aria-label'), e.getAttribute('placeholder'), e.getAttribute('title')].filter(Boolean).join(' ')).join('\n');
          const nameless = all('button,a[href],input:not([type=file]),select,textarea').filter(e => e.offsetParent !== null && !((e.textContent || '').trim() || e.getAttribute('aria-label') || (e.id && document.querySelector('label[for="' + e.id + '"]')) || e.closest('label'))).map(e => e.outerHTML.slice(0, 90));
          const wide = [...(on ? sheet : document.getElementById('app')).querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1) && !e.closest('.vh') && !e.closest('[hidden]'); }).slice(0, 3).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right));
          const copied = on && sheet.querySelector('[data-act=aicopy]') ? sheet.querySelector('textarea').value : '';      // the text Ask AI copies is checked like a screen
          return { text: (on ? sheet.innerText : [document.getElementById('topbar').innerText, document.getElementById('app').innerText, document.getElementById('bar').innerText].join('\n')) + '\n' + attrs + '\n' + copied, over: document.documentElement.scrollWidth - innerWidth, sheetOver: on ? sheet.scrollWidth - sheet.clientWidth : 0, nameless, wide }; });
        const t = strip(r.text), bad = BAN[lang].exec(t), door = name === 'door' ? null : DOOR_ONLY[lang].exec(t), other = OTHER_LANG[lang].exec(t), broke = BROKEN.exec(t);
        ok(T + name + ': none of the words the app never uses', !bad, bad && '“' + bad[0] + '” in: …' + t.slice(Math.max(0, bad.index - 70), bad.index + 50).replace(/\n/g, ' ') + '…');
        ok(T + name + ': allergy, medicine and eating disorders are named only at the door', !door, door && door[0]);
        { const lucky = /luck alone gives|hasard seul donne|times? in \d|fois sur \d/i.exec(t); ok(T + name + ': no number is put on luck', !lucky, lucky && '“' + lucky[0] + '” in: …' + t.slice(Math.max(0, lucky.index - 70), lucky.index + 50).replace(/\n/g, ' ') + '…'); }
        ok(T + name + ': all of it is in ' + (lang === 'fr' ? 'French' : 'English'), !other, other && '“' + other[0] + '” in: …' + t.slice(Math.max(0, other.index - 70), other.index + 50).replace(/\n/g, ' ') + '…');
        ok(T + name + ': no broken value on screen', !broke, broke && t.slice(Math.max(0, broke.index - 60), broke.index + 40));
        if (lang === 'fr') { const p1 = /[ \t][:;?!]/.exec(t), p2 = /«[^ ]|[^ ]»/.exec(t);
          ok(T + name + ': French punctuation, no plain space before : ; ? !', !p1, p1 && t.slice(Math.max(0, p1.index - 50), p1.index + 20)); ok(T + name + ': French punctuation, a non-breaking space inside « »', !p2, p2 && t.slice(Math.max(0, p2.index - 30), p2.index + 30)); }
        ok(T + name + ': nothing runs off a 320-pixel screen', r.over <= 1 && r.sheetOver <= 1 && !r.wide.length, `page ${r.over}px, sheet ${r.sheetOver}px, ${r.wide.join(' | ')}`);
        ok(T + name + ': every control has a name', !r.nameless.length, r.nameless.join(' | ')); };
      const tap = sel => page.click(sel), shut = () => page.click('#sheet [data-act=close]'), slide = async h => { await page.focus('#tWin'); await page.keyboard.press('Home'); for (let i = 1; i < h; i++) await page.keyboard.press('ArrowRight'); };
      for (const per of ['h4', 'today', 'week', 'month']) { await tap(`[data-act=per][data-v=${per}]`); await visit('Home, ' + per); }
      await tap('.fxbar'); await visit('effects sheet'); await shut(); { const oc = page.locator('#app [data-act=comps]'); if (await oc.count()) { await oc.click(); await visit('other compounds'); const cp = page.locator('#sheet [data-act=comp]'); if (await cp.count()) { await cp.first().click(); await visit('a compound'); const hi = page.locator('#sheet [data-act=histinfo]'); if (await hi.count()) { await hi.click(); await visit('histamine sheet'); } } await shut(); } }
      await page.evaluate(() => { UI.cp = 'flav'; compSheet(); }); await visit('the flavourings sheet'); await page.evaluate(() => { UI.lb = {}; labelSheet(); }); await tap('#sheet [data-act=lbflav]'); await visit('the flavourings sheet, from the label form'); await shut();
      await tap('.mb.meal'); await visit('meal'); for (const g of ['recent', 'dairy', 'sup', 'proc', 'label']) { const b = page.locator(`#mTabs [data-act=mgrp][data-v=${g}]`); if (await b.count()) { await b.click(); await visit('meal, ' + g); } }
      await page.fill('#mQ', 'zzzz'); await visit('meal, a search with no match'); await page.fill('#mQ', lang === 'fr' ? 'lait' : 'milk'); await tap('#mRows .stp.plus'); await visit('meal, a search with a pick'); await tap('#bar [data-act=back]');
      await tap('.mb.fx'); await visit('effect, physical'); await tap('#sheet [data-act=fxtab][data-v=psy]'); await visit('effect, psychological'); await shut();
      await tap('[data-act=tab][data-v=nut]'); for (const per of ['today', 'week', 'month']) { await tap(`[data-act=nper][data-v=${per}]`); await visit('Nutrition, ' + per); } await tap('details.note summary'); await visit('Nutrition, the reference questions');
      if (B.gut) { await tap('[data-act=impread]'); await visit('import, confirm'); await shut(); const rej = page.locator('#app [data-act=foodrd]'); if (await rej.count()) { await rej.first().click(); await visit('one food, rejected in the Food Trial Log'); await shut(); } }
      await tap('[data-act=tab][data-v=thr]'); for (const mode of ['meal', 'day']) { await tap(`[data-act=tmode][data-v=${mode}]`); await visit('Threshold, ' + mode);
        if (mode === 'meal') { await slide(1); await visit('Threshold, meal, the slider at 1 hour'); await slide(8); await visit('Threshold, meal, the slider at 8 hours'); }
        const fx = page.locator('.fxpick [data-act=tfx]'); if (await fx.count() > 1) { await fx.nth(1).click(); await visit('Threshold, ' + mode + ', one effect'); if (await fx.count() > 2) { await fx.nth(2).click(); await visit('Threshold, ' + mode + ', two effects together'); await tap('#allAny [data-v="0"]'); await visit('Threshold, ' + mode + ', any of two effects'); await tap('#allAny [data-v="1"]'); } await fx.first().click(); }
        const ln = page.locator('#app [data-act=rowsheet][data-k=lact]'); if (await ln.count()) { await ln.click(); const st = page.locator('#sheet [data-act=rstep]'); if (await st.count()) await st.last().click(); await visit('a line, ' + mode); await shut(); } }
      const chip = page.locator('#tqRows [data-act=foodrd]'); if (await chip.count()) { await chip.first().click(); const f = page.locator('#sheet [data-act=frfx]'); if (await f.count()) await f.first().click(); await visit('one food'); await shut(); }
      await page.fill('#tQ', lang === 'fr' ? 'pain' : 'bread'); await visit('Threshold, a food search'); await page.fill('#tQ', 'zzzz'); await visit('Threshold, a food search with no match'); await page.fill('#tQ', '');
      await tap('#topbar [data-act=ai]'); await visit('Ask AI, this month'); await tap('#sheet [data-act=aiscope][data-v=all]'); await visit('Ask AI, everything'); await shut();
      await tap('[data-act=menu]'); await visit('menu'); await tap('#sheet [data-act=hist]'); await visit('History');
      for (const k of ['meal', 'fx', 'none']) { const id = await page.evaluate(k => { const e = S.ev.slice().reverse().find(x => x.k === k); return e && e.id; }, k); if (id && await page.locator(`#app [data-act=entry][data-v="${id}"]`).count()) { await tap(`#app [data-act=entry][data-v="${id}"]`); await visit('an entry, ' + k); await shut(); } }
      await tap('#bar [data-act=back]');
      for (const [act, name] of [['list', 'my list'], ['label', 'a food from its label'], ['help', 'how to read the screens'], ['about', 'about'], ['install', 'install'], ['backup', 'backup'], ['restore', 'restore']]) { await tap('[data-act=menu]'); await tap(`#sheet [data-act=${act}]`); await visit(name); if (act === 'list') await tap('#bar [data-act=back]'); else await shut(); }
      if (person.labels.length) { await tap('[data-act=menu]'); await tap('#sheet [data-act=label]'); await tap('#sheet [data-act=lbedit]'); await visit('a label food, opened again'); await shut(); }
      ok(T + `${seen} screens and sheets visited`, seen >= 42, seen); same(T + 'no script error on any of them', A.errors, []); same(T + 'no request to another site', A.outside, []);
      await A.ctx.close();
    }
    // the door, in both languages
    for (const lang of ['en', 'fr']) { const A = await open(browser, base, { lang, width: 320 }), page = A.page, t = await page.locator('#app').innerText();
      ok(`[door, ${lang}] names allergy, medicine and eating disorders`, /allerg/i.test(t) && (lang === 'fr' ? /médicament/.test(t) && /trouble alimentaire/.test(t) : /medicine/.test(t) && /eating disorder/.test(t)));
      ok(`[door, ${lang}] says 18`, /18/.test(t));
      ok(`[door, ${lang}] opens on what the app is for, in the Home screen’s words: a meal, a negative effect, lists`, (lang === 'fr' ? ['Vois ce que tu avais mangé avant les effets négatifs que tu as notés.', 'Note un repas quand tu manges', 'Note un effet négatif quand tu en as un', 'Ses listes mettent les repas suivis d’un effet à côté des autres repas'] : ['See what you had eaten before the negative effects you reported.', 'Report a meal when you eat', 'Report a negative effect when you have one', 'Its lists set the meals an effect came after beside the meals it didn’t']).every(x => t.includes(x)), t.slice(0, 420));
      ok(`[door, ${lang}] no longer speaks of a scale, of bars or of what you feel`, !/scale|échelle|\bbars?\b|barres?|what you feel|ce que tu ressens/i.test(t), (t.match(/scale|échelle|\bbars?\b|barres?|what you feel|ce que tu ressens/i) || [''])[0]); same(`[door, ${lang}] nothing runs off the screen`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      same(`[door, ${lang}] nothing can be entered before it`, [await page.locator('.mb').count(), await page.locator('#topbar [data-act=ai]').count()], [0, 0]);
      await page.click('[data-act=menu]'); same(`[door, ${lang}] the menu holds install, restore and about only`, await page.locator('#sheet .menu button').evaluateAll(b => b.map(x => x.dataset.act)), ['install', 'restore', 'about']); await page.click('#sheet [data-act=close]');
      await page.click('[data-act=enter]'); await page.reload(); await page.waitForSelector('#topbar .in'); same(`[door, ${lang}] once passed, it stays passed`, await page.locator('.mb').count(), 2);
      { const home = await page.locator('#app').innerText(); ok(`[door, ${lang}] the empty Home screen says the same: a negative effect, and lists that count complete days`, home.includes(lang === 'fr' ? 'Note un effet négatif quand tu en as un.' : 'Report a negative effect when you have one.') && home.includes(lang === 'fr' ? 'les listes comptent les journées complètes' : 'the lists count complete days') && !/\bbars\b|barres/i.test(home), home.slice(-320)); }
      await page.click('#topbar [data-act=lang][data-v=' + (lang === 'fr' ? 'en' : 'fr') + ']'); same(`[door, ${lang}] the language switch turns the whole screen`, await page.locator('.mb.meal').innerText(), lang === 'fr' ? '＋\nMeal' : '＋\nRepas'); same(`[door, ${lang}] no error`, A.errors, []); await A.ctx.close(); }

    // ================= the keyboard =================
    { const person = people.steady, B = build(person, table, 'en'), A = await open(browser, base, { state: B.state, now: person.now, lang: 'en' }), page = A.page, at = () => page.evaluate(() => { const e = document.activeElement; return (e.dataset && (e.dataset.act || e.dataset.in) || e.id || e.tagName) + (e.dataset && e.dataset.v ? ':' + e.dataset.v : ''); });
      const order = []; for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); order.push(await at()); }
      same('[keyboard] Tab walks the top bar, the tabs, then Meal and Effect', order, ['menu', 'home', 'ai', 'lang:fr', 'lang:en', 'tab:home', 'tab:nut', 'tab:thr', 'meal', 'fx']);
      await page.keyboard.press('Enter'); ok('[keyboard] Enter on Effect opens its sheet, and the focus goes into it', await page.evaluate(() => document.getElementById('sheet').classList.contains('on') && document.getElementById('sheet').contains(document.activeElement)));
      let inside = true; for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); if (!(await page.evaluate(() => document.getElementById('sheet').contains(document.activeElement)))) inside = false; } ok('[keyboard] Tab stays inside an open sheet', inside);
      await page.keyboard.press('Shift+Tab'); await page.focus('#sheet [data-act=fxk][data-v=head]'); await page.keyboard.press('Space'); same('[keyboard] Space ticks an effect, and the focus stays on it', [await page.locator('#sheet [data-act=fxk][data-v=head]').getAttribute('aria-pressed'), await at()], ['true', 'fxk:head']);
      await page.keyboard.press('Escape'); same('[keyboard] Escape closes the sheet and gives the focus back', [await page.evaluate(() => document.getElementById('sheet').classList.contains('on')), await at()], [false, 'fx']);
      await page.click('.mb.meal'); await page.click('#mTabs [data-act=mgrp][data-v=fruit]'); await page.focus('#mRows .stp.plus'); const k = await page.evaluate(() => document.activeElement.dataset.k);
      await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); same('[keyboard] Enter twice on + gives 1½, with the focus still on that +', [await page.evaluate(k => V.items[k], k), await page.evaluate(() => document.activeElement.dataset.k + document.activeElement.dataset.v)], [1.5, k + '0.5']);
      same('[keyboard] no error', A.errors, []); await A.ctx.close(); }

    // ================= offline =================
    { const person = people.varied, B = build(person, table, 'fr'), A = await open(browser, base, { state: B.state, now: person.now, lang: 'fr', sw: true }), page = A.page;
      await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(async () => { const ks = await caches.keys(); if (!ks.length) return false; const c = await caches.open(ks[0]); return (await c.keys()).length >= 8; }, null, { timeout: 15000 });
      // the one cache on the phone is named by sw.js, and that name is this version of the app and the first 8 characters of its file's hash
      { const named = (/const CACHE='([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'threshold', 'app', 'sw.js'), 'utf8')) || [])[1], ver = await page.evaluate(() => VER);
        same('[offline] the cache carries the app’s own name', await page.evaluate(() => caches.keys()), [named]);
        ok('[offline] that name holds the app’s version', new RegExp('^thresholdlog-' + ver.replace(/\./g, '\\.') + '-[0-9a-f]{8}$').test(named), named + ', version ' + ver); }
      await A.ctx.setOffline(true); await page.reload(); await page.waitForSelector('.mb.meal'); same('[offline] the app opens with no connection, with the data', (await A.S()).ev.length, B.state.ev.length);
      await page.click('[data-act=tab][data-v=thr]'); ok('[offline] the lists show', (await page.locator('#app table.rws tbody tr').count()) > 5);
      await page.goto(base + '/threshold/app/?r=meal'); await page.waitForSelector('#mQ'); ok('[offline] the home-screen shortcut for a meal opens the meal screen', true);
      await page.goto(base + '/threshold/app/?r=fx'); await page.waitForSelector('#sheet.on [data-act=fxdone]'); ok('[offline] the shortcut for an effect opens the effect sheet', true);
      same('[offline] no error', A.errors.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)), []); await A.ctx.close(); }

    // ================= a day turns over while the app sits open =================
    { const person = people.steady, B = build(person, table, 'en'), day = 30, A = await open(browser, base, { state: Object.assign({}, B.state, { ev: B.state.ev.filter(e => e.t < person.T(day, 12, 0)) }), now: person.T(day, 23, 0), lang: 'en' }), page = A.page;
      const nones = async () => (await A.S()).ev.filter(e => e.k === 'none').map(e => e.d).sort(), before = await nones();
      await page.clock.setFixedTime(person.T(day + 1, 9, 0));                        // the next morning; the screen still shows last night's
      await page.click('[data-act=tab][data-v=nut]'); ok('[new day] the first tap after the day turns is not taken', (await page.locator('#toast').innerText()).includes('A new day has started') && (await page.locator('[data-act=tab][data-v=home]').getAttribute('aria-selected')) === 'true');
      await page.click('.mb.meal'); await page.waitForSelector('#mQ'); same('[new day] the next tap is, and the meal screen opens on the new day', await page.evaluate(() => V.day), person.dayKey(day + 1)); await page.click('#bar [data-act=back]'); same('[new day] nothing was saved by the tap that was not taken', await nones(), before);
      same('[new day] no error', A.errors, []); await A.ctx.close(); }

    // ================= clock changes, checked inside the browser alone, in three zones that have them =================
    for (const zone of ['America/New_York', 'Europe/Paris', 'Australia/Sydney']) { const A = await open(browser, base, { lang: 'en', zone, now: new Date(Date.UTC(2026, 5, 1, 12)).getTime() }), page = A.page;
      const r = await page.evaluate(() => { const bad = [], two = n => (n < 10 ? '0' : '') + n; let short = 0, long = 0;
        for (const roll of [0, 4]) { S.roll = roll; for (let i = 0; i < 366; i++) { const d = new Date(2026, 0, 1 + i), k = d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()), next = TLE.keyAdd(k, 1), a = TLE.dayStart(k, roll), b = TLE.dayStart(next, roll), len = Math.round((b - a) / 36e5);
            if (len === 23) short++; if (len === 25) long++;
            const nd = new Date(2026, 0, 2 + i), nk = nd.getFullYear() + '-' + two(nd.getMonth() + 1) + '-' + two(nd.getDate());
            if (next !== nk) bad.push(k + ' +1 gave ' + next); if (TLE.keyAdd(next, -1) !== k) bad.push(next + ' -1');
            if (TLE.dayKey(a, roll) !== k) bad.push(k + ' its first moment'); if (TLE.dayKey(b - 1, roll) !== k) bad.push(k + ' its last moment'); if (TLE.dayKey(b, roll) !== next) bad.push(k + ' the moment after');
            for (const hm of ['00:10', '03:59', '04:00', '12:00', '23:50']) { const t = atTime(k, hm); if (TLE.dayKey(t, roll) !== k) bad.push(k + ' ' + hm + ' at day start ' + roll); } } }
        return { bad: bad.slice(0, 6), short, long }; });
      same(`[clock, ${zone}] every day of 2026 keeps its own entries, whatever hour the day starts at and whatever the clock does`, r.bad, []);
      ok(`[clock, ${zone}] the year did hold a short day and a long day to test on`, r.short >= 1 && r.long >= 1, JSON.stringify(r)); same(`[clock, ${zone}] no error`, A.errors, []); await A.ctx.close(); }

    // ================= small rules of the entry screens =================
    { const now = new Date(2026, 10, 14, 15, 0).getTime(), A = await open(browser, base, { now, lang: 'en' }), page = A.page; await page.click('[data-act=enter]');
      const toast = () => page.locator('#toast').innerText();
      await page.click('.mb.meal'); await page.fill('#mQ', 'gouda'); await page.click('#mRows .stp.plus'); await page.fill('#mAt', '18:00'); await page.click('[data-act=mealdone]'); ok('[rules] a meal in the future is not taken', (await toast()).includes('hasn’t happened yet') && (await A.S()).ev.length === 0);
      await page.fill('#mAt', '12:00'); await page.click('#mRows .stp[data-v="-0.5"]'); same('[rules] one tap gives a portion, minus gives a half', await page.evaluate(() => Object.values(V.items)), [0.5]); await page.click('#mRows .stp[data-v="-0.5"]'); same('[rules] minus again takes the food off', await page.evaluate(() => Object.keys(V.items).length), 0);
      ok('[rules] Done waits for a food', await page.locator('[data-act=mealdone]').isDisabled()); await page.click('#mRows .stp.plus'); await page.click('[data-act=mealdone]'); same('[rules] the meal is saved at the time that was set', (await A.S()).ev.map(e => [e.k, new Date(e.t).getHours(), e.items[0].q]), [['meal', 12, 1]]);
      same('[rules] the Effects bar waits for 7 complete days before it draws', [await page.locator('.fxbar .trk.wait').count(), await page.locator('.fxbar .trk i').evaluate(e => e.style.height)], [1, '0%']);
      await page.click('#app button.none'); same('[rules] “No effects today” closes the day', (await A.S()).ev.filter(e => e.k === 'none').length, 1); same('[rules] and shows as ticked', await page.locator('#app button.none').getAttribute('aria-pressed'), 'true');
      await page.click('#app button.none'); same('[rules] tapping it again takes it back', (await A.S()).ev.filter(e => e.k === 'none').length, 0); await page.click('#toast [data-act=undo]'); same('[rules] and Undo restores it', (await A.S()).ev.filter(e => e.k === 'none').length, 1);
      await page.click('.mb.fx'); await page.fill('#fxOwn', '  Brain   fog '); await page.click('#sheet [data-act=fxadd]'); await page.fill('#fxOwn', 'headache'); await page.click('#sheet [data-act=fxadd]'); await page.fill('#fxOwn', 'brain FOG'); await page.click('#sheet [data-act=fxadd]');
      same('[rules] own words are tidied, a listed effect typed by name ticks the listed one, and the same words twice stay one', await page.evaluate(() => [UI.fx.sel, S.own]), [['o:Brain fog', 'head'], { phys: ['Brain fog'], psy: [] }]);
      await page.click('#sheet [data-act=fxdone]'); const st = await A.S(); same('[rules] two effects saved, and the day is no longer a day with none', [st.ev.filter(e => e.k === 'fx').map(e => e.c).sort(), st.ev.filter(e => e.k === 'none').length], [['head', 'o:Brain fog'], 0]);
      same('[rules] with an effect today, “No effects today” is not offered', await page.locator('#app button.none').count(), 0);
      await page.click('#toast [data-act=undo]'); const un = await A.S(); same('[rules] Undo takes both effects back and restores the day with none', [un.ev.filter(e => e.k === 'fx').length, un.ev.filter(e => e.k === 'none').length], [0, 1]);
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=label]'); await page.click('#sheet [data-act=lbsave]'); ok('[rules] a label food needs a name', (await toast()).includes('needs a name'));
      await page.fill('#sheet [data-in=lb][data-k=n]', 'Oat bar'); await page.fill('#sheet [data-in=lb][data-k=fat]', '4,5'); await page.fill('#sheet [data-in=lb][data-k=carb]', '21'); await page.click('#sheet [data-act=lbsave]'); ok('[rules] and fat, carbohydrate and protein', (await toast()).includes('fat, carbohydrate and protein'));
      await page.fill('#sheet [data-in=lb][data-k=prot]', 'x'); await page.click('#sheet [data-act=lbsave]'); ok('[rules] a number that can’t be read is refused', (await toast()).includes('can’t be read')); await page.fill('#sheet [data-in=lb][data-k=prot]', '3'); await page.click('#sheet [data-act=lbsave]');
      same('[rules] a comma works as a decimal point, empty sugars stay “not listed”, and calories are worked out when left empty', (await A.S()).custom.map(c => [c.n, c.fat, c.carb, c.prot, c.sug, c.kcal]), [['Oat bar', 4.5, 21, 3, null, Math.round(4 * 21 + 4 * 3 + 9 * 4.5)]]);
      // a label food can be changed, and removed while no meal uses it
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=label]'); await page.click('#sheet [data-act=lbedit]'); await page.fill('#sheet [data-in=lb][data-k=sug]', '9'); await page.click('#sheet [data-act=lbsave]'); same('[rules] a label food can be changed', (await A.S()).custom[0].sug, 9);
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=label]'); await page.click('#sheet [data-act=lbedit]'); await page.click('#sheet [data-act=lbdel]'); same('[rules] and removed while no meal uses it', (await A.S()).custom.length, 0);
      // what a label's ingredient list names: ticked on the form, kept, and carried by the food
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=label]'); await page.fill('#sheet [data-in=lb][data-k=n]', 'Fizzy lime'); for (const k of ['fat', 'carb', 'prot']) await page.fill(`#sheet [data-in=lb][data-k=${k}]`, '0');
      await page.click('#sheet [data-act=lbt][data-k=flav]'); await page.click('#sheet [data-act=lbt][data-k=swt]'); await page.click('#sheet [data-act=lbt][data-k=swt]');
      await page.click('#sheet [data-act=lbflav]'); same('[rules] the label form opens what a flavouring can hold, with a way back and no link that leaves the form behind', [await page.locator('#sheet [data-act=lbback]').count(), await page.locator('#sheet [data-act=rowsheet], #sheet [data-act=foodrd]').count()], [1, 0]);
      await page.click('#sheet [data-act=lbback]'); same('[rules] and coming back keeps what was typed and ticked', [await page.inputValue('#sheet [data-in=lb][data-k=n]'), await page.getAttribute('#sheet [data-act=lbt][data-k=flav]', 'aria-pressed'), await page.getAttribute('#sheet [data-act=lbt][data-k=swt]', 'aria-pressed')], ['Fizzy lime', 'true', 'false']);
      await page.click('#sheet [data-act=lbsave]'); same('[rules] a ticked flavour is saved with the label food, and the food carries it', [(await A.S()).custom.map(c => [c.n, c.t]), await page.evaluate(() => food('L' + S.custom[0].id).c)], [[['Fizzy lime', ['flav']]], { flav: 1 }]);
      same('[rules] a tick that isn’t one of the four is dropped when the data is read back', await page.evaluate(() => clean({ custom: [{ id: 'c1', n: 'x', t: ['flav', 'bogus', 'flav', 'nitr'] }] }).custom[0].t), ['flav', 'nitr']);
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=label]'); await page.click('#sheet [data-act=lbedit]'); same('[rules] opened again, the tick is still there', await page.getAttribute('#sheet [data-act=lbt][data-k=flav]', 'aria-pressed'), 'true'); await page.click('#sheet [data-act=lbdel]');
      // the search puts the plain name first
      same('[rules] a search puts the word as the whole name first: Water before Watermelon, the potato before the chips', await page.evaluate(() => [searchFoods('water').slice(0, 2), searchFoods('eau')[0], searchFoods('potato')[0], searchFoods('wat')[0]]), [['f930001', 'f1691'], 'f930001', 'f2506', 'f1691']);
      // an effect for yesterday, from the effect sheet
      await page.click('.mb.fx'); await page.click('#sheet [data-act=fxk][data-v=joint]'); await page.click('#sheet [data-act=fxday]:nth-of-type(2)'); await page.fill('#fxAt', '22:10'); await page.click('#sheet [data-act=fxdone]');
      { const e = (await A.S()).ev.find(x => x.c === 'joint'), d = new Date(e.t); same('[rules] an effect can be set to yesterday, at its time', [d.getDate(), d.getHours(), d.getMinutes()], [13, 22, 10]); }
      // History: a day that was missed
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=hist]'); await page.fill('#hDay', '2026-11-09'); await page.click('[data-act=hmeal]'); await page.fill('#mQ', 'banana'); await page.click('#mRows .stp.plus'); await page.click('[data-act=mealdone]');
      { const e = (await A.S()).ev.find(x => x.k === 'meal' && new Date(x.t).getDate() === 9); ok('[rules] History: a meal can be added to an earlier day, at noon unless the time is set', !!e && new Date(e.t).getHours() === 12); same('[rules] and the screen comes back to History', await page.locator('#hDay').count(), 1); }
      await page.fill('#hDay', '2026-11-09'); await page.click('[data-act=hfx]'); await page.click('#sheet [data-act=fxk][data-v=gut]'); await page.click('#sheet [data-act=fxdone]');
      same('[rules] History: an effect too, and that day is then complete', await page.evaluate(() => IX().D['2026-11-09'].closed), true);
      await page.fill('#hDay', '2026-11-20'); await page.click('[data-act=hmeal]'); ok('[rules] History: a day that hasn’t come is refused', (await toast()).includes('today or before') && (await page.locator('#mQ').count()) === 0);
      await page.click('#bar [data-act=back]');
      // words a person types are shown as words, never run as page code
      await page.click('.mb.fx'); await page.fill('#fxOwn', '<img src=x onerror=document.title=1>'); await page.click('#sheet [data-act=fxadd]'); await page.click('#sheet [data-act=fxdone]');
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=label]'); await page.fill('#sheet [data-in=lb][data-k=n]', '"><img src=x onerror=document.title=2>'); for (const k of ['fat', 'carb', 'prot']) await page.fill(`#sheet [data-in=lb][data-k=${k}]`, '1'); await page.click('#sheet [data-act=lbsave]');
      await page.click('.mb.meal'); await page.fill('#mQ', 'img'); await page.click('#mRows .stp.plus'); await page.click('[data-act=mealdone]'); await page.click('[data-act=tab][data-v=thr]'); await page.click('[data-act=tab][data-v=nut]'); await page.click('[data-act=menu]'); await page.click('#sheet [data-act=hist]');
      same('[rules] typed words are shown as words, never run as page code', [await page.locator('#app img, #sheet img').count(), await page.title()], [0, 'Threshold Log']); await page.click('#bar [data-act=back]');
      // the hour the day starts at
      await page.click('[data-act=menu]'); await page.selectOption('#rollSel', '4'); same('[rules] the hour the day starts at can be set from the menu', (await A.S()).roll, 4); await page.selectOption('#rollSel', '0'); await page.click('#sheet [data-act=close]');
      // the language is kept
      await page.click('#topbar [data-act=lang][data-v=fr]'); await page.reload(); await page.waitForSelector('.mb.meal'); same('[rules] the language picked is kept', [await page.evaluate(() => document.documentElement.lang), (await A.S()).lang], ['fr-CA', 'fr']); await page.click('#topbar [data-act=lang][data-v=en]');
      same('[rules] no error', A.errors, []); await A.ctx.close(); }

    // ================= copying and files: Ask AI, the backup file, restoring from a file, the install offer =================
    { const person = people.varied, B = build(person, table, 'en'), A = await open(browser, base, { state: B.state, now: person.now, lang: 'en', clip: true }), page = A.page;
      await page.click('#topbar [data-act=ai]'); const shown = await page.locator('#sheet textarea').inputValue(); await page.click('#sheet [data-act=aicopy]');
      same('[copy] Ask AI puts on the clipboard exactly the text it shows', await page.evaluate(() => navigator.clipboard.readText()), shown); await page.click('#sheet [data-act=close]');
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=backup]'); const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sheet [data-act=bkfile]')]);
      const file = await dl.path(), bk = JSON.parse(fs.readFileSync(file, 'utf8')); same('[file] the backup downloads as a file named for the app and the day', [dl.suggestedFilename(), bk.app, bk.state.ev.length], ['threshold-log-backup-' + O.dayOf(person.now, 0) + '.json', 'threshold-log', B.state.ev.length]);
      ok('[file] and the app notes when the last backup was made', !!(await A.S()).bkAt); await page.click('#sheet [data-act=close]');
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=erase]'); await page.click('#sheet [data-act=erase]'); await page.click('[data-act=menu]'); await page.click('#sheet [data-act=restore]');
      await page.setInputFiles('#restoreFile', file); await page.waitForSelector('#sheet [data-act=dorestore]'); await page.click('#sheet [data-act=dorestore]'); same('[file] the downloaded file restores every entry', (await A.S()).ev.length, B.state.ev.length);
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=restore]'); await page.setInputFiles('#restoreFile', { name: 'food-trial-log-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"food-trial-log","state":{"ev":[]}}') });
      await page.waitForFunction(() => document.getElementById('toast').innerText.includes('Nutrition tab')); same('[file] a Food Trial Log backup offered as a restore is turned away, and nothing changes', (await A.S()).ev.length, B.state.ev.length);
      same('[copy] no error', A.errors, []); await A.ctx.close(); }
    { const A = await open(browser, base, { lang: 'en' }), page = A.page; same('[install] the first screen offers to install', await page.locator('.instbig').count(), 1); await page.click('.instbig [data-act=instno]');
      await page.reload(); await page.waitForSelector('[data-act=enter]'); same('[install] “Not now” is remembered', await page.locator('.instbig').count(), 0);
      await page.click('[data-act=menu]'); await page.click('#sheet [data-act=install]'); ok('[install] the steps are still in the menu', (await page.locator('#sheet ol.inst').count()) >= 1); await A.ctx.close(); }

    // ================= the slider: how many hours after a meal an effect counts =================
    for (const lang of ['en', 'fr']) { const person = people.varied, B = build(person, table, lang), A = await open(browser, base, { state: B.state, now: person.now, lang }), page = A.page, fr = lang === 'fr', T = `[slider, ${lang}] `;
      await page.click('[data-act=tab][data-v=thr]'); const head = () => page.locator('#thrHead').innerText(), saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)).twin, KEY), meals = async () => (await head()).match(/\d+/g).map(Number);
      const box = await page.locator('#tWin').boundingBox();
      same(T + 'it starts at 4 hours, runs from 1 to 8 in steps of one, and is at least 44 pixels high', [await page.inputValue('#tWin'), ...(await page.locator('#tWin').evaluate(e => [e.min, e.max, e.step])), box.height >= 44], ['4', '1', '8', '1', true]);
      same(T + 'its eight stops are numbered under it', (await page.locator('.twin .ends').innerText()).split(/\s+/).filter(Boolean), ['1', '2', '3', '4', '5', '6', '7', '8']);
      { const g = await page.evaluate(() => { const r = document.getElementById('tWin').getBoundingClientRect(); return { w: r.width, at: [...document.querySelectorAll('.twin .ends span')].map(x => { const q = x.getBoundingClientRect(); return q.left + q.width / 2 - r.left; }) }; });
        ok(T + 'each number sits under the thumb at that stop', g.at.every((x, i) => Math.abs(x - (14 + i * (g.w - 28) / 7)) <= 2), JSON.stringify(g)); }
      ok(T + 'the words beside it say the hours', (await page.locator('.twin label').innerText()).includes(fr ? 'les 4 heures suivantes' : 'the 4 hours after it'));
      const at4 = await meals();
      // a drag: the lists follow while the thumb is held, and the setting is saved when it is let go
      await page.mouse.move(box.x + 14 + 3 * (box.width - 28) / 7, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width - 6, box.y + box.height / 2, { steps: 8 });
      const held = await meals(), heldSaved = await saved(); await page.mouse.up();
      same(T + 'dragged to the end: 8 hours, read at once', [held[0], await page.inputValue('#tWin')], [8, '8']);
      ok(T + 'more hours take in more meals with an effect, never fewer', held[1] >= at4[1], `${at4} then ${held}`);
      same(T + 'the setting is saved when the thumb is let go, not before', [heldSaved === undefined || heldSaved === 4, await saved()], [true, 8]);
      await page.focus('#tWin'); await page.keyboard.press('ArrowLeft'); same(T + 'an arrow key moves it one hour, and the focus stays on it', [await page.inputValue('#tWin'), (await meals())[0], await page.evaluate(() => document.activeElement.id), await saved()], ['7', 7, 'tWin', 7]);
      await page.reload(); await page.waitForSelector('.mb.meal'); await page.click('[data-act=tab][data-v=thr]'); same(T + 'the setting is still there when the app is opened again', [await page.inputValue('#tWin'), (await meals())[0]], ['7', 7]);
      ok(T + 'under the lists’ heading, one line says which side usually has the narrower range', (await page.locator('#thrCard').innerText()).includes(fr ? 'Le côté qui compte le moins de repas a d’habitude l’intervalle le plus étroit.' : 'The side with fewer meals usually has the narrower range.'));
      await page.click('#app [data-act=rowsheet][data-k=fat]'); await page.locator('#sheet [data-act=rstep]').last().click(); const sheet = (await page.locator('#sheet').innerText()).replace(/[\u00a0\u202f]/g, ' ');
      ok(T + 'an opened line says the hours it was read at', sheet.includes(fr ? 'effets notés dans les 7 heures suivantes.' : 'effects reported in the 7 hours after it.'), sheet.slice(0, 200));
      ok(T + 'it puts no number on luck, and says what leaves luck more room and what leaves it less', !/luck alone|hasard seul|times? in \d|fois sur \d/i.test(sheet) && sheet.includes(fr ? 'Plus de place pour le hasard : peu d’entrées, plusieurs choses mangées ensemble, des repas plus rapprochés que les heures réglées. Moins de place : plus d’entrées, une seule chose changée à la fois, des repas plus espacés que les heures réglées.' : 'More room for luck: few entries, several things eaten together, meals closer together than the hours set. Less room: more entries, one thing changed at a time, meals further apart than the hours set.'), sheet.slice(-420));
      await page.click('#sheet [data-act=close]');
      await page.click('[data-act=tmode][data-v=day]'); same(T + 'over a day there is no slider', await page.locator('#tWin').count(), 0);
      ok(T + 'over a day, the line about ranges speaks of days', (await page.locator('#thrCard').innerText()).includes(fr ? 'Le côté qui compte le moins de jours' : 'The side with fewer days'));
      await page.click('#app [data-act=rowsheet][data-k=fat]'); await page.locator('#sheet [data-act=rstep]').last().click();
      { const day = (await page.locator('#sheet').innerText()).replace(/[\u00a0\u202f]/g, ' '); ok(T + 'over a day, the words about luck speak of days and name no slider', !/luck alone|hasard seul|times? in \d|fois sur \d|hours set|heures réglées/i.test(day) && day.includes(fr ? 'Plus de place pour le hasard : peu de jours, plusieurs choses mangées le même jour. Moins de place : plus de jours, une seule chose changée à la fois.' : 'More room for luck: few days, several things eaten on the same day. Less room: more days, one thing changed at a time.'), day.slice(-300)); } await page.click('#sheet [data-act=close]');
      await page.click('#topbar [data-act=ai]'); await page.click('#sheet [data-act=aiscope][data-v=all]'); const ai = await page.locator('#sheet textarea').inputValue();
      ok(T + 'the text for Ask AI says the hours the tallies were read at, as the person’s own setting', ai.includes(fr ? 'effets notés dans les 7 heures suivantes\u00a0: mon propre réglage, de 1 à 8 heures' : 'effects reported in the 7 hours after it: my own setting, from 1 to 8 hours'), ai.slice(ai.indexOf(fr ? 'COMPTES APRÈS' : 'TALLIES AFTER'), ai.indexOf(fr ? 'COMPTES APRÈS' : 'TALLIES AFTER') + 160));
      await page.click('#sheet [data-act=close]'); same(T + 'no error', A.errors, []); await A.ctx.close(); }
    // a saved setting that is not a stop of the slider is read as 4 hours; one that is, is kept
    for (const [twin, want] of [[9, '4'], [0, '4'], ['6', '4'], [2.5, '4'], [6, '6'], [1, '1']]) { const person = people.steady, B = build(person, table, 'en'), A = await open(browser, base, { state: Object.assign({}, B.state, { twin }), now: person.now, lang: 'en' }), page = A.page;
      await page.click('[data-act=tab][data-v=thr]'); same(`[slider] saved as ${JSON.stringify(twin)}, shown as ${want}`, [await page.inputValue('#tWin'), A.errors], [want, []]); await A.ctx.close(); }
    // the app says how many hours count and nothing about how long anything takes to act: no compound's sheet and no help text gives a time
    { const person = people.varied, B = build(person, table, 'en'), A = await open(browser, base, { state: B.state, now: person.now, lang: 'en' }), page = A.page;
      const texts = await page.evaluate(() => Object.keys(INFO).map(k => INFO[k].join(' '))); const timed = texts.filter(t => /\b(minutes?|hours?)\b/i.test(t));
      same('[slider] no compound’s sheet gives a time to act', timed, []); await A.ctx.close(); }

    // ================= a day is read once the day after it is over; one food's days with it and without it are read over the same span =================
    { const D = (d, h, m) => new Date(2026, 10, d, h, m || 0).getTime(), A = await open(browser, base, { lang: 'en', now: D(13, 10) }), page = A.page, flat = t => t.replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal');
      // the 11th: cheese, and "No effects". The 12th: milk, and a headache two hours later. It is now the 13th, 10 a.m.
      await page.evaluate(([a, b]) => { S.ev.push({ id: 'd1', k: 'meal', t: a, items: [{ key: 'f109', q: 1 }] }, { id: 'd2', k: 'none', t: a + 36e5, d: TLE.dayKey(a, S.roll) }, { id: 'd3', k: 'meal', t: b, items: [{ key: 'f61', q: 1 }] }, { id: 'd4', k: 'fx', t: b + 72e5, c: 'head' }); IXM = null; render(); }, [D(11, 12), D(12, 12)]);
      const go = async t => { await page.clock.setFixedTime(t); await page.evaluate(() => { IXM = null; document.dispatchEvent(new Event('visibilitychange')); }); await page.click('[data-act=tab][data-v=thr]'); await page.click('[data-act=tmode][data-v=day]'); };
      const nums = async () => ((await page.locator('#thrHead').innerText()).match(/\d+/g) || []).map(Number), milk = async () => { await page.fill('#tQ', 'Milk, 2%'); await page.click('#tqRows [data-act=foodrd][data-v="f61"]'); const t = flat(await page.locator('#sheet').innerText()); await page.click('#sheet [data-act=close]'); return t; };
      await go(D(13, 10));
      same('[days] on the 13th, the 11th is read (the 12th is over) and it sits with the 12th’s headache', await nums(), [1, 1]);
      ok('[days] ...and the 12th waits, since the 13th is not over, and the screen says so', flat(await page.locator('#thrWait').innerText()) === '1 day isn’t counted yet: a day is read once the day after it is over.', await page.locator('#thrWait').innerText());
      { const t = await milk(); ok('[days] the sheet for milk says its day is not counted yet', t.includes('Not reported on a complete day yet.') && t.includes('1 day with it isn’t counted yet: a day is read once the day after it is over.'), t.slice(0, 400)); }
      await go(D(14, 0, 5));
      same('[days] five minutes into the 14th, the 12th is read too', [await nums(), await page.locator('#thrWait').count()], [[2, 2], 0]);
      { const t = await milk(); ok('[days] the sheet for milk: one day with it, and the day without it carries the next day’s headache, as a day with it would', t.includes('Reported on 1 complete day.') && /Complete days without it: 1 · headache 1/.test(t) && !t.includes('counted yet'), t.slice(0, 600));
        ok('[days] ...and it says both kinds of day are read over the same span', t.includes('Days without it are read over the same span: that day, that night and the next day.'), t.slice(-500)); }
      same('[days] no error', A.errors, []); await A.ctx.close(); }

    // ================= a first meal and effect, entered just now =================
    { const t0 = new Date(2026, 10, 14, 18, 0).getTime(), A = await open(browser, base, { lang: 'en', now: t0 }), page = A.page;
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal');
      await page.evaluate(t => { S.ev.push({ id: 'w1', k: 'meal', t, items: [{ key: 'f109', q: 2 }] }, { id: 'w2', k: 'fx', t, c: 'head' }); IXM = null; render(); }, t0);
      await page.click('[data-act=tab][data-v=thr]'); const head = () => page.locator('#thrHead').innerText(), wait = () => page.locator('#thrWait').innerText();
      ok('[new] a meal with an effect reported after it is in the lists at once', /after 1 of 1 meal\./.test(await head()), await head());
      await page.evaluate(t => { S.ev.push({ id: 'w3', k: 'meal', t: t + 600000, items: [{ key: 'f109', q: 1 }] }); IXM = null; render(); }, t0); await page.clock.setFixedTime(t0 + 900000); await page.evaluate(() => { IXM = null; document.dispatchEvent(new Event('visibilitychange')); }); await page.click('[data-act=tab][data-v=thr]');
      ok('[new] a meal with nothing reported after it waits, and the screen says so', /1 meal isn’t counted yet/.test(await wait()) && /after 1 of 1 meal\./.test(await head()), await wait());
      const refresh = async ms => { await page.clock.setFixedTime(t0 + ms); await page.evaluate(() => { IXM = null; document.dispatchEvent(new Event('visibilitychange')); }); await page.click('[data-act=tab][data-v=thr]'); };
      await page.focus('#tWin'); await page.keyboard.press('Home'); ok('[new] with the slider at 1 hour, the meal waits for its hour', /its hour isn’t over/.test(await wait()), await wait());
      await refresh(80 * 60000); ok('[new] 80 minutes on, at 1 hour, the second meal has settled on the other side', /in the hour after 1 of 2 meals\./.test(await head()) && (await page.locator('#thrWait').count()) === 0, await head());
      await page.focus('#tWin'); await page.keyboard.press('End'); ok('[new] ...and at 8 hours it is waiting again, since its 8 hours are not over', /its 8 hours aren’t over/.test(await wait()) && /in the 8 hours after 1 of 1 meal\./.test(await head()), (await head()) + ' | ' + (await wait()));
      await page.keyboard.press('Home'); for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight'); await refresh(900000);
      await page.click('[data-act=tmode][data-v=day]'); ok('[new] over a day, today says it is waiting until the day after it is over', /^1 day isn’t counted yet: a day is read once the day after it is over\.$/.test((await wait()).trim()), await wait());
      await page.clock.setFixedTime(t0 + 5 * 3600e3); await page.evaluate(() => { IXM = null; document.dispatchEvent(new Event('visibilitychange')); }); await page.click('[data-act=tab][data-v=thr]'); await page.click('[data-act=tmode][data-v=meal]');
      ok('[new] once its 4 hours are over with nothing reported, the second meal is on the other side', /after 1 of 2 meals\./.test(await head()), await head());
      same('[new] no error', A.errors, []); await A.ctx.close(); }

    // ================= a day with nothing but water =================
    for (const lang of ['en', 'fr']) { const t0 = new Date(2026, 10, 14, 18, 0).getTime(), A = await open(browser, base, { lang, now: t0 }), page = A.page, fr = lang === 'fr';
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal');
      await page.evaluate(t => { S.ev.push({ id: 'w1', k: 'meal', t: t - 2 * 3600e3, items: [{ key: 'f930001', q: 2 }] }, { id: 'w2', k: 'meal', t: t - 3600e3, items: [{ key: 'f930003', q: 1 }] }); IXM = null; render(); }, t0);
      const home = await page.locator('#app').innerText();
      ok(`[water, ${lang}] Home doesn’t say no meal was reported when water was`, !/No meal reported|Aucun repas noté/.test(home) && (fr ? /ne contient ni gras/ : /holds no fat/).test(home), home.slice(0, 300));
      await page.click('#app [data-act=comps]'); ok(`[water, ${lang}] the flavouring of the flavoured one is in reach from Home`, (await page.locator('#sheet [data-act=comp][data-v=flav]').count()) === 1);
      await page.click('#sheet [data-act=comp][data-v=flav]'); const sheet = await page.locator('#sheet').innerText();
      ok(`[water, ${lang}] its sheet says what it can hold, what the label leaves out, and that one product says nothing about another`, (fr ? ['Ce qu’il peut contenir', 'Ce que l’étiquette ne dit pas', 'D’un produit à l’autre', 'ne dit rien sur l’autre', 'D’où vient le compte', 'Eau pétillante aromatisée'] : ['What it can hold', 'What the label leaves out', 'One product and another', 'says nothing about another', 'Where the count comes from', 'Sparkling water, flavoured']).every(w => sheet.includes(w)), sheet.slice(0, 200));
      await page.click('#sheet [data-act=close]');
      for (const tab of ['nut', 'thr']) { await page.click(`[data-act=tab][data-v=${tab}]`); const t = await page.locator('#app').innerText(); ok(`[water, ${lang}] ${tab}: no broken number`, !/NaN|undefined|Infinity/.test(t)); }
      same(`[water, ${lang}] no error`, A.errors, []); await A.ctx.close(); }

    // ================= a line with nothing counted =================
    { const t0 = new Date(2026, 10, 14, 18, 0).getTime(), A = await open(browser, base, { lang: 'fr', now: t0 }), page = A.page;
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal');
      await page.evaluate(t => { S.ev.push({ id: 'g1', k: 'meal', t, items: [{ key: 'f910001', q: 1 }] }, { id: 'g2', k: 'fx', t, c: 'head' }); IXM = null; render(); }, t0);      // a can whose label does not split its carbs
      await page.click('[data-act=tab][data-v=thr]'); const gone = await page.locator('#thrGone').innerText();
      ok('[new] a line with nothing counted is not shown as two dashes', (await page.locator('#app [data-act=rowsheet][data-k=cplx]').count()) === 0 && (await page.locator('#app [data-act=rowsheet][data-k=sug]').count()) === 0 && (await page.locator('#app [data-act=rowsheet][data-k=fat]').count()) === 1);
      ok('[new] it is named under the lists, with what kept its meal out', /glucides complexes, sucres/.test(gone) && /1 repas laissé de côté/.test(gone), gone);
      same('[new] no error with nothing counted', A.errors, []); await A.ctx.close(); }

    // ================= the web page =================
    for (const lang of ['en', 'fr']) { const ctx = await browser.newContext({ viewport: { width: 320, height: 760 }, locale: lang === 'fr' ? 'fr-CA' : 'en-CA', serviceWorkers: 'block' }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/threshold/'); await page.waitForSelector('#langBtn'); const T = `[page, ${lang}] `, main = page.locator(`main[data-l=${lang}]`);
      same(T + 'opens in the browser’s language', [await page.evaluate(() => document.documentElement.lang), await main.isVisible(), await page.locator(`main[data-l=${lang === 'fr' ? 'en' : 'fr'}]`).isVisible()], [lang === 'fr' ? 'fr-CA' : 'en-CA', true, false]);
      const A = await open(browser, base, { lang, width: 320 }); same(T + 'its five statements are the app’s door, word for word', await main.locator('ol.door li').allInnerTexts(), await A.page.locator('.card.gate ol li').allInnerTexts()); await A.ctx.close();
      const t = (await main.innerText()) + '\n' + (await page.locator(`footer [data-l=${lang}]`).innerText()), bad = BAN[lang].exec(t.replace(/Food Trial Log|Threshold Log|The Patch/g, '§'));
      ok(T + 'none of the words the app never uses', !bad, bad && t.slice(Math.max(0, bad.index - 60), bad.index + 40)); ok(T + 'carries the attribution line', t.includes(lang === 'fr' ? 'Créé par Tobie et Claude. Version gratuite à v3ktor.org/threshold.' : 'Made by Tobie and Claude. Free version at v3ktor.org/threshold.'));
      if (lang === 'fr') { const p1 = /[ \t][:;?!]/.exec(t); ok(T + 'French punctuation', !p1, p1 && t.slice(Math.max(0, p1.index - 40), p1.index + 20)); }
      same(T + 'nothing runs off a 320-pixel screen', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      same(T + 'every picture loads', await page.evaluate(async () => { const ims = [...document.querySelectorAll('main:not([hidden]) img')]; for (const i of ims) { i.loading = 'eager'; if (!i.complete) await new Promise(r => { i.onload = i.onerror = r; }); } return ims.filter(i => !i.naturalWidth).map(i => i.getAttribute('src')); }), []);
      await page.click('#langBtn'); same(T + 'the language button turns the page and is remembered', [await page.evaluate(() => document.documentElement.lang), await page.evaluate(() => localStorage.getItem('v3ktor-lang'))], lang === 'fr' ? ['en-CA', 'en'] : ['fr-CA', 'fr']);
      await page.goto(base + '/threshold/app/'); await page.waitForSelector('[data-act=enter]'); same(T + 'and the app then opens in the language picked on the page', await page.evaluate(() => document.documentElement.lang), lang === 'fr' ? 'en-CA' : 'fr-CA');
      same(T + 'no error', errors, []); await ctx.close(); }

    // ================= the how-to page: what sources say about how soon, kept apart from the app =================
    for (const lang of ['en', 'fr']) { const ctx = await browser.newContext({ viewport: { width: 320, height: 760 }, locale: lang === 'fr' ? 'fr-CA' : 'en-CA', serviceWorkers: 'block' }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + '/threshold/'); same(`[how soon, ${lang}] the app’s page links to it`, await page.locator(`main[data-l=${lang}] a[href="how-soon/"]`).count(), 1);
      await page.goto(base + '/threshold/how-soon/'); await page.waitForSelector('#langBtn'); const T = `[how soon, ${lang}] `, main = page.locator(`main[data-l=${lang}]`), other = page.locator(`main[data-l=${lang === 'fr' ? 'en' : 'fr'}]`);
      same(T + 'opens in the browser’s language', [await page.evaluate(() => document.documentElement.lang), await main.isVisible(), await other.isVisible()], [lang === 'fr' ? 'fr-CA' : 'en-CA', true, false]);
      const t = (await main.innerText()) + '\n' + (await page.locator(`footer [data-l=${lang}]`).innerText()), bad = BAN[lang].exec(t.replace(/Food Trial Log|Threshold Log|The Patch/g, '§'));
      ok(T + 'none of the words the app never uses', !bad, bad && t.slice(Math.max(0, bad.index - 60), bad.index + 40)); ok(T + 'carries the attribution line', t.includes(lang === 'fr' ? 'Créé par Tobie et Claude. Version gratuite à v3ktor.org/threshold.' : 'Made by Tobie and Claude. Free version at v3ktor.org/threshold.'));
      if (lang === 'fr') { const p1 = /[ \t][:;?!]/.exec(t); ok(T + 'French punctuation', !p1, p1 && t.slice(Math.max(0, p1.index - 40), p1.index + 20)); }
      const rows = await main.locator('.clocks li').evaluateAll(ls => ls.map(l => ({ when: l.querySelector('.when').textContent.trim(), what: l.querySelector('.what').textContent.trim(), href: (l.querySelector('.who a') || {}).href || '' })));
      ok(T + 'every time has what it is the time of, and a source to open', rows.length === 12 && rows.every(r => r.when && r.what && /^https:\/\//.test(r.href)), JSON.stringify(rows.filter(r => !(r.when && r.what && /^https:/.test(r.href)))));
      same(T + 'the two languages give the same sources in the same order', rows.map(r => r.href), await other.locator('.clocks li .who a').evaluateAll(as => as.map(a => a.href)));
      ok(T + 'it says what to do in an emergency, and that it is not advice', /911/.test(t) && (lang === 'fr' ? /pas un conseil ni un diagnostic/ : /not advice and not a diagnosis/).test(t));
      same(T + 'nothing runs off a 320-pixel screen', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.click('#langBtn'); same(T + 'the language button turns the page', await page.evaluate(() => document.documentElement.lang), lang === 'fr' ? 'en-CA' : 'fr-CA');
      same(T + 'no error', errors, []); await ctx.close(); }
    // and the app itself still gives no time: no link to that page and none of its sources
    { const html = fs.readFileSync(path.join(ROOT, 'threshold/app/index.html'), 'utf8'); ok('[how soon] the app holds no link to the how-to and none of its sources', !/how-soon|ichd-3|monashfodmap|clevelandclinic|mayoclinic/i.test(html)); }

    // ================= saved data that can't be read, a changed agreement, storage that is blocked =================
    { const A = await open(browser, base, { lang: 'en', store: { [KEY]: '{"v":1,"ev":[{"k":"meal"' } }), page = A.page;
      ok('[storage] data that can’t be read: the app says so', (await page.locator('#app').innerText()).includes('couldn’t be read')); await page.click('[data-act=enter]'); await page.click('.mb.fx'); await page.click('#sheet [data-act=fxk][data-v=head]'); await page.click('#sheet [data-act=fxdone]');
      same('[storage] and never writes over it', await page.evaluate(k => localStorage.getItem(k), KEY), '{"v":1,"ev":[{"k":"meal"'); await A.ctx.close(); }
    { const person = people.steady, B = build(person, table, 'en'), A = await open(browser, base, { state: Object.assign({}, B.state, { cv: 0 }), now: person.now, lang: 'en' }), page = A.page;
      same('[agreement] when the five statements change, the door comes back, and the entries are kept', [await page.locator('[data-act=enter]').count(), (await A.S()).ev.length], [1, B.state.ev.length]); await A.ctx.close(); }
    { const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, locale: 'en-CA' }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new Error('blocked'); }; Storage.prototype.getItem = function () { throw new Error('blocked'); }; });
      await page.goto(base + '/threshold/app/'); await page.waitForSelector('[data-act=enter]'); await page.click('[data-act=enter]');
      ok('[storage] a browser that blocks storage: the app says nothing is being saved, and still runs', (await page.locator('#app').innerText()).includes('Not saved') && (await page.locator('.mb').count()) === 2); same('[storage] no error', errors, []); await ctx.close(); }
  } catch (e) { fail++; console.log('STOPPED: ' + (e.stack || e)); }
  await browser.close(); await srv.close();
  console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `screens: all ${pass} checks passed`); process.exit(fail ? 1 : 0);
})();
