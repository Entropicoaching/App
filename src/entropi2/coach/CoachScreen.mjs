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
import { useKostKlienter } from './useKostKlienter.mjs'
import { activityDay } from '../../dashboard/coachInactive.mjs'
import { alsoLine, ATTENTION_UNAVAILABLE } from './coachAttention.mjs'
import { idagVisible, IDAG_MAX } from './coachIDag.mjs'
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
  // Ordre 2103: kostklienter (kostpakke, intet program) læses én gang pr. dag for de atleter, forsiden viser.
  const kostDay = activityDay(props.today ?? now)
  const kostKlienter = useKostKlienter({ client: props.notesClient, athleteIds: props.readContext?.athleteIds, day: kostDay })
  const roster = u3 ? adaptCoachState(props, props.today ?? now) : null
  const attention = useCoachAttention({ enabled: u3 && roster.rosterReady && roster.athletes.length > 0,
    client: props.notesClient, athleteIds: roster ? roster.athletes.map(a => a.id) : [], day: roster?.day })
  // U7: coachens nuværende kostmål dateres, når tabellen findes. Gør intet uden flaget eller tabellen.
  useTargetSync({ enabled: u7Enabled('coachData', props.u7CoachData) && props.tab !== 'inbox', client: props.notesClient,
    targets: props.coachNutrition?.state === 'ready' ? props.coachNutrition.targets : null, day: props.coachNutrition?.day })
  return h(CoachView, { ...props, today: props.today ?? now, ...(kostKlienter ? { kostKlienter } : {}),
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
// Ordre 2005a: et trin i ugen viser fem rækker; resten står i en lukket fold under trinnet.
export const STEP_ROWS = 5
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
    if (!also && !day && !heavy && !coachData && !draft && !long && !kvitter && !row.ugeGrund) return null
    return h('details', { 'data-u11-detaljer': row.athlete.id, style: { margin: '0 0 10px', paddingInline: 4 } },
      h('summary', { style: { cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', color: '#b9b4a8' } },
        arrow, long ? 'Hele grunden' + (also || day || heavy || coachData || draft || row.ugeGrund ? ' og detaljer' : '') : draft ? 'Detaljer og udkast' : 'Detaljer'),
      long && h('span', { 'data-coach-hel-grund': true, style: { display: 'block', marginTop: 4, color: '#edeae2' } }, long),
      row.ugeGrund && h('span', { 'data-coach-uge-grund': row.athlete.id, style: { display: 'block', marginTop: 4, color: '#edeae2' } }, `Mangler ny uge: ${row.ugeGrund}`),
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
  const rowButton = (row, index, plain = false) => h('li', { key: row.key }, h('button', {
    type: 'button', disabled: !available, 'data-coach-action': row.key,
    style: { ...button, width: '100%', marginBlock: 6, display: 'flex', alignItems: 'center', minHeight: 56, paddingBlock: 8,
      ...(index === 0 && !inbox ? { borderColor: '#c8923a' } : {}) },
    onClick: available ? () => openCoachRow(row, props, inbox ? 'inbox' : 'list') : undefined },
    h('span', { style: { ...s.avatar, display: 'inline-flex', flex: 'none', marginRight: 12 }, 'aria-hidden': true }, initials(row.athlete.name)),
    h('span', { 'data-u11-linje': '', style: { ...twoLines, flex: 1 } },
      h('strong', null, row.athlete.name), h('span', { style: { color: '#d9d4c8' } }, ' · ', inbox ? row.reason : reasonParts(row.athlete.name, row.reason).head))),
    !inbox && !plain && rowDetails(row))
  // Ordre 2005a: Kræver dit blik på forsiden er nu kun det, der venter på svar (beskeder og videoer), én række pr. atlet.
  const rows = inbox ? model.inbox : model.waiting
  const firstRows = rows.slice(0, inbox ? inboxLimit : 3)
  const idagRows = inbox ? [] : idagVisible(model.idag)
  // Ordre 2491: med 15 atleter kræver flere end 5 coachen. Resten står i en lukket fold i samme liste, så ingen atlet kun findes bag Coach Briefing.
  const idagRest = inbox || !Array.isArray(model.idag) ? [] : model.idag.slice(IDAG_MAX)
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
      utenNavn: true, onOpen: typeof props.openProfile === 'function' ? () => props.openProfile(athlete, 'program', 'list') : undefined })
    return [...lines, workspace]
  }
  const calm = model.complete && model.state !== 'empty' && !model.isLoading && !model.hasError
  const status = model.hasError ? h('p', { role: 'alert' }, 'Nogle data kunne ikke hentes. Overblikket er ufuldstændigt. ',
    reload && h('button', { type: 'button', style: button, disabled: model.isLoading, onClick: reload }, 'Prøv igen')) :
    model.isLoading ? h('p', { role: 'status' }, 'Opdaterer overblikket…') :
      model.state === 'empty' ? h('p', { role: 'status' }, 'Ingen synlige atleter.') :
        !model.complete && h('p', { role: 'status' }, 'Overblikket skal opdateres. ',
          reload && h('button', { type: 'button', style: button, onClick: reload }, 'Opdater overblikket'))
  // Ordre 2005a: ét trin i ugen. Rækkerne åbner atletens program med ét tryk; Sendt har ingen detaljer under sig.
  const step = (key, title, list, empty, plain = false) => h('section', { 'aria-label': title, 'data-coach-uge': key },
    h('h2', null, title, list.length > 0 && h('span', { style: { color: '#b9b4a8', fontWeight: 400 } }, ` (${list.length})`)),
    list.length ? h('ul', { style: { listStyle: 'none', padding: 0 } }, ...list.slice(0, STEP_ROWS).map(row => rowButton(row, -1, plain))) :
      model.uge.ready && calm && h('p', { style: { color: '#b9b4a8' } }, empty),
    list.length > STEP_ROWS && h('details', { 'data-coach-fold': `${key}-resten`, style: fold },
      h('summary', { style: foldSummary }, arrow, `Vis resten (${list.length - STEP_ROWS})`),
      h('ul', { style: { listStyle: 'none', padding: 0 } }, ...list.slice(STEP_ROWS).map(row => rowButton(row, -1, plain)))))
  const more = children => children.some(Boolean) && h('details', { 'aria-label': 'Mere', 'data-coach-fold': 'mere', style: fold },
    h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Mere')),
    h('div', { style: { paddingLeft: 12 } }, ...children))
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
    inbox ? h('section', { 'aria-label': 'Ulæste beskeder og indsendelser' },
      h('h2', null, 'Venter på dig'),
      status,
      rows.length > 0 && h('p', null, `${rows.length} ${rows.length === 1 ? 'opgave' : 'opgaver'} i alt`),
      rows.length > 0 && h('p', { 'aria-live': 'polite', 'data-coach-inbox-count': true }, `${firstRows.length} af ${rows.length}`),
      rows.length ? h('ul', { style: { listStyle: 'none', padding: 0 } }, ...firstRows.map((row, index) => rowButton(row, index))) :
        calm && h('p', null, 'Intet venter på dig lige nu.'),
      firstRows.length < rows.length && h('button', { type: 'button', style: button,
        disabled: typeof onShowMoreInbox !== 'function', onClick: onShowMoreInbox }, 'Vis 10 flere')) :
      // Ordre 2005a (Marc 20. nov.: "husk jeg er pt den eneste træner, kan vi arbejde på at optimere mit orkflow"):
      // forsiden følger ugen. Check-in og ny uge sker i Claude-chatten; her står, hvem der mangler en ny uge,
      // hvad der venter på svar, og hvad der er sendt, hver række med ét tryk ind.
      h('div', { 'data-coach-uge': 'uge' },
        // Ordre 1547 (1544's fund): tom liste siger kun den rolige sætning, ikke "0 opgaver i alt".
        // Ordre 1707: "Vis resten (n)" bærer tallet over tre; indbakken beholder sit tal.
        // Ordre 2417: én liste øverst, højst 5 rækker, hasteste først (smerte, ingen log i 3 dage, svar der venter, programuge der slutter).
        h('section', { 'aria-label': 'Atleter der kræver handling', 'data-u11-top': 'opgaver', 'data-coach-uge': 'venter', 'data-coach-idag': true },
          h('h2', null, 'Kræver dig i dag'),
          status,
          idagRows.length ? h('ul', { style: { listStyle: 'none', padding: 0 } }, ...idagRows.map((row, index) => rowButton(row, index))) :
            calm && h('p', { 'data-coach-idag-tom': true }, 'Ingen kræver dig i dag.'),
          idagRest.length > 0 && h('details', { 'data-coach-fold': 'idag-resten', style: fold },
            h('summary', { style: foldSummary }, arrow, `Vis resten (${idagRest.length})`),
            h('ul', { style: { listStyle: 'none', padding: 0 } }, ...idagRest.map(row => rowButton(row, -1))))),
        model.state !== 'empty' && step('ny-uge', 'Mangler ny uge', model.uge.nyUge, 'Alle har en uge i appen.'),
        model.state !== 'empty' && step('sendt', 'Sendt', model.uge.sendt, 'Ingen uge sendt til denne uge endnu.', true)),
    !inbox && coachRadarEnabled(props.coachRadarEnabled) && h(CoachRadar, { enabled: true, source: props, context: model }),
    !inbox && (model.nutritionState === 'error' || model.nutritionState === 'partial') && h('details', {
      'aria-label': 'Kostoverblik', 'data-coach-fold': 'kost', 'data-coach-nutrition-state': model.nutritionState, open: true, style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Kost')),
      h('p', { role: 'alert' }, model.nutritionState === 'error'
        ? 'Kostdata kunne ikke hentes. Overblikket viser ikke kost lige nu.'
        : 'Kostdata er ufuldstændige. Overblikket viser ikke kost lige nu.'),
      model.nutritionReload && h('button', { type: 'button', style: button, onClick: model.nutritionReload }, 'Hent kost igen')),
    // U11 (Marc 11. nov.): en nem oversigt, så coachen hurtigt kan klikke ind og se en atlets program.
    !inbox && model.rosterReady && h('section', { 'aria-label': 'Dine atleter', 'data-u11-top': 'atleter',
      style: { marginTop: 24 } },
      model.athletes.length > 0 && h('h2', null, `Dine atleter (${model.athletes.length})`),
      model.athletes.length > 0 && h(AthleteOverview, { context: model, openProfile: props.openProfile, details: detailsFor, query: athleteQuery, onQueryChange: onAthleteQueryChange }),
      // Ordre 2005a: ny atlet havde ingen knap ved 1280 px (kun i mobilmenuen). Samme modal, som menuen åbner.
      typeof props.onNyAtlet === 'function' && h('button', { type: 'button', 'data-coach-ny-atlet': true,
        style: { ...button, minHeight: 48, paddingBlock: 10, marginTop: 8 }, onClick: props.onNyAtlet }, '+ Ny atlet')),
    // U11: det, der hører sammen, under én overskrift. Grupperne er lukkede.
    inbox ? model.rosterReady && h('details', { 'aria-label': 'Alle samtaler', 'data-coach-fold': 'samtaler', style: fold },
      h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, `Alle samtaler (${model.athletes.length})`)),
      ...model.athletes.map(a => h('button', { key: a.id, type: 'button', style: { ...button, margin: 4 },
        disabled: !available, onClick: available ? () => props.openProfile(a, 'beskeder', 'inbox') : undefined }, a.name))) :
      // Ordre 2005a: det, der overlapper check-in i chatten eller ikke bruges i ugen, er foldet ind under Mere.
      // Intet er slettet, og ingen data er rørt.
      more([
        model.signals.length > 0 && h('section', { key: 'signaler', 'aria-label': 'Signaler fra appen', 'data-coach-signaler': true },
          h('h2', { style: { ...foldHeading, display: 'block', marginTop: 8 } }, `Signaler fra appen (${model.signals.length})`),
          h('p', { style: { color: '#b9b4a8', margin: '4px 0 0' } }, 'Log, smerte, readiness og kost. Tages i check-in i chatten.'),
          h('ul', { style: { listStyle: 'none', padding: 0 } }, ...model.signals.map(row => rowButton(row, -1)))),
        model.u3?.attentionState === 'unavailable' && h('p', { key: 'u3', role: 'status', 'data-u3-attention-unavailable': true }, ATTENTION_UNAVAILABLE),
        group('hold', 'Holdet', [
          team && h('details', { 'aria-label': 'Holdoverblik', 'data-coach-fold': 'hold', style: fold },
            h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Holdoverblik')),
            h(CoachTeamRegistrations, { enabled: true, model: team, utenAtleter: true })),
          // U3 afsnit 3: "Holdet samlet" uden navne. Læser først, når folden åbnes.
          u3DataEnabled(props.u3Data) && props.notesClient && model.rosterReady && h(TeamPatternsView, {
            client: props.notesClient, day: model.day, athletes: teamAthletes(model.athletes, model.day),
            targets: new Map(model.athletes.map(a => [a.id, props.coachNutrition?.targets?.find?.(t => t?.athlete_id === a.id)?.protein_target ?? a.protein_target])),
            foldProps: { 'aria-label': 'Holdet samlet', 'data-coach-fold': 'holdet-samlet', style: fold },
            summary: h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Holdet samlet')) }),
          report.ready && report.rows.some(hasWeeklyReportData) && h('details', {
            'aria-label': 'Ugerapport', 'data-coach-fold': 'ugerapport', style: fold },
            h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Ugerapport')),
            h(WeeklyReport, { ...props, today, utenAtleter: true })),
          model.nutritionState === 'ready' && model.kostvane && h('details', { 'aria-label': 'Kostoverblik', 'data-coach-fold': 'kost', style: fold },
            h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading },
              `Kost · ${model.kostvane.medMaal} af ${model.kostvane.aktive} logger 4+ dage`)),
            h('p', { 'data-coach-kostvane': '' },
              `De seneste 7 dage har ${model.kostvane.medMaal} af ${model.kostvane.aktive} atleter logget mad mindst ${model.kostvane.maal} dage. `
              + `${model.kostvane.lidt} har logget 1 til ${model.kostvane.maal - 1} dage, og ${model.kostvane.ingen} har ikke logget.`)),
        ]),
        group('programmer', 'Programmer og noter', [
          model.rosterReady && model.athletes.length > 0 && h('details', {
            'aria-label': 'Noter fra passene', 'data-coach-fold': 'noter', style: fold },
            h('summary', { style: foldSummary }, arrow, h('h2', { style: foldHeading }, 'Noter fra passene · Vælg atlet')),
            h(CoachSessionNotes, { source: props, context: model })),
        ])]))
}
