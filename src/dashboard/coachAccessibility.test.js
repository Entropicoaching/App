import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { ugeFeedbackTree, coachUgeFeedback } from './coachUgeFeedback.js'
import { coachTekstTree } from './coachTekstTree.js'
import { renderCoachNote, createCoachNote, approvalBasis, canonical, RULESET } from '../videoCoachNote.mjs'
import { measurement } from './appTest2Measurement.mjs'
import { activateOnKey, searchKeys, leaveSearch, selectSearchOption } from './focusCopies.mjs'

const source = name => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const program = source('ProgramTab.jsx')
const form = source('ExFormRow.jsx')
const weekdays = source('WeekdayPicker.jsx')
// Synthetic DOM only. Nothing from the original React modules is imported or evaluated.
function fixture() {
  const doc = { activeElement: null }
  const state = { open: true, clicks: 0, selected: 0 }
  const input = { tagName: 'INPUT', focus() { doc.activeElement = this; state.open = true } }
  const option = { tagName: 'DIV', focus() { doc.activeElement = this }, click() { state.clicks++ } }
  const root = {
    querySelector(selector) { return selector === 'input' ? input : selector === '[role="button"]' ? option : null },
    contains(node) { return node === input || node === option || node === this },
  }
  option.closest = selector => selector === '[data-exercise-search]' ? root : null
  const setOpen = value => { state.open = value }
  const event = (key, target = option, currentTarget = option, repeat = false) => ({
    key, target, currentTarget, repeat, prevented: false, stopped: false,
    preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true },
  })
  return { doc, state, input, option, root, setOpen, event }
}
function binding(text, token) { assert.ok(text.includes(token), `Mangler binding: ${token}`) }
function buttonBindings(text) {
  binding(text, 'role="button" tabIndex={0}')
  binding(text, 'onKeyDown={activateOnKey}')
}

test('Enter og mellemrum aktiverer syntetisk DOM en gang og stopper rulning', () => {
  for (const key of ['Enter', ' ']) {
    const f = fixture(); const event = f.event(key)
    activateOnKey(event)
    assert.equal(f.state.clicks, 1)
    assert.equal(event.prevented, true)
    assert.equal(event.stopped, true)
  }
})

test('Gentagelse, andre taster og tastetryk fra børn aktiverer ikke rækken', () => {
  const f = fixture()
  for (const event of [f.event('Enter', f.option, f.option, true), f.event('Tab'), f.event('Enter', f.input, f.option)]) {
    activateOnKey(event)
    assert.equal(event.prevented, !!event.repeat)
  }
  assert.equal(f.state.clicks, 0)
})

test('Søgning bevarer popup ved Tab internt og lukker ved fokus udenfor', () => {
  const f = fixture()
  leaveSearch({ currentTarget: f.root, relatedTarget: f.option }, f.setOpen)
  assert.equal(f.state.open, true)
  leaveSearch({ currentTarget: f.root, relatedTarget: {} }, f.setOpen)
  assert.equal(f.state.open, false)
  f.state.open = true
  leaveSearch({ currentTarget: f.root, relatedTarget: null }, f.setOpen)
  assert.equal(f.state.open, false)
})

test('Pil ned fokuserer valget; Escape returnerer fokus og lukker efter onFocus', () => {
  const f = fixture()
  const down = f.event('ArrowDown', f.input, f.root)
  searchKeys(down, f.setOpen, { current: false })
  assert.equal(f.doc.activeElement, f.option)
  assert.equal(down.prevented, true)
  const escape = f.event('Escape', f.option, f.root)
  searchKeys(escape, f.setOpen, { current: false })
  assert.equal(f.doc.activeElement, f.input)
  assert.equal(f.state.open, false)
  assert.equal(escape.stopped, true)
})

test('Valg returnerer fokus før popup fjernes og vælger præcis en gang', () => {
  const f = fixture(); f.option.focus()
  selectSearchOption(f.event('Enter'), () => {
    assert.equal(f.doc.activeElement, f.input)
    f.state.selected++; f.state.open = false
  })
  assert.equal(f.state.selected, 1)
  assert.equal(f.state.open, false)
})

test('Kandidatens uge, pas, fase og vægt har særskilte tastaturbindinger', () => {
  buttonBindings(program)
  for (const token of [
    'aria-expanded={openWeekId === week.id}', 'aria-expanded={openSessionId === session.id}',
    'aria-label={`Gå til ${range}`}', 'aria-label={`Gå til uge ${week.week_number}`}',
    'aria-label={`Rediger anbefalet vægt for ${ex.name}`}',
    'onClick={e => { e.stopPropagation(); setOpenWeekId',
    'onClick={e => { e.stopPropagation(); setOpenSessionId',
  ]) binding(program, token)
  // Actual key handler is tested on a DOM fake only when it is wired in this source.
  const f = fixture()
  const wired = program.includes('onKeyDown={activateOnKey}') ? activateOnKey : () => {}
  wired(f.event('Enter'))
  assert.equal(f.state.clicks, 1)
})

