
const CACHE_NAME = 'dataflow-v1';
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  // Estrategia de red primero para asegurar datos actualizados
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
