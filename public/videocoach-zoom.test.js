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

// ---------- ORDRE 23: regression ved 390px viewport-bredde (mobil) ----------
// Placér skærmen på et point/telefon-agtigt viewport (iPhone 12/13 mini-
// bredde) fremfor desktop-tal, og bevis begge invarianter der: (1) punktet
// under fingeren/markøren driver ikke ved zoom, og (2) alle fire hjørner af
// billedet kan panoreres ind i syne — ingen usynlig klemme på x/y forhindrer
// det, som var netop symptomet Marc så ("kun det højre hjørne i syne").
function screenPos(base, zoom, local) {
  return { x: base.x + zoom.x + zoom.s * local.x, y: base.y + zoom.y + zoom.s * local.y }
}

test('390px viewport: zoom om pegepunktet driver ikke, heller ikke tæt på kanten af en smal skærm', () => {
  // #stage har en header (64px) og bundnav i videocoach.html - canvas' u-
  // transformerede top-venstre ligger derfor typisk et stykke nede, ikke i
  // (0,0). Kun 390px bred viewport at panorere/zoome indenfor.
  const base390 = { x: 0, y: 64 }
  const focalPointsNearEdges = [
    { x: 15, y: 90 },    // helt ude i venstre kant
    { x: 375, y: 90 },   // helt ude i højre kant (390px bred skærm)
    { x: 195, y: 700 },  // nederst, hvor skiven ofte lander på en gulv-optagelse
  ]
  for (const focal of focalPointsNearEdges) {
    for (const targetScale of [1.5, 2, 3, 4]) {
      const z = zoomKeepingPoint(base390, focal, IDENTITY, focal, targetScale)
      const after = screenPos(base390, z, {
        x: (focal.x - base390.x - IDENTITY.x) / IDENTITY.s,
        y: (focal.y - base390.y - IDENTITY.y) / IDENTITY.s,
      })
      assert.ok(Math.abs(after.x - focal.x) < 1e-9, `x drev ved 390px, skala ${targetScale}: ${after.x} != ${focal.x}`)
      assert.ok(Math.abs(after.y - focal.y) < 1e-9, `y drev ved 390px, skala ${targetScale}: ${after.y} != ${focal.y}`)
    }
  }
})

test('390px viewport: panorering kan nå alle fire hjørner af billedet ind i syne', () => {
  const VIEWPORT = { width: 390, height: 750 }
  const base390 = { x: 0, y: 64 }
  // Et 16:9-klip skaleret til fuld skærmbredde (typisk landskabsoptagelse på
  // en portræt-telefon).
  const canvas = { w: 390, h: Math.round(390 * 9 / 16) } // 219
  const corners = {
    'øverst-venstre': { x: 0, y: 0 },
    'øverst-højre': { x: canvas.w, y: 0 },
    'nederst-venstre': { x: 0, y: canvas.h },
    'nederst-højre': { x: canvas.w, y: canvas.h },
  }
  // En typisk "langt inde"-zoom centreret et vilkårligt sted - efterlader
  // hjørnerne langt uden for de 390px, akkurat den situation hvor en bruger
  // har brug for at panorere for at nå fx skiven i et hjørne.
  const zoomedIn = { s: 3.5, x: -520, y: -140 }
  const targets = {
    'øverst-venstre': { x: 15, y: 90 },
    'øverst-højre': { x: 375, y: 90 },
    'nederst-venstre': { x: 15, y: 700 },
    'nederst-højre': { x: 375, y: 700 },
  }
  for (const [name, corner] of Object.entries(corners)) {
    const before = screenPos(base390, zoomedIn, corner)
    const target = targets[name]
    // Sanitycheck: testen er kun meningsfuld hvis hjørnet FAKTISK er udenfor
    // syne før panoreringen (ellers beviser den ingenting).
    const wasOffscreenOrFar = before.x < 0 || before.x > VIEWPORT.width ||
      before.y < 0 || before.y > VIEWPORT.height ||
      Math.hypot(before.x - target.x, before.y - target.y) > 50
    assert.ok(wasOffscreenOrFar, `${name}: var allerede ved målet (${before.x},${before.y}) - testen beviser intet`)
    // To-finger-panorering (samme skala) fra hjørnets nuværende skærmposition
    // til målpunktet - reproducerer den rigtige touch-pinch-håndtering.
    const panned = zoomKeepingPoint(base390, before, zoomedIn, target, zoomedIn.s)
    const after = screenPos(base390, panned, corner)
    assert.ok(Math.abs(after.x - target.x) < 1e-9, `${name}: x ramte ikke målet (${after.x} != ${target.x})`)
    assert.ok(Math.abs(after.y - target.y) < 1e-9, `${name}: y ramte ikke målet (${after.y} != ${target.y})`)
    assert.ok(after.x >= 0 && after.x <= VIEWPORT.width, `${name}: endte uden for de 390px i bredden`)
    assert.ok(after.y >= 0 && after.y <= VIEWPORT.height, `${name}: endte uden for viewportens højde`)
  }
})