test('Bibliotekets muligheder har tastatur, fokusretur og ingen tidsbaseret lukning', () => {
  buttonBindings(form)
  for (const token of ['data-exercise-search=""', 'searchKeys(e, setExerciseSearchOpen, searchFocus)',
    'leaveSearch(e, setExerciseSearchOpen)', 'onClick={e => selectSearchOption(e, () =>']) binding(form, token)
  assert.equal(form.includes('setTimeout'), false)
  assert.equal((form.match(/onClick=\{e => selectSearchOption/g) || []).length, 2)
})

test('Alle redigeringsfelter har labels og kopieringsknapper har navne', () => {
  for (const label of ['Uge nr.', 'Startdato', 'Blok', 'Coach-note', 'Blok-beskrivelse', 'Titel',
    'Nye uger, startdato', 'Planassistentens fokus', 'Bloknavn', 'Anbefalet vægt (kg)',
    'Annuller kopiering af træning', 'Annuller kopiering af øvelse']) binding(program, `aria-label="${label}"`)
  for (const token of ['aria-label={`Blok for uge ${w.week_number}`}', 'aria-label={`Blok ${i + 1}: navn`}',
    'aria-label={`Blok ${i + 1}: antal uger`}', 'aria-label={`Kopiér ${session.title} til uge`}',
    'aria-label={`Kopiér ${ex.name} til træning`}', 'aria-required="true"', 'aria-invalid={missingReason}']) binding(program, token)
  for (const token of ['aria-label="Navn"', 'aria-label={label}', 'aria-label="Intensitet"', 'aria-label="Note"']) binding(form, token)
})

test('Ugedage har gruppenavn og valgte tilstande', () => {
  for (const token of ['role="group" aria-label="Fast ugedag (valgfri)"', 'aria-pressed={active}',
    'aria-pressed={sessionForm.weekday == null}']) binding(weekdays, token)
})

test('Overskriftshierarki og livebeskeder bindes til de eksisterende elementer', () => {
  for (const level of [2, 3, 4]) binding(program, `role="heading" aria-level={${level}}`)
  binding(program, 'role="alert"')
  binding(program, 'role="status" aria-live="polite"')
  binding(program, 'aria-busy={!!weekDraft?.loading}')
  assertProgramBindings(program)
  // The wrapper imports the parent module. A dashboard-local file never existed.
  binding(source('VideoCoachNote.jsx'), "from '../videoCoachNote.mjs'")
  binding(source('VideoCoachNote.jsx'), 'renderCoachNote(createElement, notes, { athlete_id: athleteId, session_id: sessionId })')
  assertFeedbackHeadings(ugeFeedbackTree(h, closedFeedback(), 3, 'scope'))
  assertDraftHeading(coachTekstTree(h, [{ situation: 'test', navn: 'Kladde', tekst: 'Syntetisk tekst', mangler: [] }], 'scope'))
  assertNoteHeading(renderCoachNote(h, [validNote()], noteTarget()))
})

test('Modprøver: fjernede bindinger afsløres, også med CRLF', () => {
  for (const original of [program, program.replace(/\n/g, '\r\n')]) {
    assert.throws(() => buttonBindings(original.replaceAll('onKeyDown={activateOnKey}', '')))
    assert.throws(() => binding(original.replaceAll('aria-expanded={openWeekId === week.id}', ''), 'aria-expanded={openWeekId === week.id}'))
  }
  const f = fixture()
  const baseActivate = () => {}
  baseActivate(f.event('Enter'))
  assert.throws(() => assert.equal(f.state.clicks, 1))
})

test('Pinnet basis mangler rettelserne, uden at modulerne køres', () => {
  const pinned = new URL('input-267-input-267-input-267-264-ProgramTab.jsx', import.meta.url)
  if (!existsSync(pinned)) return // Integrated checkout has no worker input copies.
  const old = readFileSync(pinned, 'utf8')
  assert.throws(() => buttonBindings(old))
  assert.throws(() => binding(old, 'aria-label="Anbefalet vægt (kg)"'))
  assert.throws(() => binding(old, 'role="status" aria-live="polite"'))
})

// Inspect actual pure renderer output. The fake only records createElement calls.
const h = (tag, props, ...children) => ({ tag, props: props || {}, children })
const nodes = tree => tree && typeof tree === 'object' ? [tree, ...tree.children.flatMap(nodes)] : []
const textOf = tree => tree == null ? '' : typeof tree === 'object' ? tree.children.map(textOf).join('') : String(tree)
function expectHeading(tree, label, tag, level, role) {
  const found = nodes(tree).filter(n => n.tag === tag && textOf(n) === label)
  assert.equal(found.length, 1, `Præcis en overskrift: ${label}`)
  assert.equal(found[0].props['aria-level'], level, label)
  if (role) assert.equal(found[0].props.role, role, label)
}
function closedFeedback() {
  const week = { start_date: '2026-10-12', sessions: [] }
  return coachUgeFeedback(week, [], new Date(2026, 9, 19))
}
function assertFeedbackHeadings(tree) {
  assert.equal(tree.tag, 'section')
  assert.equal(tree.props['aria-label'], 'Coachens ugeoverblik for uge 3')
  expectHeading(tree, 'Uge 3 · Coachens ugeoverblik', 'h3', 4)
  for (const label of ['Pas og sæt', 'Afvigelser', 'Atletens noter', 'RPE', 'Spørgsmål til coachen'])
    expectHeading(tree, label, 'h4', 5)
}
function assertDraftHeading(tree) {
  assert.equal(tree.props['aria-label'], 'Tekstforslag til atleten')
  expectHeading(tree, 'Kladder til atleten', 'h4', 5)
}
const noteTarget = () => ({ athlete_id: 'athlete1', session_id: 'session1' })
function validNote() {
  const batch = { schema: 'va-k5-batch/v1', status: 'synthetic_only', clips: [{ clip_id: 'clip1', measurement: measurement() }] }
  const request = { schema: 'va-k6-request/v1', status: 'synthetic_only', target: noteTarget(),
    review: { schema: 'va-k5-review/v1', status: 'synthetic_only', ruleset: RULESET, basis: canonical(batch), batch,
      answers: [{ clip_id: 'clip1', finding_id: 'BAR_FORWARD', decision: 'enig', comment: '' }],
      physical_vc_pass: false, technique_acceptance: false, five_real_clips_accepted: false },
    clip_id: 'clip1', finding_ids: ['BAR_FORWARD'], cue: 'Syntetisk cue' }
  return createCoachNote(request, { schema: 'va-k6-direct-approval/v1', status: 'synthetic_only', actor: 'Marc', method: 'direct', decision: 'enig', basis: approvalBasis(request) })
}
function assertNoteHeading(tree) {
  assert.equal(tree.tag, 'aside')
  assert.equal(tree.props['aria-label'], 'Tekniknote til passet')
  expectHeading(tree, 'Tekniknote', 'strong', 5, 'heading')
}

test('Overskrifter opstår kun for eksisterende kort og gyldig tekniknote', () => {
  assert.equal(ugeFeedbackTree(h, null, 3), null)
  assert.equal(coachTekstTree(h, [], 'scope'), null)
  assert.equal(renderCoachNote(h, [], noteTarget()), null)
  assert.equal(renderCoachNote(h, [validNote()], { ...noteTarget(), session_id: 'other' }), null)
  const note = validNote(), before = canonical(note)
  const tree = renderCoachNote(h, [note], noteTarget())
  assertNoteHeading(tree)
  assert.equal(textOf(tree.children[1]), note.text)
  assert.equal(canonical(note), before)
})

test('Modprøver af elementtræer afslører manglende eller forkert niveau og rolle', () => {
  for (const level of [undefined, 2, 6]) {
    const alter = (tag, props, ...children) => h(tag, { ...props, 'aria-level': level }, ...children)
    assert.throws(() => assertFeedbackHeadings(ugeFeedbackTree(alter, closedFeedback(), 3, 'scope')), assert.AssertionError)
    assert.throws(() => assertDraftHeading(coachTekstTree(alter, [{ situation: 'test', navn: 'Kladde', tekst: 'Tekst', mangler: [] }], 'scope')), assert.AssertionError)
    assert.throws(() => assertNoteHeading(renderCoachNote(alter, [validNote()], noteTarget())), assert.AssertionError)
  }
  const noRole = (tag, props, ...children) => h(tag, { ...props, role: undefined }, ...children)
  assert.throws(() => assertNoteHeading(renderCoachNote(noRole, [validNote()], noteTarget())), assert.AssertionError)
})

// Bounded source binding: inspect the opening div of the actual existing content.
// This is source verification, not a browser or screen-reader assertion.
function assertProgramBindings(value) {
  for (const [child, tokens] of [
    ["{weeks.length} uge{weeks.length !== 1", ['role="heading"', 'aria-level={2}']],
    ['>Uge {week.week_number}</span>', ['role="heading"', 'aria-level={3}']],
    ['>{session.title}</span>', ['role="heading"', 'aria-level={4}']],
    ['>{weekDraft.error}</div>', ['role="alert"']],
    ['Udkast: uge {weekDraft.data.draft.p_payload.week}', ['role="status"', 'aria-live="polite"']],
  ]) {
    const at = value.indexOf(child)
    assert.ok(at >= 0, `Eksisterende indhold: ${child}`)
    const start = value.lastIndexOf('<div ', at)
    const end = value.indexOf('>', start)
    assert.ok(start >= 0 && end < at + 1, child)
    const opening = value.slice(start, end + 1)
    for (const token of tokens) binding(opening, token)
  }
}

test('Livebeskeder og niveauer kan ikke flyttes til uvedkommende elementer', () => {
  for (const original of [program, program.replaceAll('\n', '\r\n')]) {
    assertProgramBindings(original)
    for (const token of ['role="alert"', 'role="status"', 'aria-live="polite"', 'aria-level={2}', 'aria-level={3}', 'aria-level={4}']) {
      const moved = original.replaceAll(token, '') + `<div ${token}>Uvedkommende</div>`
      assert.throws(() => assertProgramBindings(moved), assert.AssertionError)
    }
  }
})
