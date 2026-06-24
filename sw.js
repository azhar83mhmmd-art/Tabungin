const CACHE_NAME = 'tabungin-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/supabase.js',
  './js/scanner.js',
  './js/insight.js',
  './js/charts.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=> cache.addAll(ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event)=>{
  event.waitUntil(
    caches.keys().then(keys=> Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event)=>{
  const req = event.request;
  if(req.method !== 'GET') return;

  // App shell: cache-first
  if(ASSETS.some(a => req.url.endsWith(a.replace('./','/')))){
    event.respondWith(
      caches.match(req).then(cached=> cached || fetch(req).then(res=>{
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c=> c.put(req, clone));
        return res;
      }))
    );
    return;
  }

  // Everything else (CDN libs, API calls): network-first, fallback to cache
  event.respondWith(
    fetch(req).then(res=>{
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c=> c.put(req, clone)).catch(()=>{});
      return res;
    }).catch(()=> caches.match(req))
  );
});
