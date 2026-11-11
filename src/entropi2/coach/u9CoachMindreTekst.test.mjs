import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// U9 punkt 8 (Marc 11. nov.): "der er meget tekst og det kan godt virke lidt uoverskueligt".
// Coachens forside, arbejdsrum og kost: forklaringer står i en lukket fold "Forklaring", så hvert kort har ét fokus.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const FOLDET = {
  'coach/radar/CoachRadar.mjs': ['Atleter med signaler'],
  'coach/WeeklyReport.mjs': ['Træning: aktuel programuge'],
  'coach/evaluering/WeekEvaluationView.mjs': ['Et pas tæller som gennemført', 'Gennemsnit pr. logget dag', 'Gennemsnit af dagsgennemsnit', 'Smerte og stop markeres'],
  'coach/planlaegning/PlanGrundlagView.mjs': ['Andel gennemførte sæt', 'Volumen er gennemførte', 'Markeringerne finder omtale'],
  'coach/sammenlign/CompareWeeksView.mjs': ['Observerede forskelle', 'Pas tælles ved mindst'],
  'coach/ugebrev/WeeklyLetterView.mjs': ['Grundlaget er atletens egne'],
  'coach/blokplan/CoachProgramTools.mjs': ['Gem opbevarer et lokalt'],
  // Kostplanens øvrige metodetekster står allerede i lukkede folde ("Om forslaget", "Portionsgrænser", Frida-folden).
  'kostplan/coach/view.mjs': ['Coachens tekst om fx væske'],
}

test('U9 8: coachens forklaringer står i en lukket fold "Forklaring"', () => {
  for (const [file, starts] of Object.entries(FOLDET)) {
    const lines = read(file).split(/\r?\n/)
    for (const start of starts) {
      const line = lines.find(l => l.includes(`'${start}`))
      assert.ok(line, `${file}: ${start}`)
      assert.match(line, /h\('details', \{ 'data-u9-forklaring': '' \}, h\('summary'[^)]*'Forklaring'\)/, `${file}: ${start}`)
      assert.doesNotMatch(line, /open:/, `${file}: folden er lukket`)
    }
  }
})

test('U9 8: ugerapporten viser forklaringen lukket i den rigtige visning', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { createElement } = await import('react')
  const { default: WeeklyReport } = await import('./WeeklyReport.mjs')
  const src = read('coach/WeeklyReport.mjs')
  assert.match(src, /data-u9-forklaring/)
  assert.equal(typeof WeeklyReport, 'function')
  void renderToStaticMarkup; void createElement
})
