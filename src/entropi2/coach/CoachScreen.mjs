import { createElement as h, useEffect, useState } from 'react'
import { s, initials } from '../../dashboardShared.js'
import WeeklyReport from './WeeklyReport.mjs'
import { weeklyReportModel, hasWeeklyReportData } from './weeklyReportModel.mjs'
import CoachAthleteWorkspace from './CoachAthleteWorkspace.mjs'
import { coachAthleteWorkspace } from './coachWorkspaceModel.mjs'
import CoachSessionNotes from './SessionNotesView.mjs'
import ProgramEndingView, { programEndingModel } from './ProgramEndingView.mjs'
import CoachProgramsView from './CoachProgramsView.mjs'
import { CoachTeamRegistrations } from '../tracking/hold/CoachTeam.mjs'
import { coachTeamModel } from './coachTeamModel.mjs'
import { coachHomeModel, openCoachRow, selectCoachTab } from './coachModel.mjs'
import CoachRadar, { coachRadarEnabled } from './radar/CoachRadar.mjs'

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
  const [athleteQuery, setAthleteQuery] = useState('')
  const [athletesOpen, setAthletesOpen] = useState(false)
  const [inboxLimit, setInboxLimit] = useState(10)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])
  return h(CoachView, { ...props, today: props.today ?? now,
    athleteQuery: props.athleteQuery ?? athleteQuery,
    onAthleteQueryChange: props.onAthleteQueryChange ?? setAthleteQuery,
    athletesOpen: props.athletesOpen ?? athletesOpen,
    onAthletesOpenChange: props.onAthletesOpenChange ?? setAthletesOpen,
    inboxLimit: props.inboxLimit ?? inboxLimit,
    onShowMoreInbox: props.onShowMoreInbox ?? (() => setInboxLimit(limit => limit + 10)) })
}

