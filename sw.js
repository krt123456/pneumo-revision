/* Service worker : fonctionne hors ligne. Version 1a72a902d0 */
const CACHE = 'pneumo-1a72a902d0';
const CORE = ["./", "css/app.css", "data/annales.js", "data/fiches.js", "data/figs.js", "data/glossaire.js", "data/lessons.js", "data/plan.js", "data/qsj.js", "img/cxr/abces.webp", "img/cxr/bpco.webp", "img/cxr/bronchopneumonie.webp", "img/cxr/cancer-atelectasie.webp", "img/cxr/ddb.webp", "img/cxr/embolie.webp", "img/cxr/fibrose.webp", "img/cxr/htp.webp", "img/cxr/interstitiel.webp", "img/cxr/khp-rompu.webp", "img/cxr/khp.webp", "img/cxr/mediastin.webp", "img/cxr/metastases.webp", "img/cxr/miliaire.webp", "img/cxr/nodule-spicule.webp", "img/cxr/normal.webp", "img/cxr/pfla.webp", "img/cxr/pleuresie-enkystee.webp", "img/cxr/pleuresie.webp", "img/cxr/pno.webp", "img/cxr/sarcoidose.webp", "img/cxr/silicose.webp", "img/cxr/tb-caverne.webp", "img/icon-192.png", "img/icon-512.png", "img/icon-maskable-512.png", "img/pac/bronchopneumonie.webp", "img/pac/interstitielle.webp", "img/pac/pfla.webp", "img/pac/trepied.webp", "index.html", "js/core.js", "js/train.js", "js/ui.js", "js/views.js", "manifest.webmanifest"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.indexOf('/app/') >= 0) return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
    const net = fetch(r).then(res => { if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
