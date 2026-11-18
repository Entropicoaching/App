import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, text } from './reactFixture.mjs'

registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === new URL('./KostMaal.mjs', import.meta.url).href)
    return { url: new URL('./reactFixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: KostMaal } = await import('./KostMaal.mjs')
const today = '2026-11-02'
const athlete = { id: 'synthetic-t', kcal_target: 2400, protein_target: 160, bodyweight: 80 }
const row = (id, date, meal, kcal) => ({ id, athlete_id: athlete.id, date, meal, kcal, protein: 20 })
function fixture(rows) {
  return { enabled: true, athlete: { ...athlete }, today, session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day: today, athleteIds: [athlete.id] },
    coachNutrition: { coachId: 'synthetic-coach', day: today, athleteIds: [athlete.id],
      from: '2026-10-27', through: today, state: 'ready', complete: true, targets: [], rows } }
}
const render = p => text(mount(KostMaal, p).render())

test('seneste logdags maaltider vises med navn og kcal, kun den seneste dag', () => {
  const out = render(fixture([row('a', '2026-11-01', 'Gammel ret', 900),
    row('b', '2026-11-02', 'Havregryn', 450), row('c', '2026-11-02', 'Kylling og ris', 700),
    row('d', '2026-11-02', 'Skyr', 200), row('e', '2026-11-02', 'Pasta', 800)]))
  assert.match(out, /Måltider 2\. nov/)
  for (const t of ['Havregryn · 450 kcal', 'Kylling og ris · 700 kcal', 'Skyr · 200 kcal', 'Pasta · 800 kcal']) assert.ok(out.includes(t), t)
  assert.ok(!out.includes('Gammel ret'))
})

test('tom log giver ingen maaltidsliste', () => {
  assert.doesNotMatch(render(fixture([])), /Måltider \d/)
})

test('kcal 0 vises, kcal null og manglende navn udelades', () => {
  const out = render(fixture([row('a', '2026-11-02', 'Vand', 0), row('b', '2026-11-02', 'Uden tal', null),
    row('c', '2026-11-02', '   ', 300), row('d', '2026-11-02', undefined, 300),
    row('e', '2026-11-02', '[appData2-day-v1]{}', 100)]))
  assert.ok(out.includes('Vand · 0 kcal'))
  assert.ok(!out.includes('Uden tal') && !out.includes('appData2'))
})

test('datoen er en kalenderdag og flytter sig ikke i Europe/Copenhagen', () => {
  const out = render(fixture([row('a', '2026-10-31', 'Aftensmad', 600), row('b', '2026-10-31', 'Snack', 100)]))
  assert.match(out, /Måltider 31\. okt/)
})
