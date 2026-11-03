// Pure presentation contract. No note extraction, default pause or timer policy.
const phases = [
  ['eccentric', 'Sænkning'],
  ['bottom', 'Pause efter sænkning'],
  ['concentric', 'Løft'],
  ['top', 'Pause efter løft'],
]

export function parseTempo(value) {
  if (value == null || (typeof value === 'string' && !value.trim())) return { status: 'missing' }
  if (typeof value !== 'string' || value.length > 64) return { status: 'invalid' }
  // Four single-digit seconds or X (explosive); explicit separators avoid guessing.
  const match = value.trim().match(/^([0-9x])\s*-\s*([0-9x])\s*-\s*([0-9x])\s*-\s*([0-9x])$/i)
  if (!match) return { status: 'invalid' }
  const tokens = match.slice(1).map(token => token.toUpperCase())
  return {
    status: 'valid', notation: tokens.join('-'),
    phases: phases.map(([key, label], index) => ({ key, label,
      seconds: tokens[index] === 'X' ? null : Number(tokens[index]),
      explosive: tokens[index] === 'X',
    })),
  }
}

// Explicit field: numeric seconds, digit string, mm:ss, seconds or minutes.
// Never coerce objects, extract numbers from prose, or invent a default.
export function parsePlannedRest(value) {
  if (value == null || (typeof value === 'string' && !value.trim())) return { status: 'missing' }
  let seconds = null
  if (typeof value === 'number') seconds = value
  else if (typeof value === 'string' && value.length <= 64) {
    const text = value.trim()
    let match = text.match(/^(\d{1,5})(?:\s*(?:s|sek|sec))?$/i)
    if (match) seconds = Number(match[1])
    else if ((match = text.match(/^(\d{1,4}):([0-5]\d)$/))) seconds = Number(match[1]) * 60 + Number(match[2])
    else if ((match = text.match(/^(\d{1,4}(?:[.,]\d{1,2})?)\s*min$/i))) {
      // Decimal minutes must resolve to whole seconds without rounding a plan.
      const hundredths = Math.round(Number(match[1].replace(',', '.')) * 100)
      if ((hundredths * 60) % 100 === 0) seconds = hundredths * 60 / 100
    }
  }
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 86400) return { status: 'invalid' }
  const minutes = Math.floor(seconds / 60), remainder = seconds % 60
  const label = seconds === 0 ? 'Ingen planlagt pause (0 sek.)'
    : minutes === 0 ? `${seconds} sek.`
      : remainder === 0 ? `${minutes} min.` : `${minutes} min. ${remainder} sek.`
  return { status: 'valid', seconds, label }
}
