import { antalOrd } from '../../antalOrd.mjs'
// Input: the ready output of weeklyReportModel for the current coach/day.
// Select by athlete id, never by row position or name. No reads, clock or sends.
const count = value => Number.isSafeInteger(value) && value >= 0
const days = value => count(value) && value <= 7

/** Returns an editable suggestion, or null when the selected report is unavailable.
 * The caller owns freshness and authorization, as for weeklyReportModel itself.
 * This module is deliberately not connected to any screen or sending action.
 */
export function createCoachMessageDraft(report, athleteId) {
  if (report?.ready !== true || typeof athleteId !== 'string' || !athleteId.trim() ||
    !Array.isArray(report.rows)) return null
  const matches = report.rows.filter(row => row?.athlete?.id === athleteId)
  if (matches.length !== 1) return null
  const { training: t, nutrition: n } = matches[0]
  const sentences = ['Hej! Her er et kort overblik over dine registreringer.']

  if (count(t?.completed)) {
    sentences.push(count(t?.planned)
      ? `I din aktuelle programuge er ${t.completed} pas logget mod ${t.planned} ${antalOrd(t.planned, 'planlagt', 'planlagte')}.`
      : `I din aktuelle programuge er ${t.completed} pas logget; antal planlagte pas er ukendt.`)
    sentences.push('Et logget pas betyder, at mindst ét sæt er registreret.')
  } else {
    sentences.push('Jeg mangler et sikkert overblik over ugens loggede pas.')
  }
  if (typeof t?.rpe === 'number' && Number.isFinite(t.rpe) && t.rpe >= 0 &&
    t.rpe <= 10 && count(t.rpeCount) && t.rpeCount > 0) {
    sentences.push(`I seneste loggede pas var den gennemsnitlige oplevede anstrengelse (RPE) ${t.rpe.toFixed(1).replace('.', ',')} på tværs af ${t.rpeCount} ${antalOrd(t.rpeCount, 'registrering', 'registreringer')}.`)
  }
  if (days(n?.logged)) {
    sentences.push(`Der er logget kost på ${n.logged} af de seneste 7 dage.`)
    if (typeof n.proteinGoal === 'number' && Number.isFinite(n.proteinGoal) &&
      n.proteinGoal > 0 && n.logged > 0 && days(n.reached) && n.reached <= n.logged) {
      sentences.push(`Proteinmålet er registreret nået på ${n.reached} af ${n.logged} ${antalOrd(n.logged, 'logget dag', 'loggede dage')}.`)
    }
  } else {
    sentences.push('Jeg mangler et sikkert overblik over de seneste 7 dages kostregistreringer.')
  }
  sentences.push('Hvordan har ugen føltes for dig, og er der noget, vi skal tage højde for sammen?')
  return { text: sentences.join(' '), requiresCoachReview: true }
}
