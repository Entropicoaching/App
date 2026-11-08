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
function validLegacyScope(raw, athleteId) {
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

// Only previously oversized scopes use this lossless codec. It compresses the
// EXACT original v2 JSON, including literal unmatched identities and gram text.
// References are non-overlapping UTF-16 ranges, never recursive dictionaries.
const compactTag = 'purchase-scope/lz2', maxExpanded = 262144, maxTokens = 4096
function shallow(raw, limit) {
  let depth = 0, quoted = false, escape = false
  for (const ch of raw) {
    if (quoted) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') quoted = false
    } else if (ch === '"') quoted = true
    else if (ch === '[' || ch === '{') { if (++depth > limit) return false }
    else if (ch === ']' || ch === '}') { if (--depth < 0) return false }
  }
  return depth === 0 && !quoted
}
function pack(raw) {
  const seen = new Map(), tokens = []
  let i = 0, literal = ''
  while (i < raw.length) {
    const key = raw.slice(i, i + 8), candidates = seen.get(key) ?? []
    let length = 0, previous = 0
    for (const position of candidates) {
      const bound = Math.min(i - position, raw.length - i)
      let match = 0
      while (match < bound && raw[position + match] === raw[i + match]) match++
      if (match > length) { length = match; previous = position }
    }
    const take = length >= 12 ? length : 1
    if (take > 1) {
      if (literal) { tokens.push(literal); literal = '' }
      tokens.push((i - previous) * (maxExpanded + 1) + take)
    } else literal += raw[i]
    for (let j = i; j < i + take; j++) {
      const key = raw.slice(j, j + 8), positions = seen.get(key) ?? []
      if (positions.length === 8) positions.shift()
      positions.push(j); seen.set(key, positions)
    }
    i += take
  }
  if (literal) tokens.push(literal)
  return tokens.length <= maxTokens ? JSON.stringify([compactTag, tokens]) : null
}
const high = code => code >= 0xd800 && code <= 0xdbff
const low = code => code >= 0xdc00 && code <= 0xdfff
// Count UTF-8 without making the reference slice. Unpaired surrogates cost 3
// bytes, exactly as TextEncoder; a pair split across tokens costs 4, not 6.
function rangeBytes(source, start, end) {
  let size = 0
  for (let i = start; i < end; i++) {
    const code = source.charCodeAt(i)
    if (code < 0x80) size++
    else if (code < 0x800) size += 2
    else if (high(code) && i + 1 < end && low(source.charCodeAt(i + 1))) { size += 4; i++ }
    else size += 3
  }
  return size
}
// Track string escapes and container nesting across token boundaries BEFORE
// copying the next range. JSON.parse later checks the complete bounded grammar.
function scanStructure(state, source, start, end) {
  for (let i = start; i < end; i++) {
    const ch = source[i]
    if (state.quoted) {
      if (source.charCodeAt(i) < 0x20) throw Error('Scope string control')
      if (state.escape) state.escape = false
      else if (ch === '\\') state.escape = true
      else if (ch === '"') state.quoted = false
    } else if (ch === '"') state.quoted = true
    else if (ch === '[' || ch === '{') {
      if (state.stack.length === 7) throw Error('Scope depth')
      state.stack.push(ch)
    } else if (ch === ']' || ch === '}') {
      if (state.stack.pop() !== (ch === ']' ? '[' : '{')) throw Error('Scope structure')
    }
  }
}
function unpack(raw, athleteId) {
  if (raw.length > maxPurchaseBytes / 2 || bytes(raw) > maxPurchaseBytes / 2 || !shallow(raw, 2)) throw Error('Scope bound')
  const value = JSON.parse(raw)
  if (!Array.isArray(value) || value.length !== 2 || value[0] !== compactTag
    || !Array.isArray(value[1]) || !value[1].length || value[1].length > maxTokens) throw Error('Scope tag/tokens')
  let expanded = '', expandedBytes = 0
  const structure = { stack: [], quoted: false, escape: false }
  for (const token of value[1]) {
    const literal = typeof token === 'string'
    const length = literal ? token.length : token % (maxExpanded + 1)
    if (!Number.isSafeInteger(length) || length < 1 || length > maxExpanded - expanded.length) throw Error('Expansion bound')
    let source = token, start = 0
    if (!literal) {
      const distance = Math.floor(token / (maxExpanded + 1))
      if (!Number.isSafeInteger(token) || distance < length || distance > expanded.length || length < 12) throw Error('Scope reference')
      source = expanded; start = expanded.length - distance
    }
    const nextBytes = expandedBytes + rangeBytes(source, start, start + length)
      - (high(expanded.charCodeAt(expanded.length - 1)) && low(source.charCodeAt(start)) ? 2 : 0)
    // BOTH ceilings precede the affected slice/concatenation, including UTF-8.
    if (nextBytes > maxExpanded) throw Error('UTF-8 expansion bound')
    scanStructure(structure, source, start, start + length)
    expanded += literal ? token : source.slice(start, start + length)
    expandedBytes = nextBytes
  }
  if (expandedBytes <= maxPurchaseBytes / 2 || structure.stack.length || structure.quoted) throw Error('Expanded scope')
  if (!validLegacyScope(expanded, athleteId) || JSON.stringify(JSON.parse(expanded)) !== expanded
    || pack(expanded) !== raw) throw Error('Noncanonical scope')
  return JSON.parse(expanded)
}
function validScope(raw, athleteId) {
  if (!shallow(raw, 7)) return null
  const value = JSON.parse(raw)
  if (Array.isArray(value) && value.length === 2 && value[0] === compactTag) {
    const scope = unpack(raw, athleteId)
    return scope[0] === athleteId ? scope : null
  }
  return validLegacyScope(raw, athleteId) ? value : null
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
  const legacy = JSON.stringify([athleteId, today, [...result.dates].sort(),
    [...evidence].sort((a, b) => a.date.localeCompare(b.date)).map(day => [day.date, day.planId,
      day.versionId, day.versionNumber, day.effectiveFrom,
      day.meals.map(meal => meal.portions.map(p => {
        const identity = foodKey(p.food)
        return [ingredients.get(identity) ?? identity, String(p.grams)]
      }))]),
    result.items.map(item => [item.key, item.grams, item.preparation])])
  // Preserve every supported legacy scope byte-for-byte; no read migration.
  if (bytes(legacy) <= maxPurchaseBytes / 2 || legacy.length > maxExpanded || bytes(legacy) > maxExpanded) return legacy
  const compact = pack(legacy)
  return compact !== null && bytes(compact) <= maxPurchaseBytes / 2 ? compact : legacy
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
      if (!shallow(raw, 3)) throw Error('Deep marker record')
      const value = JSON.parse(raw)
      const checkedScope = typeof value?.scope === 'string' ? validScope(value.scope, athleteId) : null
      if (!value || Object.keys(value).sort().join(',') !== 'bought,namespace,scope'
        || value.namespace !== purchaseNamespace || !checkedScope
        || !Array.isArray(value.bought) || value.bought.length > maxPurchaseItems
        || value.bought.some(i => !Number.isInteger(i) || i < 0 || i >= checkedScope[4].length)
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
