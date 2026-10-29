export function conclusionSentence(value) {
  if (typeof value !== 'string') return ''
  const clean = value.trim().replace(/\s+/g, ' ')
  return clean.match(/^.*?[.!?](?=\s|$)/u)?.[0] || (clean ? clean + '.' : '')
}

// Input is the same approved, scoped and sorted selection as the headline.
export function previousConclusions(reviews) {
  const current = reviews[0]
  if (!current) return []
  return reviews.slice(1).filter(row => row.lift === current.lift)
}

export function renderConclusionHistory(h, reviews) {
  const previous = previousConclusions(reviews)
  if (!previous.length) return null
  return h('details', { 'aria-label': 'Tidligere konklusioner', style: { minWidth: 0, overflowWrap: 'anywhere' } },
    h('summary', { style: { minHeight: 44, padding: '0.65rem', boxSizing: 'border-box', cursor: 'pointer', color: '#edeae2' } },
      `Tidligere konklusioner (${previous.length})`),
    h('ul', null, ...previous.map(row => h('li', { key: row.id, style: { lineHeight: 1.5 } },
      h('time', { dateTime: row.analyzed_at.slice(0, 10) }, row.analyzed_at.slice(0, 10)),
      ': ' + conclusionSentence(row.athlete_feedback.focus[0].text)))))
}
