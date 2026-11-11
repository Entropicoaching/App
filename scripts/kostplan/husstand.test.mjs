// U10a: omsætteren fra husstandsformatet, kun på syntetiske data (ingen personnavne).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ATHLETES, createRehearsalDb } from '../generalproeve/proeveDb.mjs'
import { ForslagFejl, lavForslagSql } from './forslag.mjs'
import { husstandTilUgeplan } from './husstand.mjs'
import { skrivForslag } from './skriv-forslag.mjs'

const item = (name, grams) => ({ foodId: 'local:' + encodeURIComponent(name), name, grams })
const maaltider = () => ({
  morgenmad: { items: [item('Havregryn', 90), item('Skyr naturel', 250), item('Banan', 120), item('Blåbær', 100)] },
  frokost: { items: [item('Rugbrød', 150), item('Kyllingebryst', 125), item('Agurk', 100), item('Tomat', 100)] },
  'foer-traening': { items: [item('Skyr naturel', 200), item('Mandler', 25), item('Æble', 150)] },
  aftensmad: { items: [item('Ris kogt', 400), item('Laks fersk', 175), item('Broccoli', 200), item('Olivenolie', 10)] },
  aftensnack: { items: [item('Hytteost', 200), item('Rugbrød', 50)] },
})
const planData = () => ({ dage: Array.from({ length: 9 }, (_, i) => ({
  dato: `2026-11-${String(14 + i).padStart(2, '0')}`, menu: {},
  personer: { testperson: { maaltider: maaltider() } },
})) })
const felter = { athleteId: ATHLETES.mine, goal: 'vedligehold', intensity: 0.5,
  rationale: 'Syntetisk husstandsuge omsat til et forslag.', basisAsOf: '2026-11-11',
  targets: { kcal: 2800, protein: 180, as_of: '2026-11-11' } }
const opt = { ...felter, person: 'testperson', fra: '2026-11-16' }

test('husstandsplanen omsættes til 7 dage med Frida-rækker og bliver 7 forslag i prøveskemaet', async () => {
  const ugeplan = husstandTilUgeplan(planData(), opt)
  assert.deepEqual(ugeplan.days.map(d => d.date), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
  assert.deepEqual(ugeplan.days[0].meals.map(m => m.name), ['Morgenmad', 'Frokost', 'Før træning', 'Aftensmad', 'Aftensnack'])
  assert.deepEqual(ugeplan.days[0].meals[0].portions[0], { foodId: 'frida55:480', grams: 90, dagligvare: 'Havregryn' })
  const { db, count } = await createRehearsalDb()
  try {
    const { sql, plan } = await skrivForslag(ugeplan)
    await db.exec(sql)
    assert.equal(await count('kostplan_v1_plans'), 7)
    assert.equal(await count('kostplan_v1_approvals'), 0)
    // Frida-rækken bærer mikronæringen ind i planen.
    const { rows } = await db.query(`select v.meals->0->'portions'->0->'food'->'nutrientsPer100g'->>'ironMg' jern
      from public.kostplan_v1_versions v join public.kostplan_v1_plans p on p.id = v.plan_id
      where p.athlete_id = $1 and p.valid_from = '2026-11-16'`, [ATHLETES.mine])
    assert.ok(Number(rows[0].jern) > 0)
    assert.ok(Math.abs(plan.days[0].kcal - 2800) / 2800 <= 0.05)
  } finally { await db.close() }
})

test('en ukoblet vare stopper omsætningen med varens navn', () => {
  const data = planData()
  data.dage[3].personer.testperson.maaltider.aftensnack.items.push(item('Knækbrød', 40))
  data.dage[4].personer.testperson.maaltider.frokost.items[0] = item('Hummus', 60)
  assert.throws(() => husstandTilUgeplan(data, opt),
    error => error instanceof ForslagFejl && error.message === 'Varen er ikke koblet til Frida: Hummus, Knækbrød.')
})

test('omsætteren stopper ved for få dage, ukendt person og foodId der ikke passer til navnet', () => {
  assert.throws(() => husstandTilUgeplan(planData(), { ...opt, fra: '2026-11-20' }), /kun 3 dage/)
  assert.throws(() => husstandTilUgeplan(planData(), { ...opt, person: 'ingen' }), /personen findes ikke/)
  const data = planData()
  data.dage[2].personer.testperson.maaltider.morgenmad.items[0].foodId = 'local:Rugbr%C3%B8d'
  assert.throws(() => husstandTilUgeplan(data, opt), /passer til navnet/)
})

test('en Frida-portion kræver en dagligvare, der er koblet til netop den række', () => {
  const ugeplan = husstandTilUgeplan(planData(), opt)
  delete ugeplan.days[0].meals[0].portions[0].dagligvare
  assert.throws(() => lavForslagSql(ugeplan), /mangler dagligvare/)
  const forkert = husstandTilUgeplan(planData(), opt)
  forkert.days[0].meals[0].portions[0].dagligvare = 'Banan'
  assert.throws(() => lavForslagSql(forkert), /Banan er ikke koblet til frida55:480/)
})

test('kommandolinjen skriver SQL-filen fra en syntetisk husstandsplan og stopper med navnet ved en ukoblet vare', () => {
  const dir = mkdtempSync(join(tmpdir(), 'u10a-'))
  const script = fileURLToPath(new URL('skriv-forslag.mjs', import.meta.url))
  try {
    writeFileSync(join(dir, 'felter.json'), JSON.stringify(felter))
    writeFileSync(join(dir, 'plan.json'), JSON.stringify(planData()))
    const args = [script, join(dir, 'felter.json'), '--husstand', join(dir, 'plan.json'), '--person', 'testperson', '--fra', '2026-11-16']
    const ok = spawnSync(process.execPath, [...args, '--ud', join(dir, 'forslag.sql')], { encoding: 'utf8' })
    assert.equal(ok.status, 0, ok.stderr)
    assert.match(ok.stderr, /7 forslag klar/)
    const data = planData()
    data.dage[2].personer.testperson.maaltider.aftensnack.items.push(item('Knækbrød', 40))
    writeFileSync(join(dir, 'plan.json'), JSON.stringify(data))
    const stop = spawnSync(process.execPath, args, { encoding: 'utf8' })
    assert.equal(stop.status, 1)
    assert.match(stop.stderr, /Stop: Varen er ikke koblet til Frida: Knækbrød\./)
    assert.equal(stop.stdout, '')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
