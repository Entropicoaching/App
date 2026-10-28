// Synthetic element tree only. No browser, storage, network or React dependency.
export const s = new Proxy({}, { get: () => ({}) })
export const today = () => '2026-10-25'
export const useRef = () => ({ current: null })
export function h(type, props, _unused, ...children) {
  if (typeof type === 'function') return type({ ...props, children })
  return { type, props: props || {}, children: children.flat(Infinity).filter(c => c != null && c !== false && c !== true) }
}
export const createElement = (type, props, ...children) => h(type, props, null, ...children)
export function nodes(tree, predicate = () => true) {
  if (!tree || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...tree.children.flatMap(child => nodes(child, predicate))]
}
export const text = tree => tree == null ? '' : typeof tree === 'object' ? tree.children.map(text).join('') : String(tree)
export const forbidden = () => { throw new Error('Forbidden synthetic I/O or unexpected dependency call') }
export const supabase = new Proxy({}, { get: () => forbidden })
export const shouldNudgeCheckin = () => false
export const weekStartDate = () => null
export const fmtWeekRange = forbidden
export const WEEKDAYS_LONG = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
export const naesteLabel = () => 'Næste sæt'
export const dinUge = () => ({})
export const weightTrendText = forbidden
export const renderAthleteShortcuts = forbidden
export const revealWeek = forbidden
export const restSecondsForExercise = forbidden
export const startRestPause = forbidden
export const isMainLift = forbidden
export const compareReadiness = forbidden
export const readinessComparisonText = forbidden
export const readinessTrainingNote = forbidden
export const summarizeReadinessForCoach = forbidden
export const lastCheckinDrivenChange = forbidden
export const checkinNoteTimingText = forbidden
export const WeeklyTonnageChart = forbidden
export const E1RMChart = forbidden
export const ReadinessSparkline = forbidden

export const useState = initial => [typeof initial === 'function' ? initial() : initial, forbidden]
