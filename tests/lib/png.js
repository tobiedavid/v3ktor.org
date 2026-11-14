// Reads a picture of the screen into its pixels, so a test can check what is drawn and not only what the page says is drawn.
// Plain Node, nothing to install. It reads the one kind of PNG a browser screenshot is: 8 bits a channel, RGB or RGBA, not interlaced.
'use strict';
const zlib = require('zlib');

function decode(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, bpp = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || (data[9] !== 2 && data[9] !== 6) || data[12]) throw new Error(`a kind of PNG this reader does not read: depth ${data[8]}, colour type ${data[9]}, interlace ${data[12]}`);
      bpp = data[9] === 6 ? 4 : 3; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), row = w * bpp, px = Buffer.alloc(h * row);
  if (raw.length !== h * (row + 1)) throw new Error('PNG data is not the size its header says');
  for (let y = 0; y < h; y++) { const f = raw[y * (row + 1)], o = y * (row + 1) + 1, d = y * row;      // each row starts with the filter it was saved with
    for (let x = 0; x < row; x++) { const a = x >= bpp ? px[d + x - bpp] : 0, b = y ? px[d - row + x] : 0, c = x >= bpp && y ? px[d - row + x - bpp] : 0;
      let add = 0;
      if (f === 1) add = a; else if (f === 2) add = b; else if (f === 3) add = (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (f !== 0) throw new Error('PNG row filter ' + f);
      px[d + x] = (raw[o + x] + add) & 255; } }
  return { w, h, at: (x, y) => { const i = y * row + x * bpp; return [px[i], px[i + 1], px[i + 2]]; } };
}
module.exports = { decode };
