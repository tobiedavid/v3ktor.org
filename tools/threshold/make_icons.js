// Draws the Threshold Log's icons: a plain glass, filled below a mark, on the family's orange square.
// A threshold drawn as a level and a line, with nothing shown crossing it.
//   node tools/threshold/make_icons.js        (needs Playwright with Chromium; writes threshold/app/icons/*.png)
const { chromium } = require('playwright'), path = require('path');
const OUT = path.join(__dirname, '..', '..', 'threshold', 'app', 'icons'), BG = '#c8481f', CREAM = '#f7f4ee', INK = '#1c1b19';
// the glyph on a 512 square: the glass (wider at the top), what it holds, and the mark above that
const cells = `<path d="M132 130 L166 346 Q171 382 208 382 H304 Q341 382 346 346 L380 130" fill="none" stroke="${CREAM}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`
  + `<path d="M185 262 H327 L317 332 Q314 352 294 352 H218 Q198 352 195 332 Z" fill="${CREAM}"/>`
  + `<rect x="172" y="190" width="168" height="28" rx="14" fill="${INK}"/>`;
const svg = (size, { round, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="${round ? 104 : 0}" fill="${BG}"/><g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${cells}</g></svg>`;
(async () => {
  const b = await chromium.launch();
  for (const [file, size, opt] of [['icon-512.png', 512, { round: true, scale: 1 }], ['icon-192.png', 192, { round: true, scale: 1 }], ['maskable-512.png', 512, { round: false, scale: 0.84 }], ['apple-touch-icon.png', 180, { round: false, scale: 1 }], ['favicon-32.png', 32, { round: true, scale: 1.08 }]]) {
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:transparent">${svg(size, opt)}</body>`);
    await p.screenshot({ path: path.join(OUT, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }); await p.close(); console.log(file);
  }
  await b.close();
})();