export function CoachView(input = {}) {
  if (input.enabled !== true) return null
  const { tab = 'home', today = new Date(), athleteQuery = '', onAthleteQueryChange,
    athletesOpen = false, onAthletesOpenChange, inboxLimit = 10, onShowMoreInbox, ...props } = input
  const model = coachHomeModel(props, today)
  const inbox = tab === 'inbox'
  const report = inbox ? null : weeklyReportModel(props, today)
  const team = inbox ? null : coachTeamModel({ enabled: true, props, context: model })
  const ending = inbox ? null : programEndingModel(model)
  const reload = typeof props.reloadOverview === 'function' ? props.reloadOverview : null
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
  const firstRows = rows.slice(0, inbox ? inboxLimit : 3)
  const query = athleteQuery.trim().toLocaleLowerCase('da')
  const summaries = model.summaries.filter(row => row.athlete.name.toLocaleLowerCase('da').includes(query))
  // Marc 3. nov.: keep it simple. Kun det vigtigste staar aabent; resten er foldet ind.
  const fold = { marginBlock: 16, borderTop: '1px solid #414139', paddingTop: 8 }
  const foldSummary = { cursor: 'pointer', minHeight: 48, display: 'flex', alignItems: 'center', minWidth: 0, overflowWrap: 'anywhere' }
  const foldHeading = { display: 'inline', fontSize: 20, margin: 0 }
  // Foldene viser en tydelig pil, saa man ser, at de kan aabnes.
  const arrow = h('span', { 'aria-hidden': true, style: { marginRight: 10, color: '#d8b16b' } }, '▸')
  return h('main', { 'data-entropi2-coach': true, style: { boxSizing: 'border-box',
    maxWidth: 900, marginInline: 'auto', padding: 20, background: '#141410', color: '#edeae2',
    fontFamily: s.wrap.fontFamily, lineHeight: 1.5, overflowWrap: 'anywhere' } },
    h('style', null, '[data-entropi2-coach] :is(button,summary):focus-visible{outline:3px solid #f1cf7b;outline-offset:3px}'),
    h('nav', { 'aria-label': 'Coach', style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
      ...[['home', 'Overblik'], ['inbox', 'Indbakke']].map(([value, label]) => h('button', {
        key: value, type: 'button', style: button, disabled: !canTab,
        'aria-current': (value === 'inbox') === inbox ? 'page' : undefined,
        onClick: canTab ? () => selectCoachTab(value, props) : undefined }, label))),
    // Marc 3. nov.: dansk dato og luft til knapperne over.
    h('p', { style: { marginTop: 20, marginBottom: 0, color: '#b9b4a8' } }, `Coach · ${coachDay(model.day)}`),
    h('h1', { style: { fontFamily: 'Georgia, serif', fontSize: 36, lineHeight: 1.15 } }, inbox ? 'Indbakke' : 'Det vigtigste først.'),
    !available && h('p', { role: 'alert' }, 'Navigationen er ikke tilsluttet.'),
    h('section', { 'aria-label': inbox ? 'Ulæste beskeder og indsendelser' : 'Atleter der kræver handling' },
      h('h2', null, inbox ? 'Venter på dig' : 'Kræver dit blik'),
      model.hasError ? h('p', { role: 'alert' }, 'Nogle data kunne ikke hentes. Overblikket er ufuldstændigt. ',
        reload && h('button', { type: 'button', style: button, disabled: model.isLoading, onClick: reload }, 'Prøv igen')) :
        model.isLoading ? h('p', { role: 'status' }, 'Opdaterer overblikket…') :
          model.state === 'empty' ? h('p', { role: 'status' }, 'Ingen synlige atleter.') :
            !model.complete && h('p', { role: 'status' }, 'Overblikket skal opdateres. ',
              reload && h('button', { type: 'button', style: button, onClick: reload }, 'Opdater overblikket')),
      (rows.length > 0 || model.complete && !model.isLoading && !model.hasError) &&
        h('p', null, `${rows.length} ${rows.length === 1 ? 'opgave' : 'opgaver'} i alt`),
      inbox && (rows.length > 0 || model.complete && !model.isLoading && !model.hasError) &&
        h('p', { 'aria-live': 'polite', 'data-coach-inbox-count': true }, `${firstRows.length} af ${rows.length}`),
      rows.length ? h('ul', { style: { listStyle: 'none', padding: 0 } }, ...firstRows.map(rowButton)) :
        model.complete && model.state !== 'empty' && !model.isLoading && !model.hasError &&
          h('p', null, inbox ? 'Intet venter på dig lige nu.' : 'Ingen atleter kræver dit blik lige nu.'),
      inbox && firstRows.length < rows.length && h('button', { type: 'button', style: button,
        disabled: typeof onShowMoreInbox !== 'function', onClick: onShowMoreInbox }, 'Vis 10 flere'),
      !inbox && rows.length > 3 && h('details', { 'data-coach-fold': 'opgaver', style: fold },
        h('summary', { style: foldSummary }, arrow, `Vis resten (${rows.length - 3})`),
        h('ul', { style: { listStyle: 'none', padding: 0 } }, ...rows.slice(3).map((row, index) => rowButton(row, index + 3))))),
    !inbox && coachRadarEnabled(props.coachRadarEnabled) && h(CoachRadar, { enabled: true, source: props, context: model }),
    team && h('details', { 'aria-label': 'Holdoverblik', 'data-coach-fold': 'hold', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Holdoverblik')),
      h(CoachTeamRegistrations, { enabled: true, model: team })),
    !inbox && model.summaries.length > 0 && h('details', { 'aria-label': 'Atletoverblik', 'data-coach-fold': 'atleter', style: fold,
      open: athletesOpen, onToggle: event => {
        if (event.target !== event.currentTarget) return
        onAthletesOpenChange?.(event.currentTarget.open)
      } },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, `Dine atleter (${model.summaries.length})`)),
      h('label', { style: { display: 'block' } }, 'Søg efter atletnavn',
        h('input', { type: 'search', value: athleteQuery,
          onChange: event => onAthleteQueryChange?.(event.target.value),
          style: { ...button, display: 'block', boxSizing: 'border-box', width: '100%', minHeight: 44, marginTop: 8 } })),
      query && h('button', { type: 'button', style: { ...button, marginTop: 8 },
        onClick: () => onAthleteQueryChange?.('') }, 'Nulstil søgning'),
      h('p', { 'aria-live': 'polite' }, `${summaries.length} af ${model.summaries.length}`),
      summaries.length === 0 && h('p', null, 'Ingen match på atletnavnet.'),
      h('ul', { style: { listStyle: 'none', padding: 0 } },
        ...summaries.map(row => h('li', { key: row.athlete.id },
          h(CoachAthleteWorkspace, { key: `${props.readContext?.coachId}:${row.athlete.id}:${model.day}`,
            athlete: row.athlete, data: coachAthleteWorkspace(props, model, row.athlete, report),
            onOpen: typeof props.openProfile === 'function'
              ? () => props.openProfile(row.athlete, 'hub', 'list') : undefined }))))),
    !inbox && report.ready && report.rows.some(hasWeeklyReportData) && h('details', {
      'aria-label': 'Ugerapport', 'data-coach-fold': 'ugerapport', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Ugerapport')),
      h(WeeklyReport, { ...props, today })),
    !inbox && (model.nutritionState === 'error' || model.nutritionState === 'partial') && h('details', {
      'aria-label': 'Kostoverblik', 'data-coach-fold': 'kost', 'data-coach-nutrition-state': model.nutritionState, open: true, style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Kost')),
      h('p', { role: 'alert' }, model.nutritionState === 'error'
        ? 'Kostdata kunne ikke hentes. Overblikket viser ikke kost lige nu.'
        : 'Kostdata er ufuldstændige. Overblikket viser ikke kost lige nu.'),
      model.nutritionReload && h('button', { type: 'button', style: button, onClick: model.nutritionReload }, 'Hent kost igen')),
    !inbox && model.nutritionState === 'ready' && (model.nutrition.size > 0 || model.kostvane?.aktive > 0) && h('details', { 'aria-label': 'Kostoverblik', 'data-coach-fold': 'kost', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading },
        model.kostvane ? `Kost · ${model.kostvane.medMaal} af ${model.kostvane.aktive} logger 4+ dage` : `Kost (${model.nutrition.size})`)),
      model.kostvane && h('p', { 'data-coach-kostvane': '' },
        `De seneste 7 dage har ${model.kostvane.medMaal} af ${model.kostvane.aktive} atleter logget mad mindst ${model.kostvane.maal} dage. `
        + `${model.kostvane.lidt} har logget 1 til ${model.kostvane.maal - 1} dage, og ${model.kostvane.ingen} har ikke logget.`),
      h('ul', { style: { listStyle: 'none', padding: 0 } },
        ...model.athletes.filter(a => model.nutrition.has(a.id)).map(a => h('li', { key: a.id,
          style: { marginBlock: 12 }, 'data-coach-nutrition': a.id },
          h('strong', null, a.name), h('span', { style: { display: 'block' } }, model.nutrition.get(a.id).text))))),
    !inbox && model.rosterReady && model.athletes.length > 0 && h('details', {
      'aria-label': 'Noter fra passene', 'data-coach-fold': 'noter', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Noter fra passene · Vælg atlet')),
      h(CoachSessionNotes, { source: props, context: model })),
    !inbox && ending.rows.length > 0 && h('details', { 'aria-label': 'Programmer der slutter', 'data-coach-fold': 'programslut', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Programmer der slutter')),
      h(ProgramEndingView, { context: model, openProfile: props.openProfile })),
    inbox ? model.rosterReady && h('details', { 'aria-label': 'Alle samtaler', 'data-coach-fold': 'samtaler', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, `Alle samtaler (${model.athletes.length})`)),
      ...model.athletes.map(a => h('button', { key: a.id, type: 'button', style: { ...button, margin: 4 },
        disabled: !available, onClick: available ? () => props.openProfile(a, 'beskeder', 'inbox') : undefined }, a.name))) :
      model.rosterReady && model.calendarReady && model.athletes.length > 0 && h('details', {
        'aria-label': 'Ugens programmer', 'data-coach-fold': 'programmer', style: fold },
        h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, `Ugens programmer (${model.athletes.length})`)),
        h(CoachProgramsView, { context: model, openProfile: props.openProfile })))
}
