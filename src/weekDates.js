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
