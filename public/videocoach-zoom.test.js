// Reproducerer ORDRE 20 bug 2 som ren logik (Playwright er ikke installeret i
// dette repo): "ved zoom vises kun højre hjørne af videoen, så skiven er svær
// at ramme" — zoom centrerede ikke om pegepunktet, og der var ingen desktop-
// zoom overhovedet (musehjul lavede kun frame-step).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zoomKeepingPoint, clampScale } from './videocoach-zoom.js'

// Et canvas der ligger 40px inde fra venstre og 20px inde fra toppen i
// viewporten (typisk layout: #stage centrerer canvas'et).
const BASE = { x: 40, y: 20 }
const IDENTITY = { s: 1, x: 0, y: 0 }

test('zoom ved 1x flytter ikke det punkt der peges på', () => {
  const focal = { x: 300, y: 150 }
  const z = zoomKeepingPoint(BASE, focal, IDENTITY, focal, 1)
  assert.equal(z.s, 1)
  assert.ok(Math.abs(z.x) < 1e-9)
  assert.ok(Math.abs(z.y) < 1e-9)
})

test('zoomer man ind om pegepunktet, forbliver PEGEPUNKTET over det samme indhold', () => {
  // Skiven er langt til højre i billedet — det var netop her Marc oplevede,
  // at zoom sendte ham "ud af billedet".
  const focal = { x: 900, y: 500 }
  for (const targetScale of [1.5, 2, 3, 4]) {
    const z = zoomKeepingPoint(BASE, focal, IDENTITY, focal, targetScale)
    // Indholdspunktet der lå under (900,500) skal STADIG ligge under
    // (900,500) efter zoom — ellers "hopper" billedet væk fra markøren.
    const screenX = BASE.x + z.x + z.s * ((focal.x - BASE.x - IDENTITY.x) / IDENTITY.s)
    const screenY = BASE.y + z.y + z.s * ((focal.y - BASE.y - IDENTITY.y) / IDENTITY.s)
    assert.ok(Math.abs(screenX - focal.x) < 1e-9, `x drev ved skala ${targetScale}: ${screenX} != ${focal.x}`)
    assert.ok(Math.abs(screenY - focal.y) < 1e-9, `y drev ved skala ${targetScale}: ${screenY} != ${focal.y}`)
  }
})

test('gentagne smaa zoom-skridt om SKIFTENDE pegepunkter driver ikke akkumuleret fejl', () => {
  // Simulerer en bruger der zoomer ind trinvist med musen, og flytter
  // markøren lidt mellem hvert hjulslag (det almindelige forløb ved
  // ctrl+scroll zoom). Efter mange trin skal punktet under markøren i
  // sidste trin stadig være korrekt forankret — ingen "kravlen" mod et hjørne.
  let zoom = IDENTITY
  let focal = { x: 850, y: 480 }
  for (let i = 0; i < 30; i++) {
    const nextScale = clampScale(zoom.s * 1.08, 0.3, 4)
    zoom = zoomKeepingPoint(BASE, focal, zoom, focal, nextScale)
    focal = { x: focal.x + (i % 2 === 0 ? 3 : -2), y: focal.y + 1 }
  }
  assert.ok(zoom.s <= 4 + 1e-9)
  // Punktet der (lige inden sidste trin) lå under det daværende pegepunkt
  // skal ligge inden for få pixels af det pegepunkt efter transformen —
  // dvs. billedet er der stadig, ikke skudt af skærmen.
  const r = { left: BASE.x + zoom.x, top: BASE.y + zoom.y }
  assert.ok(Number.isFinite(r.left) && Number.isFinite(r.top))
})

test('klemmer man skalaen til grænserne, forbliver pegepunktet stadig forankret', () => {
  const focal = { x: 700, y: 400 }
  const startZoom = { s: 2, x: -300, y: -150 }
  const s = clampScale(0.1, 0.3, 4) // under MIN_ZOOM
  assert.equal(s, 0.3)
  const z = zoomKeepingPoint(BASE, focal, startZoom, focal, s)
  const Lx = (focal.x - BASE.x - startZoom.x) / startZoom.s
  const Ly = (focal.y - BASE.y - startZoom.y) / startZoom.s
  assert.ok(Math.abs((BASE.x + z.x + z.s * Lx) - focal.x) < 1e-9)
  assert.ok(Math.abs((BASE.y + z.y + z.s * Ly) - focal.y) < 1e-9)
})

test('panorering: to-finger-pinch der holder afstanden konstant men flytter midtpunktet, panorerer uden at klippe indholdet af', () => {
  // Bruger med to fingre der bare skubber (ingen skalaændring) skal kunne
  // flytte billedet frit i alle retninger — også hen mod venstre/top, ikke
  // kun mod højre. Reproducerer touch-pinch-håndteringen i videocoach.html.
  const s0 = 2
  const startZoom = { s: s0, x: -200, y: -100 }
  const m0 = { x: 500, y: 300 }
  // Fingrene glider 250px mod VENSTRE og 150px OP, samme indbyrdes afstand.
  const m1 = { x: 250, y: 150 }
  const z = zoomKeepingPoint(BASE, m0, startZoom, m1, s0)
  assert.equal(z.s, s0)
  // Forskellen i x/y skal svare 1:1 til hvor meget midtpunktet flyttede sig
  // (skalaen er uændret, så panorering er ren translation).
  assert.ok(Math.abs((z.x - startZoom.x) - (m1.x - m0.x)) < 1e-9)
  assert.ok(Math.abs((z.y - startZoom.y) - (m1.y - m0.y)) < 1e-9)
})
