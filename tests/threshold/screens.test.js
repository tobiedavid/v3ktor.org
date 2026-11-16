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

// the Threshold tab keeps its settings (the reading and its hours) and its filter (the effects) in two sheets
const setOpen = async page => { if (!(await page.locator('#sheet.on [data-act=tmode]').count())) await page.click('#thrBar [data-act=tset]'); await page.waitForSelector('#sheet.on [data-act=tmode]'); };
const sheetShut = async page => { await page.evaluate(() => closeSheet()); };
const setMode = async (page, mode) => { await setOpen(page); await page.click(`#sheet [data-act=tmode][data-v=${mode}]`); await sheetShut(page); };
const setHours = async (page, h) => { await setOpen(page); await page.focus('#tWin'); await page.keyboard.press('Home'); for (let i = 1; i < h; i++) await page.keyboard.press('ArrowRight'); await sheetShut(page); };
const filterOpen = async page => { if (!(await page.locator('#sheet.on .fxpick').count())) await page.click('#thrBar [data-act=tfilter]'); await page.waitForSelector('#sheet.on [data-act=close]'); };
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
      const tap = sel => page.click(sel), shut = () => page.click('#sheet [data-act=close]'), slide = h => setHours(page, h);
      await visit('Home');
      // an effect, opened: the meals in the slider's hours before it. And a poor sleep, which opens the day before.
      for (const [name, pick] of [['an effect, opened', 'x => x.k === "fx" && x.c !== "sleep"'], ['a poor sleep, opened', 'x => x.k === "fx" && x.c === "sleep"']]) { const id = await page.evaluate(src => { const e = S.ev.slice().reverse().find(eval(src)); if (!e) return null; UI.en = { id: e.id, at: hm(e.t) }; entrySheet(); return e.id; }, pick); if (id) { await visit(name); await shut(); } }
      await tap('[data-act=tab][data-v=nut]'); { const oc = page.locator('#app [data-act=comps]'); if (await oc.count()) { await oc.click(); await visit('other compounds'); const cp = page.locator('#sheet [data-act=comp]'); if (await cp.count()) { await cp.first().click(); await visit('a compound'); const hi = page.locator('#sheet [data-act=histinfo]'); if (await hi.count()) { await hi.click(); await visit('histamine sheet'); } } await shut(); } } await tap('[data-act=tab][data-v=home]');
      await page.evaluate(() => { UI.cp = 'flav'; compSheet(); }); await visit('the flavourings sheet'); await page.evaluate(() => { UI.lb = {}; labelSheet(); }); await tap('#sheet [data-act=lbflav]'); await visit('the flavourings sheet, from the label form'); await shut();
      await tap('.mb.meal'); await visit('meal'); for (const g of ['recent', 'dairy', 'sup', 'proc', 'label']) { const b = page.locator(`#mTabs [data-act=mgrp][data-v=${g}]`); if (await b.count()) { await b.click(); await visit('meal, ' + g); } }
      await page.fill('#mQ', 'zzzz'); await visit('meal, a search with no match'); await page.fill('#mQ', lang === 'fr' ? 'lait' : 'milk'); await tap('#mRows .stp.plus'); await visit('meal, a search with a pick'); await tap('#bar [data-act=back]');
      await tap('.mb.fx'); await visit('effect, physical'); await tap('#sheet [data-act=fxtab][data-v=psy]'); await visit('effect, psychological'); await shut();
      await tap('[data-act=tab][data-v=nut]'); for (const per of ['today', 'week', 'month']) { await tap(`[data-act=nper][data-v=${per}]`); await visit('Nutrition, ' + per); } await tap('details.note summary'); await visit('Nutrition, the reference questions');
      if (B.gut) { await tap('[data-act=impread]'); await visit('import, confirm'); await shut(); const rej = page.locator('#app [data-act=foodrd]'); if (await rej.count()) { await rej.first().click(); await visit('one food, rejected in the Food Trial Log'); await shut(); } }
      await tap('[data-act=tab][data-v=thr]'); for (const mode of ['meal', 'day']) { await setMode(page, mode); await visit('Threshold, ' + mode); await setOpen(page); await visit('Threshold, ' + mode + ', the settings'); await sheetShut(page);
        if (mode === 'meal') { await slide(1); await visit('Threshold, meal, the slider at 1 hour'); await slide(8); await visit('Threshold, meal, the slider at 8 hours'); }
        await filterOpen(page); await visit('Threshold, ' + mode + ', the filter'); const fx = page.locator('#sheet .fxpick [data-act=tfx]');
        if (await fx.count() > 1) { await fx.nth(1).click(); await sheetShut(page); await visit('Threshold, ' + mode + ', one effect'); await filterOpen(page);
          if (await fx.count() > 2) { await fx.nth(2).click(); await visit('Threshold, ' + mode + ', two effects together, in the filter'); await sheetShut(page); await visit('Threshold, ' + mode + ', two effects together'); await filterOpen(page); await tap('#allAny [data-v="0"]'); await sheetShut(page); await visit('Threshold, ' + mode + ', any of two effects'); await filterOpen(page); await tap('#allAny [data-v="1"]'); }
          await fx.first().click(); } await sheetShut(page);
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
      await page.click('[data-act=tab][data-v=thr]'); ok('[offline] the rows show', (await page.locator('#app .drow').count()) > 5);
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
      same('[rules] Home lists the meal under Today, with a count and the way to Nutrition', [await page.locator('#todayList li').count(), await page.locator('#todayCount').innerText(), await page.locator('#app [data-act=tonut]').count(), await page.locator('#app [data-act=per], #app .fxbar, #app .ring').count()], [1, '1 meal · 0 effects', 1, 0]);
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
      same(T + 'the tab opens on two buttons, Filter and Settings, with no switch, slider or chips on it', [await page.locator('#thrBar [data-act=tfilter]').count(), await page.locator('#thrBar [data-act=tset]').count(), await page.locator('#app #tWin, #app [data-act=tmode], #app [data-act=tfx]').count()], [1, 1, 0]);
      ok(T + 'the buttons say what is picked and how it is read', (await page.locator('#thrBar').innerText()).replace(/\s+/g, ' ').includes(fr ? 'Tout effet' : 'Any effect') && (await page.locator('#thrBar').innerText()).replace(/[\s\u00a0]+/g, ' ').includes(fr ? 'Après un repas · 4 heures' : 'After a meal · 4 hours'));
      await setOpen(page); const box = await page.locator('#tWin').boundingBox();
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
      await page.reload(); await page.waitForSelector('.mb.meal'); await page.click('[data-act=tab][data-v=thr]'); await setOpen(page); same(T + 'the setting is still there when the app is opened again', [await page.inputValue('#tWin'), (await meals())[0]], ['7', 7]); await sheetShut(page);
      { const m = await meals(), flat = t => t.replace(/[\s\u00a0\u202f]+/g, ' ').trim();
        same(T + 'under the heading, the key says what a filled dot and an empty dot are, in the heading’s own numbers', flat(await page.locator('#thrKey').innerText()), fr ? `Avec un effet : ${m[1]} repas Sans : ${m[2] - m[1]} repas` : `With an effect: ${m[1]} meals Without: ${m[2] - m[1]} meals`);
        ok(T + 'one line says what a dot is, where the mark stands and which rows come first', flat(await page.locator('#thrSides').innerText()) === (fr ? 'Chaque point est un repas : plus il est à droite, plus il en contenait. La marque se place à la quantité qui met le mieux les points pleins d’un côté et les points vides de l’autre. Les lignes où elle y arrive le mieux viennent en premier.' : 'Each dot is a meal: the further right, the more it had. The mark stands at the amount that best puts the filled dots on one side of it and the empty dots on the other. The rows where it does that best come first.')); }
      await page.click('#app [data-act=rowsheet][data-k=fat]'); await page.locator('#sheet [data-act=rstep]').last().click(); const sheet = (await page.locator('#sheet').innerText()).replace(/[\u00a0\u202f]/g, ' ');
      ok(T + 'an opened line says the hours it was read at', sheet.includes(fr ? 'effets notés dans les 7 heures suivantes.' : 'effects reported in the 7 hours after it.'), sheet.slice(0, 200));
      ok(T + 'it puts no number on luck, and says what leaves luck more room and what leaves it less', !/luck alone|hasard seul|times? in \d|fois sur \d/i.test(sheet) && sheet.includes(fr ? 'Plus de place pour le hasard : peu d’entrées, plusieurs choses mangées ensemble, des repas plus rapprochés que les heures réglées. Moins de place : plus d’entrées, une seule chose changée à la fois, des repas plus espacés que les heures réglées.' : 'More room for luck: few entries, several things eaten together, meals closer together than the hours set. Less room: more entries, one thing changed at a time, meals further apart than the hours set.'), sheet.slice(-420));
      await page.click('#sheet [data-act=close]');
      await setOpen(page); await page.click('#sheet [data-act=tmode][data-v=day]'); same(T + 'over a day there is no slider', await page.locator('#tWin').count(), 0); await sheetShut(page);
      ok(T + 'over a day, the Settings button says so', (await page.locator('#thrBar').innerText()).includes(fr ? 'Sur une journée' : 'Over a day'));
      await page.click('#app [data-act=rowsheet][data-k=fat]'); await page.locator('#sheet [data-act=rstep]').last().click();
      { const day = (await page.locator('#sheet').innerText()).replace(/[\u00a0\u202f]/g, ' '); ok(T + 'over a day, the words about luck speak of days and name no slider', !/luck alone|hasard seul|times? in \d|fois sur \d|hours set|heures réglées/i.test(day) && day.includes(fr ? 'Plus de place pour le hasard : peu de jours, plusieurs choses mangées le même jour. Moins de place : plus de jours, une seule chose changée à la fois.' : 'More room for luck: few days, several things eaten on the same day. Less room: more days, one thing changed at a time.'), day.slice(-300)); } await page.click('#sheet [data-act=close]');
      await page.click('#topbar [data-act=ai]'); await page.click('#sheet [data-act=aiscope][data-v=all]'); const ai = await page.locator('#sheet textarea').inputValue();
      ok(T + 'the text for Ask AI says the hours the tallies were read at, as the person’s own setting', ai.includes(fr ? 'effets notés dans les 7 heures suivantes\u00a0: mon propre réglage, de 1 à 8 heures' : 'effects reported in the 7 hours after it: my own setting, from 1 to 8 hours'), ai.slice(ai.indexOf(fr ? 'COMPTES APRÈS' : 'TALLIES AFTER'), ai.indexOf(fr ? 'COMPTES APRÈS' : 'TALLIES AFTER') + 160));
      await page.click('#sheet [data-act=close]'); same(T + 'no error', A.errors, []); await A.ctx.close(); }
    // a saved setting that is not a stop of the slider is read as 4 hours; one that is, is kept
    for (const [twin, want] of [[9, '4'], [0, '4'], ['6', '4'], [2.5, '4'], [6, '6'], [1, '1']]) { const person = people.steady, B = build(person, table, 'en'), A = await open(browser, base, { state: Object.assign({}, B.state, { twin }), now: person.now, lang: 'en' }), page = A.page;
      await page.click('[data-act=tab][data-v=thr]'); await setOpen(page); same(`[slider] saved as ${JSON.stringify(twin)}, shown as ${want}`, [await page.inputValue('#tWin'), A.errors], [want, []]); await A.ctx.close(); }
    // the app says how many hours count and nothing about how long anything takes to act: no compound's sheet and no help text gives a time
    { const person = people.varied, B = build(person, table, 'en'), A = await open(browser, base, { state: B.state, now: person.now, lang: 'en' }), page = A.page;
      const texts = await page.evaluate(() => Object.keys(INFO).map(k => INFO[k].join(' '))); const timed = texts.filter(t => /\b(minutes?|hours?)\b/i.test(t));
      same('[slider] no compound’s sheet gives a time to act', timed, []); await A.ctx.close(); }

    // ================= a day is read once the day after it is over; one food's days with it and without it are read over the same span =================
    { const D = (d, h, m) => new Date(2026, 10, d, h, m || 0).getTime(), A = await open(browser, base, { lang: 'en', now: D(13, 10) }), page = A.page, flat = t => t.replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal');
      // the 11th: cheese, and "No effects". The 12th: milk, and a headache two hours later. It is now the 13th, 10 a.m.
      await page.evaluate(([a, b]) => { S.ev.push({ id: 'd1', k: 'meal', t: a, items: [{ key: 'f109', q: 1 }] }, { id: 'd2', k: 'none', t: a + 36e5, d: TLE.dayKey(a, S.roll) }, { id: 'd3', k: 'meal', t: b, items: [{ key: 'f61', q: 1 }] }, { id: 'd4', k: 'fx', t: b + 72e5, c: 'head' }); IXM = null; render(); }, [D(11, 12), D(12, 12)]);
      const go = async t => { await page.clock.setFixedTime(t); await page.evaluate(() => { IXM = null; document.dispatchEvent(new Event('visibilitychange')); }); await page.click('[data-act=tab][data-v=thr]'); await setMode(page, 'day'); };
      const nums = async () => ((await page.locator('#thrHead').innerText()).match(/\d+/g) || []).map(Number), milk = async () => { await page.fill('#tQ', 'Milk, 2%'); await page.click('#tqRows [data-act=foodrd][data-v="f61"]'); const t = flat(await page.locator('#sheet').innerText()); await page.click('#sheet [data-act=close]'); return t; };
      await go(D(13, 10));
      same('[days] on the 13th, the 11th is read (the 12th is over) and it sits with the 12th’s headache', await nums(), [1, 1]);
      ok('[days] ...and the 12th waits, since the 13th is not over, and the screen says so', flat(await page.locator('#thrWait').innerText()) === '1 day isn’t counted yet: a day is read once the day after it is over.', await page.locator('#thrWait').innerText());
      { const t = await milk(); ok('[days] the sheet for milk says its day is not counted yet', t.includes('Not reported on a complete day yet.') && t.includes('1 day with it isn’t counted yet: the day after is not over, or nothing is reported for it.'), t.slice(0, 400)); }
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
      await setHours(page, 1); ok('[new] with the slider at 1 hour, the meal waits for its hour', /its hour isn’t over/.test(await wait()), await wait());
      await refresh(80 * 60000); ok('[new] 80 minutes on, at 1 hour, the second meal has settled on the other side', /in the hour after 1 of 2 meals\./.test(await head()) && (await page.locator('#thrWait').count()) === 0, await head());
      await setHours(page, 8); ok('[new] ...and at 8 hours it is waiting again, since its 8 hours are not over', /its 8 hours aren’t over/.test(await wait()) && /in the 8 hours after 1 of 1 meal\./.test(await head()), (await head()) + ' | ' + (await wait()));
      await setHours(page, 4); await refresh(900000);
      await setMode(page, 'day'); ok('[new] over a day, today says it is waiting until the day after it is over', /^1 day isn’t counted yet: a day is read once the day after it is over\.$/.test((await wait()).trim()), await wait());
      await page.clock.setFixedTime(t0 + 5 * 3600e3); await page.evaluate(() => { IXM = null; document.dispatchEvent(new Event('visibilitychange')); }); await page.click('[data-act=tab][data-v=thr]'); await setMode(page, 'meal');
      ok('[new] once its 4 hours are over with nothing reported, the second meal is on the other side', /after 1 of 2 meals\./.test(await head()), await head());
      same('[new] no error', A.errors, []); await A.ctx.close(); }

    // ================= Threshold: shares on both sides, a kept filter, and an effect's own hours =================
    for (const lang of ['en', 'fr']) { const person = people.varied, B = build(person, table, lang), A = await open(browser, base, { state: B.state, now: person.now, lang }), page = A.page, fr = lang === 'fr', T = `[lists, ${lang}] `;
      await page.click('[data-act=tab][data-v=thr]'); const bar = async () => (await page.locator('#thrBar').innerText()).replace(/[\s\u00a0]+/g, ' '), head = async () => (await page.locator('#thrHead').innerText()).replace(/[\s\u00a0]+/g, ' ');
      // every row is a picture of dots with words beside it: one dot for each meal, a line at the mark, and the counts on each side of it
      const rows = await page.locator('#app .drow').evaluateAll(lis => lis.map(li => { const d = li.dataset, svg = li.querySelector('svg.dots'), line = li.querySelector('.dm'); return { k: d.k, hit: +d.hit, rest: +d.rest, at: d.at === undefined ? null : +d.at, dir: d.dir || null, up: +(d.hitin || 0), under: +(d.restin || 0), dh: li.querySelectorAll('circle.dh').length, dr: li.querySelectorAll('circle.dr').length, role: svg.getAttribute('role'), label: svg.getAttribute('aria-label') || '', btn: li.querySelectorAll('button[data-act=rowsheet]').length, line: !!line, text: ((li.querySelector('.dtx') || {}).textContent || '').replace(/[\s\u00a0]+/g, ' '), group: li.parentElement.id }; }));
      ok(T + 'there are rows of dots, and no table of shares for them', rows.length >= 12 && (await page.locator('#fam-base, #fam-added, #fam-amine').count()) === 0, String(rows.length));
      ok(T + 'every row draws one dot for each meal on its side, and can be opened by its name', rows.every(r => r.dh === r.hit && r.dr === r.rest && r.btn === 1), JSON.stringify(rows.filter(r => !(r.dh === r.hit && r.dr === r.rest && r.btn === 1)).slice(0, 2)));
      ok(T + 'every picture has words for a person who cannot see it', rows.every(r => r.role === 'img' && r.label.includes(fr ? `${r.hit} avec, ${r.rest} sans` : `${r.hit} with, ${r.rest} without`)), JSON.stringify(rows.find(r => r.role !== 'img' || !r.label)));
      { const marked = rows.filter(r => r.at !== null), wrong = r => (r.hit - r.up + r.rest - r.under) / (r.hit + r.rest), n = marked.length;
        ok(T + 'the rows with a mark come first, the one with the smallest share on the wrong side at the top', n > 0 && n < rows.length && rows.slice(0, n).every(r => r.at !== null) && marked.every((r, i) => !i || wrong(marked[i - 1]) <= wrong(r) + 1e-12), JSON.stringify(rows.map(r => [r.k, r.at])));
        ok(T + 'a row with a mark has its line and a sentence with the counts; a row with none has neither', rows.every(r => r.at !== null ? r.line && r.group === 'dSep' && (r.dir === 'down' ? (fr ? /^Sous .+ : \d+ sur \d+ avec\. À partir de .+ : \d+ sur \d+ sans\.$/ : /^Under .+: \d+ of \d+ with\. From .+ up: \d+ of \d+ without\.$/) : (fr ? /^À partir de .+ : \d+ sur \d+ avec\. Sous .+ : \d+ sur \d+ sans\.$/ : /^From .+ up: \d+ of \d+ with\. Under .+: \d+ of \d+ without\.$/)).test(r.text) : !r.line && !r.text && r.group === 'dMix'), JSON.stringify(rows.find(r => r.at !== null ? !r.line || !r.text : r.line || r.text)));
        ok(T + 'a mark is kept only when it leaves fewer on the wrong side than the smaller side holds', marked.every(r => r.hit - r.up + r.rest - r.under < Math.min(r.hit, r.rest)));
        ok(T + 'the rows with no mark sit under a heading that says so', (await page.locator('#dMixHead').innerText()).replace(/\u00a0/g, ' ') === (fr ? 'Sans marque : aucune quantité ne sépare celles-ci.' : 'No mark: no amount separates these.')); }
      { const r = await page.evaluate(() => { const s = E.split(E.bar(IX(), 'lact', 'meal').units); return [s.at, s.dir, s.hitIn, s.restIn, s.nHit, s.nRest]; }), row = rows.find(x => x.k === 'lact');
        same(T + 'the lactose row shows the engine’s mark and counts', [row.at, row.dir, row.up, row.under, row.hit, row.rest], r); }
      // the three views, under Settings: Full shows every row, Medium the rows with a mark, Minimal the rows whose mark is clear
      { const keys = () => page.locator('#app .drow').evaluateAll(lis => lis.map(li => li.dataset.k)), flat = t => t.replace(/[\s\u00a0\u202f]+/g, ' ').trim(), clear = r => r.at !== null && r.up * 2 > r.hit && r.under * 2 > r.rest;
        const view = async v => { await setOpen(page); await page.click(`#tView [data-act=tview][data-v=${v}]`); const note = flat(await page.locator('#tViewNote').innerText()), on = await page.locator('#tView [aria-pressed=true]').getAttribute('data-v'); await sheetShut(page); return [on, note]; };
        const more = async () => (await page.locator('#thrMore').count()) ? flat(await page.locator('#thrMore').innerText()) : '', rw = n => fr ? `${n} ${n === 1 ? 'ligne' : 'lignes'}` : `${n} ${n === 1 ? 'row' : 'rows'}`;
        const marked = rows.filter(r => r.at !== null), none = rows.length - marked.length;
        // no row has a clear mark for any effect here: the tab says the whole log can be copied for an AI
        { const anyClear = rows.some(clear), ask = (await page.locator('#thrAsk').count()) ? flat(await page.locator('#thrAsk').innerText()) : '';
          same(T + 'with meals on both sides and no clear mark, the tab offers to copy the whole log for an AI; with a clear mark it doesn’t', ask, anyClear ? '' : fr ? 'Aucune ligne n’a de marque nette. Tu peux copier tout ton journal et voir si une IA y trouve une tendance. Demander à l’IA' : 'No row has a clear mark. You can copy your whole log and see whether an AI finds a pattern in it. Ask AI');
          if (!anyClear) { await page.click('#thrAsk [data-act=aiall]'); await page.waitForSelector('#sheet.on textarea.out');
            same(T + 'its button opens Ask AI set on everything, and the app still writes no question', [await page.locator('#sheet [data-act=aiscope][aria-pressed=true]').getAttribute('data-v'), /\?/.test(await page.inputValue('#sheet textarea.out')), flat(await page.locator('#sheet').innerText()).includes(fr ? 'L’app n’écrit aucune question.' : 'The app writes no question.')], ['all', false, true]); await sheetShut(page);
            await view('min'); same(T + 'in Minimal the tab says it once: no row, then the offer', [flat(await page.locator('#thrNoRow').innerText()), flat(await page.locator('#thrAsk').innerText())], fr ? ['Aucune ligne n’a de marque nette.', 'Tu peux copier tout ton journal et voir si une IA y trouve une tendance. Demander à l’IA'] : ['No row has a clear mark.', 'You can copy your whole log and see whether an AI finds a pattern in it. Ask AI']); await view('all'); } }
        await setOpen(page); same(T + 'Settings has “Rows shown” with three choices, and it starts on Full', [(await page.locator('#tView button').allInnerTexts()).map(flat), await page.locator('#tView [aria-pressed=true]').getAttribute('data-v'), await more()], [fr ? ['Minimale', 'Moyenne', 'Complète'] : ['Minimal', 'Medium', 'Full'], 'all', '']); await sheetShut(page);
        same(T + 'Medium: says what it keeps', await view('med'), ['med', fr ? 'Toutes les lignes qui ont une marque.' : 'Every row with a mark.']);
        same(T + 'Medium keeps the rows with a mark, in the same order, and the heading for the others is gone', [await keys(), await page.locator('#dMixHead').count()], [marked.map(r => r.k), 0]);
        same(T + 'under the rows, one line says how many rows are not in this view, with the way to Settings', await more(), fr ? `Hors de cette vue : ${rw(none)} sans marque. Réglages` : `Not in this view: ${rw(none)} with no mark. Settings`);
        same(T + 'Minimal: says what a clear mark is', await view('min'), ['min', fr ? 'Seulement les lignes où la marque a plus de la moitié des points pleins d’un côté et plus de la moitié des points vides de l’autre.' : 'Only the rows where the mark has more than half of the filled dots on one side and more than half of the empty dots on the other.']);
        const clr = marked.filter(clear), less = marked.length - clr.length;
        same(T + 'Minimal keeps only the rows whose mark has more than half of each kind on its own side', await keys(), clr.map(r => r.k));
        ok(T + 'the rows left out are counted by kind', (await more()) === (fr ? `Hors de cette vue : ${less ? rw(less) + ' à la marque moins nette, ' : ''}${rw(none)} sans marque. Réglages` : `Not in this view: ${less ? rw(less) + ' with a less clear mark, ' : ''}${rw(none)} with no mark. Settings`), await more());
        if (!clr.length) same(T + 'with no clear mark, the tab says so', flat(await page.locator('#thrNoRow').innerText()), fr ? 'Aucune ligne n’a de marque nette.' : 'No row has a clear mark.');
        same(T + 'the view is saved', await page.evaluate(k => JSON.parse(localStorage.getItem(k)).tview, KEY), 'min');
        await page.click('#thrMore [data-act=tset]'); same(T + 'the link under the rows opens Settings', await page.locator('#sheet.on #tView').count(), 1); await sheetShut(page);
        same(T + 'back on Full, every row is there again', [(await view('all'))[0], (await keys()).length, await more()], ['all', rows.length, '']); }
      { const cells = (await page.locator('#fam-tog tbody td').allInnerTexts()).map(c => c.replace(/[\s\u00a0]+/g, ' ').trim());
        ok(T + '“Eaten together” keeps a share and a count on each side', cells.length === 6 && cells.every(c => (fr ? /^\d+ % \d+ sur \d+$/ : /^\d+% \d+ of \d+$/).test(c)), JSON.stringify(cells)); }
      // the two columns say what they are, each with how many meals it holds: "With" alone, beside a food's name, read as "with that food"
      { const flat = t => t.replace(/[\s\u00a0\u202f]+/g, ' ').trim(), m = (await head()).match(/\d+/g).map(Number), want = fr ? [`Avec effet ${m[1]} repas`, `Sans ${m[2] - m[1]} repas`] : [`With effect ${m[1]} meals`, `Without ${m[2] - m[1]} meals`];
        same(T + '“Eaten together”: the columns are “With effect” and “Without”, with the meals in each', (await page.locator('#fam-tog thead th').allInnerTexts()).slice(1).map(flat), want);
        await page.click('#app [data-act=rowsheet][data-k=fat]'); await page.waitForSelector('#rowSteps');
        same(T + 'an opened line: the same two columns', (await page.locator('#rowSteps thead th').allInnerTexts()).slice(1).map(flat), want); await sheetShut(page); }
      ok(T + '“Eaten together” has the line for 5 compounds or more', (await page.locator('#togMany').innerText()).includes(fr ? '5 composés ou plus dans le repas' : '5 compounds or more in the meal'));
      await filterOpen(page); await page.click('#sheet .fxpick [data-act=tfx][data-v=head]'); await sheetShut(page); await setHours(page, 2);
      same(T + 'with one effect filtered, the slider sets that effect’s own hours and leaves the general ones', await page.evaluate(() => [S.tsel, S.fxw, S.twin]), [['head'], { head: 2 }, 4]);
      ok(T + 'the Settings button and the heading say those 2 hours', (await bar()).includes(fr ? '2 heures' : '2 hours') && (await head()).includes(fr ? 'les 2 heures' : 'the 2 hours'), (await bar()) + ' | ' + (await head()));
      await setOpen(page); ok(T + 'and the settings say whose hours they are', (await page.locator('#tWinNote').innerText()).includes(fr ? 'mal de tête seulement' : 'headache alone')); await sheetShut(page);
      await filterOpen(page); await page.locator('#sheet .fxpick [data-act=tfx]').first().click(); await sheetShut(page);
      ok(T + 'back on any effect, the general 4 hours are read', (await bar()).includes(fr ? 'Tout effet' : 'Any effect') && (await bar()).includes(fr ? '4 heures' : '4 hours'), await bar());
      await filterOpen(page); await page.click('#sheet .fxpick [data-act=tfx][data-v=head]'); await page.click('#sheet .fxpick [data-act=tfx][data-v=gut]'); await page.click('#allAny [data-v="0"]'); await sheetShut(page);
      ok(T + 'two effects together are read with the general hours', (await bar()).includes(fr ? '4 heures' : '4 hours'), await bar());
      await page.reload(); await page.waitForSelector('.mb.meal'); await page.click('[data-act=tab][data-v=thr]');
      same(T + 'the picks, how they combine and the hours are still there when the app is opened again', await page.evaluate(() => [S.tsel, S.tall, S.fxw, S.twin]), [['head', 'gut'], false, { head: 2 }, 4]);
      await page.evaluate(() => { const e = S.ev.slice().reverse().find(x => x.k === 'fx' && x.c === 'head'); UI.en = { id: e.id, at: hm(e.t) }; entrySheet(); });
      same(T + 'a headache opened from Home is read with its own 2 hours', await page.locator('#befHead').innerText(), fr ? 'Dans les 2 heures d’avant' : 'In the 2 hours before'); await sheetShut(page);
      same(T + 'saved hours and picks that make no sense are dropped when the data is read', await page.evaluate(() => { const c = clean({ fxw: { head: 9, gut: '3', joint: 3 }, tsel: 'head', tall: 0 }); return [c.fxw, c.tsel, c.tall]; }), [{ joint: 3 }, [], true]);
      same(T + 'no error', A.errors, []); await A.ctx.close(); }

    // ================= Home: today's entries, and an effect that opens what came before it =================
    for (const lang of ['en', 'fr']) { const at = (d, h, m) => new Date(2026, 10, d, h, m).getTime(), t0 = at(15, 15, 10), A = await open(browser, base, { lang, now: t0 }), page = A.page, fr = lang === 'fr', T = `[home, ${lang}] `;
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal');
      same(T + 'with nothing reported it says so, and offers no link to Nutrition or History', [await page.locator('#todayNone').count(), await page.locator('#app [data-act=tonut], #app [data-act=hist], #todayCount').count()], [1, 0]);
      await page.evaluate(([y, a, b, c, d, e]) => { const meal = (id, t, ks) => ({ id, k: 'meal', t, items: ks.map(k => ({ key: k, q: 1 })) });
        S.ev = [meal('m0', y, ['f920001', 'f2850']), { id: 'x0', k: 'fx', t: a, c: 'sleep' }, meal('m1', b, ['f2873', 'f61']), meal('m2', c, ['f920001', 'f4523']), meal('m3', d, ['f502170']), { id: 'x1', k: 'fx', t: e, c: 'gut' }]; save(); render(); },
        [at(14, 18, 30), at(15, 6, 50), at(15, 7, 40), at(15, 12, 20), at(15, 13, 50), at(15, 14, 30)]);
      same(T + 'today’s entries in order, and nothing from yesterday', await page.locator('#todayList [data-act=entry]').evaluateAll(bs => bs.map(b => b.dataset.v)), ['x0', 'm1', 'm2', 'm3', 'x1']);
      same(T + 'the count under them', await page.locator('#todayCount').innerText(), fr ? '3 repas · 2 effets' : '3 meals · 2 effects');
      same(T + 'no period choice, no ring and no Effects bar on Home', await page.locator('#app [data-act=per], #app .ring, #app .fxbar').count(), 0);
      await page.click('#todayList [data-act=entry][data-v=x1]');
      same(T + 'an effect opens the meals in the 4 hours before it, the nearest first', [await page.locator('#befHead').innerText(), await page.locator('#befList [data-act=entry]').evaluateAll(bs => bs.map(b => b.dataset.v))], [fr ? 'Dans les 4 heures d’avant' : 'In the 4 hours before', ['m3', 'm2']]);
      { const shown = await page.locator('#befList li').evaluateAll(lis => lis.map(li => [li.querySelector('[data-act=entry]').dataset.v, ((li.querySelector('.held') || {}).textContent || '').replace(/\u00a0/g, ' ')]));
        const want = await page.evaluate(ids => ids.map(id => { const am = E.mealAmounts(S.ev.find(x => x.id === id), food); return E.FAMS.reduce((a, f) => a.concat(f[1]), []).filter(k => (am[k] || 0) > 0.005 || (k === 'hist' && am.histN > 0)).map(k => (S.lang === 'fr' ? BARN[k][1] : BARN[k][0]).toLowerCase()); }), shown.map(r => r[0]));
        same(T + 'under each meal before the effect, what that meal held: the things the Threshold rows count, and only those', shown.map(r => r[1] ? r[1].split(' · ').map(p => want.flat().filter(n => p.startsWith(n + ' ')).sort((a, b) => b.length - a.length)[0]) : []), want);
        ok(T + 'each with its amount', shown.every(r => r[1] && r[1].split(' · ').every(p => /\d/.test(p) && /(g|mg|portions?)$/.test(p))), JSON.stringify(shown)); }
      const gaps = await page.locator('#befList li').allInnerTexts(); ok(T + 'each with how long before', fr ? /40\s?min avant/.test(gaps[0]) && /2\s?h\s?10 avant/.test(gaps[1]) : /40\s?min before/.test(gaps[0]) && /2\s?h\s?10 before/.test(gaps[1]), gaps.join(' | '));
      ok(T + 'it names the earlier meal that is outside the hours', (await page.locator('#befNote').innerText()).includes('07:40'));
      // the same meals the Threshold tab sets this effect beside
      same(T + 'they are the meals the lists count this effect for', await page.evaluate(() => { const I = IX(); return E.mealUnits(I, 'fat').units.filter(u => u.fx.indexOf('gut') >= 0).map(u => u.id).sort(); }), ['m2', 'm3']);
      await page.click('#befList [data-act=entry][data-v=m2]'); ok(T + 'a meal in that list opens as a meal', (await page.locator('#sheet [data-act=mealedit]').count()) === 1); await page.evaluate(() => closeSheet());
      await page.click('#todayList [data-act=entry][data-v=x1]'); await page.click('#sheet [data-act=fxthr]');
      same(T + 'the link goes to the Threshold tab with that effect picked', await page.evaluate(() => [S.tab, S.tmode, S.tsel]), ['thr', 'meal', ['gut']]);
      await setHours(page, 1); await page.click('[data-act=tab][data-v=home]'); await page.click('#todayList [data-act=entry][data-v=x1]');
      same(T + 'with the slider at 1 hour, only the meal in that hour', [await page.locator('#befHead').innerText(), await page.locator('#befList [data-act=entry]').evaluateAll(bs => bs.map(b => b.dataset.v))], [fr ? 'Dans l’heure d’avant' : 'In the hour before', ['m3']]);
      await page.fill('#enAt', '10:00'); await page.click('#sheet [data-act=ensave]'); await page.click('#todayList [data-act=entry][data-v=x1]');
      same(T + 'when the effect’s time is changed, the meals before it change with it', await page.locator('#befList [data-act=entry]').count() + (await page.locator('#befNone').count()) * 10, 10);
      await page.evaluate(() => closeSheet()); await page.click('#todayList [data-act=entry][data-v=x0]');
      same(T + 'a poor sleep opens the meals of the day before, the day it is counted with', [/^(Counted with the day before|Compté avec la journée d’avant)/.test(await page.locator('#befHead').innerText()), await page.locator('#befList [data-act=entry]').evaluateAll(bs => bs.map(b => b.dataset.v)), await page.locator('#befNote').count()], [true, ['m0'], 0]);
      await page.click('#sheet [data-act=fxthr]'); same(T + 'and its link opens the Threshold tab over a day', await page.evaluate(() => [S.tab, S.tmode, S.tsel]), ['thr', 'day', ['sleep']]);
      await page.click('[data-act=tab][data-v=home]'); await page.click('#app [data-act=tonut]'); same(T + '“What went in” opens Nutrition on today, with the ring and the compounds', [await page.evaluate(() => [S.tab, S.nper]), await page.locator('#app .ring').count(), await page.locator('#compCard').count()], [['nut', 'today'], 1, 1]);
      await page.click('[data-act=tab][data-v=home]'); await page.click('#app [data-act=hist]'); ok(T + '“Earlier days” opens History', (await page.locator('#hDay').count()) === 1);
      same(T + 'saved data from before, with Home’s old period in it, is read without it', await page.evaluate(() => 'per' in clean({ per: 'h4', nper: 'month' })), false);
      same(T + 'no error', A.errors, []); await A.ctx.close(); }

    // ================= a day with nothing but water =================
    for (const lang of ['en', 'fr']) { const t0 = new Date(2026, 10, 14, 18, 0).getTime(), A = await open(browser, base, { lang, now: t0 }), page = A.page, fr = lang === 'fr';
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal');
      await page.evaluate(t => { S.ev.push({ id: 'w1', k: 'meal', t: t - 2 * 3600e3, items: [{ key: 'f930001', q: 2 }] }, { id: 'w2', k: 'meal', t: t - 3600e3, items: [{ key: 'f930003', q: 1 }] }); IXM = null; render(); }, t0);
      same(`[water, ${lang}] Home lists the two drinks as entries`, [await page.locator('#todayList li').count(), await page.locator('#todayCount').innerText()], [2, fr ? '2 repas · 0 effet' : '2 meals · 0 effects']);
      await page.click('#app [data-act=tonut]'); const nut = await page.locator('#app').innerText();
      ok(`[water, ${lang}] Nutrition doesn’t say no meal was reported when water was`, !/No meal reported|Aucun repas noté/.test(nut) && (fr ? /ne contient ni gras/ : /holds no fat/).test(nut), nut.slice(0, 300));
      await page.click('#app [data-act=comps]'); ok(`[water, ${lang}] the flavouring of the flavoured one is in reach under Nutrition`, (await page.locator('#sheet [data-act=comp][data-v=flav]').count()) === 1);
      await page.click('#sheet [data-act=comp][data-v=flav]'); const sheet = await page.locator('#sheet').innerText();
      ok(`[water, ${lang}] its sheet says what it can hold, what the label leaves out, and that one product says nothing about another`, (fr ? ['Ce qu’il peut contenir', 'Ce que l’étiquette ne dit pas', 'D’un produit à l’autre', 'ne dit rien sur l’autre', 'D’où vient le compte', 'Eau pétillante aromatisée'] : ['What it can hold', 'What the label leaves out', 'One product and another', 'says nothing about another', 'Where the count comes from', 'Sparkling water, flavoured']).every(w => sheet.includes(w)), sheet.slice(0, 200));
      await page.click('#sheet [data-act=close]');
      for (const tab of ['nut', 'thr']) { await page.click(`[data-act=tab][data-v=${tab}]`); const t = await page.locator('#app').innerText(); ok(`[water, ${lang}] ${tab}: no broken number`, !/NaN|undefined|Infinity/.test(t)); }
      same(`[water, ${lang}] no error`, A.errors, []); await A.ctx.close(); }

    // ================= how to read the tab: a card at its top until the person closes it =================
    for (const lang of ['en', 'fr']) { const fr = lang === 'fr', T = `[how to read, ${lang}] `, t0 = new Date(2026, 10, 14, 18, 0).getTime(), A = await open(browser, base, { lang, now: t0 }), page = A.page, flat = t => t.replace(/[\s\u00a0\u202f]+/g, ' ').trim();
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal'); await page.click('[data-act=tab][data-v=thr]');
      const card = flat(await page.locator('#thrIntro').innerText());
      ok(T + 'the first time the tab is opened, a card at its top says how to read it', card.startsWith(fr ? 'Comment lire cet onglet' : 'How to read this tab') && card.includes(fr ? 'Les points pleins sont les repas suivis d’un effet. Les points vides sont les autres.' : 'Filled dots are the meals an effect was reported after. Empty dots are the others.'), card.slice(0, 200));
      ok(T + 'it says that more meals make it more accurate', card.includes(fr ? 'Plus tu notes de repas, plus c’est précis.' : 'The more meals you report, the more accurate it gets.'));
      const ex = await page.locator('#thrIntro svg.dots').evaluateAll(a => a.map(v => { const line = v.querySelector('.dm'), lx = line ? +line.getAttribute('x1') : null, cx = q => [...v.querySelectorAll(q)].map(c => +c.getAttribute('cx')); return { lx, dh: cx('circle.dh'), dr: cx('circle.dr'), label: v.getAttribute('aria-label') || '', role: v.getAttribute('role') }; }));
      ok(T + 'it shows two examples, named as examples: a row an amount separates, and a row none does', ex.length === 2 && ex[0].lx !== null && ex[0].dh.every(x => x > ex[0].lx) && ex[0].dr.every(x => x < ex[0].lx) && ex[1].lx === null && ex.every(e => e.role === 'img' && e.label.startsWith(fr ? 'Un exemple' : 'An example')) && card.includes(fr ? 'UN EXEMPLE' : 'AN EXAMPLE'), JSON.stringify(ex.map(e => [e.lx, e.label])));
      ok(T + 'the examples name no food and no effect', !/lactose|fat\b|gras|headache|mal de tête/i.test(card));
      ok(T + 'with nothing reported, the tab under the card says there is nothing to show yet', flat(await page.locator('#thrCard').innerText()).startsWith(fr ? 'Rien à montrer pour l’instant.' : 'Nothing to show yet.') && (await page.locator('[data-act=thrhow]').count()) === 0);
      { const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('#thrIntro *')].some(e => e.getBoundingClientRect().right > innerWidth + 0.5)); ok(T + 'the card fits the screen', !wide); }
      await page.click('#thrIntro [data-act=thrgot]');
      same(T + '“Got it” closes it, and that is saved', [await page.locator('#thrIntro').count(), await page.evaluate(k => JSON.parse(localStorage.getItem(k)).seenThr, KEY)], [0, true]);
      await page.reload(); await page.waitForSelector('.mb.meal'); await page.click('[data-act=tab][data-v=thr]');
      same(T + 'it stays closed when the app is opened again', await page.locator('#thrIntro').count(), 0);
      await page.click('[data-act=thrhow]'); same(T + 'a link under the rows brings it back', [await page.locator('#thrIntro').count(), await page.locator('[data-act=thrhow]').count()], [1, 0]);
      // the order holds from the first meals: one meal with an effect after it, two without
      await page.click('#thrIntro [data-act=thrgot]');
      await page.evaluate(t => { const H = 3600e3; S.ev.push({ id: 'h1', k: 'meal', t: t - 30 * H, items: [{ key: 'f109', q: 1 }] }, { id: 'h2', k: 'none', t: t - 26 * H, d: E.dayKey(t - 30 * H, S.roll) }, { id: 'h3', k: 'meal', t: t - 9 * H, items: [{ key: 'f109', q: 1 }] }, { id: 'h4', k: 'meal', t: t - 5 * H, items: [{ key: 'f109', q: 3 }] }, { id: 'h5', k: 'fx', t: t - 4.5 * H, c: 'head' }); S.ev.sort((a, b) => a.t - b.t); IXM = null; render(); }, t0);
      const first = await page.locator('#app .drow').evaluateAll(lis => lis.map(li => [li.dataset.k, li.dataset.at !== undefined, +li.dataset.hit, +li.dataset.rest, +(li.dataset.hitin || 0), +(li.dataset.restin || 0)]));
      ok(T + 'with three meals, one of them followed by an effect, the rows already have their marks and their order', first.length > 0 && first[0][1] && first.every(r => r[2] === 1 && r[3] === 2) && first.filter(r => r[1]).every(r => r[4] === 1 && r[5] === 2) && (first.findIndex(r => !r[1]) < 0 || first.findIndex(r => !r[1]) >= first.filter(r => r[1]).length), JSON.stringify(first));
      same(T + 'with clear marks, the tab does not offer the AI', await page.locator('#thrAsk').count(), 0);
      same(T + 'once the card is closed, the paragraph under the heading is one line', flat(await page.locator('#thrSides').innerText()), fr ? 'Chaque point est un repas : plus il est à droite, plus il en contenait.' : 'Each dot is a meal: the further right, the more it had.');
      await page.click('[data-act=thrhow]'); ok(T + 'with the card back, the paragraph says where the mark stands and which rows come first again', flat(await page.locator('#thrSides').innerText()).endsWith(fr ? 'Les lignes où elle y arrive le mieux viennent en premier.' : 'The rows where it does that best come first.') && flat(await page.locator('#thrIntro').innerText()).includes(fr ? 'et une marque s’y trouve' : 'and a mark stands at it')); await page.click('#thrIntro [data-act=thrgot]');
      { const held = await page.evaluate(() => E.rows(IX(), 'meal').map(r => [r.b, r.any])), shown = first.map(r => r[0]).sort();
        same(T + 'a row appears only when one of the meals held some of it', shown, held.filter(r => r[1]).map(r => r[0]).sort());
        ok(T + 'what was never had has no row: no alcohol, no lactose, no fibre here', held.some(r => !r[1]) && ['alc', 'lact', 'fib'].every(k => !shown.includes(k)), JSON.stringify(shown)); }
      // water alone, with an effect after it: the meals are counted, and no row has anything to show
      await page.evaluate(t => { S.ev = [{ id: 'w1', k: 'meal', t: t - 5 * 3600e3, items: [{ key: 'f930001', q: 1 }] }, { id: 'w2', k: 'fx', t: t - 4.5 * 3600e3, c: 'head' }]; IXM = null; render(); }, t0);
      same(T + 'when no counted meal held anything, the tab says so in one line and draws no row', [await page.locator('#app .drow').count(), flat(await page.locator('#thrEmpty').innerText())], [0, fr ? 'Aucun de ces repas ne contenait ce que les lignes comptent.' : 'None of these meals held anything the rows count.']);
      same(T + 'no error', A.errors, []); await A.ctx.close(); }

    // ================= over a day: a day with no effect waits when nothing is reported for the day after =================
    for (const lang of ['en', 'fr']) { const fr = lang === 'fr', T = `[next day, ${lang}] `, t0 = new Date(2026, 10, 14, 18, 0).getTime(), A = await open(browser, base, { lang, now: t0 }), page = A.page, flat = t => t.replace(/[\s\u00a0\u202f]+/g, ' ').trim(), D = 24 * 3600e3;
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal');
      // the 10th: a meal and a tap on "No effects". The 11th: nothing at all. The 12th: a meal and a headache. The 13th: nothing.
      await page.evaluate(([t, D]) => { S.ev.push({ id: 'n1', k: 'meal', t: t - 4 * D, items: [{ key: 'f109', q: 1 }] }, { id: 'n2', k: 'none', t: t - 4 * D + 3600e3, d: E.dayKey(t - 4 * D, S.roll) }, { id: 'n3', k: 'meal', t: t - 2 * D, items: [{ key: 'f109', q: 2 }] }, { id: 'n4', k: 'fx', t: t - 2 * D + 3600e3, c: 'head' }); S.ev.sort((a, b) => a.t - b.t); S.seenThr = true; IXM = null; render(); }, [t0, D]);
      await page.click('[data-act=tab][data-v=thr]'); await setMode(page, 'day');
      same(T + 'the day with its headache is counted, and the day with no effect waits, with the reason', [flat(await page.locator('#thrHead').innerText()), flat(await page.locator('#thrWait').innerText())], fr ? ['Tout effet : noté pour 1 journée complète sur 1.', '1 journée n’est pas comptée : rien n’est noté pour le lendemain, ni effet ni appui sur « Aucun effet aujourd’hui ».'] : ['Any effect: reported for 1 of 1 complete day.', '1 day isn’t counted: nothing is reported for the day after it, no effect and no tap on “No effects today”.']);
      await page.evaluate(([t, D]) => { S.ev.push({ id: 'n5', k: 'none', t: t - 3 * D, d: E.dayKey(t - 3 * D, S.roll) }); S.ev.sort((a, b) => a.t - b.t); IXM = null; render(); }, [t0, D]);
      same(T + 'once the day after has a tap on “No effects”, the day is counted on the other side', [flat(await page.locator('#thrHead').innerText()), await page.locator('#thrWait').count()], [fr ? 'Tout effet : noté pour 1 journée complète sur 2.' : 'Any effect: reported for 1 of 2 complete days.', 0]);
      await setMode(page, 'meal'); ok(T + 'after a meal, both meals were counted all along', /2/.test(await page.locator('#thrHead').innerText()));
      same(T + 'no error', A.errors, []); await A.ctx.close(); }

    // ================= a line with nothing counted =================
    { const t0 = new Date(2026, 10, 14, 18, 0).getTime(), A = await open(browser, base, { lang: 'fr', now: t0 }), page = A.page;
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal');
      await page.evaluate(t => { S.ev.push({ id: 'g1', k: 'meal', t, items: [{ key: 'f910001', q: 1 }] }, { id: 'g2', k: 'fx', t, c: 'head' }); IXM = null; render(); }, t0);      // a can whose label does not split its carbs
      await page.click('[data-act=tab][data-v=thr]'); const gone = await page.locator('#thrGone').innerText();
      ok('[new] a line with nothing counted is not shown as two dashes', (await page.locator('#app [data-act=rowsheet][data-k=cplx]').count()) === 0 && (await page.locator('#app [data-act=rowsheet][data-k=sug]').count()) === 0 && (await page.locator('#app [data-act=rowsheet][data-k=caf]').count()) === 1);
      ok('[new] the can holds no fat, so there is no fat row either', (await page.locator('#app [data-act=rowsheet][data-k=fat]').count()) === 0);
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

    // ================= French: corrections that must stay =================
    { const html = fs.readFileSync(path.join(ROOT, 'threshold/app/index.html'), 'utf8'), A = await open(browser, base, { lang: 'fr' }), page = A.page;
      await page.click('[data-act=enter]'); await page.waitForSelector('.mb.meal');
      const gone = ['route rapide', 'écrit à la main', 'pour chaque quantité', 's’entre comme', 'mis en moyenne', 'Composés des plantes', 'composés des plantes', 'à côté d’un de ces aliments',
        'Amené', 'Amène', 'amène ta liste', 'amène-les', 'Les amener', 'Hier a des repas', 'Ce qui est entré', 'Des comptes seulement', 'noté encore', 'compté encore', 'montrer encore', 'amener encore', '\'jour\':\'jours\''].filter(w => html.includes(w));
      same('[french] wording that said something other than the English is gone', gone, []);
      await page.click('[data-act=menu]'); const items = await page.locator('#sheet button').allInnerTexts(), named = (html.match(/Menu → Restaurer[^.'`<]*?(?= ramène|\.)/g) || []).map(x => x.replace('Menu → ', ''));
      ok('[french] a message that sends to the menu names the menu item as the menu writes it', named.length >= 2 && named.every(n => items.some(t => t.trim() === n)), JSON.stringify([named, items]));
      await page.evaluate(() => closeSheet());
      // a serving's adjective agrees with its food: these twelve are feminine, or a size
      const want = { 1704: '1 moyenne', 1696: '1 moyenne', 1722: '1 moyenne', 1731: '1 moyenne', 2506: '1 moyenne', 2380: '1 moyenne', 2460: '1 moyenne', 2241: '1 moyenne', 2225: '½ moyenne', 4049: '1 grosse', 2501: '2 petites', 2185: '1 format moyen' };
      same('[french] the serving agrees with the food', await page.evaluate(ids => { const o = {}; for (const id of ids) o[id] = FB['f' + id].s[1]; return o; }, Object.keys(want).map(Number)), want);
      same('[french] and their English servings are as they were', await page.evaluate(() => [FB.f1704.s[0], FB.f4049.s[0], FB.f2501.s[0], FB.f2185.s[0]]), ['1 medium', '1 large', '2 small', '1 medium']);
      same('[french] a day the app counts is « une journée », and what is left out agrees with it', await page.evaluate(() => [unitWord('day', 1), unitWord('day', 3), unitWord('meal', 3), /laissé\$\{mode==='day'\?'e':''\}/.test(vThr.toString()), /laissé\$\{B\.mode==='day'\?'e':''\}/.test(rowSheet.toString())]), ['journée', 'journées', 'repas', true, true]);
      same('[french] bringing in the Food Trial Log’s lists is « importer »', await page.evaluate(() => { S.tab = 'nut'; render(); return [...document.querySelectorAll('#app p')].some(p => p.textContent.startsWith('Importe ta liste')); }), true);
      same('[french] no error', A.errors, []); await A.ctx.close(); }

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
