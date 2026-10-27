// Peripheral home widgets only. Training and mobility modules are imported intact.
export default function PeripheralWidget() { return null }
export const s = new Proxy({}, { get: () => ({}) })
export const today = () => '2026-10-27'
export const WEEKDAYS_LONG = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
export const weekStartDate = () => new Date('2026-10-26T12:00:00Z')
export const fmtWeekRange = () => ''
export const parsePlannedRpe = () => null
export const shouldNudgeCheckin = () => false
export const compareReadiness = () => null
export const readinessComparisonText = () => ''
export const readinessTrainingNote = () => null
export const summarizeReadinessForCoach = () => null
export const lastCheckinDrivenChange = () => null
export const checkinNoteTimingText = () => ''
export const dinUge = () => ({})
export const startRestPause = () => { throw Error('Unexpected pause in synthetic test') }
export const WeeklyTonnageChart = PeripheralWidget
export const E1RMChart = PeripheralWidget
export const ReadinessSparkline = PeripheralWidget
export const weightTrendText = () => ''
export const renderAthleteShortcuts = () => null
export const revealWeek = () => {}
