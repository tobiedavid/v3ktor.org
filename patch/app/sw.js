/* The Patch — offline cache. A new app version changes CACHE, so phones pick it up on the next open with a connection. */
const CACHE='thepatch-1.2.37-d86e6004';
const SHELL=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/favicon-32.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('thepatch-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET' || new URL(r.url).origin!==location.origin) return;
  if(r.mode==='navigate'){ /* the page: network first so updates arrive — but on a weak signal, the cached copy after 3 seconds (v1.2.21); offline, the cache right away */
    const net=fetch(r).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(CACHE).then(c=>c.put('index.html',cp)); } return res; }); /* only a good page replaces the cached one */
    const slow=new Promise(ok=>setTimeout(ok,3000)).then(()=>caches.match('index.html'));
    e.respondWith(Promise.race([net.catch(()=>caches.match('index.html')), slow.then(c=>c||net)]));
    return; }
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r)));
});
