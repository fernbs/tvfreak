const CACHE = 'tvfreak-v3'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) return

  // HTML navigation: bypass HTTP/CDN cache entirely so the app always loads fresh
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(new Request(request, { cache: 'no-store' }))
        .then(res => {
          caches.open(CACHE).then(c => c.put(request, res.clone()))
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Hashed assets (/assets/foo.abc12345.js): cache first — content hash guarantees freshness
  if (/\/assets\/[^/]+\.[a-f0-9]{8,}\.(js|css)/.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(res => {
          caches.open(CACHE).then(c => c.put(request, res.clone()))
          return res
        })
      })
    )
    return
  }

  // Everything else: network first with cache fallback
  e.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(request, res.clone()))
        return res
      })
      .catch(() => caches.match(request))
  )
})
