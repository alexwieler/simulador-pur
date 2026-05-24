/* ===================== Service Worker — Simulador PUR ===================== */
/* Subí el número de versión cada vez que cambies archivos para forzar el refresco. */
const CACHE = 'pur-sim-v1';
const ASSETS = [
  '.',
  'index.html',
  'styles.css',
  'app.js',
  'preguntas.json',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable.png',
  'apple-touch-icon.png',
  'favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Estrategia: red primero (para tomar actualizaciones), con caída a caché si no hay conexión. */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
