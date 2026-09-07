// ORDRE 76 — "stille fejl, runde 4", G1: fetchProgram og stort set alle
// andre rå Supabase-læsninger på atletens vej tjekkede ikke `{ error }`.
// Fejlede hentningen (netværk, midlertidig RLS-forsinkelse ved cold-start),
// var `data` `undefined`, og koden viste den SAMME tomme-tilstand som en
// ægte tom liste — for programmet betød det: en helt ny atlet kunne ikke se
// forskel på "min coach er ikke færdig endnu" og "noget gik galt, prøv
// igen".
//
// runGuardedRead spejler runGuardedWrite (athleteWriteGuard.js): kalder
// EKSPLICIT onError hvis læsningen fejler, i stedet for at kalderen antager
// at `data` er et ægte (om end tomt) resultat. Ren funktion, enhedstestbar
// uden React. Kalderen skal kun opdatere UI-tilstand når `ok` er true — det
// er det der sikrer at sidst kendte indhold beholdes ved en fejl, i stedet
// for at blive erstattet af en tom liste.
export async function runGuardedRead(run, onError) {
  const { data, error } = await run()
  if (error) {
    onError(error)
    return { data: null, ok: false }
  }
  return { data: data ?? null, ok: true }
}
