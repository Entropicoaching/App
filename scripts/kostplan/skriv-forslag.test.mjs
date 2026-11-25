// U10a (ordre 111): forslagsscriptet mod PGlite-prøveskemaet med den syntetiske testatlet.
// Ingen nøgler, intet net, ingen rigtige data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FOODS } from '../../src/entropi2/kostplan/foedevarer/catalog.mjs'
import { ATHLETES, PEOPLE, createRehearsalDb } from '../generalproeve/proeveDb.mjs'
import { ForslagFejl, lavForslagSql } from './forslag.mjs'
import { skrivForslag } from './skriv-forslag.mjs'
import { sqlAfviserMeals } from './validMealsSql.mjs'

const id = new Map(FOODS.map(food => [food.name, food.id]))
const meal = (name, items) => ({ name, portions: items.map(([vare, grams]) => ({ foodId: id.get(vare), grams })) })
// En syntetisk dag på 2.816 kcal og 185 g protein; testatletens mål er 2.800 kcal og 180 g.
const dag = () => [
  meal('Morgenmad', [['Havregryn', 90], ['Skyr naturel', 250], ['Banan', 120], ['Blåbær', 100]]),
  meal('Frokost', [['Rugbrød', 150], ['Kyllingebryst', 125], ['Agurk', 100], ['Tomat', 100]]),
  meal('Mellemmåltid', [['Skyr naturel', 200], ['Mandler', 25], ['Æble', 150]]),
  meal('Aftensmad', [['Ris kogt', 400], ['Laks fersk', 175], ['Broccoli', 200], ['Olivenolie', 10]]),
  meal('Aftensnack', [['Hytteost', 150], ['Knækbrød', 40]]),
]
const DATOER = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']
export const ugeplan = (patch = {}) => ({
  athleteId: ATHLETES.mine, goal: 'vedligehold', intensity: 0.5,
  rationale: 'Syntetisk testuge med fem måltider om dagen omkring træningen.',
  basisAsOf: '2026-11-11', targets: { kcal: 2800, protein: 180, as_of: '2026-11-11' },
  calculationBasis: { readiness: null },
  days: DATOER.map(date => ({ date, meals: dag() })), ...patch,
})
const fejl = (fn, pattern) => assert.throws(fn, error => error instanceof ForslagFejl && pattern.test(error.message))
const fejlAsync = (fn, pattern) => assert.rejects(fn, error => error instanceof ForslagFejl && pattern.test(error.message))
const medDag = (index, change) => {
  const plan = ugeplan()
  change(plan.days[index])
  return plan
}

test('den genererede SQL indsættes rent i prøveskemaet: 7 forslag, 7 version 1, ingen godkendelser', async () => {
  const { db, count } = await createRehearsalDb()
  try {
    const { sql } = await skrivForslag(ugeplan())
    await db.exec(sql)
    assert.equal(await count('kostplan_v1_plans'), 7)
    assert.equal(await count('kostplan_v1_versions'), 7)
    assert.equal(await count('kostplan_v1_approvals'), 0)
    const { rows } = await db.query(`select p.status, p.valid_from::text vf, v.version_no, v.effective_from::text ef,
      v.basis_as_of::text ba, v.calculation_basis cb, v.goal, v.intensity::float i, jsonb_array_length(v.meals) n
      from public.kostplan_v1_plans p join public.kostplan_v1_versions v on v.plan_id = p.id
      where p.athlete_id = $1 order by p.valid_from`, [ATHLETES.mine])
    assert.deepEqual(rows.map(r => r.vf), DATOER)
    for (const row of rows) {
      assert.equal(row.status, 'forslag')
      assert.equal(row.version_no, 1)
      assert.equal(row.ef, row.vf)
      assert.equal(row.ba, '2026-11-11')
      assert.equal(row.goal, 'vedligehold')
      assert.equal(row.i, 0.5)
      assert.equal(row.n, 5)
      assert.deepEqual(row.cb, { weight_trend: null, training_volume: null, training_intensity: null,
        food_log: null, readiness: null, competition_date: null,
        targets: { kcal: 2800, protein: 180, as_of: '2026-11-11' } })
    }
  } finally { await db.close() }
})

