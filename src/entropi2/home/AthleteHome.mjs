import { messageText } from '../conversation/conversationModel.mjs'
import { createElement as h, useEffect, useRef, useState } from 'react'
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

const clock = () => new Date()
const firstName = name => typeof name === 'string' ? name.trim().split(/\s+/)[0] : ''
const MONTHS = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
const danishDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); return m ? `${Number(m[3])}. ${MONTHS[Number(m[2]) - 1]}` : String(iso) }
const labels = { holiday: 'Du er på ferie', missing: 'Programmet er ikke tilgængeligt', 'no-program': 'Intet program endnu',
  'no-next': 'Intet kommende pas planlagt', done: 'Dagens pas er klaret' }

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
  const headingRef = useRef(null)
  const latest = useRef(props)
  latest.current = props
  // The existing host removes write callbacks in "Se som atlet". Own coach
  // training retains them. Do not read history for a different athlete preview.
  const ownTracking = enabled === true && !props.sessionReadOnly && !!props.athlete?.id &&
    typeof props.saveReadiness === 'function' && typeof props.setReadinessInput === 'function'
  const trackingId = ownTracking ? props.athlete.id : null
  const trackingDay = ownTracking ? calendarDay(props.now ?? (props.getNow ?? clock)()) : null
  const read = enabled === true ? props.readHomeReadiness ?? readHomeReadiness : readHomeReadiness
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
  if (enabled !== true) return null
  const { athlete, messages = [], formatMsgTime, setTab, onStartSession, onFilmSet, getNow = clock } = props
  const name = firstName(athlete?.name)
  void tick
  const now = props.now ?? getNow()
  const model = homeModel({ ...props, now })
  const week = homeWeekOverview({ ...props, now })
  const nutrition = nutritionTodayModel(props.nutritionToday, model.today)
  const trackingData = ownTracking && tracking?.athleteId === athlete?.id && tracking?.today === model.today
    ? tracking : { status: 'loading' }
  const snapshot = homeWeekSnapshot(trackingData, athlete?.id, model.today)
  const hasWeekData = snapshot && buildAthleteWeek(snapshot, { enabled: true }).status === 'ready'
  const target = model.target
  // Runde 12: Hjem kan have flyttet sig til en ny kalenderuge, mens appens indlæste uge er den
  // gamle. Registrering kræver samme uge; ellers bedes atleten genindlæse, ikke registrere forgæves.
  const staleWeek = Boolean(target && props.currentWeek && target.week.id !== props.currentWeek.id)
  const coach = (Array.isArray(messages) ? [...messages] : []).reverse()
    .find(m => m?.sender_role === 'coach' && typeof m.content === 'string' && m.content.trim())
  const coachText = coach && coachMessageParts(messageText(coach))
  const namedExercises = target?.session.exercises.filter(e => typeof e.name === 'string' && e.name.trim()) ?? []
  const canStart = !props.sessionReadOnly && typeof onStartSession === 'function'
  const go = route => () => latest.current.setTab?.(route)
  const start = () => {
    const current = latest.current
    return startHomeSession(current, model, current.getNow ? current.getNow() : current.now ?? clock())
  }
  const link = (route, text) => h('button', { key: route, type: 'button', style: s.secondary,
    disabled: typeof setTab !== 'function', onClick: go(route) }, text)
  return h('main', { style: s.page, 'aria-label': 'Hjem', 'data-entropi2-home': '' },
    // Marc 3. nov.: datoen stod tre gange (topbjaelke, her og i kortet). Topbjaelken viser datoen;
    // her kun ugen, og kortet siger "I dag" eller en dansk dato.
    (target?.week || props.currentWeek)?.week_number != null && h('p', { style: s.eyebrow }, `Uge ${(target?.week || props.currentWeek).week_number}`),
    // Marc 3. nov.: overskriften maa ikke spoerge til et pas, der allerede er klaret.
    h('h1', { ref: headingRef, tabIndex: -1, style: s.title }, model.kind === 'done' ? (name ? `Godt arbejde i dag, ${name}` : 'Godt arbejde i dag')
      : target ? (name ? `Klar til dit pas, ${name}?` : 'Klar til dit pas?') : (name ? `Dit overblik, ${name}` : 'Dit overblik')),
    h(HomeOnboarding, { enabled, athleteId: athlete?.id, firstName: name, storage: props.storage, headingRef,
      canLogReadiness: typeof props.saveReadiness === 'function' && typeof props.setReadinessInput === 'function',
      canLogWeight: typeof props.logWeight === 'function' && typeof props.setWeightInput === 'function', visKost: props.visKost }),
    h('section', { style: s.card, 'aria-label': 'Dit næste pas' },
      h('p', { style: s.eyebrow }, target ? model.kind === 'today' ? 'Dagens pas' : 'Næste træning' : 'Dit program'),
      h('h2', { style: s.heading }, target?.session.title || (target ? 'Træning' : labels[model.kind] || labels.missing)),
      target ? h('div', null,
        model.date && h('p', { style: s.text }, model.date === model.today ? 'I dag' : danishDate(model.date)),
        !props.sessionReadOnly && h('button', { type: 'button', style: s.primary, disabled: !canStart || staleWeek, onClick: start },
          model.kind === 'today' ? 'Start dagens pas' : 'Start næste pas'),
        !props.sessionReadOnly && (staleWeek ? h('p', { role: 'status', style: s.text }, 'En ny uge er startet. Genindlæs siden for at registrere passet.')
          : !canStart && h('p', { role: 'status', style: s.text }, 'Passet kunne ikke åbnes. Prøv at genindlæse siden.')),
        namedExercises.length > 0 && h('ul', { style: { ...s.text, listStylePosition: 'inside', paddingInlineStart: 0 } }, ...namedExercises.map(e => h('li', { key: e.id }, e.name))),
        model.logged != null && h('p', { style: s.text }, `${model.logged} af ${model.total} sæt klaret`),
        ...target.session.exercises.filter(e => e.note).map(e => h('p', { key: e.id, style: s.text }, `Coach · ${e.name || 'Øvelse'}: ${e.note}`)))
        : h('p', { role: 'status', style: s.text }, model.kind === 'holiday' ? 'Din træning venter, når du er tilbage.'
          : props.offlineSnapshotAt != null ? 'Opdatér programmet, når du har net, før du registrerer et pas.'
            : props.programError ? 'Programmet kunne ikke hentes. Prøv at genindlæse siden.' : 'Se programmet eller kontakt din coach.'),
      link('program', 'Se mit program')),
    week?.line && h('p', { style: { ...s.text, marginTop: 0 }, 'data-week-sessions': '' }, week.line),
    h(QuickLogs, { ...props, key: `${athlete?.id}:${model.today}`, today: model.today, getNow,
      trackingData, onRetry: () => setReadAttempt(n => n + 1) }),
    // Marc 3. nov.: videocoachen skal kunne naas direkte fra startsiden.
    h('button', { type: 'button', style: { ...s.secondary, marginTop: 0, marginBottom: 20 }, 'data-film-set': '',
      disabled: typeof onFilmSet !== 'function', onClick: () => latest.current.onFilmSet?.() }, 'Film et sæt til videocoach'),
    h(HomeCheckIn, { enabled, athleteId: athlete?.id, now, onHoliday: props.onHoliday, storage: props.storage }),
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
    h('h2', { style: s.heading }, 'Resten af din dag'),
    h('nav', { style: s.links, 'aria-label': 'Genveje' },
      link('fremgang', 'Analyse'), link('kost', 'Kost'), link('mobilisering', 'Mobilitet'), link('beskeder', 'Din coach')),
    hasWeekData && h('details', { style: { ...s.card, marginTop: 20 }, 'data-home-week-tracking': '' },
      h('summary', { style: { ...s.text, minHeight: 44, cursor: 'pointer' } }, 'Ugen i korte træk'),
      h(AthleteWeek, { enabled: true, snapshot, compactHome: true })))
}
