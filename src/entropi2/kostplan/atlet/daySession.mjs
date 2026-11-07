import { nutritionContracts } from '../../nutrition/contracts.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { createTrackedAthleteDay } from './trackerAdapter.mjs'

// One athlete/day owner. The plan adapter caches only schema availability; plan
// data and the existing meal log are read for this exact scope on every load.
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
    contracts: planContracts, loadPlan: () => createPlanAdapter({ enabled: true, athleteId, date, client }).loadActive() })
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
    // Like the day frame, retain the last confirmed version while refreshing;
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
