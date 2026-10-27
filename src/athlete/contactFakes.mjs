export const s = new Proxy({}, { get: () => ({}) })
export const today = () => '2026-10-27'
export const supabase = new Proxy({}, { get() { throw Error('Backend forbidden') } })
export function runGuardedWrite() { throw Error('Write forbidden') }
export function runGuardedRead() { throw Error('Read forbidden') }
export function recordSilentFail() { throw Error('Storage write forbidden') }
let playbackOn = false
export const setPlayback = value => { playbackOn = value }
export const videoFeedbackPlaybackEnabled = () => playbackOn
export const VideoFeedbackPlayback = props => ({ type: 'synthetic-playback', props, children: [] })
export const videoCoachPersonalBaselineAthleteText = () => ''
export const videoCoachPersonalBaselineForAnalysis = () => null
export const VIDEOCOACH_LIFT_LABELS = { squat: 'Squat' }
export const videoCoachVariationLabel = () => 'Normal'
export const athleteVideoPathPreview = () => null
export const logFrontendError = () => {}
export const ugeBesked = () => ''
export const parseInputNumber = Number
export const formatMessageTime = () => ''
