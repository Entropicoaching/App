import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { install } from './hjem2Loader.mjs'
import { jsx } from './hjem2Jsx.mjs'
import { nodes, text } from './hjem2Dom.mjs'
import { timestampContent } from '../entropi2/conversation/conversationModel.mjs'

// Actual copied JSX modules; the existing synthetic element adapter is not React.
const legacy = install()
const target = new URL('./contactBaseBeskederTab.jsx', import.meta.url).href
const dom = new URL('./hjem2Dom.mjs', import.meta.url).href
const homes = new Set(['./HjemTab.jsx', './EnkelHjemTab.jsx'].map(p => new URL(p, import.meta.url).href))
const loader = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './ForsideGrafer.jsx' && homes.has(context.parentURL))
      return { url: 'data:text/javascript,export const ReadinessSparkline=()=>null,WeeklyTonnageChart=()=>null,E1RMChart=()=>null', shortCircuit: true }
    if (['./weightTrend.mjs', '../readinessInsight.js'].includes(specifier) && homes.has(context.parentURL))
      return { url: new URL(specifier, context.parentURL).href, shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    return url === target ? { format: 'module', shortCircuit: true,
      source: `import { h as __h } from ${JSON.stringify(dom)};\n${jsx(readFileSync(new URL(url), 'utf8'))}` }
      : next(url, context)
  },
})
test.after(() => { loader.deregister(); legacy.deregister() })
const Home = (await import('./HjemTab.jsx')).default
const SimpleHome = (await import('./EnkelHjemTab.jsx')).default
const Messages = (await import('./contactBaseBeskederTab.jsx')).default
const content = timestampContent({ id: 'synthetic-video' }, 3.5, 'Hold brystet oppe.') + ' \r\n'
const message = Object.freeze({ sender_role: 'coach', category: 'teknik', pinned: true,
  id: 'synthetic-message', content, created_at: '2026-11-02T12:00:00Z' })

test('both actual legacy home cards hide the same timed suffix and retain navigation', () => {
  for (const Component of [Home, SimpleHome]) {
    const routes = []
    const props = { tab: 'hjem', onHoliday: false, mereOpen: true, role: 'athlete',
      athlete: { id: 'synthetic-athlete' }, allWeeks: [], currentWeek: null, exerciseLogs: [],
      messages: [message], sharedVideoAnalyses: [], weightLogs: [], readinessHistory: [], readinessInput: {}, readinessLog: [],
      prs: [], liftProgress: [], weeklyTonnage: [], exerciseHistory: {}, logInputs: {}, weightInput: '',
      days: Array(7).fill('dag'), months: Array(12).fill('måned'), now: new Date('2026-11-03T12:00:00Z'),
      formatMsgTime: () => 'Syntetisk tidspunkt', setTab: route => routes.push(route) }
    const tree = Component(props)
    assert.match(text(tree), /Video ved 3,5 s\nHold brystet oppe\./)
    assert.doesNotMatch(text(tree), /Video-id:|synthetic-video/)
    nodes(tree, n => n.type === 'div' && typeof n.props.onClick === 'function' && /Seneste besked fra coach/.test(text(n)))[0].props.onClick()
    assert.deepEqual(routes, ['beskeder'])
    assert.equal(message.content, content)
  }
})

test('actual legacy pinned and full message bodies hide metadata without removing the technique video section', () => {
  const tree = Messages({ messages: [message], msgTrack: 'teknik', sharedVideoAnalyses: [],
    sharedVideoLoading: false, sharedVideoError: '', formatMsgTime: () => 'Syntetisk tidspunkt' })
  assert.equal((text(tree).match(/Hold brystet oppe\./g) || []).length, 2)
  assert.match(text(tree), /Fastgjorte beskeder|Videofeedback fra din coach/)
  assert.doesNotMatch(text(tree), /Video-id:|synthetic-video/)
  assert.equal(message.content, content)
})
