// Local transport seam. Authorization remains in the existing SQL/RLS contract.
import { createIntakeEvidenceRequest, readIntakeEvidence } from './intakeEvidence.mjs'

const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
// Compare JSON structurally: SQL jsonb does not preserve JS property order.
const key = value => JSON.stringify(value, function (_name, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item
})
const statusOnly = status => Object.freeze({ status })

export function createIntakeEvidenceWriter(options = {}) {
  // Do not even read the injected client/callback or input while OFF.
  if (options.enabled !== true) {
    const off = () => statusOnly('off')
    return Object.freeze({ prepare: off, submit: off, retry: off, snapshot: off, dispose: off })
  }
  let client = options.client, current = options.getCurrentContext
  let bound = null, state = 'idle', request = null, value = null, operation = null
  let uncertain = false, sent = false
  const used = new Map()
  const retire = () => {
    state = 'retired'
    bound = request = value = client = current = null
    used.clear()
    return Object.freeze({ status: 'retired', mayHaveCommitted: sent })
  }
  const context = () => {
    try { return typeof current === 'function' ? current() : null } catch { return null }
  }
  const capable = c => c?.enabled === true && c.writable === true && c.future !== true
    && typeof c.ownerId === 'string' && c.ownerId.length > 0
    && typeof c.athleteId === 'string' && typeof c.date === 'string'
    && ((typeof c.generation === 'string' && c.generation.length > 0)
      || (typeof c.generation === 'number' && Number.isFinite(c.generation)))
    && c.client === client && typeof client?.rpc === 'function'
  const initial = context()
  if (capable(initial)) {
    bound = Object.freeze({ ownerId: initial.ownerId, athleteId: initial.athleteId,
      date: initial.date, generation: initial.generation })
  } else retire()

  const active = () => {
    if (state === 'retired') return false
    const c = context()
    if (!capable(c) || Object.keys(bound).some(name => c[name] !== bound[name])) {
      retire()
      return false
    }
    return true
  }
  const snapshot = () => {
    if (!active()) return Object.freeze({ status: 'retired', mayHaveCommitted: sent })
    return Object.freeze({ status: state, mayHaveCommitted: uncertain,
      ...(request ? { requestId: request.requestId } : {}), ...(value ? { value } : {}) })
  }
  const prepare = input => {
    if (!active()) return snapshot()
    let candidate
    try { candidate = createIntakeEvidenceRequest(input) } catch { return statusOnly('invalid') }
    if (candidate.athleteId !== bound.athleteId || candidate.date !== bound.date) {
      return statusOnly(candidate.requestId === request?.requestId ? 'conflict' : 'invalid')
    }
    const bytes = key(candidate)
    if (used.has(candidate.requestId) && used.get(candidate.requestId) !== bytes) return statusOnly('conflict')
    if (request?.requestId === candidate.requestId) return snapshot()
    if (operation || uncertain || state === 'prepared') return statusOnly('blocked')
    // The model owns canonicalization. Copy and freeze its complete JSON output.
    request = freeze(JSON.parse(JSON.stringify(candidate)))
    used.set(request.requestId, bytes)
    state = 'prepared'; value = null
    return snapshot()
  }
  const send = () => {
    if (!active()) return Promise.resolve(snapshot())
    if (operation) return operation
    if (!request) return Promise.resolve(snapshot())
    // Schedule before entering caller-owned transport, including synchronous reentry.
    state = 'pending'
    operation = Promise.resolve().then(async () => {
      if (!active()) return snapshot()
      sent = true
      try {
        const reply = await client.rpc('record_meal_intake_evidence_v1', { p_request: request })
        if (!active()) return snapshot()
        if (reply?.error) {
          const code = reply.error.code
          state = code === '23505' ? 'conflict' : code === '42501' ? 'denied'
            : ['PGRST202', '42P01', '42883'].includes(code) ? 'unavailable' : 'uncertain'
          if (state === 'uncertain') uncertain = true
        } else {
          const pair = reply?.data
          const parsed = readIntakeEvidence(pair?.mealLog, pair?.evidence, bound)
          const echoed = parsed && { version: parsed.version, requestId: parsed.requestId,
            athleteId: parsed.athleteId, date: parsed.date, grams: parsed.grams, meal: parsed.meal, food: parsed.food }
          if (parsed && key(echoed) === key(request)) {
            value = freeze(JSON.parse(JSON.stringify(parsed)))
            state = 'success'; uncertain = false
          } else { state = 'uncertain'; uncertain = true }
        }
      } catch {
        if (!active()) return snapshot()
        // A thrown transport error can follow an actual commit. Never expose it.
        state = 'uncertain'; uncertain = true
      }
      return snapshot()
    }).finally(() => { operation = null })
    return operation
  }
  const submit = input => {
    if (!active()) return Promise.resolve(snapshot())
    if (input !== undefined) {
      const prepared = prepare(input)
      if (['invalid', 'conflict', 'blocked', 'retired'].includes(prepared.status)) return Promise.resolve(prepared)
    }
    if (operation) return operation
    // Only explicit retry can transmit an already attempted intent again.
    return state === 'prepared' ? send() : Promise.resolve(snapshot())
  }
  const retry = () => {
    if (!active()) return Promise.resolve(snapshot())
    if (operation) return operation
    return ['uncertain', 'denied', 'unavailable', 'conflict'].includes(state) ? send() : Promise.resolve(snapshot())
  }
  return Object.freeze({ prepare, submit, retry, snapshot, dispose: retire })
}
