import { antalOrd } from '../antalOrd.mjs'
import { createElement as h, useState } from 'react'
import AthleteCard from './atletkort/AthleteCard.mjs'
import WeekEvaluation from './evaluering/WeekEvaluationView.mjs'
import PlanGrundlagView from './planlaegning/PlanGrundlagView.mjs'
import BelastningOgTrend from '../tracking/visning/BelastningOgTrend.mjs'
import { hasReportValues } from './coachTrackingModel.mjs'
import { createCoachMessageDraft } from './udkast/messageDraft.mjs'
import BlocksView from '../analysis/blokforblok/BlocksView.mjs'
import WeekByWeekView from '../u3/WeekByWeekView.mjs'

const action = { minHeight: 48, padding: 12, font: 'inherit', color: 'inherit',
  background: '#1c1c18', border: '1px solid #77776b', borderRadius: 8, cursor: 'pointer' }
const foldStyle = { marginBlock: 12, borderTop: '1px solid #59564c', paddingTop: 8 }
const foldSummary = { minHeight: 48, cursor: 'pointer', paddingBlock: 8 }
const fold = (label, child) => h('details', { 'data-coach-athlete-fold': label, style: foldStyle },
  h('summary', { style: foldSummary }, label), child)

// Mounted only in the enabled, authorized roster. Drafts live in local state;
// identity/day/owner keys discard them on context changes. There is no send action.
export function CoachMessageDraft({ report, athleteId }) {
  const [draft, setDraft] = useState(null)
  const suggestion = createCoachMessageDraft(report, athleteId)
  return h(CoachMessageDraftView, { suggestion, draft, setDraft })
}

// Pure view: event handlers use the same local setter as the mounted wrapper.
export function CoachMessageDraftView({ suggestion, draft, setDraft }) {
  return h('section', { 'aria-label': 'Beskedudkast' },
    h('p', null, 'Fra ugerapporten: den aktuelle programuge og de seneste 7 dages kost.'),
    h('button', { type: 'button', style: action, disabled: !suggestion,
      onClick: () => setDraft(suggestion?.text ?? null) }, draft === null ? 'Lav beskedudkast' : 'Gendan beskedudkast'),
    draft !== null && h('div', null,
      h('label', null, 'Beskedudkast · gennemse og ret før brug', h('textarea', {
        value: draft, rows: 9, onChange: event => setDraft(event.target.value),
        style: { width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'block',
          font: 'inherit', padding: 12, marginBlock: 12 } })),
      h('p', { role: 'status' }, 'Kun et lokalt udkast. Intet er sendt eller gemt.'),
      h('button', { type: 'button', style: action, onClick: () => setDraft(null) }, 'Luk udkast')))
}

// U3: client og u3 kommer fra CoachScreen. Uden klient eller med u3 falsk monteres
// U3-foldene ikke, og intet læses.
export default function CoachAthleteWorkspace({ data, athlete, onOpen, client, u3 }) {
  if (!data) return null
  return h('div', { 'data-coach-athlete-workspace': athlete.id, style: { minWidth: 0, marginBlock: 16 } },
    h(AthleteCard, { enabled: true, facts: data.facts, compact: data.compact, onOpen }),
    data.error && h('p', { role: 'alert' }, 'Atletens analysegrundlag kunne ikke hentes. Prøv igen efter opdatering.'),
    data.evaluation && fold('Ugeevaluering', h(WeekEvaluation, { enabled: true, input: data.evaluation })),
    (data.tracking || data.signals.length > 0) && fold('Belastning og trend', h('div', null,
      data.tracking && h(BelastningOgTrend, { enabled: true, data: data.tracking }),
      data.signals.length > 0 && h('details', null,
        h('summary', { style: { minHeight: 48, cursor: 'pointer' } }, 'Signaler og datagrundlag'),
        h('ul', null, ...data.signals.map(signal => h('li', { key: `${signal.key}:${signal.subject}` },
          h('strong', null, signal.strength === 'vigtig' ? 'Kræver opmærksomhed' : signal.strength === 'obs' ? 'Opmærksomhed' : 'Information'),
          h('p', null, signal.reasons.join(' · ')),
          ...signal.dataBasis.map((basis, index) => h('p', { key: index },
            `${basis.from} – ${basis.to}: ${basis.summary} (${basis.sampleCount} ${antalOrd(basis.sampleCount, 'registrering', 'registreringer')})`)))))))),
    u3 === true && client && h(BlocksView, { client, athleteId: athlete.id, source: 'coach',
      foldProps: { 'data-coach-athlete-fold': 'Blok for blok', style: foldStyle }, summaryStyle: foldSummary }),
    u3 === true && client && h(WeekByWeekView, { client, athlete,
      foldProps: { 'data-coach-athlete-fold': 'Uge for uge', style: foldStyle }, summaryStyle: foldSummary }),
    data.plan && fold('Planlægningsgrundlag', h(PlanGrundlagView, { enabled: true, snapshot: data.plan, today: data.facts.today })),
    hasReportValues(data.report, athlete.id) && createCoachMessageDraft(data.report, athlete.id) && fold('Beskedudkast fra ugerapport',
      h(CoachMessageDraft, { key: data.key, report: data.report, athleteId: athlete.id })))
}
