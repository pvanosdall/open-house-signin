/* Open house sign-in: offline shell.
 *
 * Everything the page needs (HTML, fonts, logo, icons) is saved on the iPad the
 * first time it loads online, so the sign-in screen opens with no wifi at all.
 * Sign-in data itself is handled by the queue inside index.html, not here.
 *
 * To ship a change: edit the files, bump VERSION below, upload to GitHub.
 * The iPad picks up the new version the next time it opens the page online.
 */
const VERSION = 'ohs-v3';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './fonts/fraunces-latin-wght-normal.woff2',
  './fonts/work-sans-latin-wght-normal.woff2',
  './assets/logo-white.png',
  './assets/logo-dark.png',
  './assets/bg/ocean.jpg',
  './assets/bg/ocean-thumb.jpg',
  './assets/bg/canal.jpg',
  './assets/bg/canal-thumb.jpg',
  './assets/bg/sunrise.jpg',
  './assets/bg/sunrise-thumb.jpg',
  './assets/bg/beach.jpg',
  './assets/bg/beach-thumb.jpg',
  './assets/bg/mountain.jpg',
  './assets/bg/mountain-thumb.jpg',
  './assets/bg/palms.jpg',
  './assets/bg/palms-thumb.jpg',
  './assets/bg/ridge.jpg',
  './assets/bg/ridge-thumb.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle our own GET requests. Sign-in POSTs to Google never pass through here.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Page loads: try the network briefly so updates arrive, otherwise use the saved copy.
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, 2500));
    return;
  }

  // Fonts, logo, icons: saved copy first, refreshed quietly in the background.
  event.respondWith(staleWhileRevalidate(req));
});

function networkFirst(req, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const fallback = () =>
      caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || caches.match('./index.html'))
        .then((hit) => hit || Response.error());

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      fallback().then(resolve);
    }, timeoutMs);

    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./index.html', copy));
        if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
      })
      .catch(() => {
        if (!settled) { settled = true; clearTimeout(timer); fallback().then(resolve); }
      });
  });
}

function staleWhileRevalidate(req) {
  return caches.open(VERSION).then((cache) =>
    cache.match(req, { ignoreSearch: true }).then((hit) => {
      const refresh = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => hit);
      return hit || refresh;
    })
  );
}
