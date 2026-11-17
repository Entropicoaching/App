// Ordre 1611 (Marc 17. nov.: "taenker det skal end hvis man er skadet syg, eller deload"):
// atleten melder syg eller skadet. Meldingen er en almindelig besked til coachen med
// fast tekst; supabase/sql/coach-besked-ved-behov-v1.sql laeser netop disse tekster og
// sender coachen een mail pr. melding. Ingen ny tabel, ingen migration her.
export const MELDINGER = Object.freeze({
  syg: Object.freeze({ tekst: 'Meldt til coach: syg', knap: 'Jeg er syg', spoerg: 'Send "Jeg er syg" til din coach?' }),
  skadet: Object.freeze({ tekst: 'Meldt til coach: skadet', knap: 'Jeg er skadet', spoerg: 'Send "Jeg er skadet" til din coach?' }),
})

export async function sendMelding(client, athleteId, slags) {
  const melding = MELDINGER[slags]
  if (!melding || !athleteId || typeof client?.from !== 'function') return 'fejl'
  try {
    const { error } = await client.from('messages')
      .insert({ athlete_id: athleteId, sender_role: 'athlete', content: melding.tekst, category: 'besked' })
    return error ? 'fejl' : 'sendt'
  } catch {
    return 'fejl'
  }
}
