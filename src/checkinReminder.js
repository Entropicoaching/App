// ORDRE 267 · commit 3 — "påmindelsen der ikke er en mail": Dagens pas viser
// en rolig linje øverst, ikke en mail eller notifikation, når ugens check-in
// mangler og ugen er ved at være slut. Ren funktion, samme mønster som
// nextSet.js/restBetweenSets.js — enhedstestet uden en mountet komponent.

// weekStartStr/weekEndStr/todayStr: 'yyyy-mm-dd'. loggedDates: alle kendte
// parathedslog-datoer (i dag + historik), kun datoen bruges.
export function shouldNudgeCheckin({ weekStartStr, weekEndStr, todayStr, loggedDates }) {
  if (!weekStartStr || !weekEndStr || !todayStr) return false
  if (todayStr < weekStartStr || todayStr > weekEndStr) return false
  if (daysBetween(todayStr, weekEndStr) > 1) return false // kun de sidste to dage af ugen — "ved at være slut"
  return !(loggedDates || []).some(d => d >= weekStartStr && d <= weekEndStr)
}

function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr + 'T12:00:00Z')
  const b = new Date(toStr + 'T12:00:00Z')
  return Math.round((b - a) / 86400000)
}
