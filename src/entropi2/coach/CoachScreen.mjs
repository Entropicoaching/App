import { createElement as h, useEffect, useState } from 'react'
import { s, initials } from '../../dashboardShared.js'
import WeeklyReport, { weeklyReportLines } from './WeeklyReport.mjs'
import { weeklyReportModel, hasWeeklyReportData } from './weeklyReportModel.mjs'
import CoachAthleteWorkspace from './CoachAthleteWorkspace.mjs'
import { coachAthleteWorkspace } from './coachWorkspaceModel.mjs'
import CoachSessionNotes from './SessionNotesView.mjs'
import { programEndingModel, programEndingLines } from './ProgramEndingView.mjs'
import { programLinesFor } from './CoachProgramsView.mjs'
import AthleteOverview from './AthleteOverview.mjs'
import { CoachTeamRegistrations, teamAthleteLines } from '../tracking/hold/CoachTeam.mjs'
import { coachTeamModel } from './coachTeamModel.mjs'
import { coachHomeModel, openCoachRow } from './coachModel.mjs'
import CoachRadar, { coachRadarEnabled } from './radar/CoachRadar.mjs'
import { u3DataEnabled } from '../u3/flag.mjs'
import { useCoachAttention } from './useCoachAttention.mjs'
import { alsoLine, ATTENTION_UNAVAILABLE } from './coachAttention.mjs'
import { gemKvitteringer, indlaesKvitteringer, medKvittering } from './smerteKvittering.mjs'
import { adaptCoachState } from './coachModel.mjs'
import TeamPatternsView from './TeamPatternsView.mjs'
import { teamAthletes } from './teamPatterns.mjs'
import { attentionFor } from './coachAttentionRead.mjs'
import { u6Enabled } from '../u6/flag.mjs'
import { attentionDraft } from '../u6/coachDraft.mjs'
import { offerCoachDraft } from '../u6/draftHandoff.mjs'
import HeavyWeekLine from '../u6/HeavyWeekLine.mjs'
import { u7Enabled } from '../u7/flag.mjs'
import { dayNumbersLine } from '../u7/coachData.mjs'
import { WeekTargetLine, useTargetSync } from '../u7/CoachWeekTarget.mjs'

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
  // Ordre 1711: kvittering for smerte og ømhed gemmes lokalt pr. coach (ingen tabel).
  const coachId = props.readContext?.coachId
  const [kvitteringer, setKvitteringer] = useState(() => indlaesKvitteringer(coachId))
  // coachId kendes først, når sessionen er læst; så hentes kvitteringerne for netop den coach.
  useEffect(() => { setKvitteringer(indlaesKvitteringer(coachId)) }, [coachId])
  const kvitterSmerte = (athleteId, mark) => setKvitteringer(old => {
    const next = medKvittering(old, athleteId, mark)
    gemKvitteringer(coachId, next)
    return next
  })
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])
  // U3: L1 for de atleter, forsiden allerede har i sin roster. Gør intet uden flaget.
  const u3 = u3DataEnabled(props.u3Data) && props.tab !== 'inbox'
  const roster = u3 ? adaptCoachState(props, props.today ?? now) : null
  const attention = useCoachAttention({ enabled: u3 && roster.rosterReady && roster.athletes.length > 0,
    client: props.notesClient, athleteIds: roster ? roster.athletes.map(a => a.id) : [], day: roster?.day })
  // U7: coachens nuværende kostmål dateres, når tabellen findes. Gør intet uden flaget eller tabellen.
  useTargetSync({ enabled: u7Enabled('coachData', props.u7CoachData) && props.tab !== 'inbox', client: props.notesClient,
    targets: props.coachNutrition?.state === 'ready' ? props.coachNutrition.targets : null, day: props.coachNutrition?.day })
  return h(CoachView, { ...props, today: props.today ?? now,
    ...(u3 && props.u3Attention === undefined ? { u3Attention: attention } : {}),
    smerteKvittering: props.smerteKvittering ?? kvitteringer, onKvitterSmerte: props.onKvitterSmerte ?? kvitterSmerte,
    athleteQuery: props.athleteQuery ?? athleteQuery,
    onAthleteQueryChange: props.onAthleteQueryChange ?? setAthleteQuery,
    athletesOpen: props.athletesOpen ?? athletesOpen,
    onAthletesOpenChange: props.onAthletesOpenChange ?? setAthletesOpen,
    inboxLimit: props.inboxLimit ?? inboxLimit,
    onShowMoreInbox: props.onShowMoreInbox ?? (() => setInboxLimit(limit => limit + 10)) })
}

