import { antalOrd } from '../../antalOrd.mjs'
import { evaluateCoachWeek } from '../../tracking/coachuge/evaluate.mjs'
import { weeklyLetterContext } from './weeklyLetterContext.mjs'

const focusText = {
  pain: ['Lad os afklare den registrerede smerte, før vi taler om at øge træningen.', 'Hvordan oplever du smerten i din træning lige nu?'],
  sleepHours: ['Lad os tale om din søvn som ugens ene fokus.', 'Hvad har påvirket din søvn i denne uge?'],
  sleepQuality: ['Lad os tale om din søvnkvalitet som ugens ene fokus.', 'Hvordan har din søvn føltes i denne uge?'],
  energy: ['Lad os tale om din energi som ugens ene fokus.', 'Hvornår har du oplevet mest og mindst energi?'],
  stress: ['Lad os tale om din oplevede belastning i hverdagen.', 'Hvad har fyldt mest i hverdagen i denne uge?'],
  soreness: ['Lad os tale om den registrerede ømhed som ugens ene fokus.', 'Hvordan har ømheden påvirket din træning?'],
  load: ['Lad os gennemgå træningsbelastningen sammen.', 'Hvordan har ugens træningsmængde føltes?'],
  strength: ['Lad os gennemgå udviklingen i det registrerede løft.', 'Hvordan har løftet føltes i de seneste pas?'],
  nutrition: ['Lad os tale om, hvordan dine proteinmål passer ind i hverdagen.', 'Hvad har gjort det let eller svært at følge dine proteinmål?'],
  weight: ['Lad os sætte de registrerede vægtændringer i sammenhæng.', 'Er der noget fra din uge, som kan hjælpe os med at forstå registreringerne?'],
  compliance: ['Lad os se på, hvordan de planlagte pas passer ind i din uge.', 'Hvad har hjulpet eller stået i vejen for dine planlagte pas?'],
}

/** Pure, unwired projection of the authorized single-athlete coachuge snapshot.
 * No I/O, raw text interpolation, diagnosis, persistence or sending capability.
 */
export function createWeeklyLetter(options = {}) {
  if (options?.enabled !== true) return { state: 'off', requiresCoachEdit: true }
  const evaluation = evaluateCoachWeek(options)
  const base = { requiresCoachEdit: true }
  if (['loading', 'error'].includes(evaluation.state)) return { ...base, state: evaluation.state }
  const { data } = options
  const { from, asOf } = evaluation
  let context
  try { context = weeklyLetterContext(data, evaluation) }
  catch { return { ...base, state: 'error' } }
  const compliance = evaluation.sections.find(s => s.id === 'compliance')
  const trainingKnown = ['ready', 'notPlanned'].includes(compliance.state)
  const training = trainingKnown ? {
    planned: data.compliance.plannedIds.length, completed: data.compliance.completedIds.length,
    extra: data.compliance.extraIds.length,
  } : null
  // Reuse the validated 28-day nutrition set, then select the seven-day week.
  // Missing days remain unknown; current targets must never be backdated.
  const nutritionSection = evaluation.sections.find(s => s.id === 'nutrition')
  const nutritionKnown = nutritionSection.dataBasis.sampleCount !== null
  const nutrition = nutritionKnown ? data.nutritionDays.filter(r => r.day >= from && r.day <= asOf) : null
  const nutritionDays = nutrition?.length ?? null
  const dailyCount = Math.max(0, ...evaluation.sections.filter(s =>
    ['pain', 'sleepHours', 'sleepQuality', 'energy', 'stress', 'soreness'].includes(s.id))
    .map(s => s.dataBasis.sampleCount ?? 0))
  const hasEvidence = evaluation.sections.some(s => s.dataBasis.sampleCount > 0) || trainingKnown || context.length > 0
  if (!hasEvidence) return { ...base, state: 'empty', from, asOf }
  const selected = evaluation.flags[0] ?? null
  const [focus, question] = selected ? focusText[selected.id] : [
    'Lad os vælge ét realistisk fokus for den kommende uge.',
    'Hvad vil du helst have, at vi arbejder med i den kommende uge?',
  ]
  const nutritionPraiseDays = context.some(c => c.id === 'nutrition') ? 0 : nutritionDays
  const trainingPraise = training?.completed > 0
    ? `Godt arbejde med ${training.completed} af ${training.planned} ${antalOrd(training.planned, 'planlagt pas', 'planlagte pas')}, der er bekræftet gennemført i denne uge.`
    : nutritionPraiseDays > 0 ? `Tak for dine komplette kostregistreringer på ${nutritionPraiseDays} af ugens 7 dage.`
      : dailyCount > 0 ? 'Tak for dine registreringer om, hvordan du har det.'
        : 'Tak fordi du tager dig tid til at samle op på ugen sammen med mig.'
  const praise = training?.completed > 0 && nutritionPraiseDays > 0
    ? `${trainingPraise} Tak også for dine komplette kostregistreringer på ${nutritionPraiseDays} af ugens 7 dage.`
    : trainingPraise
  const b = selected?.dataBasis
  const evidence = selected ? { id: selected.id, title: selected.title,
    from: b.from, to: b.to, sampleCount: b.sampleCount, minimumSampleCount: b.minimumSampleCount,
    rule: b.rule, formula: b.formula, value: selected.value } : null
  return { ...base, state: 'ready', from, asOf, praise, focus, question,
    text: [[praise, ...context.map(c => c.text)].join('\n'), focus, question].join('\n\n'), context,
    training, nutritionDays, evidence, incomplete: evaluation.insufficient,
    otherFlags: Math.max(0, evaluation.flags.length - 1) }
}
