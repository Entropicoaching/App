import { antalOrd } from '../antalOrd.mjs'
import { nextSetInSession } from '../../nextSet.js'
import { createMobilityPlan } from '../mobility/plan/mobilityPlanDom.mjs'
import { mobilityPlan } from '../mobility/plan/mobility-plan.mjs'
import { createSessionController } from './sessionModel.mjs'
import { bindDialog, watchRest } from './sessionDom.mjs'
import { sessionStyle } from './sessionStyle.mjs'
import { lastSetLine } from './sessionHistory.mjs'
import { sessionSummary } from './sessionSummary.mjs'
import { sessionComparisons } from './sessionComparison.mjs'
import { sessionComparisonContent } from './sessionComparisonContent.mjs'
import { stepWeight, stepReps } from '../../setLogDefaults.js'
import { createRestTimer } from './restTimer.mjs'
import { mountPlateCalculator } from './plader/plateView.mjs'
import { createOpvarmning } from './opvarmning/OpvarmningView.mjs'
import { mountTempoView } from './tempo/tempoView.mjs'
import { createSetNote } from './noter/noteDom.mjs'
import { sessionPrescription } from './sessionPrescription.mjs'
import { parseInputNumber } from '../../inputValues.js'
import { sessionGroupsForDisplay } from './supersaet/supersetModel.mjs'
import { mountSupersetView } from './supersaet/supersetView.mjs'
import { mountExerciseHistory, closeExerciseHistory, sessionHistoryProps, historyElement } from './historik/exerciseHistoryDom.mjs'
import { sessionRecordReceipt } from './sessionRecordReceipt.mjs'

const present = v => v == null || v === '' ? 'Ikke angivet' : String(v)
const given = v => v != null && String(v).trim() !== ''
const messages = { saving: 'Gemmer sættet. Vent på svar.', waiting: 'Afventer bekræftelse. Sættet er endnu ikke bekræftet gemt.',
  queued: 'Venter på net. Sættet ligger lokalt og er endnu ikke bekræftet gemt.', parked: 'Sættet kunne ikke synkroniseres. Kontakt din coach.',
  error: 'Sættet blev ikke gemt. Dine tal er bevaret. Prøv igen.' }

