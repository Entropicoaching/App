import { createElement as h, useEffect, useState } from 'react'
import { s, initials } from '../../dashboardShared.js'
import CoachSessionNotes from './SessionNotesView.mjs'
import ProgramEndingView from './ProgramEndingView.mjs'
import ProgramOverblik from '../../dashboard/ProgramOverblikView.mjs'
import { DEFAULT_ENTROPI2_COACH, coachHomeModel, hasUndatedPlannedWeek, openCoachRow, selectCoachTab } from './coachModel.mjs'

const button = { minHeight: 52, padding: 16, font: 'inherit', color: '#edeae2',
  background: '#1c1c18', borderWidth: 1, borderStyle: 'solid', borderColor: '#59564c', borderRadius: 12,
  cursor: 'pointer', textAlign: 'left', overflowWrap: 'anywhere' }

// Assembly mounts this component only for coach list/inbox with entropi2 === true.
// The clock is isolated behind the disabled boundary and owns no data reads.
const MONTHS_DA = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
const coachDay = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? '')); return m ? `${Number(m[3])}. ${MONTHS_DA[Number(m[2]) - 1]}` : 'Ukendt dato' }

export default function CoachScreen(props = {}) {
  if (props.enabled !== true) return null
  return h(ClockedCoach, props)
}
function ClockedCoach(props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])
  return h(CoachView, { ...props, today: props.today ?? now })
}

