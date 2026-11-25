import { formatCompactShopping } from './compactShoppingText.mjs'
import { createPlanAdapter } from '../planAdapter.mjs'
import { weekEnd, datesAfterWeek, shoppingDates, shoppingVersion, shoppingWindow, scaleShoppingVersion, sumApprovedShopping, formatApprovedShopping, freezeShopping } from './approvedShoppingModel.mjs'
import { openPurchaseMarkers, purchaseScope } from './purchaseMarkers.mjs'

const current = () => true
const reasons = { empty: 'Ingen godkendt plan', unavailable: 'Kostplanens tabeller er ikke tilgængelige',
  error: 'Læsning eller portionsgrundlag kunne ikke bekræftes', pending: 'Afventer læsning' }

// Read-only transport per mounted client/athlete/today. Purchase markers use
// only their own local boundary, never diary, coach, auth/session or plan writes.
export function createApprovedShopping(options = {}) {
  if (options.enabled !== true || options.readOnly === true) return null
  const { client, athleteId, today, isCurrent = current } = options
  let dates = shoppingDates(today, options.dates ?? shoppingWindow(today))
  // Validate the adapter's existing owner/client contract without any I/O.
  createPlanAdapter({ enabled: true, client, athleteId, date: today })
  let disposed = false, token = 0, attempted = false, pendingCopy = false
  // 2373: standardvalget er resten af den sendte uge fra i dag; uden en kendt uge (en enkelt plan) er det som før de tre næste dage.
  // "Hele ugen" vælger hele vinduet. Begge dele lader i dag falde af, hvis der ikke er en plan endnu.
  let defaulted = options.dates === undefined, wholeWeek = defaulted
  // 2123: dage uden godkendt plan (efter den sendte uges slut) er ikke en del af listen og vises ikke.
  let outside = []
  let markers = null
  const listeners = new Set()
  let state = freezeShopping({ phase: 'idle', dates, outside, complete: false, result: null, affected: [], copyPending: false, copyStatus: '', copyText: '', compactCopyStatus: '', compactCopyText: '', purchases: null })
  const alive = () => { try { return !disposed && isCurrent() === true } catch { return false } }
  const publish = changes => {
    state = freezeShopping({ ...state, copyPending: pendingCopy, ...changes })
    for (const fn of listeners) fn()
  }
  const reset = (phase, affected = []) => publish({ phase, dates, outside, affected, complete: false, result: null, copyStatus: '', copyText: '', compactCopyStatus: '', compactCopyText: '', purchases: null })
  const api = {
    snapshot: () => state,
    subscribe(fn) { if (!alive()) return () => {}; listeners.add(fn); return () => listeners.delete(fn) },
    choose(selected) {
      if (!alive()) return false
      try { dates = shoppingDates(today, selected) } catch { return false }
      defaulted = false; wholeWeek = dates.length === shoppingWindow(today).length
      return api.load()
    },
    async load() {
      if (!alive()) return false
      const attempt = ++token, selected = [...dates], freshAvailability = attempted
      attempted = true
      reset(selected.length ? 'loading' : 'empty-selection', selected.map(date => ({ date, reason: reasons.pending })))
      if (!selected.length) return false
      // 2123: en plan gælder til den næste kommer; den sendte uge slutter på den seneste godkendte plans første dag.
      // 2373: læses før dagene, så dagene efter ugens slut ikke hentes for ingenting (vinduet er nu 7 dage).
      let gone = [], known = false
      try {
        const response = await client.from('kostplan_v1_plans').select('valid_from').eq('athlete_id', athleteId).eq('status', 'godkendt')
          .order('valid_from', { ascending: false }).limit(7)
        if (!alive() || token !== attempt) return false
        if (!response?.error && Array.isArray(response?.data) && response.data.length > 0) {
          const froms = response.data.map(p => p.valid_from)
          gone = datesAfterWeek(shoppingWindow(today), froms); known = weekEnd(froms) !== null
        }
      } catch { if (!alive() || token !== attempt) return false }
      if (defaulted && !known) { wholeWeek = false; selected.splice(0, selected.length, ...shoppingWindow(today).slice(1, 4)); dates = [...selected] }
      defaulted = false
      outside = gone
      if (gone.length) {
        const kept = selected.filter(d => !gone.includes(d))
        if (!kept.length) {
          // Standardvalget kan ligge helt efter ugens slut: vælg så de dage, der er tilbage i ugen.
          const rest = shoppingWindow(today).filter(d => !gone.includes(d))
          if (rest.length) { dates = rest; return api.load() }
          reset('no-plan'); return false
        }
        selected.splice(0, selected.length, ...kept)
        dates = [...selected]
      }
      const evidence = [], affected = []
      // At most seven dates, serial reads. Never fan out child work or transport.
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
          evidence.push(scaleShoppingVersion(version, confirmed, athleteId, date))
        } catch (error) {
          if (!alive() || token !== attempt) return false
          affected.push({ date, reason: error?.code !== 'KOSTPLAN_UNAVAILABLE' ? reasons.error
            : error.table === 'kostplan_v1_plans' ? reasons.empty : reasons.unavailable })
        }
      }
      if (!alive() || token !== attempt) return false
      // 2373: standardvalget og "Hele ugen" starter i dag. Har i dag ingen plan endnu (ugen starter i morgen), falder i dag af;
      // en manglende plan på en senere dag gør stadig listen ufuldstændig.
      if (wholeWeek && evidence.length) {
        const before = affected.filter(a => a.reason === reasons.empty && a.date === today).map(a => a.date)
        if (before.length) {
          affected.splice(0, affected.length, ...affected.filter(a => !before.includes(a.date)))
          selected.splice(0, selected.length, ...selected.filter(d => !before.includes(d)))
          dates = [...selected]
        }
      }
      // No plan on any selected day (also before the migration) is an honest
      // empty state. A partial schema and read errors stay incomplete.
      if (affected.length && !evidence.length && affected.every(a => a.reason === reasons.empty)) {
        reset('no-plan'); return false
      }
      if (affected.length) { reset('incomplete', affected); return false }
      try {
        const result = sumApprovedShopping(today, selected, evidence)
        // A refresh with identical evidence retains session-only marks even if
        // storage failed. Nothing is restored or exposed before approval checks.
        const markerOptions = { athleteId, today, result, evidence, storage: options.storage }
        if (!markers || markers.scope !== purchaseScope(markerOptions)) markers = openPurchaseMarkers(markerOptions)
        publish({ phase: 'ready', dates, outside, complete: true, result, affected: [], copyStatus: '', copyText: '', compactCopyStatus: '', compactCopyText: '', purchases: markers.snapshot() }); return true
      } catch {
        reset('incomplete', selected.map(date => ({ date, reason: reasons.error }))); return false
      }
    },
    markBought(index, checked, expectedEvidence = state.result) {
      if (!alive() || !state.complete || expectedEvidence !== state.result || !markers) return false
      if (!markers.set(index, checked)) return false
      publish({ purchases: markers.snapshot() }); return true
    },
    async copy(clipboard, expectedEvidence = state.result) {
      if (!alive() || pendingCopy || state.complete !== true || expectedEvidence !== state.result) return false
      const evidence = state.result, attempt = token, text = formatApprovedShopping(evidence)
      const stillCurrent = () => alive() && token === attempt && state.result === evidence && state.complete
      pendingCopy = true; publish({ copyStatus: 'pending', copyText: '', compactCopyStatus: '', compactCopyText: '' })
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
    async copyCompact(clipboard, expectedEvidence = state.result) {
      if (!alive() || pendingCopy || state.complete !== true || expectedEvidence !== state.result) return false
      const evidence = state.result, attempt = token
      let text
      try { text = formatCompactShopping(evidence) } catch { return false }
      const stillCurrent = () => alive() && token === attempt && state.result === evidence && state.complete
      pendingCopy = true
      publish({ compactCopyStatus: 'pending', compactCopyText: '', copyStatus: '', copyText: '' })
      try {
        // Resolve and invoke only within this explicit action. A getter or
        // subscriber may revoke the scope synchronously, so recheck before I/O.
        const adapter = clipboard === undefined ? globalThis.navigator?.clipboard : clipboard
        const write = adapter?.writeText
        if (typeof write !== 'function' || !stillCurrent()) throw Error('Clipboard unavailable')
        const response = await write.call(adapter, text)
        if (!stillCurrent()) return false
        // Clipboard.writeText resolves void. Explicit non-void/unknown outcomes
        // from an injected boundary cannot truthfully confirm that contract.
        if (response !== undefined) throw Error('Clipboard result unknown')
        publish({ compactCopyStatus: 'copied', compactCopyText: '' }); return true
      } catch {
        if (stillCurrent()) publish({ compactCopyStatus: 'failed', compactCopyText: text })
        return false
      } finally { pendingCopy = false; if (alive()) publish({ copyPending: false }) }
    },
    dispose() { disposed = true; token++; listeners.clear() },
  }
  return Object.freeze(api)
}
