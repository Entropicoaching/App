export function createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } } }
export function h(type, props, unused, ...children) { return createElement(type, props, ...children) }
export const useMemo = fn => fn()
export const useState = value => [typeof value === 'function' ? value() : value, () => {}]
export const s = new Proxy({}, { get: () => ({}) })
export const readinessSignal = () => ({})
export default function LazyBoundary() { return null }

export class Element {
  constructor(tag, attrs = {}) { this.tagName = tag; this.attrs = attrs; this.children = []; this.ownText = '' }
  get textContent() { return this.ownText + this.children.map(c => c.textContent).join('') }
}
export function mount(tree) {
  if (tree == null || tree === false || tree === true) return new Element('empty')
  if (typeof tree !== 'object') { const el = new Element('text'); el.ownText = String(tree); return el }
  if (typeof tree.type === 'function') return mount(tree.type(tree.props))
  const el = new Element(tree.type || 'fragment', tree.props)
  el.children = (tree.props.children || []).flat(Infinity).map(mount)
  return el
}
export function find(root, attr) { return [...(root.attrs[attr] != null ? [root] : []), ...root.children.flatMap(c => find(c, attr))] }

export let client
export function setClient(value) { client = value }
export const supabase = new Proxy({}, { get(_, key) { if (!client) throw Error('No synthetic client'); return client[key]?.bind(client) } })
export const ATHLETE_LOGS_LIMIT = 2000
export const COACH_NOTE_SIGNAL_ENABLED = false
export const COACH_ACTIONS_ENABLED = false
// Other coach handlers are not called by this fixture.
export const summarizeRefreshResults = () => { throw Error('Unexpected handler') }
export const filterDraftVideoReviews = summarizeRefreshResults, filterOpenTrainingSignals = summarizeRefreshResults, summarizeCoachMessages = summarizeRefreshResults
export const withRetry = summarizeRefreshResults, filterOpenAutomationAlerts = summarizeRefreshResults, saetSmerteSignaler = summarizeRefreshResults, medSaetSmerte = summarizeRefreshResults
export const planlagteReps = summarizeRefreshResults, taellerIKg = summarizeRefreshResults, logTegn = summarizeRefreshResults
export const VIDEOCOACH_BASELINE_VERSION = 'synthetic'
export const normaliserRekorder = summarizeRefreshResults, bedsteRekorder = summarizeRefreshResults, tungeRekorder = summarizeRefreshResults
export const danskDag = summarizeRefreshResults, coachActionsEnabled = summarizeRefreshResults, actionSessions = summarizeRefreshResults
