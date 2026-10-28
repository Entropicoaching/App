// Only legacy dependencies are doubled. Candidate component and handlers are real.
export const s = {}
export const VIDEOCOACH_STATUS = {}
export const VIDEOCOACH_METRICS = []
export const VIDEOCOACH_LIFT_LABELS = {}
export const buildVideoCoachBaselineProfiles = () => []
export const countReadyVideoCoachBaselineProfiles = () => 0
export const videoCoachFeedbackQuality = () => ({})
export const videoCoachVariationLabel = () => ''
export const byggKategoriOpslag = () => ({})
export const kategoriFor = () => ''
export const exerciseSetView = () => ({})
export const videoCoachMetric = () => null
export const videoCoachBaseline = () => null
export const videoCoachMetricText = () => ''
export const videoCoachBaselineText = () => ''
export const parsePlannedRpe = () => null
export const buildLiftSeries = () => ({ plannedData: planPresent ? legacyPlan : [], actualData: legacyActual, hasData: false, data: legacyActual })
export const primaerKurve = () => ({ data: [], note: '' })
export const primaerOverskrift = () => ''
export const danskDag = () => ''
export const BarChart = () => null
export const LineChart = props => createElement('synthetic-chart', props)
export const ScatterPlot = () => null
export default function LegacyChild() { return null }
import { createElement } from 'react'
// Deterministic chart/plan seam. Evidence and candidate render/handlers are real.
export const legacyActual = [{ y: 777, label: 'legacy-only' }]
export const legacyPlan = [{ y: 888, label: 'planned-only' }]
export let planPresent = true
export const setPlanPresent = value => { planPresent = value }
