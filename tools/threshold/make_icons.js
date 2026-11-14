// Draws the Threshold Log's icons: the app's own bar, five steps, turning at the fourth, on the family's orange square.
//   node tools/threshold/make_icons.js        (needs Playwright with Chromium; writes threshold/app/icons/*.png)
const { chromium } = require('playwright'), path = require('path');
const OUT = path.join(__dirname, '..', '..', 'threshold', 'app', 'icons'), BG = '#c8481f', CREAM = '#f7f4ee', INK = '#1c1b19';
// the glyph on a 512 square: five cells, 56 wide, 10 apart; the last two dark, each with the mark a step with effects carries
const cells = [0, 1, 2, 3, 4].map(i => { const x = 96 + i * 66, dark = i > 2; return `<rect x="${x}" y="148" width="56" height="216" rx="14" fill="${dark ? INK : CREAM}"/>` + (dark ? `<circle cx="${x + 28}" cy="256" r="11" fill="${CREAM}"/>` : ''); }).join('');
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
