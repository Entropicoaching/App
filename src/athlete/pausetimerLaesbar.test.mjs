// Ordre 1261: pausetimer og saetkort laesbare med een haand.
// Kildeprove: tekst mindst 11 px, Luk/Skjul 52 px i een raekke, afkrydsning 24 px.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { logStil } from './dagensPasLayout.mjs'

const laes = navn => readFileSync(new URL(navn, import.meta.url), 'utf8')
const MIN_REM = 11 / 16

test('pausefodens tekst er mindst 11 px', () => {
  const kilde = laes('./RestPauseFooter.jsx')
  const stoerrelser = [...kilde.matchAll(/fontSize: '([\d.]+)rem'/g)].map(m => Number(m[1]))
  assert.ok(stoerrelser.length > 0)
  // Det lille luk-kryds (0.75rem) er over graensen; intet er under.
  for (const r of stoerrelser) assert.ok(r >= MIN_REM, `${r}rem er under 11 px`)
})

test('Luk og Skjul pausen er 52 px hoeje og staar i een raekke', () => {
  const kilde = laes('./RestPauseFooter.jsx')
  assert.match(kilde, /display: 'flex', gap: '0\.6rem', width: '100%' \}\}/)
  assert.doesNotMatch(kilde, /flexWrap: 'wrap', justifyContent: 'center' \}\}>\s*<button type="button" data-testid="rest-pause-close"/)
  for (const mark of ['data-testid="rest-pause-close"', 'onClick={clear}']) {
    const linje = kilde.split('\n').find(l => l.includes(mark) && l.includes('<button'))
    assert.ok(linje, mark)
    assert.match(linje, /minHeight: '52px'/)
    assert.match(linje, /flex: 1/)
  }
})

test('saetkortets tekst er mindst 11 px og afkrydsningen er 24 px', () => {
  const st = logStil()
  for (const [navn, v] of Object.entries(st)) {
    const stil = typeof v === 'function' ? v(false) : v
    if (stil && typeof stil.fontSize === 'string' && stil.fontSize.endsWith('rem')) {
      assert.ok(parseFloat(stil.fontSize) >= MIN_REM, `${navn}: ${stil.fontSize}`)
    }
  }
  assert.equal(st.ekstraKnap(false).minHeight, '52px')
  const kort = laes('./DagensPasCard.jsx')
  assert.match(kort, /type="checkbox" checked=\{showNextPreview\}[\s\S]{0,200}width: '24px', height: '24px'/)
  for (const m of kort.matchAll(/fontSize: '([\d.]+)rem'/g)) assert.ok(Number(m[1]) >= MIN_REM, m[0])
})
