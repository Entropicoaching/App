const ACTION_WORDS = /\b(hold|bevar|pres|skub|byg|spænd|spaend|gentag|sammenlign|stop|reducér|reducer|giv|overvej|vælg|vaelg|kontrollér|kontroller|justér|juster|ret|se|kør|koer|behold|accelerér|accelerer|styr|træk|traek|lad|gør|goer|sæt|saet|ram|løft|loeft|rejs|find|tag|få|faa)\b/i
const MEASUREMENT_WORDS = /\b(\d+(?:[.,]\d+)?\s*(?:%|cm|mm|m\/s|grader?)|sticking point|bane-effektivitet|tracker-confidence)\b/i

function feedbackLines(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => typeof item === 'string' ? item : item?.text)
      .map(text => String(text || '').trim())
      .filter(Boolean)
  }
  return String(value || '').split(/\r?\n/).map(text => text.trim()).filter(Boolean)
}

function normalizedWords(value) {
  return new Set(String(value || '').toLocaleLowerCase('da-DK')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9æøå ]/gi, ' ')
    .split(/\s+/).filter(word => word.length > 2))
}

function overlapRatio(left, right) {
  const a = normalizedWords(left)
  const b = normalizedWords(right)
  if (!a.size || !b.size) return 0
  const shared = [...a].filter(word => b.has(word)).length
  return shared / Math.min(a.size, b.size)
}

function joinDanish(items) {
  if (items.length < 2) return items[0] || ''
  return `${items.slice(0, -1).join(', ')} og ${items.at(-1)}`
}

export function videoCoachFeedbackQuality(feedback) {
  const works = feedbackLines(feedback?.works)
  const focus = feedbackLines(feedback?.focus)
  const nextSet = feedbackLines(feedback?.next_set)
  const blockers = []
  const warnings = []

  if (!focus.length) blockers.push('ét tydeligt fokus')
  if (!nextSet.length) blockers.push('én handling til næste sæt')
  if (nextSet.length > 1) blockers.push('ét prioriteret cue i stedet for flere')

  if (focus[0] && nextSet[0] && overlapRatio(focus[0], nextSet[0]) >= 0.78)
    blockers.push('et cue, der omsætter observationen til en ny handling')

  if (nextSet[0] && !ACTION_WORDS.test(nextSet[0]))
    warnings.push('Skriv cue’et som en konkret handling, atleten kan udføre')
  if (nextSet[0] && MEASUREMENT_WORDS.test(nextSet[0]))
    warnings.push('Hold måltal i begrundelsen og cue’et enkelt')
  if (nextSet[0] && nextSet[0].length > 180)
    warnings.push('Forkort cue’et, så det kan huskes under løftet')
  if (!works.length)
    warnings.push('Tilføj gerne en ærlig positiv observation, hvis målingen understøtter den')

  const canShare = blockers.length === 0
  const needsReview = canShare && warnings.length > 0
  return {
    canShare,
    needsReview,
    level: canShare ? (needsReview ? 'review' : 'strong') : 'blocked',
    blockers,
    warnings,
    works,
    focus,
    nextSet,
    title: canShare
      ? needsReview ? 'Brugbart udkast · tjek formuleringen' : 'Feedback klar til atleten'
      : 'Feedback mangler retning',
    detail: canShare
      ? needsReview ? warnings[0] : 'Én observation og ét konkret cue hænger tydeligt sammen.'
      : `Tilføj ${joinDanish(blockers)} før deling.`,
  }
}
