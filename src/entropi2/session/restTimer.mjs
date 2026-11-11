import { mainLiftName } from '../../exerciseSetView.js'
import { sessionPrescription } from './sessionPrescription.mjs'
import { parsePlannedRest } from './tempo/tempoParser.mjs'

// Local display only: observe confirmed rows, never call logging or storage.
export function createRestTimer(doc, clock = globalThis) {
  const el = (tag, text, attrs = {}) => {
    const n = doc.createElement(tag)
    if (text != null) n.textContent = text
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
    return n
  }
  const node = el('section', null, { class: 'e2-rest', 'aria-label': 'Pause mellem sæt' })
  const style = el('style', `
.e2-session .e2-rest {min-width:0;max-width:100%;overflow-wrap:anywhere;margin:12px 0;padding:16px;box-sizing:border-box;border:1px solid #c8923a;border-radius:16px;background:#1c1c18;text-align:center}
.e2-session .e2-rest[hidden] {display:none}
.e2-session .e2-rest p {margin:4px 0}
.e2-session .e2-rest [role="timer"] {font-size:40px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.2}
.e2-session .e2-rest-controls {display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
.e2-session .e2-rest button {min-height:48px;min-width:88px}
.e2-session [data-announce][data-summary="1"] {position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce) {
  .e2-session .e2-rest,.e2-session .e2-rest * {animation:none;transition:none}
}`)
  const timer = el('p', '', { role: 'timer', 'aria-label': 'Pause tilbage', 'aria-live': 'off' })
  const source = el('p', '')
  const status = el('p', '', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' })
  const controls = el('div', null, { class: 'e2-rest-controls', role: 'group', 'aria-label': 'Styr pause-uret' })
  let identity = null, seen = new Set(), observedAt = 0, startedAt = null, interval = null
  let duration = 0, deadline = 0, paused = null, signalled = false, dead = false
  const left = () => paused ?? Math.max(0, deadline - clock.Date.now())
  const active = () => !dead && !node.hidden && startedAt != null
  const action = (label, run) => {
    const b = el('button', label, { type: 'button' })
    b.addEventListener('click', () => { if (active()) { run(); refresh() } })
    controls.append(b); return b
  }
  const pause = action('Pause', () => {
    if (paused == null) paused = left()
    else { deadline = clock.Date.now() + paused; paused = null }
  })
  const reset = action('Nulstil', () => {
    deadline = clock.Date.now() + duration * 1000; paused = null; signalled = false
  })
  const extend = action('+30 s', () => {
    if (paused != null) paused += 30000
    else deadline = clock.Date.now() + left() + 30000
    signalled = false
  })
  node.append(style, el('p', 'Pause mellem sæt'), timer, source, controls, status)
  node.hidden = true
  function stop() { if (interval != null) clock.clearInterval(interval); interval = null }
  function refresh() {
    stop()
    if (!active()) return
    tick()
    if (paused == null && left() > 0) interval = clock.setInterval(tick, 250)
  }
  function tick() {
    if (!active()) { stop(); return }
    const seconds = Math.ceil(left() / 1000)
    timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    pause.textContent = paused == null ? 'Pause' : 'Fortsæt'
    pause.disabled = seconds === 0
    const message = seconds === 0 ? 'Pausen er slut. Fortsæt, når du er klar.'
      : paused != null ? 'Pause-uret er sat på pause.' : ''
    if (status.textContent !== message) status.textContent = message
    if (!seconds) {
      stop()
      if (!signalled) {
        signalled = true
        // Unsupported or denied vibration must never interrupt the session.
        try { clock.navigator?.vibrate?.(150) } catch { /* Visual status remains. */ }
      }
    }
  }
  function begin(row, at, exercises) {
    const exercise = exercises.find(ex => ex.id === row.exercise_id)
    const rest = parsePlannedRest(sessionPrescription(exercise).restSeconds)
    duration = rest.status === 'valid' ? rest.seconds : mainLiftName(exercise.name) ? 120 : 90
    source.textContent = `Efter ${exercise.name || 'sættet'}. ` + (rest.status === 'valid' ? 'Programmets pause.'
      : rest.status === 'invalid' ? 'Programmets pause kan ikke læses. Bruger standardpause.' : 'Standardpause.')
    startedAt = at; deadline = at + duration * 1000; paused = null; signalled = false
  }
  return { node,
    update(s, p) {
      if (dead) return
      const nextIdentity = s.session ? JSON.stringify([s.selection.stamp, s.session.id]) : null
      const exercises = s.session?.exercises || []
      // U11: et sæt i offline-køen er gemt på telefonen og sendes senere, så pausen starter også der.
      // Et optimistisk sæt uden for køen venter stadig på serveren; et parkeret sæt starter aldrig.
      const queued = row => (p.pendingSyncKeys || []).includes(`${row.exercise_id}_${row.set_number}`)
      const local = s.session ? (p.exerciseLogs || []).filter(row => row && queued(row) &&
        (row.athlete_id == null || row.athlete_id === p.athleteId)) : []
      const rows = [...(s.logs || []), ...local].filter(row => !row.skipped && (!row._optimistic || queued(row)) &&
        !(p.parkedSets || []).some(x => x.exerciseId === row.exercise_id && x.setNumber === row.set_number) &&
        exercises.some(ex => ex.id === row.exercise_id && Number.isInteger(row.set_number) && row.set_number > 0 && row.set_number <= ex.sets))
      const key = row => `${row.exercise_id}_${row.set_number}`
      if (nextIdentity !== identity) {
        stop(); identity = nextIdentity; seen = new Set(rows.map(key)); startedAt = null; observedAt = clock.Date.now()
      } else {
        let newest = null, newestAt = startedAt ?? observedAt
        for (const row of rows) {
          const at = typeof row.logged_at === 'string' ? Date.parse(row.logged_at) : NaN
          if (!seen.has(key(row)) && Number.isFinite(at) && at >= observedAt && at <= clock.Date.now() && at >= newestAt) {
            newest = row; newestAt = at
          }
          seen.add(key(row))
        }
        if (newest) begin(newest, newestAt, exercises)
      }
      node.hidden = !s.open || s.summary || startedAt == null
      for (const b of [pause, reset, extend]) b.disabled = node.hidden
      refresh()
    },
    dispose() { dead = true; stop(); node.remove() },
  }
}
