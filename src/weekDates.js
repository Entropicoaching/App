// ORDRE 204: en uge skal få sin startdato af sig selv når den oprettes, i
// stedet for at afhænge af en coach-vane på travle aftener. Rene funktioner
// (ingen Supabase, ingen React) så datoreglen kan testes uafhængigt af UI'en
// og af weeks-hentningen.

// Startdato til en ny uge: forrige daterede uge (højeste week_number blandt
// eksisterende uger) + 7 dage. Ingen daterede uger endnu → førstkommende
// mandag fra `today`.
export function nextWeekStartDate(existingWeeks, today = new Date()) {
  const dated = (existingWeeks || []).filter(w => w.start_date).sort((a, b) => b.week_number - a.week_number)
  if (dated.length) {
    const prevMs = new Date(dated[0].start_date + 'T12:00:00').getTime()
    return new Date(prevMs + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  }
  const d = new Date(today)
  d.setHours(12, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7 // 0 = mandag
  if (dow !== 0) d.setDate(d.getDate() + (7 - dow))
  return d.toISOString().slice(0, 10)
}

// Udfylder start_date for uger der mangler den, ud fra den første daterede
// uge i samme program (weeks forventes sorteret efter week_number, som
// fetchWeeks allerede gør), frem og tilbage i 7-dages-spring. Rører aldrig
// en uge der allerede har en dato — returnerer kun dem der manglede en.
export function fillMissingWeekDates(weeks) {
  const anchor = (weeks || []).find(w => w.start_date)
  if (!anchor) return []
  const anchorMs = new Date(anchor.start_date + 'T12:00:00').getTime()
  return weeks
    .filter(w => !w.start_date)
    .map(w => ({
      id: w.id,
      week_number: w.week_number,
      start_date: new Date(anchorMs + (w.week_number - anchor.week_number) * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    }))
}
