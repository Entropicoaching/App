// Runde 11 (K-R10 fund 5): coachens rod markeres kun med Entropi 2 tændt, så entropi2.css' scopede
// regler aldrig rammer de eksisterende skærme med flaget slukket.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8').replaceAll('\r\n', '\n')

test('R11: Dashboard-roden får data-entropi2-coach-root kun bag e2, præcis ét sted', () => {
  const source = read('../Dashboard.jsx')
  assert.equal(source.split("{...(e2 ? { 'data-entropi2-coach-root': '' } : {})}").length, 2)
  assert.equal(source.split('data-entropi2-coach-root').length, 2)
})

test('R11: index.css har ingen Entropi 2-afledte farveregler for eksisterende sektioner', () => {
  const css = read('../index.css')
  for (const marker of ['section[aria-label="Kostuge"]', 'section[aria-label="Lokalt videoanalyseværktøj"]', '[data-analyse-atlet1]'])
    assert.equal(css.indexOf(marker), -1, marker)
})