// This is the production DOM renderer, also imported by hermetic DOM tests.
// It owns only nodes under root, no storage, media, global listeners or writes.
export function mountSession(root, latest, { clock = globalThis } = {}) {
  const doc = root.ownerDocument
  const rest = createRestTimer(doc, clock)
  let cleanBlocks = [], plateBar = 20
  const clearBlocks = () => { cleanBlocks.forEach(fn => fn()); cleanBlocks = [] }
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
    clearBlocks()
    stopTimer?.(); stopTimer = null; lastPause = undefined
    unbind?.(); unbind = null
    dialog?.remove(); dialog = null; stepIdentity = undefined
  }
  function render() {
    if (dead) return
    const p = latest(), s = controller.state()
    rest.update(s, p)
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
      announcement = el('p', '', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', 'data-announce': '' })
      errorStatus = el('p', '', { role: 'alert', 'aria-atomic': 'true' })
      frame.append(handle, close, rest.node, announcement, body, errorStatus); dialog.append(frame); root.append(dialog)
      unbind = bindDialog({ dialog, handle, close, trigger, document: doc, dismiss: () => controller.close(),
        dismissLayer: () => closeExerciseHistory(body, doc.activeElement) })
    }
    const nextStep = JSON.stringify([s.selection.stamp, s.key, s.summary]), stepChanged = nextStep !== stepIdentity
    stepIdentity = nextStep
    const summary = s.summary ? sessionSummary(s.session, s.logs, p, clock.Date.now()) : null
    announcement.textContent = summary ? `${summary.done} af ${summary.total} sæt klaret`
      : [`${s.done} af ${s.total} sæt bekræftet`, messages[s.phase]].filter(Boolean).join('. ')
    errorStatus.textContent = s.error
    // Marc 3. nov.: opsummeringskortet viser selv antallet; statuslinjen bliver kun for skaermlaesere.
    announcement.setAttribute('data-summary', summary ? '1' : '0')
    const focused = doc.activeElement, fieldName = focused?.getAttribute('data-field')
    const position = fieldName ? [focused.selectionStart, focused.selectionEnd] : null
    const detailsOpen = [...body.querySelectorAll('details')].filter(n => n.open).map(n => n.getAttribute('data-detail'))
    const hadBodyFocus = body.contains(focused)
    const detailFocus = focused?.tagName?.toLowerCase() === 'summary' ? focused.parentElement?.getAttribute('data-detail') : null
    const approveFocus = focused?.getAttribute('class') === 'approve'
    const stepFocus = focused?.getAttribute('data-step')
    const oldBar = body.querySelector('[data-e2-plader]')?.querySelector('select')
    if (oldBar) plateBar = Number(oldBar.value)
    clearBlocks()
    body.replaceChildren()
    const showHistory = (parent, ex, detail) => {
      const active = () => {
        const current = controller.state()
        return !dead && current.open && current.selection.stamp === s.selection.stamp
      }
      const read = () => sessionHistoryProps(latest(), ex, clock.Date.now())
      // An error/loading snapshot must not advertise stale values as the last set.
      const previous = !p.exerciseLogsError && !p.exerciseLogsLoading ? lastSetLine(p, ex.id, clock.Date.now()) : null
      cleanBlocks.push(mountExerciseHistory(parent, { detail, previous, read, active,
        open: !stepChanged && detailsOpen.includes(detail), aboutOpen: !stepChanged && detailsOpen.includes(`${detail}-about`) }))
    }
    const first = nextSetInSession(s.session, [])
    const dailyWarmup = !summary && s.next?.setNumber === 1 && s.next.exercise.id === first?.exercise.id
    if (dailyWarmup) {
      const warm = el('details', null, { class: 'card', 'data-detail': 'warmup' })
      const mobility = mobilityPlan({ enabled: true, session: s.session })
      warm.append(el('summary', mobility.kind === 'ready' ? 'Opvarmning (5-10 min)' : 'Opvarmningssæt'))
      if (mobility.kind === 'ready') warm.append(createMobilityPlan(doc, { enabled: true, session: s.session }))
      else if (mobility.kind === 'error') warm.append(el('p', 'Opvarmningen kunne ikke vises. Bed din coach kontrollere planen.', { role: 'alert' }))
      warm.append(createOpvarmning(doc, { enabled: true, firstWorkSet: { weight: parseInputNumber(s.input.weight) } }))
      body.append(warm)
    }
    body.append(el('h1', summary ? 'Opsummering af passet' : s.next?.exercise.name || s.session.title || 'Dagens pas', { tabindex: '-1', 'data-heading': '' }))
    const receipt = sessionRecordReceipt(p, s)
    if (receipt) body.append(el('p', receipt.text, { role: 'status', 'data-rekord-fejring': receipt.key, class: 'record-receipt' }))
    if (summary) {
      const card = el('section', null, { class: 'card', 'aria-label': 'Opsummering', 'data-session-summary': '' })
      card.append(el('p', `${summary.done} af ${summary.total} sæt klaret`))
      const records = new Map()
      for (const item of p.sessionRecordReceipts || []) {
        const valid = sessionRecordReceipt(p, s, item)
        if (valid && valid.key !== receipt?.key) records.set(valid.key, valid)
      }
      if (records.size) {
        const fold = el('details', null, { 'data-detail': 'session-records' })
        fold.append(el('summary', 'Rekorder i dette pas'))
        for (const item of records.values()) fold.append(el('p', item.text, { 'data-session-record': item.key }))
        card.append(fold)
      }
      const complete = summary.exercises.filter(ex => ex.total > 0 && ex.missing === 0)
      const missing = summary.exercises.filter(ex => ex.missing > 0)
      if (complete.length) card.append(el('h2', 'Øvelser med alle sæt klaret'))
      for (const ex of complete) card.append(el('p', ex.name))
      if (missing.length) {
        card.append(el('h2', 'Øvelser med sæt tilbage'))
        for (const ex of missing) card.append(el('p', `${ex.name}: ${ex.missing} sæt tilbage`))
      }
      for (const ex of summary.exercises.filter(ex => ex.total === 0)) card.append(el('p', `${ex.name}: ingen planlagte sæt`))
      if (summary.highestRpe != null) card.append(el('p', `Højeste RPE i dag: ${summary.highestRpe}`))
      const comparisons = sessionComparisons(s.session, p.exerciseLogs, p, clock.Date.now(), s.logs)
      const compared = new Set(comparisons.map(item => item.exerciseId))
      const heavy = summary.exercises.filter((ex, index) => ex.heaviest && !compared.has(s.session.exercises[index].id))
      if (heavy.length) {
        card.append(el('h2', 'Tungeste sæt i dag'))
        for (const ex of heavy) card.append(el('p', `${ex.name}: ${ex.heaviest}`))
      }
      const comparison = sessionComparisonContent((...args) => historyElement(doc, ...args), comparisons)
      if (comparison) card.append(comparison)
      body.append(card)
      if (s.next) {
        const resume = el('button', 'Fortsæt passet', { type: 'button' })
        resume.addEventListener('click', () => controller.resume()); body.append(resume)
      }
    }
    const timer = el('p', '', { role: 'timer', 'aria-label': 'Pause mellem sæt', 'aria-live': 'off' })
    body.append(timer)
    // A rerender transfers the display subscriber and disposes the previous interval.
    stopTimer?.(); lastPause = p.restPause
    // Marc 3. nov.: one rest display only. When the rest timer shows, the planned pause line hides.
    stopTimer = watchRest(lastPause, n => { timer.textContent = n > 0 ? `Pause: ${n} ${antalOrd(n, 'sekund', 'sekunder')}` : ''; timer.hidden = !(n > 0) || !rest.node.hidden }, clock)
    if (s.next && !summary) {
      const n = s.next, ex = n.exercise, key = s.key
      body.append(el('p', `Sæt ${n.setNumber} af ${n.totalSets}`, { class: 'muted' }))
      const groupView = mountSupersetView(body, { enabled: true, exercises: s.session.exercises,
        compact: true, currentExerciseId: ex.id })
      cleanBlocks.push(() => groupView.dispose())
      // Keep the optional ramp before the plan so registration follows the compact plan directly.
      // Later exercises keep their own ramp. The first exercise shares the daily fold.
      if (n.setNumber === 1 && !dailyWarmup) {
        const warm = el('details', null, { class: 'card', 'data-detail': 'warmup' })
        warm.append(el('summary', 'Opvarmningssæt'), createOpvarmning(doc, {
          enabled: true, firstWorkSet: { weight: parseInputNumber(s.input.weight) }
        }))
        body.append(warm)
      }
      const plan = el('section', null, { class: 'card plan-card', 'aria-label': 'Planlagt belastning' })
      if (!given(ex.reps)) plan.append(el('p', 'Gentagelser mangler i planen. Bed din coach rette øvelsen.', { role: 'alert' }))
      const prescription = [given(ex.reps) ? `${ex.reps} ${antalOrd(ex.reps, 'gentagelse', 'gentagelser')}` : null,
        given(ex.recommended_weight) ? `${ex.recommended_weight} kg` : null].filter(Boolean)
      if (prescription.length) plan.append(el('p', prescription.join(' · '), { class: 'plan' }))
      if (given(ex.intensity)) plan.append(el('p', `Intensitet: ${ex.intensity}`))
      body.append(plan)
      const tempo = mountTempoView(plan, { enabled: true, ...sessionPrescription(ex), compact: true })
      cleanBlocks.push(() => tempo.dispose())
      showHistory(plan, ex, 'exercise-history-current')
      if (ex.note) plan.append(el('p', `Coachens fokus: ${ex.note}`))
      if (p.readOnly !== true) {
        const form = el('form', null, { class: 'card registration-card', 'aria-label': 'Registrer sæt' }), fields = el('div', null, { class: 'fields' }), inputs = {}
        const busy = !['idle', 'error'].includes(s.phase)
        // Marc 3. nov.: same one-tap controls as the old Dagens pas, placed right at their field:
        // "−2,5 [vægt] +2,5", "−1 [reps] +1", and the RPE buttons directly under the RPE field.
        const set = (name, value) => controller.edit(key, name, value, s.selection.stamp)
        // Read the live value at tap time, so repeated taps add up even before a rerender.
        const now = name => controller.state().input?.[name] ?? inputs[name].value
        const tap = (text, label, run, cls = 'step', id = label) => {
          const b = el('button', text, { type: 'button', class: cls, 'aria-label': label, 'data-step': id })
          b.disabled = busy; b.addEventListener('click', run); return b
        }
        const stepButtons = {
          weight: [['−2,5', '2,5 kg mindre', v => stepWeight(v, -2.5), 'weight-down'], ['+2,5', '2,5 kg mere', v => stepWeight(v, 2.5), 'weight-up']],
          reps: [['−1', '1 gentagelse mindre', v => stepReps(v, -1), 'reps-down'], ['+1', '1 gentagelse mere', v => stepReps(v, 1), 'reps-up']]
        }
        for (const [name, label, mode] of [['weight', 'Vægt i kg', 'decimal'], ['reps', 'Gentagelser', 'numeric'], ['rpe', 'Oplevet RPE (valgfri)', 'decimal']]) {
          const lab = el('label', label), input = el('input', null, { type: 'text', inputmode: mode, 'data-field': name })
          input.value = String(s.input[name]); input.disabled = busy
          input.addEventListener('input', () => controller.edit(key, name, input.value, s.selection.stamp))
          inputs[name] = input
          if (stepButtons[name]) {
            // The input stays directly inside its own label; the buttons sit on either side of it.
            const [down, up] = stepButtons[name]
            const line = el('div', null, { class: 'stepper-line' })
            lab.append(input)
            line.append(tap(down[0], down[1], () => set(name, down[2](now(name))), 'step', down[3]), lab,
              tap(up[0], up[1], () => set(name, up[2](now(name))), 'step', up[3]))
            fields.append(line)
            if (name === 'weight') {
              const plates = el('details', null, { 'data-detail': 'plates', class: 'plate-tool' })
              plates.append(el('summary', 'Skiver'))
              let disposePlates = null
              const toggle = () => {
                if (plates.open && !disposePlates) disposePlates = mountPlateCalculator(plates,
                  { weight: controller.state().input.weight, barWeightKg: plateBar })
                else if (!plates.open && disposePlates) {
                  plateBar = Number(plates.querySelector('select')?.value || 20)
                  disposePlates(); disposePlates = null
                }
              }
              // Enter in the read-only calculator must never approve the work set.
              plates.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target?.tagName?.toLowerCase() === 'input') event.preventDefault() })
              plates.addEventListener('toggle', toggle)
              cleanBlocks.push(() => { plates.removeEventListener('toggle', toggle); disposePlates?.() })
              plates.open = !stepChanged && detailsOpen.includes('plates'); toggle()
              fields.append(plates)
            }
            continue
          } else {
            lab.append(input)
            const rpeRow = el('div', null, { class: 'rpe-row', role: 'group', 'aria-label': 'Vælg RPE' })
            for (const v of ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10']) {
              const shown = v.replace('.', ',')
              const b = tap(shown, `RPE ${shown}`, () => set('rpe', String(now('rpe')) === v ? '' : v), 'rpe', `rpe-${v}`)
              b.setAttribute('aria-pressed', String(String(s.input.rpe) === v)); rpeRow.append(b)
            }
            const rpe = el('details', null, { 'data-detail': 'rpe' })
            rpe.append(el('summary', given(s.input.rpe)
              ? `Oplevet anstrengelse (RPE): ${String(s.input.rpe).replace('.', ',')}`
              : 'Tilføj oplevet anstrengelse (RPE)'), lab, rpeRow,
            el('p', 'RPE er din oplevede anstrengelse fra 0 til 10. Det er valgfrit og kan stå tomt.', { class: 'hint' }))
            fields.append(rpe)
          }
        }
        form.append(el('h2', 'Dit sæt'), fields, el('p', 'Skriv 0 kg ved en øvelse uden ekstra vægt.', { class: 'hint' }))
        const approve = el('button', s.phase === 'queued' ? 'Venter på net' : busy ? 'Afventer svar' : s.approveLabel, { type: 'submit', class: 'approve' })
        approve.disabled = busy
        form.addEventListener('submit', e => {
          e.preventDefault()
          return controller.approve(key, { ...s.input, ...Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, v.value])) }, s.selection.stamp)
        })
        form.append(createSetNote(doc, { value: s.note, disabled: busy,
          onChange: value => controller.editNote(key, value, s.selection.stamp) }), approve)
        body.append(form)
      }
    }
    if (!summary) {
      const finish = el('button', 'Afslut pas', { type: 'button' })
      finish.addEventListener('click', () => controller.finish()); body.append(finish)
    }
    const history = el('details', null, { class: 'card', 'data-detail': 'history' })
    history.append(el('summary', 'Hele passet og klarede sæt'))
    const grouping = sessionGroupsForDisplay(s.session.exercises)
    for (const [index, ex] of (s.session.exercises || []).entries()) {
      const group = grouping.groups.find(group => group.kind !== 'single' && group.members[0].exerciseId === ex.id)
      if (group) history.append(el('h2', group.label))
      history.append(el('h2', ex.name))
      if (given(ex.sets) && given(ex.reps)) history.append(el('p', `${ex.sets} × ${ex.reps}`))
      showHistory(history, ex, `exercise-history-${index}`)
      for (const log of s.logs.filter(l => l.exercise_id === ex.id).slice().sort((a, b) => a.set_number - b.set_number))
        history.append(el('p', `Sæt ${log.set_number}: ${log.skipped ? 'Sprunget over' : `${present(log.weight)} kg, ${present(log.reps_completed)} gent.${given(log.rpe_actual) ? `, RPE ${log.rpe_actual}` : ''}`}`))
    }
    body.append(history)
    for (const node of body.querySelectorAll('details')) {
      const detail = node.getAttribute('data-detail')
      node.open = (detail === 'rpe' && given(s.input.rpe)) || (!stepChanged && detailsOpen.includes(detail))
    }
    const replacement = fieldName ? body.querySelector(`[data-field="${fieldName}"]`) : null
    const stepReplacement = stepFocus ? body.querySelector(`[data-step="${stepFocus}"]`) : null
    const stepAvailable = node => {
      if (!node || node.disabled || node.hidden) return false
      let child = node, parent = node.parentElement
      while (parent && parent !== body) {
        if (parent.hidden || (parent.tagName?.toLowerCase() === 'details' && !parent.open && child.tagName?.toLowerCase() !== 'summary')) return false
        child = parent; parent = parent.parentElement
      }
      return true
    }
    if (stepChanged) body.querySelector('[data-heading]')?.focus()
    else if (replacement && !replacement.disabled) {
      replacement.focus(); if (position[0] != null && typeof replacement.setSelectionRange === 'function') replacement.setSelectionRange(...position)
    } else if (stepAvailable(stepReplacement)) stepReplacement.focus()
    else if (detailFocus) body.querySelector(`[data-detail="${detailFocus}"] summary`)?.focus()
    else if (approveFocus && !body.querySelector('.approve')?.disabled) body.querySelector('.approve')?.focus()
    else if (hadBodyFocus) body.querySelector('[data-heading]')?.focus()
  }
  render()
  return { update: () => controller.refresh(), controller,
    dispose() { dead = true; rest.dispose(); tearDown(); trigger.removeEventListener('click', start); root.replaceChildren(); root.classList.remove('e2-session') } }
}
