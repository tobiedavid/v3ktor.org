/* Sollum moved from /sollum/ to /sollum/app/ on 8 Nov 2026; /sollum/ is now the website page.
   This worker replaces the old one at /sollum/: it clears the old offline copy and removes itself,
   so a phone that opened the old address gets the page, and the app runs from /sollum/app/.
   Copyright (C) 2026  Tobie David · SPDX-License-Identifier: AGPL-3.0-or-later · https://github.com/tobiedavid/v3ktor.org */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('sollum-')).map(k=>caches.delete(k))))
  .then(()=>self.registration.unregister()).then(()=>self.clients.matchAll()).then(cs=>cs.forEach(c=>c.navigate(c.url))))});
