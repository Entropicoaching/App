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

// Ordre 1310: coachens atletside (profilhoved, programfane og delte knapper) maa ikke have tekst under 11 px.
for (const fil of ['./ProfilHoved.jsx', './ProgramTab.jsx', '../dashboardShared.js']) {
  test(`${fil}: ingen skrift under 11 px paa coachens atletside`, () => {
    assert.deepEqual(smaa(kilde(fil)), [])
  })
}

// Ordre 1317: atletens Fremgang og coachens Log maa ikke have tekst under 11 px.
for (const fil of ['../athlete/FremgangTab.jsx', './LogTab.jsx']) {
  test(`${fil}: ingen skrift under 11 px`, () => {
    assert.deepEqual(smaa(kilde(fil)), [])
  })
}

// Ordre 1343: knappen "Min traening" i den oeverste bjaelke (Dashboard.jsx) maa ikke vaere under 11 px.
test('../Dashboard.jsx: knappen i den oeverste bjaelke er mindst 11 px', () => {
  const src = kilde('../Dashboard.jsx')
  const linje = src.split('\n').find(l => l.includes('...s.btnPrimary') && l.includes("whiteSpace: 'nowrap'"))
  assert.ok(linje)
  assert.deepEqual(smaa(linje), [])
})

// Ordre 1358: atletens nederste menu (BundNav.jsx) maa ikke have tekst under 11 px.
test('../athlete/BundNav.jsx: ingen skrift under 11 px i atletens nederste menu', () => {
  assert.deepEqual(smaa(kilde('../athlete/BundNav.jsx')), [])
})
