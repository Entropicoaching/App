import { namespace } from './dayModel.mjs'
import { foodKey } from './approvedShoppingModel.mjs'

// v2 uses exact ingredient references. v1 records are deliberately neither read
// nor rewritten: existing local marks reset once, on opening this new namespace.
export const purchaseNamespace = `${namespace}:purchases:v2`
export const maxPurchaseBytes = 32768, maxPurchaseItems = 256
const bytes = text => new TextEncoder().encode(text).length
const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
const browserStorage = () => globalThis.localStorage
const list = (value, max, valid) => Array.isArray(value) && value.length <= max && value.every(valid)
const text = value => typeof value === 'string'
const day = value => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value)
const grams = value => text(value) && /^(?:\d+(?:\.\d+)?|\d+(?:\.\d+)?e[+-]?\d+)$/.test(value) && Number(value) > 0 && Number.isFinite(Number(value))
// Validate a prior scope too: a different selected date/version may be replaced
// by a user action, but foreign actors, malformed arrays and arbitrary JSON may not.
function validScope(raw, athleteId) {
  const s = JSON.parse(raw)
  return Array.isArray(s) && s.length === 5 && s[0] === athleteId && day(s[1])
    && list(s[2], 4, day) && s[2].length > 0 && new Set(s[2]).size === s[2].length
    && JSON.stringify(s[2]) === JSON.stringify([...s[2]].sort())
    && list(s[3], 4, d => Array.isArray(d) && d.length === 6 && day(d[0]) && id(d[1]) && id(d[2])
      && Number.isSafeInteger(d[3]) && d[3] > 0 && day(d[4])
      && list(d[5], 30, meal => list(meal, 100, p => Array.isArray(p) && p.length === 2
        && (text(p[0]) || (Number.isInteger(p[0]) && p[0] >= 0 && p[0] < s[4]?.length)) && grams(p[1]))))
    && JSON.stringify(s[3].map(d => d[0])) === JSON.stringify(s[2])
    && list(s[4], maxPurchaseItems, i => Array.isArray(i) && i.length === 3 && text(i[0]) && grams(i[1]) && text(i[2]))
    && new Set(s[4].map(i => i[0])).size === s[4].length
}

// Called only after the controller has confirmed every selected approved day.
// One bounded record per athlete; no enumeration, removal or other app keys.
// Indices refer to the exact ordered ingredient identities in this scope.
export function purchaseScope({ athleteId, today, result, evidence }) {
  if (!id(athleteId) || result?.complete !== true) throw TypeError('Unconfirmed shopping evidence')
  // The ordered gross items already contain each full foodKey exactly once.
  // Numeric references preserve its id/preparation/citation/verification without
  // repeating provenance in every portion. JSON types distinguish a reference
  // from a literal identity; retain an unmatched identity verbatim rather than
  // allowing inconsistent evidence to alias an existing ingredient's marks.
  const ingredients = new Map(result.items.map((item, index) => [item.key, index]))
  return JSON.stringify([athleteId, today, [...result.dates].sort(),
    [...evidence].sort((a, b) => a.date.localeCompare(b.date)).map(day => [day.date, day.planId,
      day.versionId, day.versionNumber, day.effectiveFrom,
      day.meals.map(meal => meal.portions.map(p => {
        const identity = foodKey(p.food)
        return [ingredients.get(identity) ?? identity, String(p.grams)]
      }))]),
    result.items.map(item => [item.key, item.grams, item.preparation])])
}

export function openPurchaseMarkers({ athleteId, today, result, evidence, storage = browserStorage }) {
  const scope = purchaseScope({ athleteId, today, result, evidence })
  const key = `${purchaseNamespace}:${encodeURIComponent(athleteId)}`
  let bought = new Set(), persistent = false
  const bounded = result.items.length <= maxPurchaseItems && bytes(scope) <= maxPurchaseBytes / 2
  // Failure is sticky for this evidence/session. Never discard working marks
  // or overwrite a malformed/foreign record in response to a read failure.
  try {
    if (!bounded) throw Error('Scope exceeds local marker bound')
    const store = storage(), raw = store.getItem(key)
    if (typeof store.setItem !== 'function') throw Error('Storage unavailable')
    if (raw !== null) {
      if (typeof raw !== 'string' || raw.length > maxPurchaseBytes || bytes(raw) > maxPurchaseBytes) throw Error('Oversized markers')
      const value = JSON.parse(raw)
      if (!value || Object.keys(value).sort().join(',') !== 'bought,namespace,scope'
        || value.namespace !== purchaseNamespace || typeof value.scope !== 'string' || !validScope(value.scope, athleteId)
        || !Array.isArray(value.bought) || value.bought.length > maxPurchaseItems
        || value.bought.some(i => !Number.isInteger(i) || i < 0 || i >= JSON.parse(value.scope)[4].length)
        || new Set(value.bought).size !== value.bought.length) throw Error('Invalid markers')
      if (value.scope === scope) {
        if (value.bought.some(i => i >= result.items.length)) throw Error('Foreign ingredient')
        bought = new Set(value.bought)
      }
    }
    persistent = true
  } catch { persistent = false }
  return Object.freeze({
    scope,
    snapshot: () => ({ bought: [...bought].sort((a, b) => a - b), persistent }),
    set(index, checked) {
      if (!Number.isInteger(index) || index < 0 || index >= result.items.length || typeof checked !== 'boolean') return false
      if (checked) bought.add(index); else bought.delete(index)
      if (persistent) {
        try {
          const raw = JSON.stringify({ namespace: purchaseNamespace, scope, bought: [...bought].sort((a, b) => a - b) })
          if (bytes(raw) > maxPurchaseBytes) throw Error('Oversized markers')
          const store = storage(); store.setItem(key, raw)
          if (store.getItem(key) !== raw) throw Error('Unconfirmed marker save')
        } catch { persistent = false }
      }
      return true
    },
  })
}
