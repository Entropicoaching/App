// VC-FORENKL4: aktiveres kun ved et eksplicit kodevalg ved integration.
export const DEFAULT_VIDEOCOACH_FORENKL4 = false

export function renderVideoCoachChoices(h, { enabled = DEFAULT_VIDEOCOACH_FORENKL4,
  athleteId, setInstant, setOpen }) {
  if (enabled !== true) return null
  const choose = instant => {
    if (!athleteId) return
    setInstant(instant)
    setOpen(true)
  }
  const style = { minHeight: 44, padding: '0.65rem', cursor: 'pointer' }
  return h('section', { 'aria-label': 'Vælg videoforløb' },
    h('p', null, 'Send råvideoen direkte, eller se din egen lokale analyse før du vælger at sende.'),
    h('button', { type: 'button', style, onClick: () => choose(false) }, 'Send video til coach'),
    h('button', { type: 'button', style, onClick: () => choose(true) }, 'Se egen analyse først'))
}

// Kaldes kun efter bekræftet UPDATE. Et lukket eller udskiftet forløb må ikke åbnes igen.
export function returnCompletedVideoToReview({ enabled = DEFAULT_VIDEOCOACH_FORENKL4,
  active, pending, data, athletes, setVideoCoachOpen, setVideoReviewRequest, openProfile }) {
  if (enabled !== true || !active || !data?.id || !pending ||
      data.athlete_id !== pending.athleteId ||
      data.client_analysis_id !== pending.clientAnalysisId) return false
  const athlete = athletes.find(item => item.id === data.athlete_id)
  if (!athlete) return false
  setVideoCoachOpen(false)
  setVideoReviewRequest({ item: { id: data.id, athlete_id: data.athlete_id },
    token: `${data.id}:${Date.now()}` })
  openProfile(athlete, 'analyse')
  return true
}
