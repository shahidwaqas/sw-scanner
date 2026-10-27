/* SW Scanner service worker. Change VER whenever you upload a new version. */
const VER = 'swscanner-2026-10-27-a';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'logo.png', 'fb.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VER).then(c =>
    Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VER) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* Network first (so updates always arrive), cache as the offline fallback.
   Only our own files are handled; Firebase, Google and CDN requests go straight to the network. */
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const timeout = new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 5000));
      const res = await Promise.race([fetch(r), timeout]);
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VER).then(c => c.put(r, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(r, { ignoreSearch: true });
      if (hit) return hit;
      if (r.mode === 'navigate') {
        const home = (await caches.match('index.html')) || (await caches.match('./'));
        if (home) return home;
      }
      return Response.error();
    }
  })());
});
