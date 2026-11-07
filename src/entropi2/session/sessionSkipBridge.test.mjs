import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse } from '@babel/parser'

const source = relative => readFile(new URL(relative, import.meta.url), 'utf8')
test('source bridge: actual AthleteView passes original guarded skip actions only outside preview', async () => {
  const text = await source('../../AthleteView.jsx')
  const ast = parse(text, { sourceType: 'module', plugins: ['jsx'] })
  const nodes = []
  const visit = value => {
    if (!value || typeof value !== 'object') return
    if (value.type === 'JSXOpeningElement' && value.name?.name === 'HomeSession') nodes.push(value)
    for (const v of Object.values(value)) if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v)
  }
  visit(ast); assert.equal(nodes.length, 1)
  const attrs = nodes[0].attributes
  const readOnly = attrs.find(a => a.name?.name === 'readOnly')
  assert.equal(readOnly.value.expression.name, 'e2ReadOnly')
  const bridge = attrs.find(a => a.type === 'JSXSpreadAttribute' && a.argument.type === 'ConditionalExpression' &&
    a.argument.consequent.properties?.some(p => p.key.name === 'onSkipSet'))
  assert.ok(bridge)
  assert.equal(bridge.argument.test.operator, '!'); assert.equal(bridge.argument.test.argument.name, 'e2ReadOnly')
  assert.deepEqual(bridge.argument.consequent.properties.map(p => [p.key.name, p.value.name]),
    [['onSkipSet', 'skipSet'], ['onSkipExercise', 'skipExercise'], ['onUnskipSet', 'unskipSet']])
  assert.equal(bridge.argument.alternate.properties.length, 0)
  assert.match(text, /guardTrainingActions\(lavSaetSkrivning\(/)
  assert.match(text, /\}\), canWriteTraining, \[[^\]]*"skipSet", "skipExercise", "unskipSet"/)
  assert.match(text, /role === 'athlete' && !coachAthleteId && !onExitPreview && athlete.user_id === session.user.id/)
  assert.match(await source('../athleteEntry.mjs'), /default as HomeSession.*home\/HomeSession.mjs/)
  const home = await source('../home/HomeSession.mjs')
  assert.match(home, /mountHomeSession\(root.current, \(\) => latest.current/)
  assert.match(home, /props.enabled === true \? \{ \.\.\.props, sessionRecordReceipts \} : props/)
  const bridgeSource = await source('../home/homeSessionBridge.mjs')
  assert.match(bridgeSource, /import\('..\/session\/sessionView.mjs'\)/)
  assert.match(bridgeSource, /return \{ \.\.\.p, enabled: !!valid/)
  assert.match(bridgeSource, /selection.today !== today/)
  assert.match(await source('./SessionScreen.mjs'), /mountSession\(root.current, \(\) => latest.current\)/)
})
