// 2137 (Marc 24. nov.): kostugen har en fast base og en fri kcal-pulje pr. dag.
// Niveauet friPct (0 til 30 % af dagens kcal) ligger i versionens calculation_basis.fri_pct,
// så der er ingen ny kolonne. Mangler det, er det 0, og ugen opfører sig som før.
// Protein ligger altid i basen; puljen er kcal og aldrig protein. Ren model uden læsning.
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

// Dagens kcal (planmåltiderne i dag) deles i base og pulje. Basen beholder dagens protein.
export function fordelDag({ kcal, protein }, pct) {
  const p = friProcent(pct)
  if (num(kcal) === null || kcal <= 0) return { friPct: p, dagKcal: null, baseKcal: null, friKcal: 0, protein: num(protein) }
  const friKcal = Math.round(kcal * p / 100)
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
  const afrund = value => Math.round(value * 10) / 10
  return {
    faktorer: { lette: a, tunge: b },
    proteinFoer: proteinTotal,
    meals: meals.map(meal => ({ ...meal, foods: meal.foods.map(food => ({ ...food, grams: afrund(food.grams * (tung(food) ? b : a)) })) })),
  }
}

// Dagens fri kcal: brugt (rækker, der starter med "Fri: ") og tilbage. Kun kcal; protein tælles ikke.
export const erFriRaekke = row => typeof row?.meal === 'string' && row.meal.trimStart().startsWith(FRI_PREFIX)
export function friStatus({ friKcal, logs }) {
  const pulje = num(friKcal) !== null && friKcal > 0 ? friKcal : 0
  const brugt = (Array.isArray(logs) ? logs : []).filter(erFriRaekke)
    .reduce((n, row) => n + (Number(String(row.kcal).replace(',', '.')) || 0), 0)
  return { pulje, brugt, tilbage: pulje - brugt, over: brugt > pulje }
}
export function friPost(stoerrelse, kcal) {
  const valgt = FRI_STOERRELSER.find(item => item.id === stoerrelse)
  const antal = valgt ? valgt.kcal : typeof kcal === 'string' ? Number(kcal.replace(',', '.')) : kcal
  if (typeof antal !== 'number' || !Number.isFinite(antal) || antal <= 0 || antal > 3000) return null
  const rundet = Math.round(antal)
  return { meal: `${FRI_PREFIX}${valgt ? valgt.id : `${rundet} kcal`}`, kcal: rundet, protein: 0, carb: 0, fat: 0 }
}

// Ugens tal til coachen: basemåltider fulgt og dage med puljen holdt. Kun dage med en fri pulje tæller.
export function friUge({ dage, raekker }) {
  const planDage = (dage ?? []).filter(d => d?.state === 'approved' && friProcent(d.friPct) > 0)
  if (!planDage.length) return null
  let basis = 0, basisAf = 0, holdt = 0, vurderede = 0
  for (const d of planDage) {
    const dagens = (raekker ?? []).filter(row => row?.date === d.date)
    const navne = new Set(dagens.filter(row => !erFriRaekke(row)).map(row => String(row.meal ?? '').trim()))
    const planNavne = Array.isArray(d.maaltider) ? d.maaltider : []
    basisAf += planNavne.length
    basis += planNavne.filter(navn => navne.has(String(navn).trim())).length
    if (dagens.length) {
      vurderede++
      const { over } = friStatus({ friKcal: Math.round(d.targets.kcal * friProcent(d.friPct) / 100), logs: dagens })
      if (!over) holdt++
    }
  }
  return { basis, basisAf, holdt, vurderede, dage: planDage.length }
}
