// U10d (ordre 117): mikronæring fra planen, uden ekstra logning. Ren: ingen net, ur eller lager.
// Kilden er planens egne fødevaresnapshots (nutrientsPer100g gange gram, Frida 5.5 når Claude
// har brugt Frida-rækker). Tallet er et 7-dages snit af planen, aldrig en enkelt dag, og
// sammenlignes med NNR 2023. Under 90 % af ugens energi med data for stoffet står der "ukendt".
import { NUTRIENTS } from './foedevarer/catalog.mjs'
import { createPlanSnapshot } from './planSnapshot.mjs'

export const MIN_DAEKNING = 0.9
export const LAV_PROCENT = 70
// Jern, D-vitamin og calcium står i den foldede linje; magnesium og kalium kun i folden (ordre 110, afsnit 4).
export const NOEGLESTOFFER = Object.freeze(['ironMg', 'vitaminDUg', 'calciumMg'])
export const STOFFER = Object.freeze([...NOEGLESTOFFER, 'magnesiumMg', 'potassiumMg'])

// Referenceværdier pr. dag for voksne 18 til 50 år. Kontrolleret mod primærkilden i ordre 107
// (KOST-MIKRONAERING-20261111, kilde 11): RI, dog AI for magnesium og kalium. Calcium er 1.000 mg
// for 18 til 24 år og 950 mg fra 25 år. Jern 15 mg gælder kvinder med menstruation; appen kender
// ikke menstruation og bruger derfor 15 mg for kvinder til og med 50 år og intet tal derover.
// Uden for 18 til 50 år, eller uden køn hvor tallet afhænger af køn, vises intet anbefalet tal.
export const NNR2023 = Object.freeze({
  kilde: 'Blomhoff R m.fl. Nordic Nutrition Recommendations 2023. Nordisk Ministerråd. doi:10.6027/nord2023-003, tabel 12, 14 og 15',
  ironMg: Object.freeze({ type: 'RI', m: 9, f: 15 }),
  vitaminDUg: Object.freeze({ type: 'RI', alle: 10 }),
  calciumMg: Object.freeze({ type: 'RI', alle: 950, under25: 1000 }),
  magnesiumMg: Object.freeze({ type: 'AI', m: 350, f: 300 }),
  potassiumMg: Object.freeze({ type: 'AI', alle: 3500 }),
})
const ALDER = { min: 18, max: 50 }

export function anbefaling(nutrient, athlete = {}) {
  const ref = NNR2023[nutrient], age = Number(athlete?.age)
  if (!ref || athlete?.age == null || !Number.isFinite(age) || age < ALDER.min || age > ALDER.max) return null
  const vaerdi = ref.under25 !== undefined && age < 25 ? ref.under25
    : ref.alle ?? (athlete.sex === 'm' || athlete.sex === 'f' ? ref[athlete.sex] : undefined)
  return vaerdi === undefined ? null : { vaerdi, type: ref.type, kilde: NNR2023.kilde }
}

// dage: 7 versioner ({ goal, intensity, meals }) i ugens rækkefølge. Mangler en dag, er den tom
// eller ulæselig, er hele ugen ukendt; et snit af færre dage ville ligne en hel uge.
export function ugeMikronaering(dage, athlete) {
  let portions = []
  try {
    if (!Array.isArray(dage) || dage.length !== 7) throw Error()
    for (const version of dage) {
      const meals = createPlanSnapshot(version).meals
      if (!meals.length) throw Error()
      for (const meal of meals) portions.push(...meal.portions)
    }
  } catch { portions = null }
  const energi = portions && portions.every(p => p.food.nutrientsPer100g.energyKcal !== null)
    ? portions.reduce((sum, p) => sum + p.food.nutrientsPer100g.energyKcal * p.grams / 100, 0) : null
  const stoffer = STOFFER.map(nutrient => {
    const ref = anbefaling(nutrient, athlete)
    let daekning = null, snit = null
    if (energi) {
      const kendte = portions.filter(p => p.food.nutrientsPer100g[nutrient] !== null)
      daekning = kendte.reduce((sum, p) => sum + p.food.nutrientsPer100g.energyKcal * p.grams / 100, 0) / energi
      if (daekning >= MIN_DAEKNING) snit = kendte.reduce((sum, p) => sum + p.food.nutrientsPer100g[nutrient] * p.grams / 100, 0) / 7
    }
    const procent = snit !== null && ref ? Math.round(snit / ref.vaerdi * 100) : null
    return { nutrient, label: NUTRIENTS[nutrient].label, unit: NUTRIENTS[nutrient].unit, snit, daekning,
      anbefalet: ref?.vaerdi ?? null, type: ref?.type ?? null, procent,
      lav: NOEGLESTOFFER.includes(nutrient) && procent !== null && procent < LAV_PROCENT }
  })
  return { status: portions ? 'klar' : 'ukendt', stoffer, kilde: NNR2023.kilde }
}

// Lægger tallene på en læst uge fra netop de versioner, ugen viser. Rører ikke en tom uge.
export function medMikronaering(week, versions = [], athlete) {
  if (week?.state !== 'ready') return week
  const dage = week.days.map(d => versions.find(v => v.id === d.versionId) ?? null)
  return { ...week, mikro: ugeMikronaering(dage, athlete) }
}
