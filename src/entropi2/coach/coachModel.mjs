import { antalOrd } from '../antalOrd.mjs'
import { messageText } from '../conversation/conversationModel.mjs'
import { buildProgramOverblik } from '../../programOverblik.mjs'
import { activityDay } from '../../dashboard/coachInactive.mjs'
import { coachAthleteList } from './athleteListModel.mjs'
import { coachNutritionLines } from './coachNutrition.mjs'

export const DEFAULT_ENTROPI2_COACH = false
const own = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k)
const ordinal = day => Date.parse(day + 'T00:00:00Z') / 86400000
const count = n => Number.isSafeInteger(n) && n > 0 ? n : 0
const civilDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? activityDay(value) : null
const loggedDay = value => typeof value === 'string' ? activityDay(value) : null

export const hasUndatedPlannedWeek = weeks => weeks.some(w =>
  Number(w.exercise_count) > 0 && !civilDay(w.start_date))

// Pure adapter over existing Dashboard state. Context belongs to the completed
// reads, never to the current render. No query, storage or global flag access.
export function adaptCoachState(props = {}, today = new Date()) {
  const day = activityDay(today)
  const { session, readContext, athletes = [], hiddenAthleteIds = new Set(),
    loading, loadError, calendarWeeks = {}, coachActionsStatus = {},
    coachMorningData = {}, latestByTrack = {}, unreadByTrack = {},
    pendingByTrack = {}, noteSignalEnabled = false, inboxRefreshing = false,
    messageInboxError, videoReviewQueueError } = props
  const reads = [coachActionsStatus.activity, coachMorningData.logs,
    coachMorningData.messages, coachMorningData.videos]
  const owner = session?.user?.id
  const validContext = Boolean(day) && typeof owner === 'string' && owner.length > 0 &&
    readContext?.coachId === owner && readContext.day === day &&
    Array.isArray(readContext.athleteIds)
  const visible = new Map()
  if (validContext && !loading && !loadError) for (const a of athletes) {
    if (typeof a?.id !== 'string' || !readContext.athleteIds.includes(a.id) ||
      a.hidden || hiddenAthleteIds.has(a.id)) continue
    visible.set(a.id, { ...a, name: typeof a.name === 'string' ? a.name : 'Atlet' })
  }
  const scoped = [...visible.values()]
  const plans = Object.fromEntries(scoped.map(a => [a.id,
    Array.isArray(calendarWeeks[a.id]) ? calendarWeeks[a.id].filter(w => w &&
      (!w.athlete_id || w.athlete_id === a.id)) : []]))
  const calendarReady = validContext && !loading && !loadError &&
    coachActionsStatus.calendar === 'ready' &&
    Object.values(calendarWeeks).filter(Array.isArray).flat().length < 1000 &&
    scoped.every(a => own(calendarWeeks, a.id) && Array.isArray(calendarWeeks[a.id]) &&
      plans[a.id].every(w => w.readEvidence?.complete !== false))
  const source = (key, error) => {
    const s = key === 'logs' ? coachActionsStatus.activity : coachMorningData[key]
    const usable = validContext && !loading && !loadError && !error &&
      (key === 'logs' || !inboxRefreshing) && s?.day === day &&
      ['ready', 'partial'].includes(s?.state) && Array.isArray(s.rows) &&
      (key === 'videos' && s.ids === null || Array.isArray(s.ids) && scoped.every(a => s.ids.includes(a.id)))
    const cap = key === 'videos' ? 50 : 1000
    const scopedRows = usable ? s.rows.filter(r => visible.has(r?.athlete_id)) : []
    const validRows = key !== 'logs' || scopedRows.every(r => r.skipped === true ||
      loggedDay(r.logged_at) && loggedDay(r.logged_at) <= day)
    return { usable: Boolean(usable), complete: Boolean(usable && validRows && s.state === 'ready' && s.rows.length < cap),
      rows: scopedRows }
  }
  return { day, athletes: scoped, plans, calendarReady,
    rosterReady: Boolean(validContext && !loading && !loadError),
    messages: source('messages', messageInboxError), videos: source('videos', videoReviewQueueError),
    logs: source('logs'), latestByTrack, unreadByTrack, pendingByTrack, noteSignalEnabled,
    isLoading: Boolean(loading || inboxRefreshing || coachActionsStatus.calendar === 'loading' ||
      coachActionsStatus.e2Calendar?.pending > 0 || reads.some(read => read?.state === 'loading')),
    hasError: Boolean(loadError || messageInboxError || videoReviewQueueError ||
      Object.values(coachActionsStatus).includes('error') || reads.some(read => read?.state === 'error')) }
}

