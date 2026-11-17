// Draws the Library's icons: an open book, on the family's orange square.
//   node tools/library/make_icons.js        (needs Playwright with Chromium; writes library/app/icons/*.png)
const { chromium } = require('playwright'), path = require('path');
const OUT = path.join(__dirname, '..', '..', 'library', 'app', 'icons'), BG = '#c8481f', CREAM = '#f7f4ee', INK = '#1c1b19';
// the glyph on a 512 square: two pages open from a spine, a line of text on each
const cells = `<path d="M256 158 Q200 124 112 132 V372 Q200 364 256 398 Z" fill="${CREAM}"/>`
  + `<path d="M256 158 Q312 124 400 132 V372 Q312 364 256 398 Z" fill="${CREAM}"/>`
  + `<path d="M256 158 V398" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>`
  + `<path d="M146 200 Q190 194 226 210 M146 250 Q190 244 226 260 M286 210 Q322 194 366 200 M286 260 Q322 244 366 250" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round" opacity="0.85"/>`;
const svg = (size, { round, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="${round ? 104 : 0}" fill="${BG}"/><g transform="translate(256 256) scale(${scale}) translate(-256 -270)">${cells}</g></svg>`;
(async () => {
  const b = await chromium.launch();
  for (const [file, size, opt] of [['icon-512.png', 512, { round: true, scale: 1 }], ['icon-192.png', 192, { round: true, scale: 1 }], ['maskable-512.png', 512, { round: false, scale: 0.84 }], ['apple-touch-icon.png', 180, { round: false, scale: 1 }], ['favicon-32.png', 32, { round: true, scale: 1.08 }]]) {
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:transparent">${svg(size, opt).replace('viewBox="0 0 512 512"', `viewBox="0 0 512 512" style="display:block"`)}</body>`);
    await p.screenshot({ path: path.join(OUT, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }); await p.close(); console.log(file);
  }
  await b.close();
})();
