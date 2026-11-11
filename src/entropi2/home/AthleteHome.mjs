import { messageText } from '../conversation/conversationModel.mjs'
import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import { homeModel, startHomeSession } from './homeModel.mjs'
import { homeStyles as s } from './homeStyles.mjs'
import { nutritionTodayModel } from './nutritionTodayModel.mjs'
import { homeWeekOverview } from './homeWeekOverview.mjs'
import WeekPlan from './ugeplan/WeekPlan.mjs'
import HomeOnboarding from '../onboarding/AthleteIntroduction.mjs'
import HomeCheckIn from './HomeCheckIn.mjs'
import QuickLogs from './QuickLogs.mjs'
import { calendarDay } from '../../calendarDate.js'
import { readHomeReadiness, homeWeekSnapshot } from './homeTrackingRead.mjs'
import AthleteWeek from '../tracking/ugeatlet/AthleteWeek.mjs'
import { buildAthleteWeek } from '../tracking/ugeatlet/athleteWeekModel.mjs'
import { homeRecordSnapshot } from './homeRecord.mjs'
import { readHomeRecordHistory } from './homeRecordRead.mjs'
import { formatHistoryKg } from '../analysis/fourWeekHistory.mjs'
import TodayCard from './today/TodayCard.mjs'
import { u5TodayEnabled } from './today/flag.mjs'
import DayFeeling from '../u7/DayFeeling.mjs'
import { u7Enabled } from '../u7/flag.mjs'
import PushCard from '../u8/PushCard.mjs'
import { u8Enabled } from '../u8/flag.mjs'

const clock = () => new Date()
const firstName = name => typeof name === 'string' ? name.trim().split(/\s+/)[0] : ''
const MONTHS = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
const danishDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); return m ? `${Number(m[3])}. ${MONTHS[Number(m[2]) - 1]}` : String(iso) }
const labels = { holiday: 'Du er på ferie', missing: 'Programmet er ikke tilgængeligt', 'no-program': 'Intet program endnu',
  'no-next': 'Intet kommende pas planlagt', done: 'Dagens pas er klaret' }

export function HomeRecordCard({ record }) {
  if (!record) return null
  return h('section', { style: { ...s.card, padding: 16 }, 'aria-label': 'Ny rekord', 'data-home-record': '' },
    h('h2', { style: { ...s.text, color: '#edeae2', margin: '0 0 4px', fontWeight: 600 } },
      `Ny rekord: ${record.lift} ${formatHistoryKg(record.weight)} kg × ${record.reps}`),
    h('time', { dateTime: record.date, style: { ...s.text, fontSize: 14 } }, danishDate(record.date)))
}

// Keep the preview short without losing whitespace or splitting a surrogate pair.
// The disclosure contains only the remainder, so expanded text is not duplicated.
function coachMessageParts(content) {
  const characters = Array.from(content)
  if (characters.length <= 160) return { preview: content, rest: '' }
  const prefix = characters.slice(0, 160).join('')
  const boundary = prefix.search(/\s+\S*$/)
  const cut = boundary > 0 ? boundary : prefix.length
  return { preview: content.slice(0, cut), rest: content.slice(cut) }
}

