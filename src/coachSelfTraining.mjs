// Navigation intent is a capability for this mounted coach session, never an auth role.
// Storage remembers an explicit choice; both navigation and the loaded row validate it.
const key = 'entropi_coach_self_training_v1'
const legacyKey = 'entropi_my_athlete_id'
const requests = new WeakMap()
const entries = new WeakMap()
const id = value => typeof value === 'string' && value.trim().length > 0
const storage = () => { try { return globalThis.localStorage } catch { return null } }
function binding() {
  try {
    const raw = storage()?.getItem(key)
    if (raw === null || raw === undefined) return null
    const saved = JSON.parse(raw)
    return saved && typeof saved === 'object' && !Array.isArray(saved) && id(saved.ownerId) && id(saved.athleteId)
      ? saved : { invalid: true }
  } catch { return { invalid: true } }
}
export function readCoachSelfAthleteId(session) {
  const ownerId = session?.user?.id
  if (!id(ownerId)) return null
  const saved = binding()
  if (saved) return saved.ownerId === ownerId && id(saved.athleteId) ? saved.athleteId : null
  try { return storage()?.getItem(legacyKey) || null } catch { return null }
}
export function requestCoachSelfTraining({ session, athlete, explicit = false }) {
  const ownerId = session?.user?.id
  if (!id(ownerId) || !id(athlete?.id) || athlete.coach_id !== ownerId) return null
  if (!explicit && readCoachSelfAthleteId(session) !== athlete.id) return null
  // Migration only follows an explicit entry and a current owned row. Keep legacy data.
  try {
    const store = storage()
    if (!store) return null
    store.setItem(key, JSON.stringify({ ownerId, athleteId: athlete.id }))
    if (explicit) store.setItem(legacyKey, athlete.id)
  } catch { return null }
  const request = Object.freeze({})
  requests.set(request, { session, ownerId, athleteId: athlete.id })
  return request
}
export function createCoachSelfContext(ownerId, role, verifiedOwnerId) {
  let active = true, generation = 0
  return {
    activate() { active = true },
    close() { generation++ },
    dispose() { active = false; generation++ },
    open(request, session) {
      const serial = ++generation
      const choice = request && requests.get(request)
      if (!active || !choice || role !== 'coach' || !id(ownerId) || verifiedOwnerId !== ownerId ||
          choice?.session !== session || choice.ownerId !== ownerId) return null
      const entry = Object.freeze({})
      entries.set(entry, { ...choice, current: () => active && generation === serial })
      return entry
    },
  }
}
export function isCoachSelfTraining(entry, { session, role, athlete, coachAthleteId }) {
  const choice = entry && typeof entry === 'object' ? entries.get(entry) : null
  const saved = binding()
  return !!(choice && choice.current() && role === 'coach' && id(session?.user?.id) &&
    choice.ownerId === session.user.id && choice.athleteId === coachAthleteId &&
    athlete?.id === coachAthleteId && athlete.coach_id === session.user.id &&
    saved?.ownerId === session.user.id && saved.athleteId === athlete.id)
}
export function guardTrainingActions(actions, canWrite, names) {
  return new Proxy(actions, { get(target, name) {
    const fn = target[name]
    return names.includes(name) && typeof fn === 'function' ? (...args) => canWrite() ? fn(...args) : false : fn
  } })
}
// Check delayed query execution too: a queued writer must not outlive its session.
export function guardTrainingClient(client, canWrite) {
  const deny = () => { throw Error('Træningskonteksten kan ikke længere gemme.') }
  const mutations = new Set(['insert', 'update', 'upsert', 'delete', 'rpc'])
  function query(target, writing = false) {
    return new Proxy(target, { get(object, name) {
      const value = object[name]
      if (typeof value !== 'function') return value
      if (name === 'then') return (ok, fail) => {
        if (writing && !canWrite()) return Promise.reject(Error('Træningskonteksten kan ikke længere gemme.')).then(ok, fail)
        return value.call(object, ok, fail)
      }
      return (...args) => {
        const write = writing || mutations.has(name)
        if (write && !canWrite()) return deny()
        const result = value.apply(object, args)
        return result && typeof result === 'object' ? query(result, write) : result
      }
    } })
  }
  return { from: (...args) => query(client.from(...args)), rpc: (...args) => {
    if (!canWrite()) return deny()
    const result = client.rpc(...args)
    return result && typeof result === 'object' ? query(result, true) : result
  } }
}

export function createTrainingLifetime(identity) {
  let active = true
  const clients = new WeakMap(), sessionClients = new WeakMap()
  return { identity, activate() { active = true }, dispose() { active = false }, isActive: () => active,
    guardSessionClient(client, canUseSession) {
      if (!sessionClients.has(client)) sessionClients.set(client, guardTrainingClient(client, canUseSession))
      return sessionClients.get(client)
    },
    guardClient(client, canWrite) {
      if (!clients.has(client)) clients.set(client, guardTrainingClient(client, canWrite))
      return clients.get(client)
    },
  }
}
