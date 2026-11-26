// 2137 (Marc 24. nov.): kostugen har en fast base og en fri kcal-pulje pr. dag.
// Niveauet friPct (0 til 30 % af dagens kcal) ligger i versionens calculation_basis.fri_pct,
// så der er ingen ny kolonne. Mangler det, er det 0, og ugen opfører sig som før.
// Protein ligger altid i basen; puljen er kcal og aldrig protein. Ren model uden læsning.
import { isDayReceipt } from '../../mealEvidence.mjs'
export const FRI_NIVEAUER = Object.freeze([0, 10, 15, 20, 30])
export const FRI_MAKS = 30
export const FRI_UDGANGSPUNKT = 15
// Lille, mellem og stor fri post i kcal.
export const FRI_STOERRELSER = Object.freeze([
  Object.freeze({ id: 'lille', navn: 'Lille', kcal: 100 }),
  Object.freeze({ id: 'mellem', navn: 'Mellem', kcal: 250 }),
  Object.freeze({ id: 'stor', navn: 'Stor', kcal: 450 }),
])
export const FRI_PREFIX = 'Fri: '
const KCAL_PR_G_PROTEIN = 4

export const friProcent = value => {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.min(FRI_MAKS, Math.round(n * 10) / 10) : 0
}
export const friFraBasis = basis => friProcent(basis && typeof basis === 'object' ? basis.fri_pct : null)
export const medFriPct = (basis, pct) => ({ ...(basis && typeof basis === 'object' ? basis : {}), fri_pct: friProcent(pct) })

const num = value => typeof value === 'number' && Number.isFinite(value) ? value : null
const kcalAf = food => num(food?.kcal100)
const proteinKcalAf = food => (num(food?.protein100) ?? 0) * KCAL_PR_G_PROTEIN

// 2392: puljens kcal afrundes ét sted, så skillen (lav-uge) og appen viser samme tal.
export const friKcalAf = (kcal, pct) => Math.round(kcal * friProcent(pct) / 100)

// Dagens kcal (planmåltiderne i dag) deles i base og pulje. Basen beholder dagens protein.
export function fordelDag({ kcal, protein }, pct) {
  const p = friProcent(pct)
  if (num(kcal) === null || kcal <= 0) return { friPct: p, dagKcal: null, baseKcal: null, friKcal: 0, protein: num(protein) }
  const friKcal = friKcalAf(kcal, p)
  return { friPct: p, dagKcal: kcal, baseKcal: kcal - friKcal, friKcal, protein: num(protein) }
}

