// Parathedsudkastet (G12: overlever en lukket fane) og forudfyldningen fra
// seneste check-in (ordre 267) — de to effekter og deres refs flyttet uaendret
// ud af AthleteView.jsx (ordre 373) som en hook, kaldt paa effekternes gamle plads.
import { useEffect, useRef } from 'react'
import { loadReadinessDraft, saveReadinessDraft, clearReadinessDraft, isEmptyReadinessDraft } from '../readinessDraft'
import { today } from '../athleteShared'

export function useParathedUdkast({ athlete, readinessInput, setReadinessInput, lastReadiness }) {
  // G12: parathedsudkastet skal overleve en lukket fane. restoredForAthleteRef
  // holder styr på hvilken atlet vi allerede har forsøgt at genindsætte et
  // udkast for, så gem-effekten nedenfor ikke rydder det udkast den lige har
  // hentet, før genindsættelsen har nået at slå igennem i state.
  const readinessDraftRestoredForRef = useRef(null)

  useEffect(() => {
    if (!athlete?.id) return
    if (readinessDraftRestoredForRef.current !== athlete.id) {
      readinessDraftRestoredForRef.current = athlete.id
      const draft = loadReadinessDraft(athlete.id, today())
      if (draft && !isEmptyReadinessDraft(draft)) {
        setReadinessInput(draft)
        return
      }
    }
    if (isEmptyReadinessDraft(readinessInput)) clearReadinessDraft(athlete.id, today())
    else saveReadinessDraft(athlete.id, today(), readinessInput)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setReadinessInput er stabil (useState i AthleteView); deps uændret fra før ordre 373
  }, [readinessInput, athlete?.id])

  // ORDRE 267 · commit 1 — "to minutter": det eneste felt appen reelt kan
  // udlede er "sandsynligvis som sidst" (atletens egen seneste log). Før
  // krævede det et eksplicit tryk på "↺ Samme som sidst"; nu forudfyldes
  // formularen automatisk, første gang lastReadiness er hentet — stadig frit
  // at rette hvert felt bagefter. Et påbegyndt, ikke-tomt udkast (draft-
  // effekten ovenfor) har forrang og forhindrer denne forudfyldning.
  const readinessPrefillDoneForRef = useRef(null)
  useEffect(() => {
    if (!athlete?.id || !lastReadiness) return
    if (readinessPrefillDoneForRef.current === athlete.id) return
    readinessPrefillDoneForRef.current = athlete.id
    if (!isEmptyReadinessDraft(readinessInput)) return
    setReadinessInput({
      sleep: lastReadiness.sleep_hours != null ? String(lastReadiness.sleep_hours) : '',
      energy: lastReadiness.energy ?? null,
      motivation: lastReadiness.motivation ?? null,
      stress: lastReadiness.stress ?? null,
      soreness: lastReadiness.soreness_level ?? null,
      soreZones: lastReadiness.sore_zones || [],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- readinessInput bevidst ikke i deps, kun læst ved selve kaldet (samme mønster som draft-effekten ovenfor)
  }, [athlete?.id, lastReadiness])
}
