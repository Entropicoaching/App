import './coachTemplateLoader.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './coachTemplateJsx.mjs'
import { nodes } from './coachTemplateDom.mjs'
import { createCoachTemplateSender, saveCoachTemplates } from './coachTemplateMessages.mjs'
const { default: ForsideView } = await import('./ForsideView.jsx')
const { default: CoachActions } = await import('./CoachActions.jsx')

test('counterprobe: actual home view forwards flag, coach and sender; OFF preserves legacy list', () => {
  const props = { athletes: [], hiddenAthleteIds: new Set(), calendarWeeks: {}, coachPriorityItems: [], loading: true }
  assert.equal(nodes(ForsideView(props), n => n.type === CoachActions).length, 0)
  const send = () => { throw Error('No automatic send') }
  const tree = ForsideView({ ...props, coachTemplateMessages: true, coachId: 'synthetic-coach', sendTemplateMessage: send })
  const row = nodes(tree, n => n.type === CoachActions)[0]
  assert.equal(row.props.enabled, true)
  assert.equal(row.props.templateMessages, true)
  assert.equal(row.props.coachId, 'synthetic-coach')
  assert.equal(row.props.sendTemplateMessage, send)
  const legacy = nodes(ForsideView({ ...props, coachActions: true }), n => n.type === CoachActions)[0]
  assert.equal(legacy.props.templateMessages, false)
})
test('counterprobe: failed insert retries once and never reports success', async () => {
  let attempts = 0, successes = 0
  const send = createCoachTemplateSender({ enabled: true, getScope: () => ({ enabled: true, coachId: 'synthetic-coach', athletes: [{ id: 'synthetic-a' }] }),
    database: { from() { return { async insert() { attempts++; return { error: Error('synthetic failure') } } } } }, onSent() { successes++ } })
  for (let i = 0; i < 2; i++) await assert.rejects(send({ coachId: 'synthetic-coach', athleteId: 'synthetic-a', text: 'Testtekst' }))
  assert.equal(attempts, 2); assert.equal(successes, 0)
})
test('counterprobe: denied storage write remains visible to caller', () => {
  assert.throws(() => saveCoachTemplates({ setItem() { throw Error('denied') } }, 'synthetic-coach', [{ name: 'Test', text: 'Hej {atlet}' }]), /denied/)
})
test('synthetic FS syntax check of exact Dashboard JSX and explicit new import paths', () => {
  const flat = new URL('./Dashboard.jsx', import.meta.url)
  const source = readFileSync(existsSync(flat) ? flat : new URL('../Dashboard.jsx', import.meta.url), 'utf8')
  const translated = jsx(source).replace(/^import .* from .*$/gm, '').replace('export default function Dashboard', 'function Dashboard')
  assert.doesNotThrow(() => new Function(translated))
  assert.match(source, /coachTemplateMessages = COACH_TEMPLATE_MESSAGES_ENABLED/)
  assert.match(source, /coachActions: true/)
  assert.match(source, /coachTemplateMessages, coachId: session\?\.user\?\.id, sendTemplateMessage/)
})