// Planmåltiderne skaleres til basen. Fødevarer, hvor protein er mindst 40 % af kcal, ligger fast
// i proteinet; resten skaleres. To lineære krav (protein uændret, kcal = base) løses ens for alle
// måltider, så hver fødevare får samme faktor i sin gruppe. Uden de to grupper skaleres alt ens.
export function skalerMaaltider(meals, pct) {
  const p = friProcent(pct)
  const foods = meals.flatMap(meal => meal.foods)
  const sum = (items, f) => items.reduce((n, food) => n + f(food) * food.grams / 100, 0)
  const kcalTotal = sum(foods, food => kcalAf(food) ?? 0)
  const proteinTotal = sum(foods, food => num(food.protein100) ?? 0)
  if (p === 0 || !(kcalTotal > 0)) return { meals, faktorer: null }
  const baseKcal = kcalTotal * (1 - p / 100)
  const tung = food => kcalAf(food) > 0 && proteinKcalAf(food) >= 0.4 * kcalAf(food)
  const lette = foods.filter(food => !tung(food)), tunge = foods.filter(tung)
  const kL = sum(lette, kcalAf), kT = sum(tunge, kcalAf)
  const pL = sum(lette, food => num(food.protein100) ?? 0), pT = sum(tunge, food => num(food.protein100) ?? 0)
  let a = baseKcal / kcalTotal, b = a
  if (kL > 0 && kT > 0) {
    // a*pL + b*pT = pL + pT og a*kL + b*kT = baseKcal
    const det = pL * kT - pT * kL
    if (Math.abs(det) > 1e-9) {
      const a2 = ((pL + pT) * kT - pT * baseKcal) / det
      const b2 = (pL * baseKcal - kL * (pL + pT)) / det
      if (a2 > 0 && b2 > 0 && a2 <= 1 && b2 <= 1.5) { a = a2; b = b2 }
    }
  }
  // 2366: gram rundes til hele 5 g (min. 5 g), så Marc og atleten ser samme tal og atleten kan veje. Rundingen kan flytte
  // protein og kcal; en lille gradient-pass flytter enkelte fødevarer 5 g, så de to totaler ligger tættest muligt på kravene.
  const TRIN = 5
  const flade = meals.flatMap(meal => meal.foods)
  const gram = flade.map(food => Math.max(TRIN, Math.round(food.grams * (tung(food) ? b : a) / TRIN) * TRIN))
  const kcalMaal = baseKcal, proteinMaal = proteinTotal
  const fejl = g => {
    let k = 0, pr = 0
    flade.forEach((food, i) => { k += (kcalAf(food) ?? 0) * g[i] / 100; pr += (num(food.protein100) ?? 0) * g[i] / 100 })
    return Math.abs(k - kcalMaal) / kcalMaal + Math.abs(pr - proteinMaal) / (proteinMaal || 1)
  }
  for (let runde = 0; runde < 50; runde++) {
    let bedst = fejl(gram), valg = null
    flade.forEach((food, i) => {
      for (const d of [-TRIN, TRIN]) {
        if (gram[i] + d < TRIN) continue
        gram[i] += d
        const f = fejl(gram)
        gram[i] -= d
        if (f < bedst - 1e-9) { bedst = f; valg = [i, d] }
      }
    })
    if (!valg) break
    gram[valg[0]] += valg[1]
  }
  let n = 0
  return {
    faktorer: { lette: a, tunge: b },
    proteinFoer: proteinTotal,
    meals: meals.map(meal => ({ ...meal, foods: meal.foods.map(food => ({ ...food, grams: gram[n++] })) })),
  }
}