test('atleten ser intet forslag, før coachen har godkendt', async () => {
  const { db, rest } = await createRehearsalDb()
  try {
    await db.exec((await skrivForslag(ugeplan())).sql)
    const get = (table, who) => rest.handle({ method: 'GET', table, params: new URLSearchParams('select=id'),
      headers: { authorization: `Bearer tok-${who.id}` } })
    for (const table of ['kostplan_v1_plans', 'kostplan_v1_versions']) {
      assert.deepEqual((await get(table, PEOPLE.athlete)).body, [], table)
      assert.equal((await get(table, PEOPLE.coach)).body.length, 7, table)
    }
  } finally { await db.close() }
})

// Ordre 1537a: kun forslag.mjs' send-del (coachens ja i chatten) må godkende; uden send aldrig.
test('scriptet laver aldrig en approvals-sætning uden send', async () => {
  const { sql } = await skrivForslag(ugeplan())
  assert.doesNotMatch(sql, /approval/i)
  const forslag = readFileSync(new URL('forslag.mjs', import.meta.url), 'utf8')
  assert.equal((forslag.match(/insert\s+into\s+(public\.)?kostplan_v1_approvals/gi) ?? []).length, 1)
  assert.match(forslag, /if \(send\) lines\.push\(\.\.\.sendSql\(plan, ids\)\)/)
  for (const file of ['skriv-forslag.mjs', 'validMealsSql.mjs', 'husstand.mjs']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /insert\s+into\s+(public\.)?kostplan_v1_approvals/i, file)
  }
})

test('ugyldig meals afvises, ligesom kostplan_v1_valid_meals afviser den i PGlite', async () => {
  const food = FOODS.find(f => f.name === 'Banan')
  const ugyldige = [
    ['gram 0', d => { d.meals[0].portions[2].grams = 0 }, [{ food, grams: 0 }]],
    ['negativt gram', d => { d.meals[0].portions[2].grams = -20 }, [{ food, grams: -20 }]],
    ['gram som tekst', d => { d.meals[0].portions[2].grams = '120' }, [{ food, grams: '120' }]],
    ['tomt navn', d => { d.meals[1].name = '  ' }, null],
    ['ingen portioner', d => { d.meals[4].portions = [] }, null],
  ]
  for (const [navn, change, raw] of ugyldige) {
    await fejlAsync(() => skrivForslag(medDag(2, change)), /./)
    const meals = raw ? [{ name: 'Morgenmad', portions: raw }] : medDag(2, change).days[2].meals.map(m => ({ name: m.name,
      portions: m.portions.map(p => ({ food: FOODS.find(f => f.id === p.foodId), grams: p.grams })) }))
    assert.deepEqual(await sqlAfviserMeals([{ date: navn, meals }]), [navn], navn)
  }
  // Og den gyldige uge består databasens egen prøve dag for dag.
  const { plan } = lavForslagSql(ugeplan())
  assert.deepEqual(await sqlAfviserMeals(plan.days), [])
})

test('afvigelse over 5 % i kcal eller protein stopper scriptet med dag og tal', () => {
  fejl(() => lavForslagSql(ugeplan({ targets: { kcal: 2650, protein: 180, as_of: '2026-11-11' } })), /Dag 1 \(2026-11-16\): Energi .* afviger 6,3 %/)
  fejl(() => lavForslagSql(ugeplan({ targets: { kcal: 2800, protein: 170, as_of: '2026-11-11' } })), /Protein 184,9 g afviger 8,8 % fra målet 170 g/)
  fejl(() => lavForslagSql(medDag(6, d => { d.meals[3].portions[0].grams = 200 })), /Dag 7 \(2026-11-22\): Energi/)
  assert.equal(lavForslagSql(ugeplan({ targets: { kcal: 2900, protein: 180, as_of: '2026-11-11' } })).plan.days.length, 7)
})

test('realismeprøven og kataloget genbruges: unormal portion og ukendt fødevare stopper', () => {
  fejl(() => lavForslagSql(medDag(0, d => { d.meals[3].portions[0].grams = 900 })), /uden for en normal portion/)
  fejl(() => lavForslagSql(medDag(0, d => { d.meals[0].portions[0].foodId = 'local:Pizza%20ukendt' })), /findes ikke/)
})

