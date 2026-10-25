// Kun en kladde. Ingen afsendelse eller skrivning til maalinger.
export function openVideoFeedbackFollowUp(analysis, actions, liftLabel, variationLabel) {
  const parts = []
  if (typeof analysis?.analyzed_at === 'string' && analysis.analyzed_at.trim()) {
    const value = analysis.analyzed_at
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value)
    if (match) {
      const [, year, month, day] = match
      const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
      const date = new Date(value)
      if (calendar.getUTCFullYear() === Number(year) && calendar.getUTCMonth() === Number(month) - 1 &&
          calendar.getUTCDate() === Number(day) && Number.isFinite(date.getTime())) {
        parts.push(date.toLocaleDateString('da-DK'))
      }
    }
  }
  if (typeof analysis?.lift === 'string' && analysis.lift.trim()) {
    parts.push(typeof liftLabel === 'string' && liftLabel.trim() ? liftLabel.trim() : analysis.lift.trim())
    if (typeof analysis.variation === 'string' && analysis.variation.trim() &&
        typeof variationLabel === 'string' && variationLabel.trim()) parts.push(variationLabel.trim())
  }
  const question = `Jeg har et spørgsmål til din videofeedback${parts.length ? ` (${parts.join(', ')})` : ''}: `
  actions.setMessageInput(previous => previous.includes(question) ? previous : previous ? `${previous}\n${question}` : question)
  actions.setMsgTrack('teknik')
  actions.setTab('beskeder')
}