// Ordre 1547 (1544's fund: grunden blev skåret af ved 390 px). Rækken har plads til cirka 60 tegn på
// 2 linjer. Er navn og grund længere, står hovedet i rækken ("Spørg atleten først"), og resten står i
// folden under den, så hele grunden kan læses uden at stå to gange.
export const GRUND_TO_LINJER = 60
export function reasonParts(name, reason) {
  const text = String(reason ?? '')
  if (`${name ?? ''} · ${text}`.length <= GRUND_TO_LINJER) return { head: text, rest: null }
  const paren = text.indexOf(' (')
  if (paren > 0 && text.endsWith(')')) return { head: text.slice(0, paren), rest: upperFirst(text.slice(paren + 2, -1)) }
  const colon = text.indexOf(': ')
  if (colon > 0) return { head: text.slice(0, colon), rest: upperFirst(text.slice(colon + 2)) }
  return { head: text, rest: null }
}
const upperFirst = text => text.charAt(0).toLocaleUpperCase('da') + text.slice(1)

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
  // U6: ét udkast pr. række. "Skriv" åbner samtalen med udkastet i feltet; coachen retter og sender selv.
  const drafts = !inbox && u6Enabled('drafts', props.u6Drafts)
  const rowAttention = row => model.u3?.attentionState === 'ready' ? attentionFor(props.u3Attention, row.athlete.id, model.day) : null
  const draftFor = row => drafts ? attentionDraft({ row, attention: rowAttention(row),
    weeks: model.calendarReady ? model.plans?.[row.athlete.id] : null, day: model.day }) : null
  // U6 del 3: forslag i tunge uger under rækken, når readiness falder og belastningen stiger.
  const heavyWeek = !inbox && u6Enabled('heavyWeek', props.u6HeavyWeek)
  // U7 del 4: søvn og smerte som tal på rækken og ugens kost mod det mål, der gjaldt. Kun med data.
  const coachData = !inbox && u7Enabled('coachData', props.u7CoachData)
  const dayLine = row => coachData ? dayNumbersLine(rowAttention(row)?.daily, model.day, row.reasons) : null
  const draftBlock = row => {
    const draft = draftFor(row)
    return draft && h('div', { 'data-u6-draft': row.athlete.id, style: { margin: '0 0 12px', paddingInline: 4 } },
      h('p', { style: { margin: '0 0 8px', color: '#b9b4a8' } }, `Udkast: ${draft.text}`),
      h('button', { type: 'button', style: { ...button, minHeight: 48, paddingBlock: 10 }, disabled: !available,
        'aria-label': `Skriv til ${row.athlete.name} med udkastet`,
        onClick: available ? () => { offerCoachDraft(draft); props.openProfile(row.athlete, 'beskeder', 'list') } : undefined }, 'Skriv'))
  }
  // U11: én række pr. opgave (navn · grund). Også-linjen, dagens tal, tung uge, ugens kost og udkastet
  // ligger samlet i en lukket fold under rækken, så tre opgaver ikke fylder hele telefonen.
  // Ordre 1547: grunden står på højst 2 linjer ved 390 px; er den længere, står hele grunden i folden.
  const twoLines = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, minWidth: 0, overflow: 'hidden', whiteSpace: 'normal' }
  const rowDetails = row => {
    const also = model.u3 && !inbox && alsoLine(row.reasons), day = dayLine(row)
    const heavy = heavyWeek && rowAttention(row), draft = draftBlock(row)
    const long = reasonParts(row.athlete.name, row.reason).rest
    const kvitter = row.smerte && typeof props.onKvitterSmerte === 'function'
    if (!also && !day && !heavy && !coachData && !draft && !long && !kvitter) return null
    return h('details', { 'data-u11-detaljer': row.athlete.id, style: { margin: '0 0 10px', paddingInline: 4 } },
      h('summary', { style: { cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', color: '#b9b4a8' } },
        arrow, long ? 'Hele grunden' + (also || day || heavy || coachData || draft ? ' og detaljer' : '') : draft ? 'Detaljer og udkast' : 'Detaljer'),
      long && h('span', { 'data-coach-hel-grund': true, style: { display: 'block', marginTop: 4, color: '#edeae2' } }, long),
      also && h('span', { 'data-coach-also': true, style: { display: 'block', marginTop: 4, color: '#b9b4a8' } }, also),
      day && h('span', { 'data-u7-day': row.athlete.id, style: { display: 'block', marginTop: 4, color: '#edeae2' } }, day),
      heavy && h(HeavyWeekLine, { key: `u6-heavy:${row.athlete.id}:${model.day}`, client: props.notesClient,
        athleteId: row.athlete.id, day: model.day, readiness: rowAttention(row).readiness, read: props.u6ReadHeavyWeek }),
      coachData && h(WeekTargetLine, { key: `u7-week:${row.athlete.id}:${model.day}`, client: props.notesClient,
        athleteId: row.athlete.id, day: model.day, read: props.u7ReadWeekNutrition }),
      draft,
      kvitter && h('button', { type: 'button', 'data-coach-kvitter-smerte': row.athlete.id,
        style: { ...button, minHeight: 48, paddingBlock: 10, marginTop: 8 },
        'aria-label': `Kvittér smerte for ${row.athlete.name}`, onClick: () => props.onKvitterSmerte(row.athlete.id, row.smerte) }, 'Kvittér smerte'))
  }
  const rowButton = (row, index) => h('li', { key: row.key }, h('button', {
    type: 'button', disabled: !available, 'data-coach-action': row.key,
    style: { ...button, width: '100%', marginBlock: 6, display: 'flex', alignItems: 'center', minHeight: 56, paddingBlock: 8,
      ...(index === 0 && !inbox ? { borderColor: '#c8923a' } : {}) },
    onClick: available ? () => openCoachRow(row, props, inbox ? 'inbox' : 'list') : undefined },
    h('span', { style: { ...s.avatar, display: 'inline-flex', flex: 'none', marginRight: 12 }, 'aria-hidden': true }, initials(row.athlete.name)),
    h('span', { 'data-u11-linje': '', style: { ...twoLines, flex: 1 } },
      h('strong', null, row.athlete.name), h('span', { style: { color: '#d9d4c8' } }, ' · ', inbox ? row.reason : reasonParts(row.athlete.name, row.reason).head))),
    !inbox && rowDetails(row))
  const rows = inbox ? model.inbox : model.actions
  const firstRows = rows.slice(0, inbox ? inboxLimit : 3)
  // Marc 3. nov.: keep it simple. Kun det vigtigste staar aabent; resten er foldet ind.
  const fold = { marginBlock: 16, borderTop: '1px solid #414139', paddingTop: 8 }
  const foldSummary = { cursor: 'pointer', minHeight: 48, display: 'flex', alignItems: 'center', minWidth: 0, overflowWrap: 'anywhere' }
  const foldHeading = { display: 'inline', fontSize: 20, margin: 0 }
  // Foldene viser en tydelig pil, saa man ser, at de kan aabnes.
  const arrow = h('span', { 'aria-hidden': true, style: { marginRight: 10, color: '#d8b16b' } }, '▸')
  // U11: en gruppe uden indhold vises ikke (kontrolfund 5).
  const group = (key, title, children) => children.some(Boolean) && h('details', { key, 'aria-label': title,
    'data-u11-gruppe': key, 'data-u11-top': key, style: fold },
  h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, title)),
  h('div', { style: { paddingLeft: 12 } }, ...children))
  // Ordre 1692 (Marc 16. nov.: "pas på at det ikke er gentagelser på siderne"): hver atlet står kun i Kræver dit blik
  // og i Dine atleter. Det, der før stod under navn i Holdoverblik, Ugerapport, Kost, Programmer og Atletkort,
  // ligger nu i én lukket fold "Flere tal" under atletens række, uden navnet gentaget.
  const detailsFor = athlete => {
    const reportRow = report?.ready ? report.rows.find(r => r.athlete.id === athlete.id) : null
    const reportLines = reportRow && hasWeeklyReportData(reportRow) ? weeklyReportLines(reportRow) : []
    const kost = model.nutritionState === 'ready' && model.nutrition.get(athlete.id)?.text
    const summary = model.summaries.find(row => row.athlete.id === athlete.id)
    const lines = [
      ...(team ? teamAthleteLines(team, athlete.id) : []), ...reportLines,
      kost && h('p', { key: 'kost', 'data-coach-nutrition': athlete.id }, kost),
      ...programLinesFor(model, athlete.id), ...(ending ? programEndingLines(ending, athlete.id, props.openProfile) : []),
    ]
    const workspace = summary && h(CoachAthleteWorkspace, { key: `${props.readContext?.coachId}:${athlete.id}:${model.day}`,
      athlete, data: coachAthleteWorkspace(props, model, athlete, report), client: props.notesClient, u3: u3DataEnabled(props.u3Data),
      utenNavn: true, onOpen: typeof props.openProfile === 'function' ? () => props.openProfile(athlete, 'hub', 'list') : undefined })
    return [...lines, workspace]
  }
  return h('main', { 'data-entropi2-coach': true, style: { boxSizing: 'border-box',
    maxWidth: 900, marginInline: 'auto', padding: 20, background: '#141410', color: '#edeae2',
    fontFamily: s.wrap.fontFamily, lineHeight: 1.5, overflowWrap: 'anywhere' } },
    h('style', null, '[data-entropi2-coach] :is(button,summary):focus-visible{outline:3px solid #f1cf7b;outline-offset:3px}'),
    // Ordre 1544 (Marc 16. nov.: "pas på at det ikke er gentagelser på siderne"): Overblik og Indbakke stod
    // både her og i menuen (Forside og Coach Briefing). Menuen bærer dem nu alene. På forsiden står
    // Kræver dit blik øverst uden en overskrift over sig; indbakken beholder sin.
    h('p', { style: { marginTop: 0, marginBottom: 0, color: '#b9b4a8' } }, `Coach · ${coachDay(model.day)}`),
    inbox && h('h1', { style: { fontFamily: 'Georgia, serif', fontSize: 36, lineHeight: 1.15 } }, 'Indbakke'),
    !available && h('p', { role: 'alert' }, 'Navigationen er ikke tilsluttet.'),
    h('section', { 'aria-label': inbox ? 'Ulæste beskeder og indsendelser' : 'Atleter der kræver handling', ...(inbox ? {} : { 'data-u11-top': 'opgaver' }) },
      h('h2', null, inbox ? 'Venter på dig' : 'Kræver dit blik'),
      model.hasError ? h('p', { role: 'alert' }, 'Nogle data kunne ikke hentes. Overblikket er ufuldstændigt. ',
        reload && h('button', { type: 'button', style: button, disabled: model.isLoading, onClick: reload }, 'Prøv igen')) :
        model.isLoading ? h('p', { role: 'status' }, 'Opdaterer overblikket…') :
          model.state === 'empty' ? h('p', { role: 'status' }, 'Ingen synlige atleter.') :
            !model.complete && h('p', { role: 'status' }, 'Overblikket skal opdateres. ',
              reload && h('button', { type: 'button', style: button, onClick: reload }, 'Opdater overblikket')),
      // Ordre 1547 (1544's fund): tom liste siger kun den rolige sætning nedenfor, ikke "0 opgaver i alt" og "0 af 0".
      // Ordre 1707 (Marc 18. nov.: "coach siden er lidt rodet"): på forsiden står rækkerne selv, og "Vis resten (n)"
      // bærer tallet over tre; "n opgaver i alt" var et tal uden handling. Indbakken beholder sit tal.
      inbox && rows.length > 0 && h('p', null, `${rows.length} ${rows.length === 1 ? 'opgave' : 'opgaver'} i alt`),
      inbox && rows.length > 0 && h('p', { 'aria-live': 'polite', 'data-coach-inbox-count': true }, `${firstRows.length} af ${rows.length}`),
      rows.length ? h('ul', { style: { listStyle: 'none', padding: 0 } }, ...firstRows.map(rowButton)) :
        model.complete && model.state !== 'empty' && !model.isLoading && !model.hasError &&
          h('p', null, inbox ? 'Intet venter på dig lige nu.' : 'Ingen atleter kræver dit blik lige nu.'),
      inbox && firstRows.length < rows.length && h('button', { type: 'button', style: button,
        disabled: typeof onShowMoreInbox !== 'function', onClick: onShowMoreInbox }, 'Vis 10 flere'),
      !inbox && model.u3?.attentionState === 'unavailable' && h('p', { role: 'status', 'data-u3-attention-unavailable': true }, ATTENTION_UNAVAILABLE),
      !inbox && rows.length > 3 && h('details', { 'data-coach-fold': 'opgaver', style: fold },
        h('summary', { style: foldSummary }, arrow, `Vis resten (${rows.length - 3})`),
        h('ul', { style: { listStyle: 'none', padding: 0 } }, ...rows.slice(3).map((row, index) => rowButton(row, index + 3))))),
    !inbox && coachRadarEnabled(props.coachRadarEnabled) && h(CoachRadar, { enabled: true, source: props, context: model }),
    !inbox && (model.nutritionState === 'error' || model.nutritionState === 'partial') && h('details', {
      'aria-label': 'Kostoverblik', 'data-coach-fold': 'kost', 'data-coach-nutrition-state': model.nutritionState, open: true, style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Kost')),
      h('p', { role: 'alert' }, model.nutritionState === 'error'
        ? 'Kostdata kunne ikke hentes. Overblikket viser ikke kost lige nu.'
        : 'Kostdata er ufuldstændige. Overblikket viser ikke kost lige nu.'),
      model.nutritionReload && h('button', { type: 'button', style: button, onClick: model.nutritionReload }, 'Hent kost igen')),
    // U11 (Marc 11. nov.): en nem oversigt, så coachen hurtigt kan klikke ind og se en atlets program.
    !inbox && model.rosterReady && model.athletes.length > 0 && h('section', { 'aria-label': 'Dine atleter', 'data-u11-top': 'atleter',
      style: { marginTop: 24 } },
      h('h2', null, `Dine atleter (${model.athletes.length})`),
      h(AthleteOverview, { context: model, openProfile: props.openProfile, details: detailsFor, query: athleteQuery, onQueryChange: onAthleteQueryChange })),
    // U11: det, der hører sammen, under én overskrift. Begge grupper er lukkede.
    inbox ? model.rosterReady && h('details', { 'aria-label': 'Alle samtaler', 'data-coach-fold': 'samtaler', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, `Alle samtaler (${model.athletes.length})`)),
      ...model.athletes.map(a => h('button', { key: a.id, type: 'button', style: { ...button, margin: 4 },
        disabled: !available, onClick: available ? () => props.openProfile(a, 'beskeder', 'inbox') : undefined }, a.name))) : [
      group('hold', 'Holdet', [
        team && h('details', { 'aria-label': 'Holdoverblik', 'data-coach-fold': 'hold', style: fold },
          h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Holdoverblik')),
          h(CoachTeamRegistrations, { enabled: true, model: team, utenAtleter: true })),
        // U3 afsnit 3: "Holdet samlet" uden navne. Læser først, når folden åbnes.
        !inbox && u3DataEnabled(props.u3Data) && props.notesClient && model.rosterReady && h(TeamPatternsView, {
          client: props.notesClient, day: model.day, athletes: teamAthletes(model.athletes, model.day),
          targets: new Map(model.athletes.map(a => [a.id, props.coachNutrition?.targets?.find?.(t => t?.athlete_id === a.id)?.protein_target ?? a.protein_target])),
          foldProps: { 'aria-label': 'Holdet samlet', 'data-coach-fold': 'holdet-samlet', style: fold },
          summary: h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Holdet samlet')) }),
        !inbox && report.ready && report.rows.some(hasWeeklyReportData) && h('details', {
          'aria-label': 'Ugerapport', 'data-coach-fold': 'ugerapport', style: fold },
          h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Ugerapport')),
          h(WeeklyReport, { ...props, today, utenAtleter: true })),
        !inbox && model.nutritionState === 'ready' && model.kostvane && h('details', { 'aria-label': 'Kostoverblik', 'data-coach-fold': 'kost', style: fold },
          h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading },
            `Kost · ${model.kostvane.medMaal} af ${model.kostvane.aktive} logger 4+ dage`)),
          h('p', { 'data-coach-kostvane': '' },
            `De seneste 7 dage har ${model.kostvane.medMaal} af ${model.kostvane.aktive} atleter logget mad mindst ${model.kostvane.maal} dage. `
            + `${model.kostvane.lidt} har logget 1 til ${model.kostvane.maal - 1} dage, og ${model.kostvane.ingen} har ikke logget.`)),
      ]),
      group('programmer', 'Programmer og noter', [
        !inbox && model.rosterReady && model.athletes.length > 0 && h('details', {
          'aria-label': 'Noter fra passene', 'data-coach-fold': 'noter', style: fold },
          h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Noter fra passene · Vælg atlet')),
          h(CoachSessionNotes, { source: props, context: model })),
      ])])
}
