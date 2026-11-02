import { activityDay } from '../dashboard/coachInactive.mjs'

// Entropi 2: konteksten hører til selve kalenderlæsningen, aldrig til gengivelsen.
// Læseren (src/dashboard/laesninger.js) kalder entropi2CalendarRead ved læsningens start og
// done(weeks) dér, hvor læsningen afsluttes. Først da stemples ejer, anmodede atlet-id'er og
// afslutningsdag, sammen med netop det kalenderobjekt, læsningen gav.
export function entropi2CalendarRead({ enabled, coachId, athleteIds, setStatus }) {
  if (enabled !== true) return null
  const token = {}, scope = Array.isArray(athleteIds) ? athleteIds.slice() : []
  setStatus(prev => ({ ...prev, e2Calendar: { token } }))
  return {
    done(weeks) {
      const context = { coachId, athleteIds: scope, day: activityDay() }
      setStatus(prev => prev.e2Calendar?.token === token ? { ...prev, e2Calendar: { token, weeks, context } } : prev)
    },
  }
}

const sameIds = (a, b) => {
  const x = [...a].sort(), y = [...b].sort()
  return x.length === y.length && x.every((id, i) => id === y[i])
}

// Ingen tid, ingen memo: konteksten læses kun fra læseresultatet. Den gives videre uændret
// (samme objekt, samme dag), når den stadig hører til den aktuelle ejer, det aktuelle atletscope
// og det aktuelle kalenderobjekt. Ved ejer- eller scopeskift, en ny eller fejlet kalenderlæsning
// eller en igangværende læsning af de øvrige kilder er der ingen kontekst.
export function entropi2ReadContext({ enabled, loading, loadError, coachId, athletes, calendarWeeks, coachActionsStatus, coachMorningData }) {
  if (enabled !== true || loading || loadError || typeof coachId !== 'string' || !coachId) return undefined
  const status = coachActionsStatus || {}, read = status.e2Calendar, context = read?.context
  if (status.calendar !== 'ready' || !context || read.weeks !== calendarWeeks || context.coachId !== coachId) return undefined
  const ids = (Array.isArray(athletes) ? athletes : []).map(item => item?.id)
  if (!sameIds(ids, context.athleteIds)) return undefined
  if ([status.activity, coachMorningData?.messages, coachMorningData?.videos].some(source => source?.state === 'loading')) return undefined
  return context
}

// Navnet er bevaret fra runde 3, så stubbe og indgang er uændrede; der er ingen React-hook i den.
export const useEntropi2ReadContext = entropi2ReadContext