export function coachHomeModel(props = {}, today = new Date()) {
  const data = adaptCoachState(props, today)
  const actions = [], inbox = [], videoKeys = new Set()
  const { day, athletes, plans, messages, videos, logs } = data
  const T = day ? ordinal(day) : null
  for (const athlete of athletes) {
    const candidates = []
    if (messages.usable) for (const track of ['besked', 'teknik']) {
      const pending = data.pendingByTrack[athlete.id]?.[track]
      const n = count(data.noteSignalEnabled === true ? pending?.count : data.unreadByTrack[athlete.id]?.[track])
      const last = data.noteSignalEnabled === true ? pending?.latestNote : data.latestByTrack[athlete.id]?.[track]
      if (!n || !last || last.athlete_id !== athlete.id) continue
      const item = { kind: 'message', key: `message-${athlete.id}-${track}`, athlete, track,
        title: athlete.name, detail: messageText(last), count: n,
        createdAt: data.noteSignalEnabled === true ? pending.oldestAt : last.created_at }
      candidates.push({ key: item.key, athlete, rank: 0, item,
        reason: `${n} ${antalOrd(n, 'ulæst', 'ulæste')} ${track === 'teknik' ? antalOrd(n, 'teknikbesked', 'teknikbeskeder') : antalOrd(n, 'besked', 'beskeder')}` })
    }
    if (videos.usable) for (const video of videos.rows) {
      if (video.athlete_id !== athlete.id || !video.id || video.status !== 'draft') continue
      const videoKey = `${athlete.id}:${video.id}`
      if (videoKeys.has(videoKey)) continue
      videoKeys.add(videoKey)
      const item = { kind: 'video', key: `video-${video.id}`, athlete, video,
        title: athlete.name, detail: 'Video venter på feedback', createdAt: video.created_at || video.analyzed_at }
      candidates.push({ key: item.key, athlete, rank: 0, item, reason: item.detail })
    }
    inbox.push(...candidates)
    if (data.calendarReady) {
      const entry = buildProgramOverblik({ athletes: [athlete], calendarWeeks: plans, today: day })[0]
      // An undated planned week makes the last date uncertain.
      const uncertain = hasUndatedPlannedWeek(plans[athlete.id])
      if (!uncertain && entry?.daysLeft !== null && entry?.daysLeft < 7) candidates.push({
        key: `program-${athlete.id}`, athlete, rank: 1, tab: 'program',
        reason: entry.daysLeft < 0 ? 'Programmet er udløbet' : `Programmet slutter om ${entry.daysLeft} ${antalOrd(entry.daysLeft, 'dag', 'dage')}` })
      if (logs.complete && T !== null) {
        const rows = logs.rows.filter(r => r.athlete_id === athlete.id && r.skipped !== true)
        const valid = rows.every(r => loggedDay(r.logged_at) && loggedDay(r.logged_at) <= day)
        const finished = plans[athlete.id].filter(w => Number(w.exercise_count) > 0 &&
          civilDay(w.start_date) &&
          ordinal(w.start_date) + 7 <= T && ordinal(w.start_date) >= T - 14)
          .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
        if (valid && finished && !rows.some(r => {
          const logged = ordinal(loggedDay(r.logged_at)), start = ordinal(finished.start_date)
          return logged >= start && logged < start + 7
        })) candidates.push({ key: `logs-${athlete.id}`, athlete, rank: 2, tab: 'log',
          reason: `Ingen log i afsluttet programuge ${finished.week_number ?? '?'}; årsagen er ukendt` })
      }
    }
    candidates.sort(order)
    if (candidates.length) actions.push({ ...candidates[0], reasons: candidates.map(c => c.reason) })
  }
  actions.sort(order); inbox.sort(order)
  const complete = data.rosterReady && data.calendarReady && messages.complete && videos.complete && logs.complete
  const nutrition = coachNutritionLines(props, day, athletes, data.rosterReady)
  // K-R3-ENTROPI-SAMLET fund 3: en fejlet eller ufuldstaendig kostlaesning maa ikke ligne fravaer.
  const nutritionSource = props.coachNutrition
  const nutritionState = !nutritionSource ? 'loading' : nutritionSource.state === 'ready' ? 'ready'
    : nutritionSource.state === 'partial' ? 'partial' : nutritionSource.state === 'error' ? 'error' : 'loading'
  const summaries = coachAthleteSummaries(data, nutrition, inbox)
  return { ...data, actions, inbox, complete, nutrition, nutritionState, summaries,
    nutritionReload: typeof nutritionSource?.reload === 'function' ? nutritionSource.reload : null,
    state: !data.rosterReady ? data.hasError ? 'error' : 'unknown' : athletes.length === 0 ? 'empty' : complete ? 'ready' : 'unknown' }
}

