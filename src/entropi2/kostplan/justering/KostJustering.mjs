import { createElement as h } from 'react'

const control = { minHeight: 44, minWidth: 44, font: 'inherit', whiteSpace: 'normal', maxWidth: '100%' }
const number = value => typeof value === 'number' && Number.isFinite(value)
  ? new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(value) : 'ukendt'
const volume = { rest: 'hvile', light: 'let', moderate: 'moderat', high: 'høj' }
const intensity = { light: 'let', moderate: 'moderat', high: 'høj' }
const trend = value => value == null ? 'ukendt' : `${number(value)} %/uge`

// Controlled view only. No effects, clock, loading, storage or automatic writes.
// onDecision receives an intent; caller must revalidate and confirm persistence.
export default function KostJustering(props = {}) {
  if (props.enabled !== true) return null
  const { snapshot: s, pending = false, error = false, onDecision } = props
  if (!s || s.phase === 'off') return h('p', { role: 'alert' }, 'Ugevurderingen er ikke tilsluttet.')
  const failed = error || !['empty', 'hold', 'review', 'ready', 'accepted', 'rejected'].includes(s.phase)
  if (failed) return h('p', { role: 'alert' }, 'Ugevurderingen kunne ikke bekræftes. Hent et nyt grundlag før du prøver igen.')
  if (s.phase === 'empty') return h('p', null, s.reason)
  const e = s.evidence
  const actionable = s.phase === 'ready'
  return h('section', { 'aria-label': 'Ugens kostjustering', 'aria-busy': pending,
    style: { width: '100%', maxWidth: '40rem', boxSizing: 'border-box', padding: 16, overflowWrap: 'anywhere' } },
  h('h2', null, 'Ugens kostjustering'),
  h('p', null, `Vurderet ${s.evaluatedOn}`),
  actionable ? h('p', null, `Forslag: ${s.deltaKcal > 0 ? '+' : '−'}${number(Math.abs(s.deltaKcal))} kcal/dag · ${number(s.plan.kcal)} → ${number(s.proposedKcal)} kcal/dag i basis`)
    : h('p', { role: 'status', 'aria-live': 'polite' }, s.reason),
  actionable && h('p', null, s.reason),
  s.phase === 'accepted' && h('p', null, `Ny basis i kladden: ${number(s.proposedKcal)} kcal/dag.`),
  s.phase === 'rejected' && h('p', null, `Basis fastholdes: ${number(s.plan.kcal)} kcal/dag.`),
  s.phase === 'review' && h('p', { role: 'alert' }, 'Planen kræver coachvurdering før brug.'),
  actionable && h('p', null, 'Forslaget ændrer intet hos atleten. Coachen skal godkende og aktivere den reviderede plan.'),
  actionable && h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
    h('button', { type: 'button', style: control, disabled: pending || typeof onDecision !== 'function',
      onClick: () => { if (!pending && typeof onDecision === 'function') return onDecision('accept', s) } }, pending ? 'Behandler…' : 'Acceptér forslag'),
    h('button', { type: 'button', style: control, disabled: pending || typeof onDecision !== 'function',
      onClick: () => { if (!pending && typeof onDecision === 'function') return onDecision('reject', s) } }, 'Afvis forslag')),
  actionable && typeof onDecision !== 'function' && h('p', { role: 'alert' }, 'Beslutninger er ikke tilsluttet.'),
  s.nextEligibleOn && h('p', null, `Næste vurdering tidligst ${s.nextEligibleOn}. Nyt datagrundlag kræves.`),
  h('details', null,
    h('summary', { style: { ...control, paddingBlock: 12, cursor: 'pointer' } }, 'Se datagrundlag og grænser'),
    h('p', null, `Periode: ${e.from} til ${e.through}. Vægt: ${e.trend.count} gyldige dage; ${e.trend.rejected} frasorteret.`),
    h('p', null, `Observeret trend: ${trend(e.observedWeeklyPct)}. Mål: ${trend(e.targetWeeklyPct)}.`),
    h('p', null, `Komplette kostdage: ${e.diet.completeDays}; ${e.diet.rejected} frasorteret. Faktisk gennemsnit: ${number(e.diet.meanKcal)} kcal/dag.`),
    h('p', null, `Træningsvolumen: ${e.trainingKnown ? volume[e.training.volume] : 'ukendt'}. Intensitet: ${e.trainingKnown ? intensity[e.training.intensity] : 'ukendt'}.`),
    h('p', null, `Basisgulv: ${number(s.limits.reviewBasisMinKcal ?? s.limits.baseMinKcal)} kcal/dag. Dagens gulv med træning: ${number(s.limits.minKcal)} kcal.`),
    h('p', null, 'Basis er før dagens træningstillæg. En ugentlig ændring må ikke lægges oven i et nyberegnet dagsmål.'),
    ...s.warnings.map((warning, i) => h('p', { key: i }, warning)),
    h('p', null, 'Grænserne er produktets voksenpolitik. Coachen skal også vurdere individuelle behov.')))
}
