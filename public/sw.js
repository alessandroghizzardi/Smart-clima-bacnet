// Il segnaposto VER (tra doppie graffe) è un'impronta dei file statici calcolata dal server all'avvio: cambia da sola a ogni modifica di app.js, style.css…
const C = 'clima-{{VER}}', FILES = ['/', '/style.css', '/app.js', '/vendor/chart.js', '/manifest.json', '/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/api/') || e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
self.addEventListener('push', e => {
  let d = { titolo: '{{NOME}}', testo: '' }; try { d = e.data.json(); } catch { /* notifica senza dati */ }
  e.waitUntil(self.registration.showNotification(d.titolo, { body: d.testo, icon: '/icon.svg', badge: '/icon.svg' }));
});
// Toccando la notifica: se l'app è già aperta la si porta in primo piano, altrimenti la si apre.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => new URL(x.url).origin === self.location.origin);
    return w ? w.focus() : clients.openWindow('/');
  }));
});
