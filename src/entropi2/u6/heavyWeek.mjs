import { addCalendarDays, calendarDay } from '../../calendarDate.js'
import { readinessDrop } from '../coach/coachAttention.mjs'
import { weeklyLoad } from '../analysis/weeklyLoad.mjs'
import { mondayOf } from '../u3/format.mjs'

// U6 del 3: forslag til coachen, når readiness og belastning peger mod en hård uge.
// Ingen nye grænser. Reglerne og deres kilder:
// - Readiness falder: samme regel som "Kræver dit blik" (coachAttention.readinessDrop, U3):
//   snit af 3 dage under snittet for dag 4 til 28 minus 0,5 × sd.
// - Belastningen stiger: sidste afsluttede uges tonnage over snittet af de 3 uger før
//   (analysis/weeklyLoad.mjs, samme forhold som U3's belastning). Ingen procentgrænse.
// - Begge på én gang: Marcs artikel om deload: "Det bliver mere relevant at overveje en
//   deload, når flere signaler peger samme vej over flere træninger."
// - Forslaget: Marcs svar 10. nov. 2026 kl. 16:41 (ordrer/koe/til-marc/some/
//   serie-fra-log-til-program-v2-20261110/KILDER-NOTE.md): "hoved udgangspunkt er 10%"
//   (fald efter topsættet) og "ved et konstruktivt sæt hæves vægten næste uge, indtil deload".
// - Deload foreslås ikke her. Marcs programregel 3 (ja 3. okt. 2026) knytter det til tre
//   uger med afvigelse (fejlede sæt, færre reps, RPE over mål), og hans svar 10. nov. siger
//   "enten ved planen er fuldt til ende, eller hvis livet sker". Ingen af delene kan aflæses
//   af readiness og tonnage alene, så forslaget nævner kun det, tallene bærer.

const tons = kg => (Math.round(kg / 100) / 10).toFixed(1).replace('.', ',')
const whole = value => String(Math.round(value))

export function heavyWeekSuggestion({ readiness, logs, day } = {}) {
  const today = calendarDay(day)
  if (!today || !Array.isArray(readiness) || !Array.isArray(logs)) return null
  const drop = readinessDrop(readiness, today)
  if (!drop) return null
  const lastSunday = addCalendarDays(mondayOf(today), -1)
  const load = lastSunday && weeklyLoad(logs, lastSunday, { weeks: 4 })
  const last = load?.weeks.at(-1)
  if (!load || !(load.chronicLoad > 0) || !(load.acuteChronicRatio > 1) || !(last?.tonnage > 0)) return null
  const facts = `Readiness ${whole(drop.current)} de sidste 3 dage mod ${whole(drop.mean)} i ugerne før. ` +
    `Tonnage ${tons(last.tonnage)} t i sidste uge mod ${tons(load.chronicLoad)} t i snit de 3 uger før.`
  const advice = 'Forslag: hæv kun vægten efter et konstruktivt sæt, og lad backoff ligge cirka 10 % under topsættet.'
  return { kind: 'heavy-week', readiness: { current: drop.current, mean: drop.mean },
    tonnage: { last: last.tonnage, average: load.chronicLoad }, text: `Tung uge. ${facts} ${advice}` }
}

// Hvor langt tilbage loggen skal hentes: fire hele uger før indeværende uge.
export function heavyWeekFrom(day) {
  const today = calendarDay(day)
  return today ? addCalendarDays(mondayOf(today), -28) : null
}
