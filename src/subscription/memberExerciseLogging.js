const BODYWEIGHT_REP_EXERCISE_IDS = new Set([
  'ab-wheel',
  'home-close-grip-push-up',
  'home-dead-bug',
])

const MAX_TIMER_SECONDS = 60 * 60
const TIME_UNIT_PATTERN = '(?:s|sek(?:und(?:er)?)?|sec(?:ond(?:s)?)?|m|min(?:ut(?:ter)?)?)'
const TIME_VALUE_PATTERN = '(\\d+(?:[.,]\\d+)?)'
const TIMED_REPS_PATTERN = new RegExp(
  `^\\s*${TIME_VALUE_PATTERN}(?:\\s*(?:-|–|—|til)\\s*${TIME_VALUE_PATTERN})?\\s*(${TIME_UNIT_PATTERN})\\s*$`,
  'i',
)

function finitePositiveSeconds(value) {
  return Number.isInteger(value) && value > 0 && value <= MAX_TIMER_SECONDS
}

function secondsFor(value, unit) {
  const numeric = Number(String(value).replace(',', '.'))
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const multiplier = /^(?:m|min)/i.test(unit) ? 60 : 1
  const seconds = Math.round(numeric * multiplier)
  return finitePositiveSeconds(seconds) ? seconds : null
}

// Only explicit seconds/minutes prescriptions are timed. Bare numbers and rep
// ranges are deliberately ignored so a normal "8–12" prescription can never
// turn into a timer by inference.
export function parseTimedPrescription(prescription) {
  if (!prescription || typeof prescription !== 'object' || Array.isArray(prescription)) return null

  if (finitePositiveSeconds(prescription.durationSeconds)) {
    return {
      minSeconds: prescription.durationSeconds,
      maxSeconds: prescription.durationSeconds,
      countdownSeconds: prescription.durationSeconds,
      source: 'duration-seconds',
    }
  }

  const explicitUnit = String(prescription.unit || prescription.durationUnit || '')
  const explicitValue = prescription.targetDuration ?? prescription.duration ?? (typeof prescription.reps === 'number' ? prescription.reps : null)
  if (explicitValue != null && new RegExp(`^${TIME_UNIT_PATTERN}$`, 'i').test(explicitUnit)) {
    const seconds = secondsFor(explicitValue, explicitUnit)
    if (seconds) {
      return {
        minSeconds: seconds,
        maxSeconds: seconds,
        countdownSeconds: seconds,
        source: 'explicit-time-unit',
      }
    }
  }

  const match = String(prescription.reps || '').match(TIMED_REPS_PATTERN)
  if (!match) return null
  const first = secondsFor(match[1], match[3])
  const second = match[2] ? secondsFor(match[2], match[3]) : first
  if (!first || !second) return null
  const minSeconds = Math.min(first, second)
  const maxSeconds = Math.max(first, second)
  return {
    minSeconds,
    maxSeconds,
    // A range starts at its conservative lower bound. The timer is a visible
    // aid only; this value is never persisted as repetitions.
    countdownSeconds: minSeconds,
    source: 'explicit-time-unit',
  }
}

export function formatDurationSeconds(seconds) {
  if (!finitePositiveSeconds(seconds) && seconds !== 0) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return minutes ? `${minutes}:${String(remainder).padStart(2, '0')}` : `${remainder} sek.`
}

export function formatTimedPrescription(value) {
  if (!value) return null
  if (value.minSeconds === value.maxSeconds) return formatDurationSeconds(value.minSeconds)
  return `${formatDurationSeconds(value.minSeconds)}–${formatDurationSeconds(value.maxSeconds)}`
}

export function isMemberBodyweightMovement(movement) {
  const explicitMode = movement?.loadMode || movement?.prescription?.loadMode
  if (explicitMode === 'bodyweight') return true
  if (explicitMode && explicitMode !== 'external-load') return false
  return BODYWEIGHT_REP_EXERCISE_IDS.has(String(movement?.exerciseId || ''))
}

export function timedMovementInSession(session) {
  if (!Array.isArray(session?.movements)) return null
  for (const movement of session.movements) {
    const timed = parseTimedPrescription(movement?.prescription)
    if (timed) return { movement, timed }
  }
  return null
}
