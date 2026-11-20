
/* Comércio Alpendorada – service worker */
const V = 'ca-2026-11-20-2';

const PRE = [
  './',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'maskable-512.png',
  'apple-touch-icon.png',
  'splash.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V)
      .then(c => Promise.allSettled(
        PRE.map(u => c.add(new Request(u, { cache: 'reload' })))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k.startsWith('ca-') && k !== V)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

const rede = (req, ms) => new Promise((ok, falha) => {
  const t = setTimeout(() => falha(new Error('timeout')), ms);
  fetch(req).then(
    r => { clearTimeout(t); ok(r); },
    err => { clearTimeout(t); falha(err); }
  );
});

self.addEventListener('fetch', e => {
  const r = e.request;
  const u = new URL(r.url);

  if (r.method !== 'GET' || u.origin !== self.location.origin) return;
  if (r.headers.has('authorization')) return;
  if (/^\/(admin|crm|api)(\/|$)/i.test(u.pathname)) return;

  e.respondWith((async () => {
    const c = await caches.open(V);

    try {
      const res = await rede(r, r.mode === 'navigate' ? 4000 : 8000);
      const cc = res.headers.get('cache-control') || '';

      if (res.status === 200 && res.type === 'basic' &&
          !/no-store|private/i.test(cc)) {
        c.put(r, res.clone());
      }

      return res;
    } catch (err) {
      const m = (await c.match(r, { ignoreSearch: true })) ||
        (r.mode === 'navigate' ? await c.match('./') : null);

      if (m) return m;
      throw err;
    }
  })());
});

/* Notificações push */
self.addEventListener('push', e => {
  let d = {};

  try {
    d = e.data ? e.data.json() : {};
  } catch (err) {
    d = {};
  }

  e.waitUntil(
    self.registration.showNotification(d.t || 'Comércio Alpendorada', {
      body: d.b || 'Há novidades no Comércio Alpendorada.',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: d.k || 'ca',
      data: { u: d.u || './' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();

  let alvo = new URL('./', self.registration.scope).href;

  try {
    const u = new URL(
      (e.notification.data && e.notification.data.u) || './',
      self.registration.scope
    );

    if (u.origin === self.location.origin) alvo = u.href;
  } catch (err) {}

  e.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(cs => {
      for (const c of cs) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(alvo).catch(() => {});
          return c.focus();
        }
      }

      return self.clients.openWindow(alvo);
    })
  );
});
