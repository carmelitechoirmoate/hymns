/* Offline support for the Carmelite Choir Hymns site.
   On install it saves every page, picture and the search index listed in
   offline-pages.json, so the whole hymn book works with no signal.
   Pages are fetched fresh when online (so edits show up) and fall back to
   the saved copy when offline. Bump VERSION to force a full refresh. */
const VERSION = 'v1'
const CACHE = 'hymns-' + VERSION
const CORE = ['./', 'index.html', 'offline-pages.json', 'search-index.js', 'manifest.webmanifest',
  '_/css/site.css', '_/css/site-extra.css', '_/css/search.css', '_/js/site.js', '_/js/hymns.js',
  '_/js/search-ui.js', '_/js/vendor/lunr.js', '_/img/carmelite-arms.svg', '_/img/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll(CORE)
    try {
      const list = await (await fetch('offline-pages.json', { cache: 'no-store' })).json()
      // Add one at a time so a single missing file does not stop the rest.
      for (const url of list.urls) {
        try { await cache.add(url) } catch (e) {}
      }
    } catch (e) {}
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const res = await fetch(req)
      if (res.ok) cache.put(req, res.clone())
      return res
    } catch (e) {
      const hit = await cache.match(req, { ignoreSearch: true })
      if (hit) return hit
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error()
      return Response.error()
    }
  })())
})
