import { createPlanAdapter } from '../planAdapter.mjs'
import { shoppingDates, shoppingVersion, sumApprovedShopping, formatApprovedShopping, freezeShopping } from './approvedShoppingModel.mjs'
import { upcomingDates } from './upcomingPlanModel.mjs'

const current = () => true
const reasons = { empty: 'Ingen godkendt plan', unavailable: 'Kostplanens tabeller er ikke tilgængelige',
  error: 'Læsning eller portionsgrundlag kunne ikke bekræftes', pending: 'Afventer læsning' }

// Read-only per mounted client/athlete/today. No diary, coach, local templates,
// storage, writes, auth/session or mutable catalogue enters this controller.
export function createApprovedShopping(options = {}) {
  if (options.enabled !== true || options.readOnly === true) return null
  const { client, athleteId, today, isCurrent = current } = options
  let dates = shoppingDates(today, options.dates ?? upcomingDates(today).slice(1))
  // Validate the adapter's existing owner/client contract without any I/O.
  createPlanAdapter({ enabled: true, client, athleteId, date: today })
  let disposed = false, token = 0, attempted = false, pendingCopy = false
  const listeners = new Set()
  let state = freezeShopping({ phase: 'idle', dates, complete: false, result: null, affected: [], copyPending: false, copyStatus: '', copyText: '' })
  const alive = () => { try { return !disposed && isCurrent() === true } catch { return false } }
  const publish = changes => {
    state = freezeShopping({ ...state, copyPending: pendingCopy, ...changes })
    for (const fn of listeners) fn()
  }
  const reset = (phase, affected = []) => publish({ phase, dates, affected, complete: false, result: null, copyStatus: '', copyText: '' })
  const api = {
    snapshot: () => state,
    subscribe(fn) { if (!alive()) return () => {}; listeners.add(fn); return () => listeners.delete(fn) },
    choose(selected) {
      if (!alive()) return false
      try { dates = shoppingDates(today, selected) } catch { return false }
      return api.load()
    },
    async load() {
      if (!alive()) return false
      const attempt = ++token, selected = [...dates], freshAvailability = attempted
      attempted = true
      reset(selected.length ? 'loading' : 'empty-selection', selected.map(date => ({ date, reason: reasons.pending })))
      if (!selected.length) return false
      const evidence = [], affected = []
      // At most four dates, serial reads. Never fan out child work or transport.
      for (const date of selected) {
        if (!alive() || token !== attempt) return false
        try {
          const adapter = createPlanAdapter({ enabled: true, client, athleteId, date })
          const active = await adapter.loadActive({ requireAvailable: true, freshAvailability })
          if (!alive() || token !== attempt) return false
          if (active === null) { affected.push({ date, reason: reasons.empty }); continue }
          if (active.athlete_id !== athleteId || active.date !== date || active.active !== true) throw Error('Foreign plan')
          const response = await client.from('kostplan_v1_versions')
            .select('id,plan_id,version_no,effective_from,goal,intensity,meals')
            .eq('id', active.revision).eq('plan_id', active.id).lte('effective_from', date).limit(2)
          if (!alive() || token !== attempt) return false
          if (response?.error || !Array.isArray(response?.data) || response.data.length !== 1) throw Error('Incomplete version')
          const version = shoppingVersion(response.data[0], active, athleteId, date)
          // A new approval/archive may arrive during the secondary read. Keep
          // the existing adapter's mutable-parent and effective-version guards.
          const confirmed = await adapter.loadActive({ requireAvailable: true })
          if (!alive() || token !== attempt) return false
          if (confirmed?.id !== active.id || confirmed?.revision !== active.revision) throw Error('Version changed during read')
          shoppingVersion(response.data[0], confirmed, athleteId, date)
          evidence.push(version)
        } catch (error) {
          if (!alive() || token !== attempt) return false
          affected.push({ date, reason: error?.code === 'KOSTPLAN_UNAVAILABLE' ? reasons.unavailable : reasons.error })
        }
      }
      if (!alive() || token !== attempt) return false
      if (affected.length) { reset('incomplete', affected); return false }
      try {
        const result = sumApprovedShopping(today, selected, evidence)
        publish({ phase: 'ready', complete: true, result, affected: [], copyStatus: '', copyText: '' }); return true
      } catch {
        reset('incomplete', selected.map(date => ({ date, reason: reasons.error }))); return false
      }
    },
    async copy(clipboard, expectedEvidence = state.result) {
      if (!alive() || pendingCopy || state.complete !== true || expectedEvidence !== state.result) return false
      const evidence = state.result, attempt = token, text = formatApprovedShopping(evidence)
      const stillCurrent = () => alive() && token === attempt && state.result === evidence && state.complete
      pendingCopy = true; publish({ copyStatus: 'pending', copyText: '' })
      try {
        // The browser boundary is resolved only in this explicit user event.
        // Injected null means unavailable; no OS clipboard is used by tests.
        const adapter = clipboard === undefined ? globalThis.navigator?.clipboard : clipboard
        if (typeof adapter?.writeText !== 'function') throw Error('Clipboard unavailable')
        await adapter.writeText(text)
        if (!stillCurrent()) return false
        publish({ copyStatus: 'copied', copyText: '' }); return true
      } catch {
        if (stillCurrent()) publish({ copyStatus: 'failed', copyText: text })
        return false
      } finally { pendingCopy = false; if (alive()) publish({ copyPending: false }) }
    },
    dispose() { disposed = true; token++; listeners.clear() },
  }
  return Object.freeze(api)
}
