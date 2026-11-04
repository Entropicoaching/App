const DAY = 86400000
export const POLICY = 'entropi2-staevne/v1'
export const COACH_MESSAGE = 'Tal med din coach før du ændrer kost eller væske.'

// Bibliographic references, not a claim of clinical validation of this model.
// The 1% assessment ceiling is our conservative product policy, not a proven
// safe dehydration threshold for an individual athlete.
const references = [
  { id: 'garthe-2011', title: 'Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes',
    authors: 'Garthe et al.', year: 2011, url: 'https://doi.org/10.1123/ijsnem.21.2.97',
    evidence: 'Moderat for gradvist vægttab hos voksne eliteatleter; begrænset overførbarhed til den enkelte.' },
  { id: 'reale-2017', title: 'Acute-Weight-Loss Strategies for Combat Sports and Applications to Olympic Success',
    authors: 'Reale, Slater & Burke', year: 2017, url: 'https://doi.org/10.1123/ijsnem.2016-0211',
    evidence: 'Oversigtsartikel om kampsport. Begrænset evidens for individuel sikkerhed og overførsel til styrkeløft.' },
  { id: 'thomas-2016', title: 'Nutrition and Athletic Performance',
    authors: 'Thomas, Erdman & Burke', year: 2016, url: 'https://doi.org/10.1249/MSS.0000000000000852',
    evidence: 'Faglig konsensus om sportsernæring og restitution; ingen validering af denne beregners grænser.' },
]

const iso = time => new Date(time).toISOString().slice(0, 10)
function calendar(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || value < '1900-01-01' || value > '9999-12-30') return null
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && iso(time) === value ? time : null
}
const kg = value => typeof value === 'number' && Number.isFinite(value) && value >= 25 && value <= 350

/** Pure, unwired, prospective coach planning. No clock, I/O, kcal prescription,
 * dehydration protocol or activation. enabled must be boolean true.
 * Dates are calendar days: the 24h weigh-in is conservatively the previous day.
 */
