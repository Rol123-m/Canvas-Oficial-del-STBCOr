/* STBCOr Gestión de Aulas · Service Worker */
const CACHE_VERSION = 'stbcor-gestion-v1.0.3';
const SHELL_FILES = [
  './','./index.html','./manifest.webmanifest','./css/app.css',
  './js/config.js','./js/api.js','./js/app.js','./js/pwa.js',
  './assets/logo.png','./assets/stbcor-gestion-icon.svg',
  './assets/stbcor-gestion-maskable.svg',
  './vendor/fonts/fonts.css',
  './vendor/fonts/merriweather-latin-400-normal.woff2',
  './vendor/fonts/merriweather-latin-700-normal.woff2',
  './vendor/fonts/open-sans-latin-400-normal.woff2',
  './vendor/fonts/open-sans-latin-600-normal.woff2',
  './vendor/fonts/open-sans-latin-700-normal.woff2',
  './vendor/fa/all.min.css','./vendor/fa/webfonts/fa-brands-400.woff2',
  './vendor/fa/webfonts/fa-regular-400.woff2','./vendor/fa/webfonts/fa-solid-900.woff2'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_VERSION).then(cache=>cache.addAll(SHELL_FILES.map(path=>new URL(path,self.registration.scope).href)))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('stbcor-gestion-')&&key!==CACHE_VERSION).map(key=>caches.delete(key)));await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.pathname.includes('/functions/v1/')||url.pathname.includes('/rest/v1/'))return;
 if(request.mode==='navigate'){event.respondWith((async()=>{try{const response=await fetch(request);const cache=await caches.open(CACHE_VERSION);cache.put(new URL('./index.html',self.registration.scope),response.clone());return response;}catch(_){return(await caches.match(new URL('./index.html',self.registration.scope)))||(await caches.match(new URL('./',self.registration.scope)));}})());return;}
 if(url.pathname.includes('/recursos/')){event.respondWith((async()=>{const cached=await caches.match(request);const fresh=fetch(request).then(response=>{if(response&&response.ok){const size=Number(response.headers.get('content-length')||0);if(!size||size<20*1024*1024)caches.open(CACHE_VERSION).then(cache=>cache.put(request,response.clone()));}return response;}).catch(()=>cached||new Response('Este recurso no está disponible sin conexión.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}));return cached||fresh;})());return;}
 const isShellAsset=/\.(?:css|js|woff2|png|svg|webmanifest)$/i.test(url.pathname)||url.pathname.endsWith('/index.html');if(!isShellAsset)return;
 event.respondWith((async()=>{const cached=await caches.match(request);try{const response=await fetch(request);if(response&&response.ok){const cache=await caches.open(CACHE_VERSION);cache.put(request,response.clone());}return response;}catch(error){if(cached)return cached;throw error;}})());
});