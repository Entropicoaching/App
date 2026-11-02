export const s = new Proxy({}, { get: () => ({}) })
export const today = () => '2026-10-27'
// E2-ATLET-LAEST1: en prøve kan vælge en syntetisk backend og læsevagt; uden valg er alt forbudt som før.
let backend = null, guardedRead = null
export const setBackend = (client, read = null) => { backend = client; guardedRead = read }
export const supabase = new Proxy({}, { get(target, key) { if (backend) return backend[key]; throw Error('Backend forbidden') } })
export function runGuardedWrite() { throw Error('Write forbidden') }
export function runGuardedRead(...args) { if (guardedRead) return guardedRead(...args); throw Error('Read forbidden') }
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
