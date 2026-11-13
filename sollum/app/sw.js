/* Sollum — offline cache. A new app version changes CACHE, so phones pick it up on the next open with a connection.
   Copyright (C) 2026  Tobie David · SPDX-License-Identifier: AGPL-3.0-or-later, with two terms under its section 7 (see the notice
   at the top of index.html) · https://github.com/tobiedavid/v3ktor.org */
const CACHE='sollumapp-0.6.8-7d67cfb0';
const SHELL=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/favicon-32.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('sollumapp-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET' || new URL(r.url).origin!==location.origin) return;
  if(r.mode==='navigate'){ /* network first so updates arrive; on a weak signal the cached copy after 3 s; offline, the cache */
    const net=fetch(r).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(CACHE).then(c=>c.put('index.html',cp)); } return res; });
    const slow=new Promise(ok=>setTimeout(ok,3000)).then(()=>caches.match('index.html'));
    e.respondWith(Promise.race([net.catch(()=>caches.match('index.html')), slow.then(c=>c||net)]));
    return; }
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r)));
});
