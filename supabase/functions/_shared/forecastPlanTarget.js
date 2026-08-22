function isText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizedText(value) {
  return isText(value) ? value.trim() : null
}

/** Næste mandag i lokal uge-logik, når der ikke findes en planlagt måluge. */
export function fallbackForecastStartDate(now = new Date()) {
  const nextMonday = new Date(now.getTime() + (((7 - ((now.getDay() + 6) % 7)) % 7 || 7)) * 86400000)
  return nextMonday.toISOString().slice(0, 10)
}

/**
 * Periodiseringsplanen er den kanoniske kilde til måluge, dato og blok,
 * når den allerede indeholder den umiddelbart næste, tomme uge.
 * @param {{ sourceWeek: any, plannedWeek?: any, now?: Date }} args
 */
export function forecastTargetForWeek({ sourceWeek, plannedWeek = null, now = new Date() }) {
  const targetWeekNumber = Number(sourceWeek?.week_number || 0) + 1
  const isMatchingPlannedWeek = Boolean(
    plannedWeek
      && Number(plannedWeek.week_number) === targetWeekNumber
      && isText(plannedWeek.id),
  )

  if (isMatchingPlannedWeek) {
    return {
      id: plannedWeek.id,
      is_planned: true,
      week_number: targetWeekNumber,
      block_name: normalizedText(plannedWeek.block_name),
      block_description: normalizedText(plannedWeek.block_description),
      start_date: normalizedText(plannedWeek.start_date),
    }
  }

  return {
    id: null,
    is_planned: false,
    week_number: targetWeekNumber,
    block_name: normalizedText(sourceWeek?.block_name),
    block_description: null,
    start_date: fallbackForecastStartDate(now),
  }
}

/** En planlagt uge med indhold må aldrig overskrives af forecastet. */
export function plannedWeekIsEmpty(plannedWeek) {
  if (!plannedWeek) return true
  const sessions = Array.isArray(plannedWeek.sessions) ? plannedWeek.sessions : []
  return sessions.length === 0
}

export function targetWeekIdFromState(state) {
  return normalizedText(state?.program?.target_week?.id)
}

export function sameTargetWeekId(left, right) {
  return targetWeekIdFromState(left) === normalizedText(right)
}

export function sameTargetBlock(state, payload) {
  const stateBlock = normalizedText(state?.program?.target_week?.block_name)
  const payloadBlock = normalizedText(payload?.blockName)
  return stateBlock === payloadBlock
}
