// Entropi service worker.
//  1) "Del til VideoCoach" (Android share target) — modtager delt video via POST.
//  2) Navigationer = network-first med no-store, så en ny deploy faktisk når
//     klienten (fikser forældet app-shell/bundle-cache på iOS + hjemmeskærms-PWA).
//     Hashed JS/CSS-assets røres ikke (de er immutable). Cachet HTML bruges kun
//     som offline-fallback.
const APP_SHELL_CACHE = 'entropi-app-shell-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Android share target — uændret adfærd.
  if (request.method === 'POST' && url.pathname === '/share-video') {
    e.respondWith((async () => {
      try {
        const form = await request.formData();
        const file = form.get('video');
        if (file) {
          const cache = await caches.open('shared-video');
          await cache.put('/shared-video-file', new Response(file, {
            headers: {
              'Content-Type': file.type || 'video/mp4',
              'X-File-Name': encodeURIComponent(file.name || 'video.mp4'),
            },
          }));
        }
      } catch { /* modtagelse fejlede -> VideoCoach viser besked */ }
      return Response.redirect('/videocoach.html?shared=1', 303);
    })());
    return;
  }

  // Navigationer (app-shell + videocoach.html): hent altid friskt fra nettet,
  // uden om HTTP-cachen, så en ny app-version indlæses. Falder tilbage til den
  // sidst gemte kopi hvis der ikke er netværk.
  if (request.method === 'GET' && request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: 'no-store' });
        try {
          const cache = await caches.open(APP_SHELL_CACHE);
          await cache.put(request, fresh.clone());
        } catch { /* cache-put må ikke vælte svaret */ }
        return fresh;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  // Alt andet: rør det ikke (normal netværksadfærd).
});
