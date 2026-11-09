// Explicit caller-owned persistence around the accepted writer; no global storage.
import { createIntakeEvidenceRequest, INTAKE_EVIDENCE_VERSION } from './intakeEvidence.mjs'
import { createIntakeEvidenceWriter } from './intakeEvidenceWriter.mjs'

export const INTAKE_INTENT_JOURNAL_VERSION = 1
export const INTAKE_INTENT_JOURNAL_BYTES = 16384
const only = status => Object.freeze({ status })
const utf8 = text => new TextEncoder().encode(text).length
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
const six = r => ({ athleteId: r.athleteId, date: r.date, requestId: r.requestId,
  grams: r.grams, meal: r.meal, food: r.food })
const exact = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
// Bounded pseudonymous key, NOT encryption. Full identity is checked on every read;
// a hash collision blocks access rather than authorizing replacement.
function scopeKey(bound) {
  const text = JSON.stringify([bound.ownerId, bound.athleteId, bound.date])
  let a = 2166136261, b = 3339675911
  for (const char of text) {
    a = Math.imul(a ^ char.codePointAt(0), 16777619)
    b = Math.imul(b ^ char.codePointAt(0), 2246822519)
  }
  return 'entropi2:intake-intent:v1:' + [a, b].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('')
}

export function createIntakeIntentJournal(options = {}) {
  if (options.enabled !== true) {
    const off = () => only('off')
    return Object.freeze({ prepare: off, recover: off, submit: off, retry: off,
      acknowledge: off, snapshot: off, dispose: off })
  }
  let client = options.client, current = options.getCurrentContext, config = options
  let bound = null, state = 'idle', record = null, bytes = null, acknowledgement = null
  let writer = null, operation = null, confirmed = false, resolved = false, attempted = false
  let transportPermit = false
  let boundStorage = null, boundLock = null
  const retire = () => {
    state = 'retired'
    writer?.dispose()
    writer = record = bytes = acknowledgement = bound = client = current = config = null
    boundStorage = boundLock = null
    confirmed = false
    return Object.freeze({ status: 'retired', mayHaveCommitted: attempted })
  }
  const context = () => {
    try { return typeof current === 'function' ? current() : null } catch { return null }
  }
  const capable = (c, rpc) => c?.enabled === true && c.writable === true && c.future !== true
    && typeof c.ownerId === 'string' && c.ownerId.length > 0 && utf8(c.ownerId) <= 256
    && typeof c.athleteId === 'string' && c.athleteId.length === 36
    && typeof c.date === 'string' && c.date.length === 10
    && ((typeof c.generation === 'string' && c.generation.length > 0)
      || (typeof c.generation === 'number' && Number.isFinite(c.generation)))
    && c.client === client && typeof rpc === 'function'
  try {
    const rpc = client?.rpc
    const c = context()
    if (capable(c, rpc)) bound = Object.freeze({ ownerId: c.ownerId, athleteId: c.athleteId,
      date: c.date, generation: c.generation })
    else retire()
  } catch { retire() }
  const active = () => {
    if (state === 'retired') return false
    try {
      // Caller-owned method lookup may revoke scope. Read it BEFORE context;
      // return this exact method so transport needs no lookup after the guard.
      const rpc = client?.rpc
      const c = context()
      if (capable(c, rpc) && Object.keys(bound).every(k => c[k] === bound[k])) return rpc
    } catch { /* A broken capability is revoked. */ }
    retire()
    return false
  }
  const snapshot = () => {
    if (!active()) return Object.freeze({ status: 'retired', mayHaveCommitted: attempted })
    return Object.freeze({ status: state, mayHaveCommitted: attempted,
      uncertain: attempted && !confirmed && !resolved,
      ...(record ? { requestId: record.request.requestId } : {}) })
  }
  const status = next => { if (active()) state = next; return snapshot() }
  const encode = value => {
    const text = JSON.stringify(value)
    if (utf8(text) > INTAKE_INTENT_JOURNAL_BYTES) throw Error('bounded record')
    return text
  }
  const makeRecord = (request, wasAttempted = false, acknowledged = false) => freeze({
    version: INTAKE_INTENT_JOURNAL_VERSION, ownerId: bound.ownerId,
    athleteId: bound.athleteId, date: bound.date, request,
    attempted: wasAttempted, acknowledged,
  })
  const decode = raw => {
    if (typeof raw !== 'string' || utf8(raw) > INTAKE_INTENT_JOURNAL_BYTES) throw Error('record')
    const v = JSON.parse(raw)
    if (!exact(v, ['version', 'ownerId', 'athleteId', 'date', 'request', 'attempted', 'acknowledged'])
      || v.version !== INTAKE_INTENT_JOURNAL_VERSION || v.ownerId !== bound.ownerId
      || v.athleteId !== bound.athleteId || v.date !== bound.date
      || typeof v.attempted !== 'boolean' || typeof v.acknowledged !== 'boolean'
      || (v.acknowledged && !v.attempted)
      || !exact(v.request, ['version', 'requestId', 'athleteId', 'date', 'grams', 'meal', 'food'])
      || v.request.version !== INTAKE_EVIDENCE_VERSION) throw Error('record')
    const request = createIntakeEvidenceRequest(six(v.request))
    if (request.athleteId !== bound.athleteId || request.date !== bound.date
      || JSON.stringify(request) !== JSON.stringify(v.request)) throw Error('canonical request')
    const canonical = makeRecord(freeze(JSON.parse(JSON.stringify(request))), v.attempted, v.acknowledged)
    if (encode(canonical) !== raw) throw Error('canonical record')
    return canonical
  }
  // Every storage call is current-scope guarded, including after caller code ran.
  const read = (storage, key) => {
    if (!active()) throw Error('retired')
    const value = storage.getItem(key)
    if (!active()) throw Error('retired')
    return value
  }
  const write = (storage, key, text) => {
    if (!active()) throw Error('retired')
    storage.setItem(key, text)
    if (!active() || read(storage, key) !== text) throw Error('readback')
  }
  const matches = (storage, key) => read(storage, key) === bytes
  // All participants must supply the SAME genuine exclusive lock service for this
  // storage namespace, covering the complete callback (including awaited RPC).
  const locked = (kind, run) => {
    if (!active()) return Promise.resolve(snapshot())
    if (operation) return kind === 'send' && operation.kind === 'send'
      ? operation.promise : Promise.resolve(only('busy'))
    const pending = Promise.resolve().then(async () => {
      if (!active()) return snapshot()
      try {
        const lock = config.withExclusiveLock
        if (typeof lock !== 'function') return status('lock-required')
        if (boundLock && boundLock !== lock) throw Error('lock changed')
        boundLock = lock
        const key = scopeKey(bound)
        let entered = false, completed = false, result
        await lock(key, async () => {
          if (entered) throw Error('lock callback repeated')
          entered = true
          if (!active()) { result = snapshot(); completed = true; return }
          const storage = config.storage
          if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
            throw Error('storage required')
          if (boundStorage && boundStorage !== storage) throw Error('storage changed')
          boundStorage = storage
          if (!active()) { result = snapshot(); completed = true; return }
          result = await run(storage, key)
          completed = true
        })
        if (!entered || !completed) return status('lock-required')
        return active() ? result : snapshot()
      } catch { return status('storage-error') }
    }).finally(() => { operation = null; transportPermit = false })
    operation = { kind, promise: pending }
    return pending
  }
  const prepare = input => {
    if (!active()) return Promise.resolve(snapshot())
    let candidate, text
    try {
      candidate = freeze(JSON.parse(JSON.stringify(createIntakeEvidenceRequest(input))))
      if (!active()) return Promise.resolve(snapshot())
      if (candidate.athleteId !== bound.athleteId || candidate.date !== bound.date) return Promise.resolve(only('invalid'))
      text = encode(makeRecord(candidate))
    } catch { return Promise.resolve(only('invalid')) }
    return locked('prepare', (storage, key) => {
      const existing = read(storage, key)
      if (record && !resolved) {
        if (JSON.stringify(candidate) !== JSON.stringify(record.request)) return only('blocked')
        // Retry persistence only for the identical, never-attempted initial record.
        if (existing === null && !attempted) write(storage, key, bytes)
        else if (existing !== bytes) return status('storage-conflict')
        return status(attempted ? state : 'prepared')
      }
      if (existing !== null && !(resolved && existing === bytes)) return only('blocked')
      if (record && candidate.requestId === record.request.requestId) return only('blocked')
      writer?.dispose(); writer = null
      record = makeRecord(candidate); bytes = text; acknowledgement = null
      confirmed = resolved = attempted = false
      state = 'persisting'
      write(storage, key, bytes)
      return status('prepared')
    })
  }
  const recover = () => locked('recover', (storage, key) => {
    if (record) return snapshot()
    const raw = read(storage, key)
    if (raw === null) return status('empty')
    let restored
    try { restored = decode(raw) } catch { return status('invalid-record') }
    if (!active()) return snapshot()
    record = restored; bytes = raw; attempted = restored.attempted
    // A local marker is never server authority after reload. Even acknowledged
    // records must revalidate the SAME UUID before this instance can replace them.
    return status(attempted ? 'recovered' : 'prepared')
  })
  const send = explicitRetry => {
    if (!active()) return Promise.resolve(snapshot())
    if (operation?.kind === 'send') return operation.promise
    if (!record || resolved || confirmed || (attempted && !explicitRetry)) return Promise.resolve(snapshot())
    return locked('send', async (storage, key) => {
      if (!matches(storage, key)) return status('storage-conflict')
      record = makeRecord(record.request, true)
      bytes = encode(record); attempted = true; state = 'persisting'
      write(storage, key, bytes)
      if (!active()) return snapshot()
      if (!writer) {
        const transport = { rpc(name, args) {
          if (!transportPermit || !active() || !matches(storage, key)
            || JSON.stringify(args.p_request) !== JSON.stringify(record.request)) throw Error('transport blocked')
          const rpc = active()
          if (!rpc) throw Error('retired')
          return Reflect.apply(rpc, client, [name, args])
        } }
        writer = createIntakeEvidenceWriter({ enabled: true, client: transport,
          getCurrentContext: () => active() ? { ...bound, enabled: true, writable: true, client: transport } : null })
        if (writer.prepare(six(record.request)).status !== 'prepared') return status('invalid')
      }
      transportPermit = true; state = 'pending'
      const result = await (writer.snapshot().status === 'prepared' ? writer.submit() : writer.retry())
      transportPermit = false
      if (!active()) return snapshot()
      // The accepted writer alone validates the echoed pair. Caller strings or
      // successes from another writer cannot enter this private authorization.
      confirmed = result.status === 'success' && result.requestId === record.request.requestId
      if (!matches(storage, key)) return status('storage-conflict')
      return status(confirmed ? 'confirmed' : result.status)
    })
  }
  const acknowledge = () => locked('acknowledge', (storage, key) => {
    if (!record || !confirmed || resolved) return only('blocked')
    const raw = read(storage, key)
    if (raw !== bytes && (acknowledgement === null || raw !== acknowledgement)) return status('storage-conflict')
    // Keep a full same-ID tombstone: a throwing/silent storage adapter must never
    // erase the only recoverable request during acknowledgement. No removeItem.
    acknowledgement = encode(makeRecord(record.request, true, true))
    write(storage, key, acknowledgement)
    record = decode(acknowledgement); bytes = acknowledgement
    resolved = true
    return status('resolved')
  })
  return Object.freeze({ prepare, recover, submit: () => send(false), retry: () => send(true),
    acknowledge, snapshot, dispose: retire })
}