export function CoachView({ enabled = DEFAULT_ENTROPI2_COACH, tab = 'home', today = new Date(), ...props }) {
  if (enabled !== true) return null
  const model = coachHomeModel(props, today)
  const inbox = tab === 'inbox'
  const unknownPrograms = model.athletes.filter(a => hasUndatedPlannedWeek(model.plans[a.id]))
  const datedPrograms = model.athletes.filter(a => !hasUndatedPlannedWeek(model.plans[a.id]))
  const available = typeof props.openProfile === 'function' && typeof props.openCoachPriorityItem === 'function'
  const canTab = typeof props.setView === 'function' && typeof props.setSelectedAthlete === 'function'
  const rowButton = (row, index) => h('li', { key: row.key }, h('button', {
    type: 'button', disabled: !available, 'data-coach-action': row.key,
    style: { ...button, width: '100%', marginBlock: 6,
      ...(index === 0 && !inbox ? { borderColor: '#c8923a' } : {}) },
    onClick: available ? () => openCoachRow(row, props, inbox ? 'inbox' : 'list') : undefined },
    h('span', { style: { ...s.avatar, display: 'inline-flex', marginRight: 12 }, 'aria-hidden': true }, initials(row.athlete.name)),
    h('strong', null, row.athlete.name), h('span', { style: { display: 'block', marginTop: 8 } }, row.reason)))
  const rows = inbox ? model.inbox : model.actions
  // Marc 3. nov.: keep it simple. Kun det vigtigste staar aabent; resten er foldet ind.
  const fold = { marginBlock: 16, borderTop: '1px solid #414139', paddingTop: 8 }
  const foldSummary = { cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }
  const foldHeading = { display: 'inline', fontSize: 20, margin: 0 }
  // Foldene viser en tydelig pil, saa man ser, at de kan aabnes.
  const arrow = h('span', { 'aria-hidden': true, style: { marginRight: 10, color: '#d8b16b' } }, '▸')
  return h('main', { 'data-entropi2-coach': true, style: { boxSizing: 'border-box',
    maxWidth: 900, marginInline: 'auto', padding: 20, background: '#141410', color: '#edeae2',
    fontFamily: s.wrap.fontFamily, lineHeight: 1.5, overflowWrap: 'anywhere' } },
    h('style', null, '[data-entropi2-coach] button:focus-visible{outline:3px solid #f1cf7b;outline-offset:3px}'),
    h('nav', { 'aria-label': 'Coach', style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      ...[['home', 'Overblik'], ['inbox', 'Indbakke']].map(([value, label]) => h('button', {
        key: value, type: 'button', style: button, disabled: !canTab,
        'aria-current': (value === 'inbox') === inbox ? 'page' : undefined,
        onClick: canTab ? () => selectCoachTab(value, props) : undefined }, label))),
    // Marc 3. nov.: dansk dato og luft til knapperne over.
    h('p', { style: { marginTop: 20, marginBottom: 0, color: '#b9b4a8' } }, `Coach · ${coachDay(model.day)}`),
    h('h1', { style: { fontFamily: 'Georgia, serif', fontSize: 36, lineHeight: 1.15 } }, inbox ? 'Indbakke' : 'Det vigtigste først.'),
    !available && h('p', { role: 'alert' }, 'Navigationen er ikke tilsluttet.'),
    model.state === 'empty' ? h('p', { role: 'status' }, 'Ingen synlige atleter.') :
      model.state !== 'ready' && h('p', { role: 'status' }, model.hasError
        ? 'Nogle data kunne ikke hentes. Overblikket er ufuldstændigt.'
        : 'Grundlaget afventer opdatering. Ukendt antal handlinger.'),
    h('section', { 'aria-label': inbox ? 'Ulæste beskeder og indsendelser' : 'Atleter der kræver handling' },
      h('h2', null, inbox ? 'Venter på dig' : 'Kræver dit blik'),
      rows.length ? h('ul', { style: { listStyle: 'none', padding: 0 } }, ...rows.map(rowButton)) :
        model.complete && h('p', null, inbox ? 'Intet venter på dig lige nu.' : 'Ingen atleter kræver dit blik lige nu.')),
    !inbox && (model.nutritionState === 'error' || model.nutritionState === 'partial') && h('details', {
      'aria-label': 'Kostoverblik', 'data-coach-fold': 'kost', 'data-coach-nutrition-state': model.nutritionState, open: true, style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Kost')),
      h('p', { role: 'alert' }, model.nutritionState === 'error'
        ? 'Kostdata kunne ikke hentes. Overblikket viser ikke kost lige nu.'
        : 'Kostdata er ufuldstændige. Overblikket viser ikke kost lige nu.'),
      model.nutritionReload && h('button', { type: 'button', style: button, onClick: model.nutritionReload }, 'Hent kost igen')),
    !inbox && model.nutritionState === 'ready' && model.nutrition.size > 0 && h('details', { 'aria-label': 'Kostoverblik', 'data-coach-fold': 'kost', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, `Kost (${model.nutrition.size})`)),
      h('ul', { style: { listStyle: 'none', padding: 0 } },
        ...model.athletes.filter(a => model.nutrition.has(a.id)).map(a => h('li', { key: a.id,
          style: { marginBlock: 12 }, 'data-coach-nutrition': a.id },
          h('strong', null, a.name), h('span', { style: { display: 'block' } }, model.nutrition.get(a.id).text))))),
    !inbox && h('details', { 'aria-label': 'Noter fra passene', 'data-coach-fold': 'noter', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Noter fra passene')),
      h(CoachSessionNotes, { source: props, context: model })),
    !inbox && h('details', { 'aria-label': 'Programmer der slutter', 'data-coach-fold': 'programslut', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Programmer der slutter')),
      h(ProgramEndingView, { context: model, openProfile: props.openProfile })),
    inbox ? model.rosterReady && h('details', { 'aria-label': 'Alle samtaler', 'data-coach-fold': 'samtaler', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, `Alle samtaler (${model.athletes.length})`)),
      ...model.athletes.map(a => h('button', { key: a.id, type: 'button', style: { ...button, margin: 4 },
        disabled: !available, onClick: available ? () => props.openProfile(a, 'beskeder', 'inbox') : undefined }, a.name))) :
      h('details', { 'aria-label': 'Ugens programmer', 'data-coach-fold': 'programmer', style: fold },
        h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, `Ugens programmer (${model.athletes.length})`)),
        model.calendarReady && available ? h('div', null,
          // Keep uncertain athletes visible without claiming the dated subset is complete.
          unknownPrograms.length > 0 && h('ul', { style: { listStyle: 'none', padding: 0 } },
            ...unknownPrograms.map(a => h('li', { key: a.id }, h('button', {
              type: 'button', style: { ...button, width: '100%', marginBlock: 6 },
              onClick: () => props.openProfile(a, 'program', 'list') },
              h('strong', null, a.name), h('span', { style: { display: 'block' } },
                'Programgrundlaget er ukendt. En planlagt uge mangler en gyldig dato.'))))),
          (datedPrograms.length > 0 || unknownPrograms.length === 0) && h(ProgramOverblik, { athletes: datedPrograms, calendarWeeks: model.plans,
            hiddenAthleteIds: new Set(), today: model.day, loading: false, loadError: false,
            openProfile: (a, target) => props.openProfile(a, target, 'list') })) :
          h('p', { role: 'status' }, 'Programgrundlaget er ukendt.')))
}
