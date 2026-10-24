// ORDRE 456 (A8 i docs/kritik-446): coachens Log og PR-tidslinje brugte
// logged_at.slice(0, 10), altså datoen i UTC. Et sæt logget mellem 00 og 02
// dansk sommertid stod derfor på dagen før, mens atleten så den rigtige dag i
// Fremgang. Her er datoen dansk tid (Europe/Copenhagen), og visningen dansk.
// Rene funktioner.
const MDR = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

import { calendarDay, calendarDaysBetween } from './calendarDate.js'
import { calendarTime } from './athlete/kostNumbers.mjs'

export function danskDag(iso) {
  if (iso == null || iso === '') return ''
  return calendarDay(iso) || ''
}

// Hele kalenderdage fra 'YYYY-MM-DD' til i dag (dansk tid). 0 = i dag.
export function dageSiden(dag, nu = new Date()) {
  return calendarDaysBetween(dag, calendarDay(nu))
}

// 'YYYY-MM-DD' → '27. sep 2026'.
export function danskDatoTekst(dag) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dag || ''))
  if (!m || calendarTime(dag) === null) return ''
  return `${Number(m[3])}. ${MDR[Number(m[2]) - 1]} ${m[1]}`
}
