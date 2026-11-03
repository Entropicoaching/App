// Local display only. Confirmed session rows are observed; logging is never called.
export function createRestTimer(doc, clock = globalThis) {
  const el = (tag, text, attrs = {}) => {
    const n = doc.createElement(tag)
    if (text != null) n.textContent = text
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
    return n
  }
  const node = el('section', null, { class: 'e2-rest', 'aria-label': 'Hvile mellem sæt' })
  const style = el('style', `
.e2-session .e2-rest {min-width:0;max-width:100%;overflow-wrap:anywhere;margin:20px 0}
.e2-session .e2-rest-options {display:flex;flex-wrap:wrap;gap:8px}
.e2-session .e2-rest button {min-height:44px;min-width:44px}
.e2-session .e2-rest button[aria-pressed="true"] {border-color:#c8923a}
@media (prefers-reduced-motion:reduce) {
  .e2-session .e2-rest,.e2-session .e2-rest * {animation:none;transition:none}
}`)
  const elapsed = el('p', '', { role: 'timer', 'aria-live': 'off' })
  const status = el('p', '', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' })
  const options = el('div', null, { class: 'e2-rest-options', role: 'group', 'aria-label': 'Valgfri hviletid' })
  let identity = null, seen = new Set(), observedAt = 0, startedAt = null, duration = 0, interval = null
  const buttons = [0, 60, 90, 120, 180].map(seconds => {
    const b = el('button', seconds ? `${seconds} s` : 'Kun tid', { type: 'button', 'aria-pressed': String(seconds === 0) })
    b.addEventListener('click', () => {
      duration = seconds
      for (const [i, button] of buttons.entries()) button.setAttribute('aria-pressed', String([0, 60, 90, 120, 180][i] === duration))
      tick()
    })
    options.append(b); return b
  })
  node.append(style, el('p', 'Hvile mellem sæt'), elapsed, options, status)
  function stop() { if (interval != null) clock.clearInterval(interval); interval = null }
  function tick() {
    if (startedAt == null) return
    const seconds = Math.max(0, Math.floor((clock.Date.now() - startedAt) / 1000))
    elapsed.textContent = `Siden sidste sæt: ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    const message = !duration ? '' : seconds >= duration ? 'Hviletiden er gået. Fortsæt, når du er klar.' : `Valgt hviletid: ${duration} sekunder.`
    if (status.textContent !== message) status.textContent = message
  }
  return { node,
    update(s, p) {
      const nextIdentity = s.session ? JSON.stringify([s.selection.stamp, s.session.id]) : null
      const rows = (s.logs || []).filter(row => !row.skipped && !row._optimistic &&
        !(p.pendingSyncKeys || []).includes(`${row.exercise_id}_${row.set_number}`) &&
        !(p.parkedSets || []).some(x => x.exerciseId === row.exercise_id && x.setNumber === row.set_number) &&
        (s.session?.exercises || []).some(ex => ex.id === row.exercise_id && Number.isInteger(row.set_number) && row.set_number > 0 && row.set_number <= ex.sets))
      const key = row => `${row.exercise_id}_${row.set_number}`
      if (nextIdentity !== identity) {
        stop(); identity = nextIdentity; seen = new Set(rows.map(key)); startedAt = null; observedAt = clock.Date.now()
      } else {
        for (const row of rows) {
          const at = typeof row.logged_at === 'string' ? Date.parse(row.logged_at) : NaN
          if (!seen.has(key(row)) && Number.isFinite(at) && at >= observedAt && at <= clock.Date.now())
            startedAt = Math.max(startedAt ?? at, at)
          seen.add(key(row))
        }
      }
      node.hidden = !s.open || s.summary || startedAt == null
      for (const b of buttons) b.disabled = node.hidden
      if (node.hidden) stop()
      else { tick(); if (interval == null) interval = clock.setInterval(tick, 1000) }
    },
    dispose() { stop(); node.remove() },
  }
}