// Only an explicit enabled=true renders this opt-in component. No flag reader.
export default function AthleteHome(props) {
  const { enabled = false } = props
  const [tick, setTick] = useState(0)
  const [tracking, setTracking] = useState(null)
  const [readAttempt, setReadAttempt] = useState(0)
  const [recordHistory, setRecordHistory] = useState(null)
  const [programRetry, setProgramRetry] = useState(null)
  const programAttempt = useRef(null)
  const headingRef = useRef(null)
  const latest = useRef(props)
  latest.current = props
  useEffect(() => () => { programAttempt.current = null }, [])
  // The existing host removes write callbacks in "Se som atlet". Own coach
  // training retains them. Do not read history for a different athlete preview.
  const ownTracking = enabled === true && !props.sessionReadOnly && !!props.athlete?.id &&
    typeof props.saveReadiness === 'function' && typeof props.setReadinessInput === 'function'
  const trackingId = ownTracking ? props.athlete.id : null
  const trackingDay = ownTracking ? calendarDay(props.now ?? (props.getNow ?? clock)()) : null
  const read = enabled === true ? props.readHomeReadiness ?? readHomeReadiness : readHomeReadiness
  const ownRecords = enabled === true && !props.sessionReadOnly && !props.readOnly && !!props.athlete?.id &&
    !props.programError && props.offlineSnapshotAt == null && !!props.currentWeek &&
    Array.isArray(props.allWeeks) && Array.isArray(props.exerciseLogs) &&
    typeof props.onLogSet === 'function' && typeof props.setLogInputs === 'function'
  const recordId = ownRecords ? props.athlete.id : null
  const recordDay = ownRecords ? calendarDay(props.now ?? (props.getNow ?? clock)()) : null
  const recordRead = ownRecords ? props.readHomeRecordHistory ?? readHomeRecordHistory : readHomeRecordHistory
  const recordLogs = ownRecords ? props.exerciseLogs : null
  const recordWeek = ownRecords ? props.currentWeek : null
  const recordWeekId = recordWeek?.id ?? null
  // homeRecordSnapshot overlays the current week's confirmed local logs on the
  // loaded history, including edits and undo. Refetch only on scope/day changes;
  // fresh logs and equivalent prescription objects must not reload all history.
  useEffect(() => {
    if (!recordId || !recordDay) return
    let active = true
    Promise.resolve().then(() => active ? recordRead({ athleteId: recordId }) : null).then(
      history => { if (active) setRecordHistory({ history, athleteId: recordId, reader: recordRead }) },
      () => { if (active) setRecordHistory({ history: { status: 'error' }, athleteId: recordId, reader: recordRead }) })
    return () => { active = false }
  }, [recordId, recordDay, recordRead, recordWeekId])
  useEffect(() => {
    if (!trackingId || !trackingDay) return
    let active = true
    setTracking({ status: 'loading', athleteId: trackingId, today: trackingDay })
    Promise.resolve().then(() => read({ athleteId: trackingId, today: trackingDay })).then(
      data => { if (active) setTracking(data) },
      () => { if (active) setTracking({ status: 'error', athleteId: trackingId, today: trackingDay }) })
    return () => { active = false }
  }, [trackingId, trackingDay, read, readAttempt])
  useEffect(() => {
    if (enabled !== true) return
    // Recompute Copenhagen calendar date while mounted.
    const id = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(id)
  }, [enabled])
  const recordProps = ownRecords ? props : {}
  const recordNow = ownRecords ? props.now ?? (props.getNow ?? clock)() : null
  const recordSnapshot = useMemo(() => ownRecords && recordHistory?.athleteId === recordId && recordHistory?.reader === recordRead
    ? homeRecordSnapshot({ enabled: true, athlete: { id: recordId }, currentWeek: recordWeek,
      allWeeks: recordProps.allWeeks, exerciseLogs: recordLogs, pendingSyncKeys: recordProps.pendingSyncKeys, parkedSets: recordProps.parkedSets,
      exerciseLogsError: recordProps.exerciseLogsError, exerciseLogsLoading: recordProps.exerciseLogsLoading,
      fremgangError: recordProps.fremgangError, fremgangLoading: recordProps.fremgangLoading }, recordHistory.history, recordNow) : null,
  // Data/day changes select the record. Clock ticks only expire the snapshot below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [ownRecords, recordHistory, recordId, recordRead, recordDay, recordWeek, recordLogs, recordProps.allWeeks,
    recordProps.pendingSyncKeys, recordProps.parkedSets, recordProps.exerciseLogsError, recordProps.exerciseLogsLoading, recordProps.fremgangError, recordProps.fremgangLoading])
  if (enabled !== true) return null
  const { athlete, messages = [], formatMsgTime, setTab, onStartSession, onFilmSet, getNow = clock } = props
  const name = firstName(athlete?.name)
  void tick
  const now = props.now ?? getNow()
  const retryState = programRetry?.athleteId === athlete?.id ? programRetry : null
  const programLoading = props.programLoading === true || retryState?.busy === true
  const programError = props.programError || retryState?.failed === true
  const programProps = { ...props, programLoading, programError, now }
  const model = homeModel(programProps)
  const recordAt = new Date(now).getTime()
  const record = recordSnapshot && recordAt < recordSnapshot.expiresAt && recordAt >= recordSnapshot.expiresAt - 3 * 86400000
    ? recordSnapshot.record : null
  const week = homeWeekOverview(programProps)
  const nutrition = nutritionTodayModel(props.nutritionToday, model.today)
  const trackingData = ownTracking && tracking?.athleteId === athlete?.id && tracking?.today === model.today
    ? tracking : { status: 'loading' }
  const snapshot = homeWeekSnapshot(trackingData, athlete?.id, model.today)
  const hasWeekData = snapshot && buildAthleteWeek(snapshot, { enabled: true }).status === 'ready'
  const target = model.target
  // Runde 12: Hjem kan have flyttet sig til en ny kalenderuge, mens appens indlæste uge er den
  // gamle. Registrering kræver samme uge; ellers bedes atleten genindlæse, ikke registrere forgæves.
  const staleWeek = Boolean(target && props.currentWeek && target.week.id !== props.currentWeek.id)
  const retryWeek = props.coachOwnTraining === true && !props.sessionReadOnly &&
    (staleWeek || (retryState?.weekRefresh === true && retryState.busy === true))
  const coach = (Array.isArray(messages) ? [...messages] : []).reverse()
    .find(m => m?.sender_role === 'coach' && typeof m.content === 'string' && m.content.trim())
  const coachContent = coach && messageText(coach, { hideStandaloneVideoId: true })
  // A valid technique reference can be the entire message. Keep its existing
  // conversation link useful without exposing metadata or inventing video data.
  const coachText = coach && coachMessageParts(coachContent.trim()
    ? coachContent : 'Din coach har sendt feedback på din video')
  const namedExercises = target?.session.exercises.filter(e => typeof e.name === 'string' && e.name.trim()) ?? []
  const canStart = !props.sessionReadOnly && typeof onStartSession === 'function'
  const go = route => () => latest.current.setTab?.(route)
  const start = () => {
    const current = latest.current
    if (programAttempt.current?.athleteId === current.athlete?.id || current.programLoading) return false
    if (current.coachOwnTraining === true && current.currentWeek?.id !== model.target?.week.id) return false
    return startHomeSession(current, model, current.getNow ? current.getNow() : current.now ?? clock())
  }
  const retryProgram = async () => {
    const current = latest.current
    if (current.enabled !== true || current.athlete?.id !== athlete?.id || current.programLoading ||
        programAttempt.current?.athleteId === athlete?.id || typeof current.onRetryProgram !== 'function') return false
    if (retryWeek && (current.coachOwnTraining !== true || current.sessionReadOnly)) return false
    const attempt = { athleteId: athlete?.id, weekRefresh: retryWeek }
    programAttempt.current = attempt
    setProgramRetry({ ...attempt, busy: true, failed: false })
    let failed = false
    try { await current.onRetryProgram() } catch { failed = true }
    if (programAttempt.current === attempt) {
      programAttempt.current = null
      if (latest.current.enabled === true && latest.current.athlete?.id === attempt.athleteId)
        setProgramRetry({ ...attempt, busy: false, failed })
    }
    return !failed
  }
  const link = (route, text) => h('button', { key: route, type: 'button', style: s.secondary,
    disabled: typeof setTab !== 'function', onClick: go(route) }, text)
  return h('main', { style: s.page, 'aria-label': 'Hjem', 'data-entropi2-home': '' },
    // Marc 3. nov.: datoen stod tre gange (topbjaelke, her og i kortet). Topbjaelken viser datoen;
    // her kun ugen, og kortet siger "I dag" eller en dansk dato.
    !programLoading && !programError && props.offlineSnapshotAt == null && (target?.week || props.currentWeek)?.week_number != null && h('p', { style: s.eyebrow }, `Uge ${(target?.week || props.currentWeek).week_number}`),
    // Marc 3. nov.: overskriften maa ikke spoerge til et pas, der allerede er klaret.
    h('h1', { ref: headingRef, tabIndex: -1, style: s.title }, model.kind === 'done' ? (name ? `Godt arbejde i dag, ${name}` : 'Godt arbejde i dag')
      : target ? (name ? `Klar til dit pas, ${name}?` : 'Klar til dit pas?') : (name ? `Dit overblik, ${name}` : 'Dit overblik')),
    // U9 (Marc 11. nov.): genvejen til dagens eller næste pas er det første, atleten møder; resten rykker ned.
    h('section', { style: { ...s.card, borderColor: '#c8923a' }, 'aria-label': 'Dit næste pas', 'aria-busy': programLoading, 'data-u9-pas': '' },
      !(programLoading || programError) && h('p', { style: s.eyebrow }, target ? model.kind === 'today' ? 'Dagens pas' : 'Næste træning' : 'Dit program'),
      h('h2', { style: s.heading }, programLoading || programError ? 'Dit program'
        : target?.session.title || (target ? 'Træning' : labels[model.kind] || labels.missing)),
      target ? h('div', null,
        model.date && h('p', { style: s.text }, model.date === model.today ? 'I dag' : danishDate(model.date)),
        !props.sessionReadOnly && h('button', { type: 'button', style: s.primary, disabled: !canStart || staleWeek || props.sessionLoading === true, onClick: start },
          model.kind === 'today' ? 'Start dagens pas' : 'Start næste pas'),
        !props.sessionReadOnly && (staleWeek ? h('p', { role: 'status', style: s.text }, retryWeek
          ? 'En ny uge er startet. Hent programmet igen for at registrere passet.'
          : 'En ny uge er startet. Genindlæs siden for at registrere passet.')
          : !canStart && h('p', { role: 'status', style: s.text }, 'Passet kunne ikke åbnes. Prøv at genindlæse siden.')),
        model.logged != null && h('p', { style: s.text }, `${model.logged} af ${model.total} sæt klaret`),
        (namedExercises.length > 0 || target.session.exercises.some(e => e.note)) && h('details', {
          key: `${target.week.id}:${target.session.id}`, 'data-home-session-details': '' },
          h('summary', { style: { ...s.text, minHeight: 44, cursor: 'pointer' } }, 'Se øvelser og coachnoter'),
          namedExercises.length > 0 && h('ul', { style: { ...s.text, listStylePosition: 'inside', paddingInlineStart: 0 } }, ...namedExercises.map(e => h('li', { key: e.id }, e.name))),
          ...target.session.exercises.filter(e => e.note).map(e => h('p', { key: e.id, style: s.text }, `Coach · ${e.name || 'Øvelse'}: ${e.note}`))))
        : h('p', { role: programError && !programLoading ? 'alert' : 'status', style: s.text }, programLoading ? 'Indlæser dit program…'
          : programError ? 'Programmet kunne ikke hentes. Tjek din forbindelse og prøv igen.'
          : model.kind === 'holiday' ? 'Din træning venter, når du er tilbage.'
          : props.offlineSnapshotAt != null ? 'Opdatér programmet, når du har net, før du registrerer et pas.'
            : 'Se programmet eller kontakt din coach.'),
      (retryWeek || (!programLoading && (programError || props.offlineSnapshotAt != null))) && h('button', {
        type: 'button', style: s.primary, disabled: programLoading || typeof props.onRetryProgram !== 'function', onClick: retryProgram,
      }, retryWeek && programLoading ? 'Henter…' : 'Hent igen'),
      props.sessionRootRef && h('section', { ref: props.sessionRootRef, 'aria-label': 'Dit valgte pas' }),
      link('program', 'Se mit program')),
    week?.line && h('p', { style: { ...s.text, marginTop: 0 }, 'data-week-sessions': '' }, week.line),
    !props.sessionReadOnly && h(HomeOnboarding, { enabled, athleteId: athlete?.id, firstName: name, storage: props.storage, headingRef,
      canLogReadiness: typeof props.saveReadiness === 'function' && typeof props.setReadinessInput === 'function',
      canLogWeight: typeof props.logWeight === 'function' && typeof props.setWeightInput === 'function', visKost: props.visKost }),
    // U5: "I dag" øverst med det, der mangler, og let logning. Bag sit eget flag.
    u5TodayEnabled(props.u5Today) && !props.sessionReadOnly && h(TodayCard, { ...props, key: `u5:${athlete?.id}:${model.today}`, today: model.today, trackingData,
      u5Training: model.kind === 'today' || model.kind === 'done' ? { kind: model.kind, logged: model.logged, total: model.total,
        exercises: target?.session.exercises } : null }),
    // U7: søvn og smerte som tal, kun når tabellen findes. Uden den er forsiden som i U6.
    u7Enabled('dayData', props.u7DayData) && !props.sessionReadOnly && athlete?.id && model.today && h(DayFeeling, {
      key: `u7:${athlete.id}:${model.today}`, athleteId: athlete.id, today: model.today, client: props.u5Client, storage: props.storage }),
    // U8: påmindelse og coachsvar som push, kun når pakke D og nøglen findes. Ellers som i U7.
    u8Enabled('push', props.u8Push) && !props.sessionReadOnly && athlete?.id && h(PushCard, {
      key: `u8:${athlete.id}`, athleteId: athlete.id, client: props.u5Client, storage: props.storage, setTab: props.setTab }),
    record && h(HomeRecordCard, { record }),
    h(QuickLogs, { ...props, key: `${athlete?.id}:${model.today}`, today: model.today, getNow,
      trackingData, onRetry: () => setReadAttempt(n => n + 1) }),
    // Marc 3. nov.: videocoachen skal kunne naas direkte fra startsiden.
    !props.sessionReadOnly && h('button', { type: 'button', style: { ...s.secondary, marginTop: 0, marginBottom: 20 }, 'data-film-set': '',
      disabled: typeof onFilmSet !== 'function', onClick: () => latest.current.onFilmSet?.() }, 'Film et sæt til videocoach'),
    !props.sessionReadOnly && h(HomeCheckIn, { enabled, athleteId: athlete?.id, now, onHoliday: props.onHoliday, storage: props.storage }),
    week?.plan && h('details', { style: s.card, 'data-home-week-plan': '' },
      h('summary', { style: { ...s.text, cursor: 'pointer', minHeight: 44 } }, 'Se ugens plan'),
      h(WeekPlan, week.plan)),
    nutrition && h('button', { type: 'button',
      style: { ...s.secondary, marginTop: 0, marginBottom: 20, textAlign: 'left' },
      disabled: typeof setTab !== 'function', onClick: go('kost') }, nutrition.text),
    coach && h('section', { style: s.card, 'aria-label': 'Fra din coach' },
      h('p', { style: s.eyebrow }, 'Fra din coach'),
      h('h2', { style: s.heading }, 'Seneste besked'),
      h('p', { style: s.text }, coachText.preview),
      coachText.rest && h('details', null,
        h('summary', { style: { ...s.text, minHeight: 44, cursor: 'pointer' } }, 'Læs resten af beskeden'),
        h('p', { style: s.text }, coachText.rest)),
      coach?.created_at && typeof formatMsgTime === 'function' && h('p', { style: s.text }, formatMsgTime(coach.created_at)),
      link('beskeder', 'Se besked og video')),
    // Presentation only: the host passes its existing confirmed coach ownership decision.
    props.coachOwnTraining !== true && h('h2', { style: s.heading }, 'Resten af din dag'),
    props.coachOwnTraining !== true && h('nav', { style: s.links, 'aria-label': 'Genveje' },
      link('fremgang', 'Analyse'), !nutrition && link('kost', 'Kost'),
      link('mobilisering', 'Mobilitet'), !coach && link('beskeder', 'Din coach')),
    hasWeekData && h('details', { style: { ...s.card, marginTop: 20 }, 'data-home-week-tracking': '' },
      h('summary', { style: { ...s.text, minHeight: 44, cursor: 'pointer' } }, 'Ugen i korte træk'),
      h(AthleteWeek, { enabled: true, snapshot, compactHome: true })))
}