test('ugen skal være 7 dage i træk med 4 til 6 måltider og gyldige felter', () => {
  fejl(() => lavForslagSql(ugeplan({ days: ugeplan().days.slice(0, 6) })), /præcis 7 dage/)
  fejl(() => lavForslagSql(medDag(3, d => { d.date = '2026-11-20' })), /følge hinanden/)
  fejl(() => lavForslagSql(medDag(1, d => { d.meals = d.meals.slice(0, 3) })), /4 til 6 måltider/)
  fejl(() => lavForslagSql(ugeplan({ goal: 'masse' })), /goal/)
  fejl(() => lavForslagSql(ugeplan({ intensity: 1.5 })), /intensity/)
  fejl(() => lavForslagSql(ugeplan({ rationale: ' ' })), /rationale/)
  fejl(() => lavForslagSql(ugeplan({ targets: { kcal: null, protein: 180, as_of: '2026-11-11' } })), /mangler mål/)
  fejl(() => lavForslagSql(ugeplan({ basisAsOf: '2026-11-17' })), /efter ugens første dag/)
  fejl(() => lavForslagSql(ugeplan({ calculationBasis: { cyklus: 'x' } })), /calculationBasis/)
  fejl(() => lavForslagSql(ugeplan({ athleteId: 'Syntetisk' })), /uuid/)
})

test('SQL-teksten afviser dubletter og et ændret kostmål i databasen', async () => {
  const { db, count } = await createRehearsalDb()
  try {
    await db.exec((await skrivForslag(ugeplan())).sql)
    await assert.rejects(async () => db.exec((await skrivForslag(ugeplan())).sql), /allerede et forslag/)
    await db.exec('rollback;').catch(() => {})
    assert.equal(await count('kostplan_v1_plans'), 7)
    const andenUge = ugeplan({ days: ugeplan().days.map((d, i) => ({ ...d, date: `2026-11-${23 + i}` })),
      targets: { kcal: 2700, protein: 180, as_of: '2026-11-11' } })
    await assert.rejects(async () => db.exec((await skrivForslag(andenUge)).sql), /kostmålet er ændret/)
    await db.exec('rollback;').catch(() => {})
    assert.equal(await count('kostplan_v1_plans'), 7)
  } finally { await db.close() }
})

// Ordre 2375: kompakt SQL (stop 5) og niveauet som flag (stop 6).
const FASTE_ID = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`
const fasteIds = () => { let n = 0; return () => FASTE_ID(++n) }
// To dagstyper (dag 2 har lidt mindre ris), så ugen ikke er syv ens dage.
const toDagstyper = () => ugeplan({ days: DATOER.map((date, i) => {
  const meals = dag()
  if (i % 2) meals[3].portions[0].grams = 380
  return { date, meals }
}) })
// Den gamle form, som den stod før ordre 2375: 14 enkelte inserts med hele måltidslisten i hver.
const gammelSql = ({ plan, ids }) => {
  const lit = v => `'${String(v).replace(/'/g, "''")}'`
  const json = v => `${lit(JSON.stringify(v))}::jsonb`
  return ['begin;', ...plan.days.flatMap((d, i) => [
    `insert into public.kostplan_v1_plans (id, athlete_id, valid_from) values (${lit(ids[i].plan)}, ${lit(plan.athleteId)}, ${lit(d.date)});`,
    `insert into public.kostplan_v1_versions (id, plan_id, version_no, effective_from, basis_as_of, calculation_basis, rationale, goal, intensity, meals) values (${[
      lit(ids[i].version), lit(ids[i].plan), 1, lit(d.date), lit(plan.basisAsOf), json(plan.calculationBasis),
      lit(plan.rationale), lit(plan.goal), Number(plan.intensity), json(d.meals)].join(', ')});`]), 'commit;'].join('\n')
}
const raekker = async db => (await db.query(`select p.id::text pid, p.athlete_id::text aid, p.valid_from::text vf, p.status,
  v.id::text vid, v.version_no, v.effective_from::text ef, v.basis_as_of::text ba, v.calculation_basis cb, v.rationale,
  v.goal, v.intensity::float i, v.meals from public.kostplan_v1_plans p join public.kostplan_v1_versions v on v.plan_id = p.id
  order by p.valid_from`)).rows

