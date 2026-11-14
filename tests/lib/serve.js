// A small static file server for the tests: serves the repository as the website would be served. No packages.
const http = require('http'), fs = require('fs'), path = require('path');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
function serve(root, port) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); res.end(); return; }
    let file = path.join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.stat(file, (err, st) => {
      if (!err && st.isDirectory()) { if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); res.end(); return; } file = path.join(file, 'index.html'); }
      fs.readFile(file, (e2, buf) => {
        if (e2) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(buf);
      });
    });
  });
  return new Promise(ok => server.listen(port || 0, '127.0.0.1', () => ok({ server, port: server.address().port, url: 'http://localhost:' + server.address().port, close: () => new Promise(r => server.close(r)) })));
}
module.exports = { serve };
