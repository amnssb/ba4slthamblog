/*
把站点配置写成 PWA 的 manifest 和 service worker。只有构建会调用。
调用示例：
  const manifest = renderManifest(config, themeConfig)
  const worker = renderServiceWorker(config)
*/

export function renderManifest(config, themeConfig) {
  const rootUrl = `${config.__basePath || ''}/`;
  return {
    name: config.title,
    short_name: config.title,
    description: config.description,
    start_url: rootUrl,
    scope: rootUrl,
    display: 'standalone',
    background_color: themeConfig.colors?.background || '#f5f7f8',
    theme_color: themeConfig.colors?.primary || '#e64c8c',
    icons: [
      { src: `${config.__basePath || ''}/favicon.svg`, sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}

export function renderServiceWorker(config) {
  const cacheName = `ham-blog-${config.__assetVersion}`;
  const assetVersion = `?v=${config.__assetVersion}`;
  const rootUrl = `${config.__basePath || ''}/`;
  const coreAssets = [
    rootUrl,
    `${config.__basePath || ''}/style.css${assetVersion}`,
    `${config.__basePath || ''}/script.js${assetVersion}`,
    `${config.__basePath || ''}/manifest.json${assetVersion}`,
    ...(config.features?.search?.enabled !== false
      ? [`${config.__basePath || ''}/search-index.json${assetVersion}`]
      : []),
  ];

  return `const CACHE_NAME = '${cacheName}';
const CORE_ASSETS = ${JSON.stringify(coreAssets)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('ham-blog-') && key !== CACHE_NAME).map((key) => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('${rootUrl}')))
    );
    return;
  }

  if (event.request.destination === 'script' || event.request.destination === 'style' || event.request.destination === 'worker') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => {
    const network = fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => cached);
    return cached || network;
  }));
});
`;
}
