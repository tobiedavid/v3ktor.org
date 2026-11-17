// The Library, in a browser, in both languages, on a 320-pixel phone: the door, the six stops, a section, every picture of every card
// one tap at a time (nothing off screen, every label inside its picture, no script error, the words it never uses), the precise
// version and its sources, the keyboard, a swipe, and a card opened straight from its address (#its-name), before and after the door.
//   node tests/library/screens.test.js      (needs Playwright with Chromium)
'use strict';
const path = require('path'), { chromium } = require('playwright'), { serve } = require('../lib/serve.js');
const ROOT = path.join(__dirname, '..', '..');
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (detail ? '\n     ' + String(detail).slice(0, 500) : '')); } }
const NEVER = /\b(safe|avoid|should|trigger|healthy|unhealthy)\b|sécuritaire|éviter|devrait|devriez|déclencheur|malsain/i;

(async () => {
  const srv = await serve(ROOT), browser = await chromium.launch(), base = srv.url + '/library/app/';
  try {
    for (const locale of ['en-CA', 'fr-CA']) { const lg = locale.slice(0, 2), T = s => `(${lg}) ${s}`;
      const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, locale, serviceWorkers: 'block', hasTouch: true }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      const words = async where => { const t = await page.evaluate(() => document.body.innerText); ok(T(where + ': none of the words the apps never use'), !NEVER.test(t), (t.match(NEVER) || [])[0]); };
      // a card opened from its address before the door: the door first, then that card
      await page.goto(base + '#brain-fuel'); await page.waitForTimeout(150);
      ok(T('the door comes first, with its five statements'), await page.locator('.gate ol li').count() === 5);
      ok(T('the door fits a 320-pixel screen'), await fits()); await words('the door');
      await page.click('[data-act="enter"]'); await page.waitForTimeout(80);
      ok(T('after the door, the card from the address'), (await page.locator('h2').innerText()).length > 3 && await page.locator('#pic svg').count() === 1, await page.locator('h2').innerText());
      // home
      await page.click('.topbar [data-act="home"]'); await page.waitForTimeout(80);
      ok(T('home: six stops on the picture and six rows'), await page.locator('svg .stop').count() === 6 && await page.locator('.cardrow').count() === 6);
      ok(T('home fits'), await fits()); await words('home');
      // a stop that isn't written yet says so; Energy lists its cards
      const empty = await page.evaluate(() => (SECTIONS.find(s => !CARDS.some(c => c.sec === s.id)) || {}).id);
      await page.locator(`.cardrow[data-v="${empty}"]`).click(); await page.waitForTimeout(60);
      ok(T('a stop not written yet says so'), await page.locator('.card.soft').count() === 1);
      // every stop that has cards lists them; every picture of every card, one tap at a time
      const secs = await page.evaluate(() => SECTIONS.filter(s => CARDS.some(c => c.sec === s.id)).map(s => s.id));
      ok(T('Energy and Signals have cards'), secs.includes('energy') && secs.includes('signals'), secs.join(' '));
      let cards = [];
      for (const sec of secs) {
      await page.click('.topbar [data-act="home"]'); await page.waitForTimeout(60);
      await page.locator(`svg .stop[data-v="${sec}"]`).click(); await page.waitForTimeout(60);
      const list = await page.evaluate(s => CARDS.filter(c => c.sec === s).map(c => ({ id: c.id, n: c.f.length, src: c.src.length })), sec);
      if (sec === 'energy') cards = list;
      ok(T(`${sec} lists its cards`), await page.locator('.cardrow[data-act="card"]').count() === list.length && list.length >= 1);
      for (const c of list) {
        await page.locator(`.cardrow[data-v="${c.id}"]`).click(); await page.waitForTimeout(60);
        ok(T(`${c.id}: Back is hidden on the first picture`), await page.locator('#bar [data-act="prev"].hide').count() === 1);
        for (let i = 0; i < c.n; i++) { const W = T(`${c.id} picture ${i + 1}`);
          ok(W + ': its number in the bar', (await page.locator('#bar .small').innerText()).replace(/\s+/g, ' ').includes(`${i + 1} / ${c.n}`));
          ok(W + ': one dot per picture, this one on', await page.locator('.dots span').count() === c.n && await page.locator(`.dots span:nth-child(${i + 1}).on`).count() === 1);
          ok(W + ': a caption and a grade', (await page.locator('.cap').innerText()).length > 20 && /:\s*(solid|likely|solide|probable)/.test(await page.locator('.grade').innerText()));
          const out = await page.evaluate(() => { const s = document.querySelector('#pic svg'), vb = s.viewBox.baseVal, bad = [];
            for (const t of s.querySelectorAll('text')) { const b = t.getBBox(); if (b.x < -0.5 || b.y < -0.5 || b.x + b.width > vb.width + 0.5 || b.y + b.height > vb.height + 0.5) bad.push(t.textContent + ' ' + [b.x, b.y, b.width, b.height].map(Math.round).join(',')); }
            return bad; });
          ok(W + ': every label inside the picture', !out.length, out.join(' | '));
          ok(W + ': nothing runs off the screen', await fits()); await words(`${c.id} picture ${i + 1}`);
          if (i < c.n - 1) { await page.click('#bar [data-act="next"]'); await page.waitForTimeout(40); } }
        // the precise version and its sources
        await page.click('[data-act="more"]'); await page.waitForTimeout(260);
        const links = await page.locator('#sheet ol.srcs a').evaluateAll(as => as.map(a => a.href));
        ok(T(`${c.id}: the precise version lists every source, each one a link`), links.length === c.src && links.every(h => /^https:\/\//.test(h)), links.join(' '));
        await words(`${c.id} precise version`);
        await page.click('#sheet [data-act="close"]'); await page.waitForTimeout(260);
        // Done on the last picture: back to the section, the card marked as read
        await page.click('#bar [data-act="next"]'); await page.waitForTimeout(80);
        ok(T(`${c.id}: Done goes back to the section and marks the card`), (await page.locator(`.cardrow[data-v="${c.id}"] .n`).innerText()).includes('✓'));
      }
      }
      // a stop with one card says « 1 card », not « 1 cards »
      await page.click('.topbar [data-act="home"]'); await page.waitForTimeout(60);
      ok(T('home: one card is singular'), !/\b1 (cards|cartes)\b/.test(await page.locator('.cardrow').allInnerTexts().then(a => a.join(' '))));
      // the keyboard and a swipe move one picture
      await page.locator('svg .stop[data-v="energy"]').click(); await page.waitForTimeout(60);
      await page.locator(`.cardrow[data-v="${cards[0].id}"]`).click(); await page.waitForTimeout(60);
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(40);
      ok(T('the right arrow key moves one picture'), (await page.locator('#bar .small').innerText()).replace(/\s+/g, ' ').includes(`2 / ${cards[0].n}`));
      const box = await page.locator('#pic svg').boundingBox();
      await page.evaluate(([x, y]) => { const el = document.querySelector('#pic svg'), mk = (cx) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: y });
        el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [mk(x + 200)], changedTouches: [mk(x + 200)] }));
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [mk(x + 40)] })); }, [box.x, box.y + box.height / 2]);
      await page.waitForTimeout(60);
      ok(T('a swipe to the left moves one picture'), (await page.locator('#bar .small').innerText()).replace(/\s+/g, ' ').includes(`3 / ${cards[0].n}`));
      // the colours and the help sheet
      await page.click('#menuBtn'); await page.waitForTimeout(260); await page.click('#sheet [data-act="colours"]'); await page.waitForTimeout(260);
      ok(T('the colours sheet lists the visual alphabet'), await page.locator('#sheet ul.cols li').count() >= 8); await words('the colours');
      await page.click('#sheet [data-act="close"]'); await page.waitForTimeout(260);
      // an address opened after the door goes straight to the card; the browser's Back goes to the screen before
      await page.goto(base + '#caffeine-clock'); await page.waitForTimeout(120);
      ok(T('an address opens its card straight away once agreed'), await page.locator('#pic svg').count() === 1 && await page.locator('.gate').count() === 0);
      ok(T('no script error'), !errors.length, errors.join(' | '));
      await ctx.close();
    }
  } catch (e) { fail++; console.log('STOPPED: ' + (e.stack || e)); }
  await browser.close(); await srv.close();
  console.log(fail ? `${fail} failed, ${pass} passed` : `ok ${pass} checks`); process.exit(fail ? 1 : 0);
})();
