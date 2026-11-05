import { antalOrd } from '../../antalOrd.mjs'
import { buildCompetitionPlan } from './model.mjs'

const number = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 3 }).format(value)
const summaryStyle = { minHeight: 44, paddingBlock: 12, cursor: 'pointer' }

// Element factory keeps the view independently inspectable. The app-facing
// component supplies real React.createElement; fixtures are NOT a React gate.
export function renderCompetitionPlan(h, props = {}) {
  if (props.enabled !== true || props.role !== 'coach') return null
  const plan = buildCompetitionPlan(props)
  const header = [h('h2', { key: 'heading' }, 'Vægtklasse og vejning'),
    h('p', { key: 'coach' }, plan.coachMessage)]
  const shell = (...children) => h('section', { 'aria-label': 'Stævnekost til coachen',
    style: { width: '100%', maxWidth: '40rem', boxSizing: 'border-box', padding: 16, overflowWrap: 'anywhere' } },
  ...header, ...children)
  if (!plan.basis) return shell(h('p', { role: ['invalid', 'review'].includes(plan.phase) ? 'alert' : 'status' }, plan.reason))
  const { basis: b } = plan
  return shell(
    h('p', null, `Coachkladde · ${b.competitionDate} · vejning ${b.weighInHours} ${antalOrd(b.weighInHours, 'time', 'timer')} før`),
    h('p', null, `${number(b.weightKg)} kg nu · vægtklasse ${number(b.weightClassKg)} kg`),
    h('p', { role: plan.phase === 'review' ? 'alert' : 'status' }, plan.reason),
    h('p', null, `Gradvis reduktion: højst 1 % pr. uge. Beregnet periode: ${b.windowStart} til ${b.weighInDate} (${b.windowDays} ${antalOrd(b.windowDays, 'dag', 'dage')}).`),
    b.startsLater && h('p', null, 'Perioden starter senere. Hent en ny aktuel kropsvægt og vurder planen igen ved start.'),
    h('p', null, 'Planen er ikke aktiveret og ændrer intet hos atleten.'),
    h('ol', { 'aria-label': 'Ugemål' }, ...plan.weeks.map((week, index) =>
      h('li', { key: week.through, style: { marginBlock: 12 } },
        `Uge ${index + 1}: ${week.from} til ${week.through} · ${number(week.targetKg)} kg som pejlemærke${week.days < 7 ? ` (${week.days} ${antalOrd(week.days, 'dag', 'dage')})` : ''}.`))),
    plan.acute.status !== 'not-needed' && h('p', null, b.weighInHours === 2
      ? 'Ingen akut vandreduktion ved 2 timers vejning.'
      : `Restforskel: ${number(plan.acute.remainingKg)} kg. Vurderingsloft ved 24 timer: ${number(plan.acute.assessmentLimitKg)} kg (højst 1 %). Dette er ikke et vandtabsmål eller en tilladelse.`),
    h('details', null, h('summary', { style: summaryStyle }, 'Efter vejning'),
      h('p', null, `${plan.recovery.windowHours} ${antalOrd(plan.recovery.windowHours, 'time', 'timer')} frem mod stævnet.`),
      h('ul', null, ...plan.recovery.steps.map((step, i) => h('li', { key: i }, step))),
      h('p', null, plan.recovery.warning)),
    h('details', null, h('summary', { style: summaryStyle }, 'Sikkerhedsgrænser og kilder'),
      ...plan.cautions.map((text, i) => h('p', { key: i }, text)),
      h('p', null, 'Evidensen beskriver grupper. Beregningen er ikke klinisk valideret for den enkelte, og målene er ikke løfter.'),
      h('ul', null, ...plan.sources.map(source => h('li', { key: source.id },
        h('a', { href: source.url }, `${source.authors} (${source.year}): ${source.title}`),
        h('p', null, source.evidence))))))
}
