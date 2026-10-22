export const FILM_GUIDE_KEY = 'videocoach:filmguide:seen:v1';

// Injected DOM/storage only; storage failure must never hide the guide or block upload.
export function mountFilmGuide(button, panel, arrow, storageProvider) {
  let storage;
  let seen = false;
  try {
    storage = storageProvider();
    seen = storage.getItem(FILM_GUIDE_KEY) === '1';
  } catch { /* First-visit fallback when storage is unavailable. */ }
  const render = expanded => {
    panel.hidden = !expanded;
    button.setAttribute('aria-expanded', String(expanded));
    arrow.textContent = expanded ? '▾' : '▸';
  };
  render(!seen);
  // Mark the visit after rendering: first visit stays open, later mounts start closed.
  try { storage?.setItem(FILM_GUIDE_KEY, '1'); } catch { /* Best effort. */ }
  const toggle = event => { event.stopPropagation(); render(panel.hidden); };
  // Native type=button supplies Enter/Space activation; no duplicate key handler.
  button.addEventListener('click', toggle);
  return () => button.removeEventListener('click', toggle);
}

export const FILM_GUIDE_HTML = "<button type=\"button\" id=\"film-guide-toggle\" class=\"film-guide-toggle\" aria-expanded=\"true\" aria-controls=\"film-guide-panel\">Sådan filmer du<span id=\"film-guide-arrow\" aria-hidden=\"true\">▾</span></button>\n<div id=\"film-guide-panel\">\n<h1>Sådan filmer du dit løft</h1>\n<p class=\"intro\">Gælder knæbøjning, bænkpres og dødløft.</p>\n<ol>\n  <li><strong>Film fra siden.</strong>\n    Telefonen står ved siden af løfteren og filmer vinkelret på stangen, set fra siden.</li>\n  <li><strong>Afstand og højde.</strong>\n    Som praktisk råd: stå 3 til 4 meter væk, med telefonen i højde med stangen eller hoften.</li>\n  <li><strong>Hele stang og skive i billedet.</strong>\n    Få hele kroppen med, og zoom ikke undervejs. Intet må dække skiven, for den bruges som målestok.</li>\n  <li><strong>Godt lys.</strong>\n    Tænd lyset i rummet, og undgå vindue lige bag dig.</li>\n  <li><strong>Stabil telefon.</strong>\n    Brug stativ, eller læn den mod noget tungt. Den må ikke bevæge sig.</li>\n  <li><strong>Hele løftet.</strong>\n    Start optagelsen, før du tager stangen. Stop først et par sekunder efter, at den er sat tilbage.</li>\n</ol>\n<p class=\"note\">Analysen er et skøn ud fra videoen. Vi lover ikke, at målene er nøjagtige.</p></div>";

// Both portal entry points use this public page. Never evaluate storage outside the provider.
export function mountUploadFilmGuide(doc, storageProvider) {
  let host = doc.getElementById('athFilmGuide');
  if (!host) {
    const drop = doc.getElementById('dropHint');
    if (!drop) return () => {};
    host = doc.createElement('section');
    host.id = 'athFilmGuide';
    drop.insertBefore(host, drop.firstChild);
  }
  host.innerHTML = FILM_GUIDE_HTML;
  const stop = event => event.stopPropagation();
  host.addEventListener('click', stop);
  const dispose = mountFilmGuide(host.querySelector('#film-guide-toggle'),
    host.querySelector('#film-guide-panel'), host.querySelector('#film-guide-arrow'), storageProvider);
  return () => { dispose(); host.removeEventListener('click', stop); };
}
