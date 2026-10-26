/* global Buffer */
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'rolldown/utils'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadCoachSvar, saveCoachSvarEnabled, saveCoachSvarTemplates, saveCoachSvarSeenNotes, insertCoachTemplate, coachNoteItems, validTemplate } from './coachSvar.js'
import { buildCoachPriorityItems } from '../coachPriority.js'

let rows, calls, failure, delay
const fakeClient = {
  from(table) {
    const filters = []
    let patch
    let inserted
    const query = {
      update(value) { patch = value; calls.push({ table, kind: 'update', value, filters }); return query },
      insert(value) { inserted = value; calls.push({ table, kind: 'insert', value }); return query },
      select() { return query },
      eq(name, value) { filters.push(['eq', name, value]); return query },
      lte(name, value) { filters.push(['lte', name, value]); return query },
      or(value) { filters.push(['or', value]); return query },
      async then(resolve, reject) {
        try {
          if (delay) await delay
          if (failure) return resolve({ error: failure })
          if (inserted) return resolve({ data: [inserted], error: null })
          const selected = rows.filter(row => filters.every(([kind, name, value]) => {
            if (kind === 'eq') return row[name] === value
            if (kind === 'lte') return row[name] <= value
            return row.category === 'besked' || row.category == null
          }))
          for (const row of selected) Object.assign(row, patch)
          resolve({ data: selected.map(row => ({ id: row.id, category: row.category })), error: null })
        } catch (error) { reject(error) }
      },
    }
    return query
  },
}
globalThis[Symbol.for('entropi.coachSvar.test')] = fakeClient
const fakeUrl = `data:text/javascript;base64,${Buffer.from("export const supabase = globalThis[Symbol.for('entropi.coachSvar.test')]").toString('base64')}`
registerHooks({
  resolve(specifier, context, next) {
    if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier)) return { url: fakeUrl, shortCircuit: true }
    if (specifier.startsWith('.') && context.parentURL) {
      for (const extension of ['.js', '.jsx']) {
        const url = new URL(specifier + extension, context.parentURL)
        if (existsSync(url)) return { url: url.href, shortCircuit: true }
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url.endsWith('.jsx')) return {
      format: 'module', shortCircuit: true,
      source: transformSync(fileURLToPath(url), readFileSync(new URL(url), 'utf8'), { jsx: { runtime: 'automatic' } }).code,
    }
    return next(url, context)
  },
})
const { lavIndbakkeHandlinger } = await import('./indbakkeHandlinger.js')
const { default: HurtigeSvar } = await import('./HurtigeSvar.jsx')
const { default: BeskederTab } = await import('./BeskederTab.jsx')
const { default: IndbakkeView } = await import('./IndbakkeView.jsx')
const { default: LogTab } = await import('./LogTab.jsx')
function memoryStorage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}
const athlete = { id: 'synthetic-a', name: 'Testatlet' }
const message = (id, extra = {}) => ({ id, athlete_id: athlete.id, sender_role: 'athlete', read_by_coach: false, category: 'besked', created_at: '2026-10-20T12:00:00Z', content: 'Godt pas', ...extra })
function harness(overrides = {}) {
  rows = [message('m1')]; calls = []; failure = null; delay = null
  const state = { messages: rows.map(row => ({ ...row })), flashes: [], saving: null, draft: '', unreadCounts: { [athlete.id]: 1 }, unreadByTrack: { [athlete.id]: { besked: 1, teknik: 0 } } }
  const props = {
    athletes: [athlete], session: { user: { id: 'coach-a' } }, selectedAthlete: athlete,
    coachSvarEnabled: true, messageSeenPendingRef: { current: false }, messageThreadAthleteRef: { current: athlete.id },
    setCoachBriefingSeenSavingKey: value => { state.saving = value },
    setMessages: update => { state.messages = update(state.messages) },
    setUnreadCounts: update => { state.unreadCounts = update(state.unreadCounts) },
    setUnreadByTrack: update => { state.unreadByTrack = update(state.unreadByTrack) },
    fetchLatestMessages: async () => { state.refreshed = true; return true }, fetchMessages: async () => {},
    showFlash: (...args) => state.flashes.push(args),
    setSendingMessage() {}, setMessageSendError() {}, setMessageInput: value => { state.draft = value },
    ...overrides,
  }
  return { state, props, actions: lavIndbakkeHandlinger(props) }
}
function elements(node) {
  if (!node || typeof node !== 'object') return []
  return [node, ...[node.props?.children].flat(Infinity).flatMap(elements)]
}

