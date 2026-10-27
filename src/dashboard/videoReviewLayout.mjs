// VC-REVIEW1: kun coachens praesentation. Ingen status- eller skrivehandlinger.
export const DEFAULT_VIDEO_REVIEW = false
export const VIDEO_REVIEW_FLAG = 'entropi:vc-review1'
export function readVideoReviewFlag(storage) {
  try {
    const source = storage === undefined ? globalThis.localStorage : storage
    return source?.getItem(VIDEO_REVIEW_FLAG) === '1'
  } catch {
    return DEFAULT_VIDEO_REVIEW
  }
}

export function videoReviewConclusion({ status, dirty, quality, updating, focus }) {
  const result = reviewState({ status, dirty, quality, updating })
  return { ...result, focus: typeof focus === 'string' && focus.trim() ? focus.trim() : 'Intet fokus angivet i feedbacken.' }
}
function reviewState({ status, dirty, quality, updating }) {
  if (updating) return { title: 'Opdaterer review', next: 'Vent til handlingen er bekræftet.' }
  if (status === 'invalid') return { title: 'Målingen er udeladt', next: 'Vælg Tilbage til kladde, hvis målingen skal gennemgås igen.' }
  if (status === 'shared') return { title: 'Feedback er delt med atleten', next: 'Gennemse den delte besked nedenfor.' }
  if (!['draft', 'coach_approved'].includes(status)) return { title: 'Ukendt reviewstatus', next: 'Kontrollér analysens status før du fortsætter.' }
  const title = status === 'draft' ? 'Afventer coachens gennemgang' : 'Godkendt til baseline, endnu ikke delt'
  const next = dirty ? 'Gem feedback før du fortsætter.'
    : !quality?.canShare ? 'Ret feedbackens fokus og næste handling før deling.'
    : status === 'draft' ? 'Gennemgå feedback og målegrundlag. Vælg derefter Godkend til baseline.'
    : 'Gennemgå beskeden. Vælg derefter Del feedback med atlet.'
  return { title, next }
}

// h og Fragment gives af React i modalen og af et syntetisk DOM i proeverne.
// De eksisterende elementer flyttes uden nye handlers eller kopier af kontroller.
export function renderVideoReviewLayout(h, Fragment, parts, enabled = DEFAULT_VIDEO_REVIEW) {
  const { measurement, packageReview, athleteNote, evidence, feedback, actions, conclusion } = parts
  if (enabled !== true) return h(Fragment, null, measurement, packageReview, athleteNote, evidence, feedback, actions)
  return h(Fragment, null,
    h('section', { 'aria-label': 'Konklusion', style: { borderLeft: '2px solid #67dff5', padding: '0.7rem 0.8rem', color: '#edeae2', overflowWrap: 'anywhere' } },
      h('h2', { style: { fontSize: '1rem', margin: '0 0 0.4rem' } }, 'Konklusion'),
      h('p', null, conclusion.title),
      h('p', { style: { whiteSpace: 'pre-wrap' } }, h('strong', null, 'Atletens fokus: '), conclusion.focus),
      h('p', null, h('strong', null, 'Næste handling: '), conclusion.next)),
    athleteNote, feedback, actions,
    h('details', { style: { marginTop: '1rem' } },
      h('summary', { style: { minHeight: 44, cursor: 'pointer', color: '#edeae2', display: 'list-item', padding: '0.65rem', boxSizing: 'border-box' } }, 'Måling, grafer og grundlag'),
      measurement, packageReview, evidence))
}
