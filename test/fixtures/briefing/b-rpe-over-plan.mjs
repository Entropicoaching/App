// B: Loefter det planlagte, men RPE ligger ca. 1,5 over plan de sidste 3 uger
// (squat +2, resten +1,5).
import { buildAthlete, defaultSession } from './helpers.mjs'

export default buildAthlete({
  id: 'syn-b', name: 'Atlet B',
  about: 'RPE 1,5 over plan i 3 uger (Squat +2)',
  session: (w, p) => defaultSession(w, p, { shift: (week, lift) => (week >= 5 ? (lift === 'Squat' ? 2 : 1.5) : 0) }),
})