function order(a, b) {
  const stamp = row => { const n = Date.parse(row.item?.createdAt); return Number.isFinite(n) ? n : Infinity }
  return a.rank - b.rank || stamp(a) - stamp(b) ||
    a.athlete.name.localeCompare(b.athlete.name, 'da') || a.key.localeCompare(b.key)
}

export function openCoachRow(row, callbacks, returnView = 'list') {
  if (row.item) return callbacks.openCoachPriorityItem(row.item, returnView)
  return callbacks.openProfile(row.athlete, row.tab, returnView)
}

export function selectCoachTab(tab, { setSelectedAthlete, setView }) {
  if (!['home', 'inbox'].includes(tab)) return
  setSelectedAthlete(null)
  setView(tab === 'inbox' ? 'inbox' : 'list')
}

// Only the already scoped, usable reads can contribute to an athlete summary.
// Missing evidence is silent; a partial read can still prove a present activity.
export function coachAthleteSummaries(data, nutrition, inbox) {
  const { day, athletes, logs, messages } = data
  const relative = date => {
    const days = ordinal(day) - ordinal(date)
    return days === 0 ? 'i dag' : days === 1 ? 'i går' : `for ${days} ${antalOrd(days, 'dag', 'dage')} siden`
  }
  const rows = athletes.map(athlete => {
    const activity = []
    const add = (source, field, kind) => {
      const dates = source.map(row => loggedDay(row[field]))
      if (dates.some(date => !date || date > day)) return
      dates.forEach((date, index) => activity.push({ day: date, kind, stamp: Date.parse(source[index][field]) }))
    }
    if (logs.usable) add(logs.rows.filter(r => r.athlete_id === athlete.id && r.skipped !== true), 'logged_at', 'Sidste pas')
    if (messages.usable) {
      const latest = ['besked', 'teknik'].map(track => data.latestByTrack[athlete.id]?.[track])
        .filter(row => row?.athlete_id === athlete.id)
      add([...messages.rows.filter(r => r.athlete_id === athlete.id), ...latest], 'created_at', 'Sidste besked')
    }
    activity.sort((a, b) => b.stamp - a.stamp || a.kind.localeCompare(b.kind, 'da'))
    const last = activity[0]
    const unread = inbox.filter(row => row.athlete.id === athlete.id && row.item.kind === 'message')
      .reduce((sum, row) => sum + row.item.count, 0)
    const parts = [last && `${last.kind} ${relative(last.day)}`, nutrition.get(athlete.id)?.text,
      unread > 0 && `${unread} ${antalOrd(unread, 'ulæst besked', 'ulæste beskeder')}`].filter(Boolean)
    return { athlete, text: parts.join(' · '), lastDay: last?.day, unread,
      hasNews: unread > 0 || last?.day === day }
  })
  rows.sort((a, b) => Number(b.hasNews) - Number(a.hasNews) ||
    (b.lastDay || '').localeCompare(a.lastDay || '') ||
    a.athlete.name.localeCompare(b.athlete.name, 'da') || a.athlete.id.localeCompare(b.athlete.id))
  if (!rows.length) return rows
  const byId = new Map(rows.map(row => [row.athlete.id, row]))
  // Only confirmed unread facts are available to the standalone list model.
  // No pain/deviation flags or inactivity claims are inferred from roster data.
  return coachAthleteList({ today: day, athletes: rows.map(row => ({
    id: row.athlete.id, unreadMessages: row.unread,
  })) }).map(row => byId.get(row.athlete.id))
}