test('Kontakten er fra som standard, er striks og er isoleret pr. coach', () => {
  const storage = memoryStorage()
  assert.equal(loadCoachSvar('coach-a', storage).enabled, false)
  for (const value of ['true', 1, null, {}]) {
    saveCoachSvarEnabled('coach-a', value, storage)
    assert.equal(loadCoachSvar('coach-a', storage).enabled, false)
  }
  saveCoachSvarEnabled('coach-a', true, storage)
  assert.equal(loadCoachSvar('coach-a', storage).enabled, true)
  assert.equal(loadCoachSvar('coach-b', storage).enabled, false)
  saveCoachSvarEnabled('coach-a', false, storage)
  assert.equal(loadCoachSvar('coach-a', storage).enabled, false)
})

test('Skabeloner og Set gendannes kun for den samme coach', () => {
  const storage = memoryStorage()
  const template = 'Godt pas, hold samme vægt næste gang'
  saveCoachSvarTemplates('coach-a', [template], storage)
  saveCoachSvarSeenNotes('coach-a', ['note-a'], storage)
  assert.deepEqual(loadCoachSvar('coach-a', storage), { enabled: false, templates: [template], seenNotes: ['note-a'] })
  assert.deepEqual(loadCoachSvar('coach-b', storage), { enabled: false, templates: [], seenNotes: [] })
  assert.equal(saveCoachSvarTemplates('', [template], storage), false)
})

test('Korrupt og afvist browserlager fejler sikkert', () => {
  const denied = { getItem() { throw Error('Afvist') }, setItem() { throw Error('Fuldt') } }
  for (const storage of [denied, { getItem: () => '{ugyldig' }, { getItem: () => '{"enabled":true}' }]) {
    assert.deepEqual(loadCoachSvar('coach-a', storage), { enabled: false, templates: [], seenNotes: [] })
  }
  assert.equal(saveCoachSvarEnabled('coach-a', true, denied), false)
  assert.equal(saveCoachSvarTemplates('coach-a', ['Svar'], denied), false)
  assert.equal(saveCoachSvarSeenNotes('coach-a', ['Note'], denied), false)
  assert.equal(validTemplate('   '), false)
  assert.equal(validTemplate('a'.repeat(501)), false)
})

test('Et tryk indsætter i kladden, bevarer teksten og sender intet', () => {
  const { actions } = harness()
  let draft = 'Min kladde'
  const tree = HurtigeSvar({ coachSvar: { enabled: true, templates: ['Godt pas'] }, messageInput: draft,
    setMessageInput: update => { draft = update(draft) }, setMessageSendError() {}, sendCoachMessage: actions.sendCoachMessage })
  elements(tree).find(node => node.type === 'button' && node.props.children === 'Godt pas').props.onClick()
  assert.equal(draft, 'Min kladde\nGodt pas')
  assert.equal(insertCoachTemplate('', 'ÆØÅ'), 'ÆØÅ')
  assert.equal(calls.length, 0)
  assert.equal(HurtigeSvar({ coachSvar: { enabled: false } }), null)
})

test('Den rettede kladde sendes først ved eksplicit Send', async () => {
  const { actions } = harness({ messageInput: 'Godt pas, øg til 105 kg', coachMsgTrack: 'teknik' })
  assert.equal(calls.length, 0)
  await actions.sendCoachMessage()
  assert.deepEqual(calls, [{ table: 'messages', kind: 'insert', value: { athlete_id: athlete.id, sender_role: 'coach', content: 'Godt pas, øg til 105 kg', category: 'teknik' } }])
})

