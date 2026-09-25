// C: Skriver i en pas-kommentar i uge 7 at knaeet goer ondt i bunden af squat,
// og melder hoej oemhed i ben to dage i denne uge. Traener ellers normalt.
import { buildAthlete, defaultSession } from './helpers.mjs'

export default buildAthlete({
  id: 'syn-c', name: 'Atlet C',
  about: 'Knaesmerte naevnt i pas-kommentar (uge 7) + oemhed 4-5/5 i Ben',
  session: (w, p) => ({
    sets: defaultSession(w, p),
    comment: w === 6 && p === 2 ? 'Knæet gør ondt i bunden af squat' : null,
  }),
  readiness: [
    { logged_date: '2026-09-15', energy: 4, motivation: 4, stress: 2, soreness_level: 2, sore_zones: null },
    { logged_date: '2026-09-22', energy: 3, motivation: 3, stress: 2, soreness_level: 5, sore_zones: ['Ben'] },
    { logged_date: '2026-09-24', energy: 3, motivation: 3, stress: 2, soreness_level: 4, sore_zones: ['Ben'] },
  ],
})
