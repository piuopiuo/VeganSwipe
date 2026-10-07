const SHELL='veganswipe-shell-v5';
const IMAGE_CACHE='veganswipe-recipe-images-v2';
const ASSETS=['./','./index.html','./styles.css','./app.js','./db.js','./recipe-utils.js','./importer.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./fallback-food.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(SHELL).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==SHELL&&k!==IMAGE_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.hostname==='raw.githubusercontent.com'&&/\.(jpe?g|png|webp)(\?|$)/i.test(u.pathname)){
    e.respondWith(caches.open(IMAGE_CACHE).then(async cache=>{
      const hit=await cache.match(e.request);if(hit)return hit;
      const response=await fetch(e.request);await cache.put(e.request,response.clone());return response
    }));return;
  }
  if(u.origin===self.location.origin){
    e.respondWith(caches.match(e.request).then(async hit=>{
      try{const response=await fetch(e.request);if(response.ok){const cache=await caches.open(SHELL);cache.put(e.request,response.clone())}return response}catch{return hit||caches.match('./index.html')}
    }));
  }
});
