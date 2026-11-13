import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Ordre 1297: Coachportalens menu maa ikke have tekst under 11 px (0.6875rem).
const kilde = fil => readFileSync(fileURLToPath(new URL(fil, import.meta.url)), 'utf8')

function smaa(src) {
  const bad = []
  for (const m of src.matchAll(/fontSize:\s*(?:'([0-9.]+)(rem|px)'|([0-9.]+))/g)) {
    const px = m[2] === 'rem' ? parseFloat(m[1]) * 16 : parseFloat(m[1] ?? m[3])
    if (px < 11) bad.push(`${m[0]} (${px} px)`)
  }
  return bad
}

for (const fil of ['./Sidebar.jsx', './MobilNav.jsx']) {
  test(`${fil}: ingen skrift under 11 px i coachportalens menu`, () => {
    assert.deepEqual(smaa(kilde(fil)), [])
  })
}

// Ordre 1301: datoen paa Hjem (Ramme.jsx) maa heller ikke vaere under 11 px.
test('../athlete/Ramme.jsx: datoen paa Hjem er mindst 11 px', () => {
  const src = kilde('../athlete/Ramme.jsx')
  const linje = src.split('\n').find(l => l.includes('{today()}'))
  assert.ok(linje)
  assert.deepEqual(smaa(linje), [])
})
