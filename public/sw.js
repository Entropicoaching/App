// Entropi service worker.
//  1) "Del til VideoCoach" (Android share target) — modtager delt video via POST.
//  2) Navigationer = network-first med no-store, så en ny deploy faktisk når
//     klienten (fikser forældet app-shell/bundle-cache på iOS + hjemmeskærms-PWA).
//     Cachet HTML bruges kun som offline-fallback.
//  3) ORDRE 397 (docs/OFFLINE-PAS.md): hashede JS/CSS-assets (/assets/*) er
//     cache-first. Et hashet filnavn ændrer sig aldrig, så en gemt kopi er
//     altid rigtig; det er det der gør at appen kan åbne uden net (før kom
//     HTML'en, men bundtet kunne ikke hentes). Supabase-kald (andet domæne),
//     version.json og alt andet røres ikke.
const APP_SHELL_CACHE = 'entropi-app-shell-v1';
const ASSET_CACHE = 'entropi-assets-v1';
// Nok til flere deploys' chunks; ældste smides ud først.
const ASSET_CACHE_MAX = 120;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

async function trimAssetCache(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - ASSET_CACHE_MAX; i++) await cache.delete(keys[i]);
}

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
        // ORDRE 397: appen er én side; uden net er den cachede forside bedre
        // end browserens fejlside (fx åbnet med ?parametre eller en anden sti).
        if (url.origin === self.location.origin && !url.pathname.endsWith('.html')) {
          const shell = await caches.match('/', { ignoreSearch: true });
          if (shell) return shell;
        }
        throw err;
      }
    })());
    return;
  }

  // ORDRE 397: hashede assets, cache-first (se 3 øverst).
  if (request.method === 'GET' && url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    e.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      const fresh = await fetch(request);
      if (fresh.ok && fresh.type === 'basic') {
        e.waitUntil(cache.put(request, fresh.clone()).then(() => trimAssetCache(cache)).catch(() => {}));
      }
      return fresh;
    })());
    return;
  }

  // Alt andet: rør det ikke (normal netværksadfærd).
});
