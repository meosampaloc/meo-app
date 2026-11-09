/* MEO App service worker: keeps the app shell, fonts and every map picture you have viewed, for offline use. */
const SHELL='meo-shell-v2', TILES='meo-tiles-v1', FONTS='meo-fonts-v1';
const SHELL_FILES=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./seal-meo.png','./seal-lgu.png'];
const TILE_HOSTS=/(^|\.)(arcgisonline\.com|tile\.openstreetmap\.org|opentopomap\.org)$/;
const MAX_TILES=20000;

self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(SHELL_FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});

async function trimTiles(){
  const c=await caches.open(TILES);const keys=await c.keys();
  if(keys.length>MAX_TILES)for(const k of keys.slice(0,keys.length-MAX_TILES))await c.delete(k);
}
let puts=0;
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin===location.origin){
    /* app shell: network first, cached copy when offline */
    e.respondWith(fetch(req).then(r=>{if(r.ok){const cp=r.clone();caches.open(SHELL).then(c=>c.put(req,cp))}return r})
      .catch(()=>caches.match(req,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
    return;
  }
  if(TILE_HOSTS.test(url.hostname)){
    /* map pictures: use the saved copy, fetch and save new ones while online */
    e.respondWith(caches.open(TILES).then(async c=>{
      const hit=await c.match(req.url);
      const net=fetch(req.url,{mode:'cors',credentials:'omit'}).then(r=>{if(r.ok){c.put(req.url,r.clone());if(++puts%200===0)trimTiles()}return r});
      if(hit){net.catch(()=>{});return hit}
      return net.catch(()=>new Response('',{status:504}));
    }));
    return;
  }
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(caches.open(FONTS).then(async c=>{const hit=await c.match(req);const net=fetch(req).then(r=>{if(r.ok||r.type==='opaque')c.put(req,r.clone());return r});return hit||net.catch(()=>new Response('',{status:504}))}));
  }
});