export function buildCompetitionPlan(props = {}) {
  if (props.enabled !== true) return { phase: 'off' }
  const base = { policy: POLICY, coachMessage: COACH_MESSAGE, requiresCoachReview: true,
    sources: references.map(source => ({ ...source })) }
  const stop = (phase, reason) => ({ ...base, phase, reason, weeks: [] })
  const input = props.input
  if (input == null) return stop('empty', 'Tilføj kropsvægt, vægtklasse, stævnedato og vejningstid. Der er ingen plan endnu.')
  if (typeof input !== 'object' || Array.isArray(input)) return stop('invalid', 'Datagrundlaget kunne ikke læses. Ret input før en beregning.')
  const { weightKg, weightClassKg, competitionDate, weighInHours, asOf } = input
  const today = calendar(asOf), meet = calendar(competitionDate)
  if (!kg(weightKg) || !kg(weightClassKg)) return stop('invalid', 'Kropsvægt og vægtklasse skal være tal mellem 25 og 350 kg.')
  if (today === null || meet === null) return stop('invalid', 'Beregningsdato og stævnedato skal være gyldige datoer (ÅÅÅÅ-MM-DD).')
  if (weighInHours !== 2 && weighInHours !== 24) return stop('invalid', 'Vælg vejning 2 eller 24 timer før stævnet.')
  if (input.adult !== true || input.healthReviewed !== true) {
    return stop('review', 'Ingen reduktionsplan: værktøjet kræver en voksen atlet og en faglig vurdering af helbred, medicin og risiko for spiseforstyrrelser.')
  }
  const weigh = meet - (weighInHours === 24 ? DAY : 0)
  if (weigh <= today) return stop('review', 'Vejningsdagen er nået eller passeret. Der beregnes ingen ny reduktionsplan.')
  const start = Math.max(today, weigh - 28 * DAY)
  const days = (weigh - start) / DAY
  const gapKg = Math.max(0, weightKg - weightClassKg)
  if (gapKg > 0 && days < 7) return stop('review', 'Under syv dage til vejning: ingen ny reduktionsplan. Vurdér vægtklasse med din coach; forsøg ikke at indhente forskellen akut.')

  // Compounding also caps partial weeks and uses the weight at the START of
  // each interval. Unused time beyond 28 days cannot inflate the loss budget.
  const weeklyRate = gapKg === 0 ? 0 : Math.min(0.01, 1 - (weightClassKg / weightKg) ** (7 / days))
  const withinClass = gapKg === 0 || weightKg * 0.99 ** (days / 7) <= weightClassKg
  const weeks = []
  let previousKg = weightKg
  for (let offset = 0; offset < days; offset += 7) {
    const end = Math.min(days, offset + 7)
    const targetKg = gapKg === 0 ? weightKg
      : end === days && withinClass ? weightClassKg
        : Math.max(weightClassKg, weightKg * (1 - weeklyRate) ** (end / 7))
    weeks.push({ from: iso(start + offset * DAY), through: iso(start + end * DAY),
      days: end - offset, startKg: previousKg, targetKg,
      lossKg: Math.max(0, previousKg - targetKg) })
    previousKg = targetKg
  }
  const projectedKg = weeks.at(-1).targetKg
  const remainingKg = Math.max(0, projectedKg - weightClassKg)
  // Assessment only, never a water-loss instruction or a target to achieve.
  // A 2h weigh-in has exactly zero acute water allowance, including opt-in.
  const assessmentLimitKg = weighInHours === 24 ? Math.floor(projectedKg * 0.01 * 1000) / 1000 : 0
  const acute = { status: withinClass ? 'not-needed'
    : weighInHours === 2 ? 'not-supported' : remainingKg <= assessmentLimitKg ? 'coach-review' : 'over-limit',
    assessmentLimitKg, remainingKg: withinClass ? 0 : remainingKg, prescribedWaterLossKg: 0 }
  const reason = gapKg === 0 ? 'Vægtklassen er allerede nået. Fasthold vægten; intet vægttab foreslås.'
    : withinClass ? 'Foreløbig plan for gradvis reduktion. Ugemål er pejlemærker og skal revurderes med faktiske vejninger.'
      : weighInHours === 2 ? 'Vægtklassen nås ikke inden for den gradvise grænse. Ved 2 timers vejning planlægges intet akut vandtab. Vurdér en anden vægtklasse.'
        : acute.status === 'over-limit' ? 'Restforskellen overstiger også den konservative vurderingsgrænse. Vurdér en anden vægtklasse; øg ikke reduktionen.'
          : 'Der er en restforskel til vægtklassen. Kun ved 24 timers vejning kan en fagperson vurdere den særskilt; der gives ingen væskeprotokol.'
  const recovery = {
    windowHours: weighInHours,
    steps: weighInHours === 2 ? [
      'Efter vejning: spis en lille, velkendt kulhydratrig snack eller et let måltid, som maven tåler.',
      'Drik efter tørst og fordel indtaget. Undgå at presse store mængder mad eller væske ind i de to timer.',
    ] : [
      'Efter vejning: begynd med velkendte kulhydratholdige måltider og væske fordelt over tiden frem mod stævnet.',
      'Spis normale, saltede måltider. Ved et faktisk væsketab skal genopfyldning individualiseres af en kvalificeret fagperson.',
    ],
    warning: 'Genopfyldning garanterer ikke restitution efter dehydrering. Ved svimmelhed, besvimelse, forvirring eller vedvarende opkast: stop og søg akut lægehjælp.',
  }
  return { ...base, phase: withinClass ? 'draft' : 'review', reason,
    basis: { weightKg, weightClassKg, competitionDate, weighInHours, asOf, weighInDate: iso(weigh),
      windowStart: iso(start), windowDays: days, startsLater: start > today },
    limits: { maxWeeklyLossPct: 1, maxWindowDays: 28, acuteAssessmentPct: weighInHours === 24 ? 1 : 0 },
    weeklyLossPct: weeklyRate * 100, projectedKg, withinClass, weeks, acute, recovery,
    cautions: [
      '1 % pr. uge er et loft, ikke et mål eller en sikkerhedsgaranti. Der beregnes intet kalorieunderskud.',
      'Ingen sauna, sveddragt, væskerestriktion, vandloading, afføringsmidler eller vanddrivende midler anbefales.',
      '24 timer fjerner ikke risikoen ved dehydrering. 1 %-grænsen er en produktregel til faglig vurdering, ikke en dokumenteret sikker dosis.',
      'Ved dårlig trivsel, sygdom eller faldende præstation: stop reduktionen og få en individuel faglig vurdering.',
    ] }
}
