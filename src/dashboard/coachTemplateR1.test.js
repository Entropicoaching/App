import './coachTemplateLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const { default: CoachActions } = await import('./CoachActions.jsx')
const { TemplateEditor } = await import('./CoachTemplateMessage.jsx')
import { mount, button, field, text } from './coachTemplateDom.mjs'
import { createCoachTemplateSender, saveCoachTemplates, readCoachTemplates, fillCoachTemplate } from './coachTemplateMessages.mjs'

test('R1: Dashboard keeps loader contract in LF and CRLF and current base option', () => {
  const flat = new URL('./Dashboard.jsx', import.meta.url)
  const source = readFileSync(existsSync(flat) ? flat : new URL('../Dashboard.jsx', import.meta.url), 'utf8')
  for (const ending of ['\n', '\r\n']) {
    const value = source.replace(/\r?\n/g, ending)
    assert.match(value, /lavLaesninger\(\{[\s\S]*?setCoachActionsStatus,/)
    assert.match(value, /coachPlanCopyEnabled = false/)
    assert.match(value, /currentProgramAthleteRef:[\s\S]+?\.\.\.\(coachTemplateMessages === true/)
  }
  assert.equal(CoachActions({ enabled: false, templateMessages: true }), null)
})
test('R1: hostile template text stays literal, storage is coach scoped', () => {
  const data = new Map(), storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) }
  const rows = [{ name: 'Test', text: 'Hej {atlet} <img onerror=alert(1)>' }]
  saveCoachTemplates(storage, 'coach/a', rows)
  assert.deepEqual(readCoachTemplates(storage, 'coach/b'), [])
  assert.equal(fillCoachTemplate(rows[0].text, "$'&{atlet}"), "Hej $'&{atlet} <img onerror=alert(1)>")
  assert.throws(() => saveCoachTemplates(storage, 'coach/a', Array(51).fill(rows[0])))
  const app = mount(TemplateEditor, { coachId: 'coach/a', athlete: { id: 'a', name: '<synthetic>' }, storage: () => storage,
    sendMessage() { throw Error('Must never send while choosing') } })
  button(app.render(), 'Brug Test').onClick()
  assert.match(field(app.render(), 'Beskedkladde').value, /<synthetic>/)
  assert.match(text(app.render()), /Intet sendes automatisk/)
})
test('R1: changing coach scope after sender creation rejects stale recipient', async () => {
  let scope = { enabled: true, coachId: 'c1', athletes: [{ id: 'a1' }] }, count = 0
  const send = createCoachTemplateSender({ enabled: true, getScope: () => scope,
    database: { from() { return { async insert() { count++; return {} } } } } })
  scope = { enabled: true, coachId: 'c2', athletes: [{ id: 'a2' }] }
  await assert.rejects(send({ coachId: 'c1', athleteId: 'a1', text: 'Syntetisk' }))
  assert.equal(count, 0)
  assert.equal(await send({ coachId: 'c2', athleteId: 'a2', text: 'Syntetisk' }), true)
  assert.equal(count, 1)
})
