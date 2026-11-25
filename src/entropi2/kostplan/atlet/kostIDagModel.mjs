import { mealKey } from '../../nutrition/controller.mjs'
import { foodChoices } from '../../nutrition/foodSearch.mjs'

// 1899 (Marc 19. nov.: "rigtig simpelt og overskueligt at indtaste"): ren model
// for kortet "Kost i dag". Ingen ny tabel eller læsning; kun kostloggens og
// dagsplanens egne snapshots.
const fmt = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(value)
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

// Én linje: dagens tal mod mål. Ventende måltider tælles med og markeres.
export function statusLinje(snapshot, pending = []) {
  if (!snapshot?.loaded) return 'Henter dagens tal…'
  if (!snapshot.totals) return 'Dagens tal kan ikke lægges sammen. Se måltiderne under Vis detaljer.'
  const extra = key => pending.reduce((sum, item) => sum + (Number(item.values?.[key]) || 0), 0)
  const kcal = snapshot.totals.kcal + extra('kcal'), protein = snapshot.totals.protein + extra('protein')
  const kcalMaal = positive(snapshot.targets?.kcal), proteinMaal = positive(snapshot.targets?.protein)
  const tekst = `I dag ${fmt(kcal)}${kcalMaal ? ` af ${fmt(kcalMaal)}` : ''} kcal · ${fmt(protein)}${proteinMaal ? ` af ${fmt(proteinMaal)}` : ''} g protein`
  return pending.length ? `${tekst} (gemmer)` : tekst
}

// 2369: én kort linje med varer og gram under et åbent planmåltid; samme gram som Vis detaljer (dayModel efter skalering).
// Over 4 varer: de 3 første og "+ N mere". Ingen varer giver ingen linje.
const gram = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)
export function planVarerLinje(meal, max = 4) {
  const foods = (meal?.foods ?? []).filter(food => food?.name && Number(food.grams) > 0)
  if (!foods.length) return null
  const vis = foods.length > max ? foods.slice(0, max - 1) : foods
  const linje = vis.map(food => `${food.name} ${gram(Number(food.grams))} g`).join(' · ')
  return foods.length > max ? `${linje} + ${foods.length - vis.length} mere` : linje
}

// Hurtige gentagelser: favoritter, i går og seneste måltider, uden dubletter.
export function hurtigeMaaltider(snapshot, max = 4) {
  if (!snapshot?.loaded) return []
  const seen = new Set(), out = []
  for (const meal of [...(snapshot.favorites ?? []), ...(snapshot.yesterday ?? []), ...(snapshot.recent ?? [])]) {
    const key = mealKey(meal)
    if (seen.has(key)) continue
    seen.add(key); out.push(meal)
    if (out.length >= max) break
  }
  return out
}

// Forslag til feltet "Nyt måltid": egne måltider (ét tryk) og basisfødevarer.
// Frida-fødevarer bruges kun i detaljerne, hvor deres egen adgang gælder.
export function forslag(snapshot, query, { maaltider = 3, foedevarer = 4 } = {}) {
  const needle = String(query ?? '').normalize('NFC').toLocaleLowerCase('da-DK').trim()
  if (needle.length < 2 || !snapshot?.loaded) return { meals: [], foods: [] }
  const seen = new Set(), meals = []
  for (const meal of [...(snapshot.favorites ?? []), ...(snapshot.recent ?? [])]) {
    const key = mealKey(meal)
    if (seen.has(key) || !meal.meal.toLocaleLowerCase('da-DK').includes(needle)) continue
    seen.add(key); meals.push(meal)
    if (meals.length >= maaltider) break
  }
  const all = snapshot.foods ?? []
  const foods = foodChoices(all, needle, null).matches
    .filter(index => !String(all[index]?.id ?? '').startsWith('frida55:'))
    .slice(0, foedevarer).map(index => ({ index, food: all[index] }))
  return { meals, foods }
}

export const detaljerNoegle = athleteId => `entropi2:kost-detaljer:v1:${encodeURIComponent(athleteId)}`
export function laesDetaljer(storage, athleteId) {
  try { return storage?.getItem(detaljerNoegle(athleteId)) === '1' } catch { return false }
}
export function gemDetaljer(storage, athleteId, open) {
  try { storage?.setItem(detaljerNoegle(athleteId), open ? '1' : '0') } catch { /* kun denne visning */ }
}

// 2154: "Alt fra i går" kopierer gårsdagens rækker. Samme navn som et planmåltid i dag beholdes; resten får dagens plannavn
// på plads i rækkefølgen (omdøbt måltid). Overskydende rækker beholder deres eget navn og tæller ikke som basemåltid.
export function iGaarMedPlannavne(iGaar, planNavne) {
  const fri = (planNavne ?? []).map(navn => String(navn ?? '').trim()).filter(Boolean)
  const tildelt = iGaar.map(meal => {
    const i = fri.indexOf(String(meal.meal ?? '').trim())
    return i === -1 ? null : fri.splice(i, 1)[0]
  })
  return iGaar.map((meal, i) => tildelt[i] ? meal : fri.length ? { ...meal, meal: fri.shift() } : meal)
}

// 2359b: "Spist igen" på et historisk måltid, hvis kcal og protein ligger inden for 10 % af et åbent planmåltid, logges under
// planmåltidets navn (som iGaarMedPlannavne), så planmåltidet ikke står åbent og maden ikke tæller som fri. Ellers uændret.
// aabne er kun de åbne planmåltider (ikke spist, ikke blokeret, ikke logget på anden vis), så et logget planmåltid matches ikke igen.
const inden10 = (value, maal) => maal > 0 && Math.abs(value - maal) <= maal * 0.1
export function spistIgenMedPlannavn(meal, aabne) {
  const kcal = Number(meal?.kcal), protein = Number(meal?.protein)
  if (!Number.isFinite(kcal) || !Number.isFinite(protein)) return { meal, plannavn: null }
  let bedst = null, afstand = Infinity
  for (const plan of Array.isArray(aabne) ? aabne : []) {
    const maalKcal = Number(plan?.values?.kcal), maalProtein = Number(plan?.values?.protein)
    if (!inden10(kcal, maalKcal) || !inden10(protein, maalProtein)) continue
    const d = Math.abs(kcal - maalKcal) / maalKcal + Math.abs(protein - maalProtein) / maalProtein
    if (d < afstand) { bedst = plan; afstand = d }
  }
  return bedst ? { meal: { ...meal, meal: bedst.name }, plannavn: bedst.name } : { meal, plannavn: null }
}
