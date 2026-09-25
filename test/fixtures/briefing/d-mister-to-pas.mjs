// D: Mistede pas 2 og 3 i uge 7 (14.-20. sep.). Resten normalt.
import { buildAthlete, defaultSession } from './helpers.mjs'

export default buildAthlete({
  id: 'syn-d', name: 'Atlet D',
  about: 'Mistede 2 af 3 pas i uge 7',
  session: (w, p) => ({ sets: defaultSession(w, p), missed: w === 6 && p > 0 }),
})
