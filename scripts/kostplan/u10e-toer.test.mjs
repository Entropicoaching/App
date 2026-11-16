// U10e (ordre 1244): tør kørsel fra generatorens uge til forslags-SQL for den syntetiske testatlet.
// Generator -> ugeplan -> skriv-forslag.mjs -> PGlite-prøveskemaet. Ingen database, nøgler eller net.
import test from 'node:test'
import assert from 'node:assert/strict'
import { generateGramPlan } from '../../src/entropi2/kostplan/generator/index.mjs'
import { DANSKE_DAGLIGVARER } from '../../src/entropi2/kostplan/realisme.mjs'
import { ATHLETES, createRehearsalDb } from '../generalproeve/proeveDb.mjs'
import { skrivForslag } from './skriv-forslag.mjs'

const MAAL = { kcal: 2800, protein: 180, carb: 330, fat: 80 }
const DATOER = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']
const sel = name => { const v = DANSKE_DAGLIGVARER[name]
  return { foodId: 'local:' + encodeURIComponent(name), minGrams: Math.max(5, Math.ceil(v.minGram / 5) * 5), maxGrams: Math.floor(v.maxGram / 5) * 5 } }
// To syntetiske dagstyper, så ugen ikke er syv ens dage.
const DAGE = [
  [['Morgenmad', ['Havregryn', 'Skyr naturel', 'Banan', 'Blåbær']], ['Frokost', ['Rugbrød', 'Kyllingebryst', 'Agurk', 'Tomat']],
    ['Mellemmåltid', ['Skyr naturel', 'Mandler', 'Æble']], ['Aftensmad', ['Ris kogt', 'Laks fersk', 'Broccoli', 'Olivenolie']],
    ['Aftensnack', ['Hytteost', 'Knækbrød']]],
  [['Morgenmad', ['Æg helt', 'Rugbrød', 'Ost 30+', 'Æble']], ['Frokost', ['Kartofler kogte', 'Laks fersk', 'Broccoli', 'Rapsolie']],
    ['Mellemmåltid', ['Hytteost', 'Banan', 'Valnødder']], ['Aftensmad', ['Ris kogt', 'Kyllingebryst', 'Tomat', 'Olivenolie']],
    ['Aftensnack', ['Skyr naturel', 'Knækbrød']]],
]
const meals = i => DAGE[i % 2].map(([name, items], m) => ({ id: 'm' + m, name, items: items.map(sel) }))

function ugeFraGenerator() {
  const days = DATOER.map((date, i) => {
    const plan = generateGramPlan({ targets: MAAL, mealCount: 5, meals: meals(i) })
    assert.ok(plan.meals.length, `${date}: generatoren gav ingen gramplan (${plan.message ?? plan.status})`)
    return { date, meals: plan.meals.map(m => ({ name: m.name,
      portions: m.items.map(item => ({ foodId: item.foodId, grams: item.grams })) })) }
  })
  return { athleteId: ATHLETES.mine, goal: 'vedligehold', intensity: 0.5,
    rationale: 'Syntetisk testuge fra generatoren med fem måltider om dagen.',
    basisAsOf: '2026-11-11', targets: { kcal: 2800, protein: 180, as_of: '2026-11-11' },
    calculationBasis: { readiness: null }, days }
}

test('generatorens uge giver 7 forslag, 7 versioner, ingen godkendelser og energi og protein inden for 5 % hver dag', async () => {
  const { db, count } = await createRehearsalDb()
  try {
    const { sql, plan } = await skrivForslag(ugeFraGenerator())
    assert.equal(plan.days.length, 7)
    for (const dag of plan.days) {
      assert.ok(Math.abs(dag.kcal - MAAL.kcal) / MAAL.kcal <= 0.05, `${dag.date}: ${dag.kcal} kcal`)
      assert.ok(Math.abs(dag.protein - MAAL.protein) / MAAL.protein <= 0.05, `${dag.date}: ${dag.protein} g protein`)
    }
    assert.equal((sql.match(/insert into public\.kostplan_v1_approvals/gi) ?? []).length, 0)
    assert.doesNotMatch(sql, /kostplan_v1_approvals/i)
    await db.exec(sql)
    assert.equal(await count('kostplan_v1_plans'), 7)
    assert.equal(await count('kostplan_v1_versions'), 7)
    assert.equal(await count('kostplan_v1_approvals'), 0)
  } finally { await db.close?.() }
})
