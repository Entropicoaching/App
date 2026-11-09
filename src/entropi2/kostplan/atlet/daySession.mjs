import { nutritionContracts } from '../../nutrition/contracts.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { createTrackedAthleteDay } from './trackerAdapter.mjs'

// One athlete/day owner. Every load confirms availability as well as plan data;
// an unavailable read must never become a confirmed empty day.
export function createKostDaySession(options = {}) {
  if (options.enabled !== true) return null
  const { athleteId, date, client, storage, currentDay, onDiaryChanged } = options
  const existing = nutritionContracts({ client })
  let disposed = false, dirty = false, scheduled = false
  const refresh = () => {
    if (disposed || !dirty || scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      if (disposed || !dirty || controller.snapshot().pending || controller.snapshot().phase === 'loading') return
      dirty = false
      void controller.load()
    })
  }
  // Both views use the same guarded diary contracts. A confirmed tracker edit
  // refreshes remaining intake, including edits made while a plan save is busy.
  const contracts = { ...existing }
  for (const method of ['save', 'saveWithIdentity', 'update', 'remove']) {
    contracts[method] = async (...args) => {
      if (disposed) return method === 'saveWithIdentity' ? { ok: false, id: null } : false
      const result = await existing[method](...args)
      if (result === true || result?.ok === true) { dirty = true; refresh() }
      return result
    }
  }
  const planContracts = { ...contracts, async saveWithIdentity(row) {
    try { return await contracts.saveWithIdentity(row) }
    finally { if (!disposed) onDiaryChanged?.() }
  } }
  const controller = createTrackedAthleteDay({ enabled: true, athleteId, date, storage, currentDay,
    contracts: planContracts, loadPlan: async () => {
      // loadActive caches schema probes by client identity and returns null for
      // missing tables. Give each read its own facade and reject failed probes,
      // so only a completed active-plan query can confirm an empty day. These
      // two single-column limit(0) probes are the existing adapter's contract.
      // Before the kostplan migration the first table does not exist at all:
      // that is a confirmed "no plan yet", so the adapter may return null.
      // A missing later table (a partial schema) remains a read error.
      const readClient = { from: table => ({ select(columns, ...args) {
        const query = client.from(table).select(columns, ...args)
        if (!['id', 'version_id'].includes(columns)) return query
        return { async limit(count) {
          const result = await query.limit(count)
          if (table === 'kostplan_v1_plans' && ['42P01', 'PGRST205'].includes(result?.error?.code)) return result
          if (result?.error) throw Error('Kostplanen er ikke tilgængelig.')
          return result
        } }
      } }) }
      return createPlanAdapter({ enabled: true, athleteId, date, client: readClient }).loadActive()
    } })
  // A read-only channel owned by this exact client/athlete/day session. Never
  // persist or share it across owners, and never issue another plan query for
  // the tracker. The authenticated client remains the access-control boundary.
  const owner = Object.freeze({}), targetListeners = new Set()
  let approved = null
  let reference = Object.freeze({ owner, athleteId, date, source: 'profile', state: 'idle' })
  const publishTargets = () => {
    const s = controller.snapshot()
    if (s.mode === 'plan') approved = { planId: s.planId, revision: s.planRevision,
      targets: Object.freeze({ ...s.targets }) }
    else if (!['loading', 'load-error'].includes(s.phase)) approved = null
    // Retain the last confirmed target reference while refreshing;
    // its status is explicit. A successful no-plan read clears it immediately.
    reference = Object.freeze({ owner, athleteId, date, source: approved ? 'approved-plan' : 'profile',
      state: s.phase === 'loading' || s.phase === 'load-error' ? s.phase : 'ready', ...approved })
    for (const fn of targetListeners) fn()
  }
  contracts.dayTargets = Object.freeze({ owner, athleteId, date,
    snapshot: () => reference,
    subscribe(fn) { if (disposed) return () => {}; targetListeners.add(fn); return () => targetListeners.delete(fn) },
  })
  const unsubscribe = controller.subscribe(() => { publishTargets(); refresh() })
  return {
    athleteId, date, client, contracts, controller,
    dispose() {
      disposed = true; unsubscribe(); controller.dispose(); approved = null
      reference = Object.freeze({ owner, athleteId, date, source: 'profile', state: 'disposed' })
      for (const fn of targetListeners) fn()
      targetListeners.clear()
    },
  }
}
