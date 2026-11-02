import { mobilityModel } from './mobility-model.mjs'

// A real DOM mount with explicit lifecycle; no routing, fetch or write globals.
// Assembly can mount this from its React effect and return the disposer.
export function mountMobility(root, options = {}) {
  const model = mobilityModel(options)
  if (!model) return () => {}
  const doc = root.ownerDocument
  const clock = options.clock || { now: () => Date.now(), setInterval, clearInterval }
  let interval = null, disposed = false, generation = 0
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
    node.style.minHeight = '48px'; node.style.whiteSpace = 'normal'
    const guarded = () => { if (!disposed) handler() }
    node.addEventListener('click', guarded); listeners.push([node, guarded]); return node
  }
  const exercise = (ex, parent) => {
    const item = element('article', undefined, parent)
    element('h3', ex.name, item); element('p', ex.label, item); element('p', ex.desc, item)
  }
  const go = () => { dispose(); options.onProgram?.() }
  function home() {
    clear()
    root.style.maxWidth = '640px'; root.style.overflowWrap = 'anywhere'
    element('h1', 'Mobilitet')
    const before = element('section'); before.setAttribute('aria-label', 'Før næste pas')
    element('h2', model.routine.length ? `Forbered din ${model.lift.toLowerCase()}` : 'Ingen kort rutine klar', before)
    if (model.routine.length) {
      element('p', `${model.minutes} · anslået tid. Følg øvelsernes dosering.`, before)
      element('p', model.selected.date || 'Dag ikke fastlagt', before)
      model.routine.forEach(ex => exercise(ex, before))
      action('Start mobilitet', () => run(0), before)
    } else element('p', 'Næste pas eller et kendt hovedløft med sæt mangler, eller passet er allerede påbegyndt.', before)
    if (typeof options.onProgram === 'function') action('Til programmet', go, before)
    const coach = element('section'); element('h2', 'Hjemmeøvelser fra din coach', coach)
    element('p', model.homeworkNotice, coach)
    if (model.assigned.length) {
      element('p', model.homeworkAuthor, coach)
      model.assigned.forEach(ex => exercise(ex, coach))
    } else element('p', 'Ingen lokale hjemmeøvelser gemt.', coach)
    for (const choice of model.choices) {
      element('p', model.coachName ? `Valgt af ${model.coachName}` : 'Coachens navn er ikke tilgængeligt.', coach)
      element('h3', `${choice.lift}: ${choice.need}`, coach)
      choice.exercises.forEach(ex => exercise(ex, coach))
    }
    if (model.error) element('p', model.error, coach).setAttribute('role', 'status')
    const library = element('section'); element('h2', 'Find øvelser efter problematik', library)
    for (const problem of model.problems) {
      const details = element('details', undefined, library)
      element('summary', problem.title, details)
      problem.exercises.forEach(ex => exercise(ex, details))
    }
  }
  function run(step) {
    clear()
    const ex = model.routine[step]
    element('h2', `${step + 1} af ${model.routine.length}`)
    exercise(ex, root)
    const status = element('p', 'Følg doseringen ovenfor.')
    status.setAttribute('role', 'timer')
    // Timed catalog doses run one side at a time; reps have no invented clock.
    let side = 0
    if (ex.type === 'timer' && Number.isFinite(ex.duration) && ex.duration > 0) {
      const sides = ex.label.includes('pr. side') ? 2 : 1
      const startSide = () => {
        clearTimer()
        const token = generation, deadline = clock.now() + ex.duration * 1000
        const tick = () => {
          if (disposed || generation !== token) return
          const remaining = Math.max(0, Math.ceil((deadline - clock.now()) / 1000))
          status.textContent = `Side ${side + 1} af ${sides}: ${remaining} sek`
          if (remaining === 0) {
            clearTimer(); side++
            status.textContent = side < sides ? 'Skift side og start timeren igen.' : 'Doseringen er færdig.'
            timerButton.disabled = side >= sides
          }
        }
        tick(); interval = clock.setInterval(tick, 250)
      }
      const timerButton = action('Start sidetimer', () => { if (interval === null && side < sides) startSide() })
    }
    action(step + 1 < model.routine.length ? 'Næste øvelse' : 'Afslut mobilitet', () => {
      if (step + 1 < model.routine.length) run(step + 1)
      else home()
    })
    action('Spring over', home)
    if (typeof options.onProgram === 'function') action('Til programmet', go)
  }
  function dispose() { if (!disposed) { disposed = true; clear() } }
  home()
  return dispose
}
