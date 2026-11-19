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
