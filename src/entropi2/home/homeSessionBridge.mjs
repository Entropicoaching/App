import { homeModel } from './homeModel.mjs'

const stamp = p => JSON.stringify([p.athlete?.id, p.allWeeks, p.currentWeek])
// The reviewed controller has no select(sessionId) API. Its read-only week
// projection contains the exact selected source session; IDs and prescriptions
// are untouched. The original program and parent log callback remain owned by caller.
export function mountHomeSession(root, latest, {
  loadSession = () => import('../session/sessionView.mjs'), onLoadingChange = () => {},
} = {}) {
  let selection = null, dead = false, view = null, pending = null, notice = null
  function choice(sessionId, weekId) {
    const p = latest(), model = homeModel({ ...p, now: p.getNow ? p.getNow() : p.now ?? new Date() })
    if (dead || p.enabled !== true || !p.athlete?.id || typeof p.onLogSet !== 'function' ||
        typeof p.setLogInputs !== 'function' || typeof p.parsePlannedRpe !== 'function' ||
        model.target?.week.id !== weekId || model.target?.session.id !== sessionId ||
        weekId !== p.currentWeek?.id || (model.target.week.athlete_id != null &&
        model.target.week.athlete_id !== p.athlete.id)) return null
    return { weekId, sessionId, today: model.today, stamp: stamp(p) }
  }
  const current = chosen => {
    const fresh = choice(chosen.sessionId, chosen.weekId)
    return fresh && fresh.today === chosen.today && fresh.stamp === chosen.stamp
  }
  function clearNotice() { notice?.remove(); notice = null }
  function stopLoading() {
    pending = null
    root.setAttribute('aria-busy', 'false')
    clearNotice()
    onLoadingChange(false)
  }
  function showNotice(text, action, run, role = 'status') {
    clearNotice()
    const doc = root.ownerDocument
    notice = doc.createElement('div')
    const message = doc.createElement('p'), button = doc.createElement('button')
    message.setAttribute('role', role); message.textContent = text
    button.setAttribute('type', 'button'); button.setAttribute('style', 'min-height:44px')
    button.textContent = action; button.addEventListener('click', run)
    notice.append(message, button); root.append(notice)
    return notice
  }
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
  const bridge = {
    start(sessionId, weekId) {
      if (dead || pending || view?.controller.state().open) return false
      const chosen = choice(sessionId, weekId)
      if (!chosen) return false
      selection = chosen
      clearNotice()
      if (view) { view.update(); return view.controller.start() }
      // Set the token before invoking the importer: even synchronous repeated
      // clicks cannot load twice. Every completion revalidates the original choice.
      const token = {}; pending = token
      root.setAttribute('aria-busy', 'true')
      showNotice('Indlæser passet…', 'Annuller', () => {
        if (pending === token) { selection = null; stopLoading() }
      })
      onLoadingChange(true)
      return Promise.resolve().then(() => loadSession()).then(module => {
        if (pending !== token || !current(chosen)) {
          if (pending === token) { selection = null; stopLoading() }
          return false
        }
        clearNotice()
        view = module.mountSession(root, sessionProps)
        const started = view.controller.start()
        stopLoading()
        return started
      }).catch(() => {
        if (pending !== token) return false
        const valid = current(chosen)
        view?.dispose(); view = null
        stopLoading()
        if (valid) {
          const errorNotice = showNotice('Passet kunne ikke indlæses. Prøv igen.', 'Prøv igen', () => {
            if (notice === errorNotice && !dead && !pending && current(chosen)) return bridge.start(sessionId, weekId)
          }, 'alert')
        }
        return false
      })
    },
    update() {
      if (selection && !view && !current(selection)) { selection = null; stopLoading() }
      view?.update()
    },
    dispose() { dead = true; selection = null; stopLoading(); view?.dispose(); view = null },
  }
  return bridge
}
