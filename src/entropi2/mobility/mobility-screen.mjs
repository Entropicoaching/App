import { mobilityModel } from './mobility-model.mjs'
import { markMobilityDone, mobilityDoneWeek } from './mobilityDone.mjs'

// Marc 3. nov.: dansk dato som paa Hjem, aldrig ISO-dato paa skaermen.
const MONTHS = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
const danishDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); return m ? `${Number(m[3])}. ${MONTHS[Number(m[2]) - 1]}` : String(iso) }

// A real DOM mount with explicit lifecycle; no routing, fetch or write globals.
// Assembly can mount this from its React effect and return the disposer.
export function mountMobility(root, options = {}) {
  let model = mobilityModel(options)
  if (!model) return () => {}
  const doc = root.ownerDocument
  root.setAttribute('data-e2-mobility', '')
  const styles = `[data-e2-mobility] :focus-visible {outline:3px solid #d8b16b;outline-offset:3px}
[data-e2-mobility] summary {min-height:44px;min-width:44px;box-sizing:border-box;padding:10px 0;cursor:pointer}
[data-e2-mobility] button {min-width:44px}
[data-e2-mobility] button:disabled {opacity:1}
[data-e2-mobility] section {margin-top:28px}
[data-e2-mobility] section[hidden] {display:none}`
  const clock = options.clock || { now: () => Date.now(), setInterval, clearInterval }
  let interval = null, disposed = false, generation = 0
  const historyOptions = { enabled: true, athleteId: model.athleteId, storage: options.storage }
  const currentDay = () => {
    if (typeof options.isCurrentDay !== 'function' || options.isCurrentDay() === true) return true
    options.onStaleDay?.()
    return false
  }
  const listeners = []
  const clearTimer = () => { generation++; if (interval !== null) clock.clearInterval(interval); interval = null }
  const clear = () => {
    clearTimer()
    for (const [node, handler] of listeners.splice(0)) node.removeEventListener('click', handler)
    root.replaceChildren()
  }
  const element = (tag, text, parent = root) => {
    const node = doc.createElement(tag)
    if (text !== undefined) node.textContent = text
    parent.appendChild(node)
    return node
  }
  const action = (label, handler, parent = root) => {
    const node = element('button', label, parent); node.type = 'button'
    Object.assign(node.style, { minHeight: '48px', maxWidth: '100%', boxSizing: 'border-box',
      whiteSpace: 'normal', border: '1px solid #59564c', borderRadius: '10px',
      padding: '12px 16px', background: '#1c1c18', color: '#edeae2', font: 'inherit' })
    const guarded = () => { if (!disposed) handler() }
    node.addEventListener('click', guarded); listeners.push([node, guarded]); return node
  }
  const exercise = (ex, parent) => {
    const item = element('article', undefined, parent)
    element('h3', ex.name, item); element('p', ex.label, item); element('p', ex.desc, item)
  }
  const go = () => { dispose(); options.onProgram?.() }
  function reload(section) {
    if (options.enabled !== true || options.athlete?.id !== historyOptions.athleteId || !currentDay()) return
    // Read the original local sources again; never repair or write on retry.
    const refreshed = mobilityModel(options)
    if (!refreshed) return
    model = refreshed
    home(false, section)
  }
  function home(focusHeading = true, retrySection = null) {
    clear()
    element('style', styles)
    Object.assign(root.style, { maxWidth: '640px', overflowWrap: 'anywhere', boxSizing: 'border-box',
      background: '#141410', color: '#edeae2', colorScheme: 'dark', padding: '20px',
      fontFamily: "'IBM Plex Sans', Arial, sans-serif", lineHeight: '1.5', textAlign: 'left' })
    const heading = element('h1', 'Mobilitet')
    heading.setAttribute('tabindex', '-1')
    if (focusHeading) heading.focus?.()
    // A count and seven day marks; no invented weekly goal. Reads never write.
    const week = mobilityDoneWeek({ ...historyOptions, screenDate: model.screenDate, weeklyTarget: 0 })
    const done = week.days.some(day => day.day === model.screenDate && day.routineIds.includes(model.routineId))
    if (model.routine.length) {
      const before = element('section'); before.setAttribute('aria-label', 'Før næste pas')
      element('h2', `Forbered din ${model.lift.toLowerCase()}`, before)
      const reason = model.selected.date && model.selected.date !== model.screenDate
        ? model.recommendation.reason.replace(/^Dagens /, 'Næste pas med ') : model.recommendation.reason
      element('p', reason, before)
      element('p', `${model.routine.length} øvelser · Følg øvelsernes dosering.`, before)
      if (model.selected.date) element('p', danishDate(model.selected.date), before)
      if (done) element('p', 'Rutine gennemført i dag · Gemt på denne enhed.', before).setAttribute('role', 'status')
      model.routine.forEach(ex => exercise(ex, before))
      // Entropi 2: et pas fra en tidligere dag startes aldrig; adapteren beregner dagen igen.
      const start = () => {
        if (!currentDay()) return
        run(0)
      }
      Object.assign(action('Start mobilitet', start, before).style, { background: '#d8b16b', color: '#141410' })
      if (typeof options.onProgram === 'function') action('Til programmet', go, before)
    } else if (typeof options.onProgram === 'function') action('Til programmet', go)
    const overview = element('section'); overview.setAttribute('aria-label', 'Mobilitet denne uge')
    const weekHeading = element('h2', 'Denne uge', overview)
    weekHeading.setAttribute('tabindex', '-1')
    if (retrySection === 'week') weekHeading.focus?.()
    if (week.error) {
      element('p', 'Ugeoversigten kunne ikke læses på denne enhed.', overview).setAttribute('role', 'alert')
      if (week.error !== 'invalid-input') action('Hent igen', () => reload('week'), overview)
    } else {
      element('p', `${week.completed} ${week.completed === 1 ? 'rutine' : 'rutiner'} gennemført på denne enhed`, overview).setAttribute('role', 'status')
      const days = element('ul', undefined, overview)
      Object.assign(days.style, { display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0', listStyle: 'none' })
      const labels = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
      week.days.forEach((day, i) => {
        const item = element('li', `${labels[i]} ${day.done ? '✓' : '–'}`, days)
        item.setAttribute('aria-label', `${labels[i]} ${danishDate(day.day)}: ${day.count} ${day.count === 1 ? 'rutine' : 'rutiner'} gennemført på denne enhed`)
      })
    }
    // Marc 3. nov. (keep it simple): hjemmeoevelser vises kun, naar der er nogen; ingen teknisk lagringstekst.
    const coach = element('section'); coach.hidden = !(model.assigned.length || model.choices.length || model.error)
    const coachHeading = element('h2', 'Hjemmeøvelser fra din coach', coach)
    coachHeading.setAttribute('tabindex', '-1')
    if (retrySection === 'coach') (coach.hidden ? weekHeading : coachHeading).focus?.()
    if (model.assigned.length) {
      model.assigned.forEach(ex => exercise(ex, coach))
      element('p', 'Gemt på denne enhed.', coach)
    }
    for (const choice of model.choices) {
      if (model.coachName) element('p', `Valgt af ${model.coachName}`, coach)
      element('h3', `${choice.lift}: ${choice.need}`, coach)
      choice.exercises.forEach(ex => exercise(ex, coach))
    }
    if (model.error) {
      element('p', model.error, coach).setAttribute('role', 'alert')
      action('Hent igen', () => reload('coach'), coach)
    }
    const library = element('section'); element('h2', 'Find øvelser efter problematik', library)
    for (const problem of model.problems) {
      const details = element('details', undefined, library)
      element('summary', problem.title, details)
      problem.exercises.forEach(ex => exercise(ex, details))
    }
  }
  function run(step) {
    clear()
    element('style', styles)
    const ex = model.routine[step]
    const heading = element('h2', `${step + 1} af ${model.routine.length}: ${ex.name}`)
    heading.setAttribute('tabindex', '-1')
    heading.focus?.()
    exercise(ex, root)
    const status = element('p', 'Følg doseringen ovenfor.')
    status.setAttribute('role', 'timer')
    status.setAttribute('aria-label', 'Doseringstimer')
    status.setAttribute('aria-live', 'off')
    const announcement = element('p', '')
    announcement.setAttribute('role', 'status')
    announcement.setAttribute('aria-live', 'polite')
    announcement.setAttribute('aria-atomic', 'true')
    // Timed catalog doses run one side at a time; reps have no invented clock.
    let side = 0
    if (ex.type === 'timer' && Number.isFinite(ex.duration) && ex.duration > 0) {
      const sides = ex.label.includes('pr. side') ? 2 : 1
      const startSide = () => {
        clearTimer()
        announcement.textContent = `Timer startet for side ${side + 1} af ${sides}.`
        const token = generation, deadline = clock.now() + ex.duration * 1000
        const tick = () => {
          if (disposed || generation !== token) return
          const remaining = Math.max(0, Math.ceil((deadline - clock.now()) / 1000))
          status.textContent = `Side ${side + 1} af ${sides}: ${remaining} sek`
          if (remaining === 0) {
            clearTimer(); side++
            status.textContent = side < sides ? 'Skift side og start timeren igen.' : 'Doseringen er færdig.'
            announcement.textContent = status.textContent
            timerButton.disabled = side >= sides
          }
        }
        tick(); interval = clock.setInterval(tick, 250)
      }
      const timerButton = action('Start sidetimer', () => { if (interval === null && side < sides) startSide() })
    }
    Object.assign(action(step + 1 < model.routine.length ? 'Næste øvelse' : 'Afslut mobilitet', () => {
      if (step + 1 < model.routine.length) run(step + 1)
      else {
        // A stale open routine must not record yesterday's completion.
        if (!currentDay()) {
          announcement.textContent = 'Dagen er skiftet. Åbn mobilitet igen før du registrerer rutinen.'
          return
        }
        const result = markMobilityDone({ ...historyOptions, routineId: model.routineId, day: model.screenDate })
        if (result.saved) home()
        else announcement.textContent = 'Rutinen kunne ikke gemmes på denne enhed. Tryk Afslut mobilitet for at prøve igen.'
      }
    }).style, { background: '#d8b16b', color: '#141410' })
    action('Spring over', home)
    if (typeof options.onProgram === 'function') action('Til programmet', go)
  }
  function dispose() { if (!disposed) { disposed = true; clear() } }
  home(false)
  return dispose
}
