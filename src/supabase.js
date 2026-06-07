import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Kør et Supabase-kald robust ved appstart/transiente fejl.
//
// `run` er en funktion der bygger og udfører forespørgslen og returnerer
// { data, error } (byg den INDE i funktionen — query-objekter kan kun bruges én
// gang, så hvert retry skal bygge en frisk forespørgsel).
//
// To ting håndteres:
//   1) Venter på at auth-sessionen er hæftet på klienten før første forsøg, så
//      kaldet ikke rammer RLS som anonym ved cold start (= 0 rækker uden fejl,
//      der ellers ligner "ingen atlet/atleter").
//   2) Prøver igen ved reel fejl med stigende ventetid.
export async function withRetry(run, { tries = 3, delay = 400 } = {}) {
  // Sikrer at en evt. gemt session er indlæst og token sat på klienten.
  await supabase.auth.getSession()
  let last
  for (let i = 0; i < tries; i++) {
    last = await run()
    if (!last.error) return last
    if (i < tries - 1) await new Promise(r => setTimeout(r, delay * (i + 1)))
  }
  return last
}