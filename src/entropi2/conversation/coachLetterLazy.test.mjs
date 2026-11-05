import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mountConversation } from './ConversationView.mjs'
import { calendarDay, addCalendarDays } from '../../calendarDate.js'

// As in unreadQuickReplies.test.mjs, replace only unused React imports.
// The actual entry factory, adapters, controller, view and reader execute.
// Import faults/delay are synthetic; this does not test React's lifecycle.
const entryURL = new URL('./ConversationEntry.mjs', import.meta.url).href
const readerURL = new URL('../coach/ugebrev/readWeeklyLetter.mjs', import.meta.url).href
const react = 'data:text/javascript,' + encodeURIComponent(`
  export const createElement = () => { throw Error('Unexpected React render') }
  export const useEffect = createElement, useRef = createElement,
    useMemo = createElement, useState = createElement
`)
let attempts = 0, failImport = false, gateId = 0, gate
const gates = new Map()
globalThis.__conversationLetterImportGates = gates
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && [entryURL, new URL('./Conversation.mjs', import.meta.url).href].includes(context.parentURL))
    return { url: react, shortCircuit: true }
  if (context.parentURL === entryURL && specifier === '../coach/ugebrev/readWeeklyLetter.mjs') {
    attempts++
    if (failImport) throw Error('Synthetic chunk import failure')
    if (gate) {
      const id = ++gateId; gates.set(id, gate)
      return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
        const gate = globalThis.__conversationLetterImportGates.get(${id});
        gate.started(); await gate.promise;
        export { readWeeklyLetter } from ${JSON.stringify(readerURL)};
      `) }
    }
  }
  return next(specifier, context)
} })
const { createEntryFactory } = await import('./ConversationEntry.mjs')
assert.equal(attempts, 0, 'loading the entry must not load the coach reader')
test.after(() => { hooks.deregister(); delete globalThis.__conversationLetterImportGates })

class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { tagName: tag, ownerDocument, style: {}, dataset: {}, attributes: {},
      children: [], events: new Map(), value: '', _text: '', disabled: false })
  }
  set textContent(value) { this._text = String(value); this.children = [] }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(' ') }
  append(...children) { this.children.push(...children) }
  replaceChildren(...children) { this._text = ''; this.children = children }
  setAttribute(key, value) { this.attributes[key] = String(value) }
  addEventListener(type, fn) { this.events.set(type, fn) }
  async click() { if (!this.disabled) return this.events.get('click')?.() }
  focus() { this.ownerDocument.focused = this }
}
const find = (el, tag) => [...(el.tagName === tag ? [el] : []), ...el.children.flatMap(n => find(n, tag))]
const button = (root, label) => find(root, 'button').find(n => n.textContent === label)
function fixture(role = 'coach', enabled = true) {
  const reads = [], writes = [], rows = []
  const entry = { enabled: true, session: { user: { id: 'synthetic-owner' } },
    athlete: { id: 'synthetic-athlete', user_id: 'synthetic-owner' },
    selectedAthlete: { id: 'synthetic-athlete' }, athletes: [{ id: 'synthetic-athlete' }],
    storage: () => null, inboxDatabase: {
      from(table) {
        reads.push(table)
        const query = Object.fromEntries(['select', 'eq', 'gte', 'lte', 'order'].map(key => [key, () => query]))
        for (const key of ['insert', 'update', 'upsert']) query[key] = () => { writes.push(key); assert.fail('Unexpected write') }
        query.range = async () => ({ data: table === 'readiness_logs' ? rows : [] })
        return query
      },
      rpc: async () => ({ data: [] }),
    } }
  const controller = createEntryFactory({ enabled, role, getEntry: () => entry })()
  const doc = { createElement: tag => new Element(tag, doc) }, root = doc.createElement('root')
  const cleanup = mountConversation(root, controller, { enabled })
  return { entry, controller, root, reads, writes, rows, cleanup }
}
function delayedImport() {
  let release, started
  const ready = new Promise(resolve => { started = resolve })
  gate = { promise: new Promise(resolve => { release = resolve }), started }
  return { ready, release, reset() { gate = undefined } }
}

test('athlete, strict OFF and idle coach never request the coach module', async () => {
  const before = attempts
  for (const enabled of [undefined, false, null, 0, 'true']) {
    const f = fixture('coach', enabled === undefined ? false : enabled)
    assert.equal(f.controller.weeklyLetter, undefined)
    assert.deepEqual(f.reads, []); f.cleanup(); f.controller.dispose()
  }
  const athlete = fixture('athlete'); await athlete.controller.refresh()
  assert.equal(athlete.controller.weeklyLetter, undefined)
  assert.equal(button(athlete.root, 'Lav udkast til ugebrev'), undefined)
  assert.equal(athlete.reads.includes('readiness_logs'), false); athlete.cleanup()
  const coach = fixture(); await coach.controller.refresh()
  assert.equal(typeof coach.controller.weeklyLetter, 'function')
  assert.equal(coach.reads.includes('readiness_logs'), false); coach.cleanup()
  assert.equal(attempts, before)
})

test('import failure stays local; explicit retry imports the actual reader, drafts and never sends', async () => {
  const f = fixture(); await f.controller.refresh()
  const input = find(f.root, 'textarea')[0], before = attempts
  const today = calendarDay(new Date())
  f.rows.push(...Array.from({ length: 4 }, (_, i) => ({ id: `synthetic-${i}`, athlete_id: 'synthetic-athlete',
    logged_date: addCalendarDays(today, -i), energy: 1, stress: 5, soreness_level: 5 })))
  try {
    failImport = true
    await button(f.root, 'Lav udkast til ugebrev').click()
    assert.equal(attempts, before + 1); assert.equal(f.reads.includes('readiness_logs'), false)
    const retry = button(f.root, 'Prøv ugebrev igen')
    assert.ok(retry); assert.equal(retry.disabled, false)
    assert.ok(find(f.root, 'p').some(p => p.attributes.role === 'alert' && /Udkastet kunne ikke dannes/.test(p.textContent)))
    assert.equal(input.disabled, false)
    f.controller.draft('Min syntetiske tekst')
    assert.equal(input.value, 'Min syntetiske tekst'); assert.equal(retry.disabled, true)
    f.controller.draft(''); failImport = false
    const wait = delayedImport(), operation = retry.click()
    await wait.ready
    assert.equal(retry.disabled, true); assert.equal(retry.textContent, 'Henter ugebrev …')
    assert.match(f.root.textContent, /Henter ugebrev og ugens grundlag/)
    assert.equal(input.disabled, false)
    await retry.events.get('click')() // even a duplicate handler call cannot start a second import
    assert.equal(attempts, before + 2)
    wait.release(); await operation; wait.reset()
    assert.equal(f.reads.filter(table => table === 'readiness_logs').length, 1)
    assert.match(input.value, /energi|ømhed|belastning/)
    assert.match(f.root.textContent, /registreret søvn, energi, stress og ømhed/)
    assert.equal(button(f.root, 'Lav udkast til ugebrev').disabled, true)
    assert.deepEqual(f.writes, [])
  } finally { failImport = false; gate = undefined; f.cleanup() }
})

test('scope revocation, identity switch and disposal during import never read or draft', async () => {
  for (const change of [f => { f.entry.enabled = false },
    f => { f.entry.athletes = [] }, f => { f.entry.hiddenAthleteIds = new Set(['synthetic-athlete']) },
    f => { f.entry.session.user.id = 'other-owner' },
    f => { f.entry.selectedAthlete = { id: 'other-athlete' }; f.entry.athletes.push({ id: 'other-athlete' }) },
    f => f.cleanup()]) {
    const f = fixture(), wait = delayedImport()
    const operation = f.controller.weeklyLetter()
    await wait.ready; change(f); wait.release()
    await assert.rejects(operation, /Samtalen er ikke længere tilgængelig/)
    wait.reset()
    assert.deepEqual(f.reads, []); assert.deepEqual(f.writes, [])
    assert.equal(f.controller.snapshot().draft, '')
    const before = attempts
    await assert.rejects(f.controller.weeklyLetter())
    assert.equal(attempts, before); f.cleanup()
  }
})

test('typing during the import preserves the draft; an empty retry stays honest', async () => {
  const f = fixture(); await f.controller.refresh()
  const wait = delayedImport()
  try {
    const operation = button(f.root, 'Lav udkast til ugebrev').click()
    await wait.ready
    f.controller.draft('Min tekst under indlæsning')
    wait.release(); await operation; wait.reset()
    assert.equal(f.controller.snapshot().draft, 'Min tekst under indlæsning')
    assert.match(f.root.textContent, /Din tekst er bevaret/)
    f.controller.draft('')
    await button(f.root, 'Lav udkast til ugebrev').click()
    assert.match(f.root.textContent, /Ingen kendte registreringer af søvn, energi, stress eller ømhed/)
    assert.equal(f.controller.snapshot().draft, '')
    assert.deepEqual(f.writes, [])
  } finally { wait.release(); wait.reset(); f.cleanup() }
})
