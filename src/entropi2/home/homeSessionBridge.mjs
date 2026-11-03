import { mountSession } from '../session/sessionView.mjs'
import { homeModel } from './homeModel.mjs'

const stamp = p => JSON.stringify([p.athlete?.id, p.allWeeks, p.currentWeek])
// The reviewed controller has no select(sessionId) API. Its read-only week
// projection contains the exact selected source session; IDs and prescriptions
// are untouched. The original program and parent log callback remain owned by caller.
export function mountHomeSession(root, latest) {
  let selection = null, dead = false
  function sessionProps() {
    const p = latest()
    const today = homeModel({ ...p, now: p.getNow ? p.getNow() : p.now ?? new Date() }).today
    // Every controller entry, including retained reopen/form events, rechecks
    // the calendar. Once expired, a choice requires a fresh Home start.
    if (selection && selection.today !== today) selection = null
    const week = p.allWeeks?.find(w => w.id === selection?.weekId)
    const session = week?.sessions.find(s => s.id === selection?.sessionId)
    // Runde 12: the dialog, the log basis and the parent's onLogSet must belong to the same
    // week. The parent's callback reads logs for p.currentWeek, so another week is never opened.
    const valid = !dead && p.enabled === true && !p.onHoliday && !p.programError &&
      p.offlineSnapshotAt == null && session && selection.stamp === stamp(p) &&
      week?.id === p.currentWeek?.id
    const scoped = valid ? { ...week, sessions: [session] } : null
    return { ...p, enabled: !!valid, athleteId: p.athlete?.id,
      allWeeks: valid ? p.allWeeks.map(w => w === week ? scoped : w) : [], currentWeek: scoped }
  }
  const view = mountSession(root, sessionProps)
  return {
    start(sessionId, weekId) {
      if (dead || view.controller.state().open) return false
      const p = latest(), model = homeModel({ ...p, now: p.getNow ? p.getNow() : p.now ?? new Date() })
      if (p.enabled !== true || !p.athlete?.id || typeof p.onLogSet !== 'function' ||
          typeof p.setLogInputs !== 'function' || typeof p.parsePlannedRpe !== 'function' ||
          model.target?.week.id !== weekId || model.target?.session.id !== sessionId ||
          weekId !== p.currentWeek?.id) return false
      selection = { weekId, sessionId, today: model.today, stamp: stamp(p) }
      view.update()
      return view.controller.start()
    },
    update() { view.update() },
    dispose() { dead = true; selection = null; view.dispose() },
  }
}
