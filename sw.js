const CACHE_NAME = 'f1-intelligence-v2'; // Incrementado para invalidar caché antigua cómodamente
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/3759/3759521.png',
  'https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precachando archivos del sistema...');
      // Mapear cada recurso para que falle de forma independiente y no detenga la instalación si falla una CDN externa
      const cachePromises = ASSETS_TO_CACHE.map((url) => {
        return cache.add(url).catch((err) => {
          console.warn(`[Service Worker] Falló al precachar recurso estático: ${url}`, err);
        });
      });
      return Promise.all(cachePromises);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché obsoleta:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar peticiones con método GET
  if (request.method !== 'GET') {
    return;
  }

  // Filtrar peticiones a servicios críticos y APIs dinámicas de Firebase
  // El SDK de Firebase ya tiene configurados persistentLocalCache y persistentMultipleTabManager
  // para persistencia offline a nivel de datos. No deben ser capturados por la caché HTTP ordinaria de SW.
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    url.hostname.includes('firebasestorage') ||
    url.pathname.includes('/google.firestore.v1.Firestore')
  ) {
    return;
  }

  // Ignorar peticiones de desarrollo para hot-reload de Vite
  if (
    url.pathname.includes('@vite') ||
    url.pathname.includes('node_modules') ||
    (url.hostname === 'localhost' && url.port !== '3000')
  ) {
    return;
  }

  // 1) MODO DE NAVEGACIÓN (Rutas SPA / index.html)
  // Permite recargar la app en cualquier sub-ruta (ej. /ventas, /inventario) sin conexión a internet.
  // Sirve la carcasa principal (index.html) para que el enrutamiento del lado del cliente herede el control.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('./index.html', responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si no hay internet, devolvemos index.html de la caché para conservar la SPA cargable offline
          return caches.match('./index.html') || caches.match('/');
        })
    );
    return;
  }

  // 2) RECURSOS ESTÁTICOS (scripts, estilos, fuentes e imágenes)
  // Aplica Stale-While-Revalidate: carga instantánea desde caché y actualización silenciosa de fondo.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // Solo cacheamos respuestas exitosas o respuestas opacas de CDNs de confianza
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const isLocalAsset = url.origin === self.location.origin;
            const isGoogleFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
            const isIconCDN = url.hostname.includes('cdn-icons-png.flaticon.com') || url.hostname.includes('material-symbols');

            const destination = request.destination;
            const isCacheableDestination = ['script', 'style', 'image', 'font'].includes(destination);
            const isManualCacheable = 
              url.pathname.endsWith('.js') || 
              url.pathname.endsWith('.css') || 
              url.pathname.endsWith('.png') || 
              url.pathname.endsWith('.svg') || 
              url.pathname.endsWith('.json') ||
              url.pathname.endsWith('.woff2');

            if (isLocalAsset || isGoogleFont || isIconCDN || isCacheableDestination || isManualCacheable) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
          }
          return networkResponse;
        })
        .catch((error) => {
          console.warn(`[Service Worker] Error al buscar en red para ${request.url}. Buscando copia en caché.`, error);
          if (cachedResponse) {
            return cachedResponse;
          }
          throw error;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
