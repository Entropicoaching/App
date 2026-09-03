// Ren matematik for VideoCoach' zoom/pan på canvas'et. Ingen DOM-adgang, ingen
// side-effekter — kun regnestykket der holder ét indholdspunkt fast under
// pegepunktet (finger-midtpunkt eller musemarkør), mens skalaen ændres.
//
// Selvstændig fil (ikke bundlet med Vite, se videocoach.html) så den både kan
// loades som modul i browseren og importeres direkte i node:test.
//
// Canvas' CSS-transform er `translate(x,y) scale(s)` med transform-origin
// "0 0". Et lokalt punkt (Lx,Ly) på canvas (før transform) havner derfor på
// skærmen ved: base + (x,y) + s·(Lx,Ly), hvor `base` er canvas' u-
// transformerede top-venstre-hjørne i viewport-koordinater
// (dvs. getBoundingClientRect().left/top MINUS den nuværende zoom.x/y).
export function zoomKeepingPoint(base, refFocal, refZoom, targetFocal, newScale) {
  // Det lokale canvas-punkt der lå under refFocal, målt i canvas' eget
  // (u-transformerede) koordinatsystem.
  const Lx = (refFocal.x - base.x - refZoom.x) / refZoom.s
  const Ly = (refFocal.y - base.y - refZoom.y) / refZoom.s
  // Placér det SAMME punkt under targetFocal, ved den nye skala.
  return {
    s: newScale,
    x: targetFocal.x - base.x - newScale * Lx,
    y: targetFocal.y - base.y - newScale * Ly,
  }
}

export function clampScale(s, min, max) {
  return Math.max(min, Math.min(max, s))
}

if (typeof window !== 'undefined') {
  window.VideoCoachZoom = { zoomKeepingPoint, clampScale }
}
