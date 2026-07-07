// Entropi service worker - KUN "Del til VideoCoach" (Android share target).
// Bevidst INGEN caching af appen: alle andre requests går urørt til nettet,
// så der aldrig kan opstå problemer med forældede app-versioner.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname === '/share-video') {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
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
      } catch (err) { /* modtagelse fejlede -> VideoCoach viser besked */ }
      return Response.redirect('/videocoach.html?shared=1', 303);
    })());
  }
  // alt andet: rør det ikke (ingen respondWith = normal netvaerksadfaerd)
});
