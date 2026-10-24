import { calendarTime } from './athlete/kostNumbers.mjs'
import { calendarDay, addCalendarDays } from './calendarDate.js'
import { inputInteger } from './inputValues.js'

// ORDRE 204: en uge skal få sin startdato af sig selv når den oprettes, i
// stedet for at afhænge af en coach-vane på travle aftener. Rene funktioner
// (ingen Supabase, ingen React) så datoreglen kan testes uafhængigt af UI'en
// og af weeks-hentningen.

// Startdato til en ny uge: forrige daterede uge (højeste week_number blandt
// eksisterende uger) + 7 dage. Ingen daterede uger endnu → førstkommende
// mandag fra `today`.
export function nextWeekStartDate(existingWeeks, today = new Date()) {
  const dated = (existingWeeks || []).filter(w => w && calendarTime(w.start_date) !== null && inputInteger(w.week_number) !== null)
    .sort((a, b) => inputInteger(b.week_number) - inputInteger(a.week_number))
  if (dated.length) return addCalendarDays(dated[0].start_date, 7)
  const day = calendarDay(today)
  if (!day) return null
  const dow = (new Date(calendarTime(day)).getUTCDay() + 6) % 7
  return addCalendarDays(day, dow === 0 ? 0 : 7 - dow)
}

// Kun manglende datoer udfyldes, ud fra et gyldigt anker.
export function fillMissingWeekDates(weeks) {
  const rows = (weeks || []).filter(w => w && inputInteger(w.week_number) !== null)
  const anchor = rows.find(w => calendarTime(w.start_date) !== null)
  if (!anchor) return []
  return rows.filter(w => !w.start_date).map(w => ({
    id: w.id, week_number: w.week_number,
    start_date: addCalendarDays(anchor.start_date, (inputInteger(w.week_number) - inputInteger(anchor.week_number)) * 7),
  })).filter(w => w.start_date)
}
