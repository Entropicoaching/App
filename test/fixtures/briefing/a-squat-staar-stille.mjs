// A: Squat har staaet stille paa 140x5 i tre uger, mens RPE kryber op (8 -> 9).
import { buildAthlete, defaultSession, mainLift } from './helpers.mjs'

const squatTop = [120, 125, 130, 135, 140, 140, 140, 140]
const squatRpe = [8, 8, 8, 8, 8, 8.5, 9, 9]

export default buildAthlete({
  id: 'syn-a', name: 'Atlet A',
  about: 'Squat staar stille 3 uger (140x5), RPE stiger fra 8 til 9 mod plan 8',
  session: (w, p) => {
    const sets = defaultSession(w, p)
    if (p === 1) return sets
    const top = p === 0 ? squatTop[w] : squatTop[w] - 5
    const squat = mainLift('Squat', top, { actual: squatRpe[w], backoffActual: 7 })
    return [...squat, ...sets.slice(3)]
  },
})
