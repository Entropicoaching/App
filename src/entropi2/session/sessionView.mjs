import { createSessionController, warmup } from './sessionModel.mjs'
import { bindDialog, watchRest } from './sessionDom.mjs'
import { sessionStyle } from './sessionStyle.mjs'
import { lastSetLine } from './sessionHistory.mjs'

const present = v => v == null || v === '' ? 'Ikke angivet' : String(v)
const messages = { saving: 'Gemmer sættet. Vent på svar.', waiting: 'Afventer bekræftelse. Sættet er endnu ikke bekræftet gemt.',
  queued: 'Gemt lokalt. Afventer synkronisering.', parked: 'Sættet kunne ikke synkroniseres. Kontakt din coach.',
  error: 'Sættet blev ikke gemt. Dine tal er bevaret. Prøv igen.' }

// This is the production DOM renderer, also imported by hermetic DOM tests.
// It owns only nodes under root, no storage, media, global listeners or writes.
export function mountSession(root, latest, { clock = globalThis } = {}) {
  const doc = root.ownerDocument
  let dialog, frame, body, close, handle, unbind, stopTimer, lastPause, stepIdentity, announcement, errorStatus, dead = false
  const el = (tag, text, attrs = {}) => {
    const node = doc.createElement(tag)
    if (text != null) node.textContent = String(text)
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
    return node
  }
  const style = el('style', sessionStyle), trigger = el('button', 'Start dagens pas', { type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' })
  const empty = el('p', '', { role: 'status' })
  root.classList.add('e2-session')
  root.append(style, trigger, empty)
  const controller = createSessionController(latest, render)
  trigger.addEventListener('click', start)
  function start() { controller.start() }
  function tearDown() {
    stopTimer?.(); stopTimer = null; lastPause = undefined
    unbind?.(); unbind = null
    dialog?.remove(); dialog = null; stepIdentity = undefined
  }
  function render() {
    if (dead) return
    const p = latest(), s = controller.state()
    root.hidden = p.enabled !== true
    trigger.disabled = !s.canStart
    trigger.textContent = s.selection ? 'Åbn dagens pas' : 'Start dagens pas'
    trigger.setAttribute('aria-expanded', String(s.open))
    empty.textContent = s.canStart ? '' : p.programError ? 'Programmet kunne ikke hentes.' : p.offlineSnapshotAt != null
      ? 'Programmet skal opdateres, før du kan registrere.' : s.day?.status === 'done' ? 'Ugens pas er klaret.' : 'Intet pas i dag.'
    if (!s.open) { tearDown(); return }
    if (!dialog) {
      dialog = el('dialog', null, { 'aria-label': 'Dagens pas' })
      frame = el('div', null, { class: 'frame' })
      handle = el('div', '━━━', { class: 'handle', 'aria-hidden': 'true' })
      close = el('button', 'Luk pas', { type: 'button' })
      body = el('div')
      announcement = el('p', '', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' })
      errorStatus = el('p', '', { role: 'alert', 'aria-atomic': 'true' })
      frame.append(handle, close, announcement, body, errorStatus); dialog.append(frame); root.append(dialog)
      unbind = bindDialog({ dialog, handle, close, trigger, document: doc, dismiss: () => controller.close() })
    }
    const nextStep = JSON.stringify([s.selection.stamp, s.key]), stepChanged = nextStep !== stepIdentity
    stepIdentity = nextStep
    announcement.textContent = [`${s.done} af ${s.total} sæt bekræftet`, messages[s.phase]].filter(Boolean).join('. ')
    errorStatus.textContent = s.error
    const focused = doc.activeElement, fieldName = focused?.getAttribute('data-field')
    const position = fieldName ? [focused.selectionStart, focused.selectionEnd] : null
    const detailsOpen = [...body.querySelectorAll('details')].filter(n => n.open).map(n => n.getAttribute('data-detail'))
    const hadBodyFocus = body.contains(focused)
    const detailFocus = focused?.tagName?.toLowerCase() === 'summary' ? focused.parentElement?.getAttribute('data-detail') : null
    const approveFocus = focused?.getAttribute('class') === 'approve'
    body.replaceChildren()
    body.append(el('h1', s.next?.exercise.name || s.session.title || 'Dagens pas', { tabindex: '-1', 'data-heading': '' }))
    const timer = el('p', '', { role: 'timer', 'aria-label': 'Pause mellem sæt', 'aria-live': 'off' })
    body.append(timer)
    // A rerender transfers the display subscriber and disposes the previous interval.
    stopTimer?.(); lastPause = p.restPause
    stopTimer = watchRest(lastPause, n => { timer.textContent = `Pause: ${n} sekunder` }, clock)
    if (s.next) {
      const n = s.next, ex = n.exercise, key = s.key
      body.append(el('p', `Sæt ${n.setNumber} af ${n.totalSets}`, { class: 'muted' }))
      const plan = el('section', null, { class: 'card', 'aria-label': 'Planlagt belastning' })
      plan.append(el('p', `${present(ex.reps)} gentagelser`, { class: 'plan' }),
        el('p', `${present(ex.recommended_weight)} kg`, { class: 'plan' }), el('p', `Intensitet: ${present(ex.intensity)}`))
      body.append(plan)
      const previous = lastSetLine(p, ex.id, clock.Date.now())
      if (previous) body.append(el('p', previous, { class: 'muted', 'data-last-set': ex.id }))
      if (ex.note) body.append(el('p', `Coachens fokus: ${ex.note}`))
      const details = el('details', null, { class: 'card', 'data-detail': 'warmup' })
      details.append(el('summary', 'Opvarmning og teknik'))
      const steps = warmup(n, s.input)
      details.append(el('p', steps.length ? 'Beregnet opvarmning frem mod din indtastede arbejdsvægt.' : 'Ingen beregnet opvarmning ved denne vægt. Aftal eventuelt opvarmning med din coach.'))
      const list = el('ol')
      for (const step of steps) list.append(el('li', `${step.weight} kg × ${step.reps} reps`))
      details.append(list); body.append(details)
      const form = el('form', null, { class: 'card', 'aria-label': 'Registrer sæt' }), fields = el('div', null, { class: 'fields' }), inputs = {}
      const busy = !['idle', 'error'].includes(s.phase)
      for (const [name, label, mode] of [['weight', 'Vægt i kg', 'decimal'], ['reps', 'Gentagelser', 'numeric'], ['rpe', 'Oplevet RPE (valgfri)', 'decimal']]) {
        const lab = el('label', label), input = el('input', null, { type: 'text', inputmode: mode, 'data-field': name })
        input.value = String(s.input[name]); input.disabled = busy
        input.addEventListener('input', () => controller.edit(key, name, input.value, s.selection.stamp))
        lab.append(input); fields.append(lab); inputs[name] = input
      }
      form.append(el('h2', 'Dit sæt'), fields, el('p', 'Skriv 0 kg ved en øvelse uden ekstra vægt. RPE er fra 0 til 10.'))
      const approve = el('button', busy ? 'Afventer svar' : 'Godkendt', { type: 'submit', class: 'approve' })
      approve.disabled = busy
      form.addEventListener('submit', e => {
        e.preventDefault()
        return controller.approve(key, { ...s.input, ...Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, v.value])) }, s.selection.stamp)
      })
      form.append(approve)
      body.append(form)
    } else body.append(el('h2', 'Passet er færdigt. Alle sæt er bekræftet.'))
    const history = el('details', null, { class: 'card', 'data-detail': 'history' })
    history.append(el('summary', 'Hele passet og klarede sæt'))
    for (const ex of s.session.exercises || []) {
      history.append(el('h2', ex.name), el('p', `${ex.sets} × ${present(ex.reps)}`))
      const previous = lastSetLine(p, ex.id, clock.Date.now())
      if (previous) history.append(el('p', previous, { class: 'muted', 'data-last-set': ex.id }))
      for (const log of s.logs.filter(l => l.exercise_id === ex.id).slice().sort((a, b) => a.set_number - b.set_number))
        history.append(el('p', `Sæt ${log.set_number}: ${log.skipped ? 'Sprunget over' : `${present(log.weight)} kg, ${present(log.reps_completed)} reps, RPE ${present(log.rpe_actual)}`}`))
    }
    body.append(history)
    for (const node of body.querySelectorAll('details')) node.open = detailsOpen.includes(node.getAttribute('data-detail'))
    const replacement = fieldName ? body.querySelector(`[data-field="${fieldName}"]`) : null
    if (stepChanged) body.querySelector('[data-heading]')?.focus()
    else if (replacement && !replacement.disabled) {
      replacement.focus(); if (position[0] != null) replacement.setSelectionRange(...position)
    } else if (detailFocus) body.querySelector(`[data-detail="${detailFocus}"] summary`)?.focus()
    else if (approveFocus && !body.querySelector('.approve')?.disabled) body.querySelector('.approve')?.focus()
    else if (hadBodyFocus) body.querySelector('[data-heading]')?.focus()
  }
  render()
  return { update: () => controller.refresh(), controller,
    dispose() { dead = true; tearDown(); trigger.removeEventListener('click', start); root.replaceChildren(); root.classList.remove('e2-session') } }
}
