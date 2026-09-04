// ORDRE 41 — fund #1: flere atlet-initierede skrivninger (besked-afsendelse,
// kostlog) er bare `await supabase.from(...).insert(...)` uden at kigge på
// `{ error }`. Ved et netværksdrop fortsætter koden alligevel som om det
// lykkedes — beskedfeltet ryddes, "logget"-tilstanden vises — mens skrivningen
// aldrig nåede databasen. Tavse fejl er dyrere end grimme fejl.
//
// runGuardedWrite kører skrivningen og kalder EKSPLICIT onError hvis den
// fejler, i stedet for at kalderen antager succes. Ren funktion (ingen UI-
// afhængighed), så den kan enhedstestes uden React.
export async function runGuardedWrite(run, onError) {
  const { error } = await run()
  if (error) {
    onError(error)
    return false
  }
  return true
}