test('kompakt SQL giver de samme rækker som den gamle form (id, værdier og meals) og er under 20 KB', async () => {
  const input = toDagstyper()
  const kompakt = lavForslagSql(input, { uuid: fasteIds(), fri: 15 })
  const gammel = lavForslagSql(input, { uuid: fasteIds(), fri: 15 })
  assert.ok(kompakt.sql.length < 20000, `kompakt SQL fylder ${kompakt.sql.length} tegn`)
  assert.ok(gammelSql(gammel).length > 60000, 'den gamle form er over 60 KB')
  const [ny, gl] = [await createRehearsalDb(), await createRehearsalDb()]
  try {
    await ny.db.exec(kompakt.sql)
    await gl.db.exec(gammelSql(gammel))
    const [a, b] = [await raekker(ny.db), await raekker(gl.db)]
    assert.equal(a.length, 7)
    assert.deepEqual(a, b)
    assert.ok(a.every(r => r.cb.fri_pct === 15 && r.meals.length === 5 && r.meals[0].portions[0].food.name))
  } finally { await ny.db.close(); await gl.db.close() }
})

test('kompakt SQL med send er under 20 KB og godkender alle 7 dage med niveauet', async () => {
  const { db, count } = await createRehearsalDb()
  try {
    const { sql } = await skrivForslag(toDagstyper(), { send: true, fri: 20 })
    assert.ok(sql.length < 20000, `send-SQL fylder ${sql.length} tegn`)
    await db.exec(sql)
    assert.equal(await count('kostplan_v1_approvals'), 7)
    const { rows } = await db.query(`select count(*) n from public.kostplan_v1_plans p join public.kostplan_v1_versions v on v.plan_id = p.id
      where p.status = 'godkendt' and (v.calculation_basis ->> 'fri_pct')::numeric = 20`)
    assert.equal(Number(rows[0].n), 7)
  } finally { await db.close() }
})

test('fri_pct 0 skrives, og uden fri skrives intet fri_pct i biblioteket', () => {
  assert.match(lavForslagSql(ugeplan(), { fri: 0 }).sql, /"fri_pct":0,/)
  assert.doesNotMatch(lavForslagSql(ugeplan()).sql, /fri_pct/)
})

test('fri over 30, under 0 eller ikke et tal stopper i biblioteket', () => {
  for (const fri of [31, -1, NaN, 'abc', '', '15 %', null]) fejl(() => lavForslagSql(ugeplan(), { fri }), /fri_pct skal være et tal fra 0 til 30/)
  assert.match(lavForslagSql(ugeplan(), { fri: '15,5' }).sql, /"fri_pct":15\.5,/)
})

test('kommandolinjen kræver --fri og stopper over 30 eller ved ikke et tal', async () => {
  const { spawnSync } = await import('node:child_process')
  const { mkdtempSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'fri-2375-'))
  const fil = join(dir, 'uge.json')
  writeFileSync(fil, JSON.stringify(ugeplan()))
  const script = new URL('skriv-forslag.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
  const kor = (...args) => spawnSync(process.execPath, [script, fil, ...args], { encoding: 'utf8' })
  const uden = kor()
  assert.notEqual(uden.status, 0)
  assert.match(uden.stderr, /Vælg niveau med --fri 0 til 30/)
  for (const vaerdi of ['31', 'abc', '-1']) {
    const svar = kor('--fri', vaerdi)
    assert.notEqual(svar.status, 0, vaerdi)
    assert.match(svar.stderr, /fri_pct skal være et tal fra 0 til 30/, vaerdi)
    assert.equal(svar.stdout, '', vaerdi)
  }
  const ok = kor('--fri', '15', '--send')
  assert.equal(ok.status, 0, ok.stderr)
  assert.match(ok.stdout, /"fri_pct":15,/)
  assert.ok(ok.stdout.length < 20000)
})

test('en tekst med $uge$ kan ikke lukke SQL-blokken for tidligt', () => {
  fejl(() => lavForslagSql(ugeplan({ rationale: "Uge $uge$; drop table x; do $uge$ begin" })), /må ikke indeholde \$uge\$/)
})