test('Set opdaterer kun den valgte atletbesked og sender intet svar', async () => {
  const { actions, state } = harness()
  rows.push(message('m2'), message('coach-message', { sender_role: 'coach' }), message('foreign', { athlete_id: 'other' }))
  await actions.markMessageSeen({ athleteId: athlete.id, messageId: 'm1' })
  assert.deepEqual(rows.map(row => row.read_by_coach), [true, false, false, false])
  assert.equal(state.messages[0].read_by_coach, true)
  assert.equal(state.unreadCounts[athlete.id], 0)
  assert.deepEqual(state.unreadByTrack[athlete.id], { besked: 0, teknik: 0 })
  assert.equal(state.refreshed, true)
  assert.equal(state.saving, null)
  assert.deepEqual(calls.map(call => call.kind), ['update'])
})

test('Set fra køen afgrænser spor og tidspunkt og bevarer nye beskeder', async () => {
  const { actions } = harness()
  rows.push(message('null-category', { category: null }), message('technique', { category: 'teknik' }),
    message('new', { created_at: '2026-10-20T12:00:01Z' }))
  await actions.markMessageSeen({ athleteId: athlete.id, track: 'besked', through: '2026-10-20T12:00:00Z' })
  assert.deepEqual(rows.map(row => row.read_by_coach), [true, true, false, false])
  assert.equal(calls[0].table, 'messages')
})

test('Flag fra og ukendt atlet skriver intet', async () => {
  let h = harness({ coachSvarEnabled: false })
  await h.actions.markMessageSeen({ athleteId: athlete.id, messageId: 'm1' })
  assert.equal(calls.length, 0)
  h = harness()
  await h.actions.markMessageSeen({ athleteId: 'other', messageId: 'm1' })
  await h.actions.markMessageSeen({ athleteId: athlete.id, track: 'besked', through: 'ugyldig' })
  assert.equal(calls.length, 0)
})

test('Set på teknik rydder kun teknik og virker selv om genhentning fejler', async () => {
  const { actions, state } = harness({ fetchLatestMessages: async () => false })
  rows = [message('technique', { category: 'teknik' }), message('regular')]
  state.unreadCounts = { [athlete.id]: 2 }
  state.unreadByTrack = { [athlete.id]: { teknik: 1, besked: 1 } }
  await actions.markMessageSeen({ athleteId: athlete.id, track: 'teknik', through: '2026-10-20T12:00:00Z' })
  assert.deepEqual(rows.map(row => row.read_by_coach), [true, false])
  assert.equal(state.unreadCounts[athlete.id], 1)
  assert.deepEqual(state.unreadByTrack[athlete.id], { teknik: 0, besked: 1 })
})

test('Fejl og nul opdaterede rækker bevarer opgaven og viser fejl', async () => {
  for (const mode of ['error', 'zero']) {
    const { actions, state } = harness()
    if (mode === 'error') failure = Error('Afvist')
    else rows = []
    await actions.markMessageSeen({ athleteId: athlete.id, messageId: 'm1' })
    assert.equal(state.messages[0].read_by_coach, false)
    assert.equal(state.flashes[0][1], 'error')
    assert.equal(state.saving, null)
  }
})

test('Dobbelttryk og profilspring under Set rammer ikke en anden tråd', async () => {
  const { actions, props, state } = harness()
  let release
  delay = new Promise(resolve => { release = resolve })
  const first = actions.markMessageSeen({ athleteId: athlete.id, messageId: 'm1' })
  await actions.markMessageSeen({ athleteId: athlete.id, messageId: 'm1' })
  props.messageThreadAthleteRef.current = 'other'
  release()
  await first
  assert.equal(calls.length, 1)
  assert.equal(state.messages[0].read_by_coach, false)
})

