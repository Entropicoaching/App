import { calendarTime } from '../../../athlete/kostNumbers.mjs'

// Kostvanen som check-in (U1). Ren model over kostloggens eget snapshot: ingen
// ny tabel, ingen ny læsning. En kostdag er en dato med mindst ét logget måltid
// i meal_logs, samme definition som coachens tal.
export const KOSTDAGE_MAAL = 4
const DAY = 86400000
const fmt = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(value)

export function weekStart(date) {
  const time = calendarTime(date)
  if (time === null) return null
  return new Date(time - (new Date(time).getUTCDay() + 6) % 7 * DAY).toISOString().slice(0, 10)
}

export function kostdageIUgen(rows, date) {
  const from = weekStart(date)
  if (!from || !Array.isArray(rows)) return []
  return [...new Set(rows.filter(row => typeof row?.date === 'string' && row.date >= from && row.date <= date).map(row => row.date))].sort()
}

const target = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

// Én linje feedback ud fra coachens mål (athletes.kcal_target/protein_target
// eller den godkendte plan). Uden mål vises kun dagens egne tal.
export function feedbackLinje({ totals, targets } = {}) {
  if (!totals) return 'Dagens tal kan ikke lægges sammen. Tjek måltiderne i kostloggen.'
  const kcal = target(targets?.kcal), protein = target(targets?.protein)
  if (!kcal && !protein) return `I dag: ${fmt(totals.kcal)} kcal og ${fmt(totals.protein)} g protein. Din coach har ikke sat dagsmål endnu.`
  const parts = []
  if (protein) parts.push(totals.protein >= protein * 0.95
    ? `Protein ramt: ${fmt(totals.protein)} af ${fmt(protein)} g.`
    : `Protein ${fmt(totals.protein)} af ${fmt(protein)} g, ${fmt(protein - totals.protein)} g mangler.`)
  if (kcal) parts.push(Math.abs(totals.kcal - kcal) <= kcal * 0.1
    ? `Energi tæt på målet: ${fmt(totals.kcal)} af ${fmt(kcal)} kcal.`
    : `Energi ${fmt(totals.kcal)} af ${fmt(kcal)} kcal.`)
  return parts.join(' ')
}

export function ugeLinje(dage, date) {
  const count = dage.length, today = dage.includes(date)
  if (count >= KOSTDAGE_MAAL) return `Ugens mål er nået: ${count} kostdage.`
  const rest = KOSTDAGE_MAAL - count
  return `${count} af ${KOSTDAGE_MAAL} kostdage i denne uge.${today ? '' : ' I dag tæller med, når du logger et måltid.'} ${rest === 1 ? 'Én dag mere' : `${rest} dage mere`} til ugens mål.`
}

export function kostvane(snapshot, done = false) {
  if (!snapshot?.loaded) return { phase: 'loading' }
  const date = snapshot.date
  const today = snapshot.logs?.length ?? 0
  const rows = [...(snapshot.historyRows ?? []), ...(snapshot.logs ?? []).map(row => ({ date: row.date ?? date }))]
  const dage = kostdageIUgen(rows, date)
  const step = today === 0 ? 1 : done ? 3 : 2
  return { phase: 'ready', date, step, mealsToday: today, yesterday: snapshot.yesterday ?? [],
    feedback: today ? feedbackLinje(snapshot) : '', dage, uge: ugeLinje(dage, date), done: done && today > 0,
    busy: snapshot.pending === true }
}

const doneKey = (athleteId, date) => `entropi2:kostvane-faerdig:v1:${encodeURIComponent(athleteId)}:${date}`
export function readDone(storage, athleteId, date) {
  try { return storage?.getItem(doneKey(athleteId, date)) === '1' } catch { return false }
}
export function saveDone(storage, athleteId, date) {
  try { storage.setItem(doneKey(athleteId, date), '1'); return storage.getItem(doneKey(athleteId, date)) === '1' } catch { return false }
}