// Dagens fri kcal: brugt (rækker, der starter med "Fri: ") og tilbage. Kun kcal; protein tælles ikke.
// 2202: planmåltidsnavne sammenlignes uden versaler og med ens mellemrum, så et omdøbt planmåltid (Frokost/frokost) stadig er base.
export const navnNoegle = navn => String(navn ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
export const erFriRaekke = row => typeof row?.meal === 'string' && row.meal.trimStart().startsWith(FRI_PREFIX)
// 2193: mad logget under et andet navn end et planmåltid og uden "Fri: " er også brugt pulje. Hver planmåltidsrække
// dækker højst ét planmåltid af samme navn; resten af rækkerne er uplanlagte. Dagskvitteringer er ikke mad.
// Uden planNavne (ukendt base) regnes der kun på "Fri: "-rækkerne som før.
export function uplanlagteRaekker(logs, planNavne) {
  if (!Array.isArray(planNavne)) return []
  const dækket = new Map()
  for (const navn of planNavne) { const n = navnNoegle(navn); dækket.set(n, (dækket.get(n) ?? 0) + 1) }
  return (Array.isArray(logs) ? logs : []).filter(row => {
    if (erFriRaekke(row) || isDayReceipt(row) || typeof row?.meal !== 'string' || !row.meal.trim()) return false
    const n = navnNoegle(row.meal)
    if ((dækket.get(n) ?? 0) > 0) { dækket.set(n, dækket.get(n) - 1); return false }
    return true
  })
}
// 2348: et åbent planmåltid, hvis navn allerede har en logget række ud over de spiste planmåltiders egne, er logget på anden vis
// (Nyt måltid, Spist igen, Hjem). Samme navnematch som uplanlagteRaekker; hver række dækker højst ét åbent planmåltid.
export function aabneLoggedeIds(logs, meals) {
  const raekker = new Map()
  for (const row of Array.isArray(logs) ? logs : []) {
    if (erFriRaekke(row) || isDayReceipt(row) || typeof row?.meal !== 'string' || !row.meal.trim()) continue
    const n = navnNoegle(row.meal)
    raekker.set(n, (raekker.get(n) ?? 0) + 1)
  }
  const liste = Array.isArray(meals) ? meals : []
  for (const meal of liste) if (meal.eaten || meal.blocked) { const n = navnNoegle(meal.name); raekker.set(n, (raekker.get(n) ?? 0) - 1) }
  const ids = new Set()
  for (const meal of liste) {
    if (meal.eaten || meal.blocked) continue
    const n = navnNoegle(meal.name)
    if ((raekker.get(n) ?? 0) > 0) { raekker.set(n, raekker.get(n) - 1); ids.add(meal.id) }
  }
  return ids
}
const kcalTal = row => Number(String(row.kcal).replace(',', '.')) || 0
export function friStatus({ friKcal, logs, planNavne }) {
  const pulje = num(friKcal) !== null && friKcal > 0 ? friKcal : 0
  const raekker = Array.isArray(logs) ? logs : []
  const brugt = [...raekker.filter(erFriRaekke), ...uplanlagteRaekker(raekker, planNavne)]
    .reduce((n, row) => n + kcalTal(row), 0)
  return { pulje, brugt, tilbage: pulje - brugt, over: brugt > pulje }
}
export function friPost(stoerrelse, kcal) {
  const valgt = FRI_STOERRELSER.find(item => item.id === stoerrelse)
  const antal = valgt ? valgt.kcal : typeof kcal === 'string' ? Number(kcal.replace(',', '.')) : kcal
  if (typeof antal !== 'number' || !Number.isFinite(antal) || antal <= 0 || antal > 3000) return null
  const rundet = Math.round(antal)
  return { meal: `${FRI_PREFIX}${valgt ? valgt.id : `${rundet} kcal`}`, kcal: rundet, protein: 0, carb: 0, fat: 0 }
}

// 2392: en logget række svarer til planmåltidet, når kcal (og protein, hvis begge kendes) ligger inden for 10 % af planen.
// Uden planens tal (ældre dagsreferencer) tæller navnet alene som før.
const inden10 = (value, maal) => maal > 0 && Math.abs(value - maal) <= maal * 0.1
function svarerTilPlan(row, plan) {
  if (!plan) return true
  const kcal = kcalTal(row), protein = Number(row?.protein)
  if (num(plan.kcal) !== null && !inden10(kcal, plan.kcal)) return false
  return !(num(plan.protein) !== null && Number.isFinite(protein) && row?.protein != null && !inden10(protein, plan.protein))
}

// Ugens tal til coachen: basemåltider fulgt og dage med puljen holdt. Kun dage med en fri pulje tæller.
export function friUge({ dage, raekker }) {
  const planDage = (dage ?? []).filter(d => d?.state === 'approved' && friProcent(d.friPct) > 0)
  if (!planDage.length) return null
  let basis = 0, basisAf = 0, holdt = 0, vurderede = 0
  for (const d of planDage) {
    const dagens = (raekker ?? []).filter(row => row?.date === d.date)
    // Hver loggede række dækker højst ét planmåltid: to planmåltider med samme navn kræver to rækker.
    const logget = new Map()
    for (const row of dagens.filter(row => !erFriRaekke(row))) {
      const navn = navnNoegle(row.meal)
      logget.set(navn, [...(logget.get(navn) ?? []), row])
    }
    const planNavne = Array.isArray(d.maaltider) ? d.maaltider : []
    basisAf += planNavne.length
    planNavne.forEach((navn, i) => {
      const n = navnNoegle(navn)
      const raekke = (logget.get(n) ?? []).find(r => svarerTilPlan(r, d.maaltidTal?.[i]))
      if (raekke) { basis++; logget.get(n).splice(logget.get(n).indexOf(raekke), 1) }
    })
    if (dagens.length) {
      vurderede++
      const { over } = friStatus({ friKcal: friKcalAf(d.targets.kcal, d.friPct), logs: dagens, planNavne: Array.isArray(d.maaltider) ? d.maaltider : undefined })
      if (!over) holdt++
    }
  }
  return { basis, basisAf, holdt, vurderede, dage: planDage.length }
}