test('Pas- og sætnoter forsvinder fra handlingskøen efter Set og vender tilbage ved rettelse', () => {
  const weeks = { [athlete.id]: [{ week_number: 4, session_voices: [{ id: 'session-a', comment: 'Træt i benene' }] }] }
  const completion = { [athlete.id]: { 4: { notes: [{ id: 'log-a', note: 'Godt sæt' }] } } }
  const notes = coachNoteItems([athlete], weeks, completion, [])
  assert.equal(notes.length, 2)
  const args = { athletes: [athlete], trainingSignals: [], unreadByTrack: {}, latestByTrack: {}, videoReviewQueue: [] }
  assert.equal(buildCoachPriorityItems(args).length, 0)
  assert.equal(buildCoachPriorityItems({ ...args, noteItems: notes }).length, 2)
  const seen = notes.map(item => item.noteKey)
  assert.equal(coachNoteItems([athlete], weeks, completion, seen).length, 0)
  weeks[athlete.id][0].session_voices[0].comment = 'Træt i benene i dag'
  assert.equal(coachNoteItems([athlete], weeks, completion, seen).length, 1)
  assert.equal(buildCoachPriorityItems({ ...args, athletes: [], noteItems: notes }).length, 0)
})

test('Den rigtige beskedfane skjuler nye knapper når flaget er fra', () => {
  const base = { a: athlete, coachMsgTrack: 'besked', messages: [message('m1')], messageInput: '', formatMsgTime: () => '12:00' }
  const off = renderToStaticMarkup(createElement(BeskederTab, base))
  assert.doesNotMatch(off, /Hurtige svar|>Set<|Gem som hurtigt svar/)
  const on = renderToStaticMarkup(createElement(BeskederTab, { ...base, coachSvar: { enabled: true, templates: ['Godt pas'] } }))
  assert.match(on, /Hurtige svar/)
  assert.match(on, />Set</)
  assert.match(on, /Gem som hurtigt svar/)
})

test('Indbakken har en kontakt fra som standard og Set på noter ved tilvalg', () => {
  const note = coachNoteItems([athlete], { [athlete.id]: [{ week_number: 1, session_voices: [{ id: 's', comment: 'Testnote' }] }] }, {}, [])[0]
  const base = { athletes: [athlete], hiddenAthleteIds: new Set(), coachPriorityItems: [], latestByTrack: {}, unreadByTrack: {} }
  const off = renderToStaticMarkup(createElement(IndbakkeView, base))
  assert.match(off, /role="switch"/)
  assert.doesNotMatch(off, /checked=""/)
  const on = renderToStaticMarkup(createElement(IndbakkeView, { ...base, coachPriorityItems: [note], coachSvar: { enabled: true } }))
  assert.match(on, /checked=""/)
  assert.match(on, /Testnote/)
  assert.match(on, />Set</)
})

test('Log viser Set på pasnoter uden vurdering og på noter til sprungne sæt', () => {
  const log = { id: 'log-a', logged_at: '2026-10-20T12:00:00Z', athlete_id: athlete.id, note: 'Pause i dag', skipped: true, set_number: 1,
    exercises: { id: 'exercise-a', name: 'Squat', sets: 3, sessions: { id: 'session-a', title: 'Pas A', athlete_comment: 'Træt i benene', weeks: { week_number: 4 } } } }
  const props = { athleteLogs: [log], athleteId: athlete.id, coachSvar: { enabled: true, seenNotes: [] } }
  const html = renderToStaticMarkup(createElement(LogTab, props))
  assert.match(html, /Træt i benene/)
  assert.match(html, /Pause i dag/)
  assert.equal((html.match(/>Set<\/button>/g) || []).length, 2)
  const seenNotes = coachNoteItems([athlete], { [athlete.id]: [{ week_number: 4, session_voices: [{ id: 'session-a', comment: 'Træt i benene' }] }] }, { [athlete.id]: { 4: { notes: [{ id: 'log-a', note: 'Pause i dag' }] } } }, []).map(item => item.noteKey)
  const seen = renderToStaticMarkup(createElement(LogTab, { ...props, coachSvar: { enabled: true, seenNotes } }))
  assert.doesNotMatch(seen, />Set<\/button>/)
})
