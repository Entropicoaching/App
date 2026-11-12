// ORDRE 1064 - node-test af public/videocoach-velocity.js (syntetisk bane med kendt hastighed).
// Kørsel: node scripts/verify-videocoach-velocity.mjs
import assert from 'node:assert/strict'
import { repSpeeds, repLossPct } from '../public/videocoach-velocity.js'

const cmPerPx = 0.1 // 1 px = 0,1 cm
// Bygger et saet: hver rep = loeft opad med konstant fart, derefter pause. y i px (stiger = mindre y).
function synth(fps, speeds, { lift = 0.5, pause = 0.5, junkRep = -1 } = {}) {
  const y = [], t = [], valid = [], reps = []
  let yy = 800, time = 0
  const push = ok => { y.push(yy); t.push(time); valid.push(ok); time += 1 / fps }
  for (let r = 0; r < speeds.length; r++) {
    const frames = Math.round(lift / (1 / fps))
    const start = y.length
    for (let i = 0; i <= frames; i++) { push(!(r === junkRep && i >= 2 && i <= frames - 2 && i % 2 === 0)); yy -= speeds[r] * 100 / cmPerPx / fps }
    reps.push({ start, end: y.length - 1 })
    yy = 800
    for (let i = 0; i < Math.round(pause * fps); i++) push(true)
  }
  return { y, t, valid, cmPerPx, reps }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} vs ${b}`)

for (const fps of [30, 60]) {
  const c = repSpeeds(synth(fps, [0.5, 0.5, 0.5]))
  c.reps.forEach((r, i) => { near(r.mean, 0.5, 0.02, `konstant ${fps}fps rep${i}`); near(r.peak, 0.5, 0.02, `peak ${fps}`) })
  near(c.lossPct, 0, 1, `konstant tab ${fps}`)
  // 5 reps der falder 20 pct lineaert fra 0,60 til 0,48
  const sp = [0.60, 0.575, 0.54, 0.51, 0.48]
  const s = repSpeeds(synth(fps, sp))
  s.reps.forEach((r, i) => near(r.mean, sp[i], 0.02, `fald ${fps}fps rep${i}`))
  near(s.lossPct, 20, 1, `fald tab ${fps}`)
  near(repLossPct(s.reps.map(r => r.mean))[4], 20, 1, `repLossPct ${fps}`)
}
// usikker rep (halvdelen ugyldige frames) -> null, ikke et gaet; tab paa resten
const j = repSpeeds(synth(60, [0.6, 0.55, 0.5], { junkRep: 1 }))
assert.equal(j.reps[1].mean, null)
near(j.lossPct, (0.6 - 0.5) / 0.6 * 100, 1, 'tab ignorerer usikker rep')
// usikker sidste rep -> intet tab
assert.equal(repSpeeds(synth(60, [0.6, 0.5, 0.4], { junkRep: 2 })).lossPct, null)
// kun een rep -> intet tab
assert.equal(repSpeeds(synth(60, [0.5])).lossPct, null)
console.log('OK verify:videocoach-velocity')
