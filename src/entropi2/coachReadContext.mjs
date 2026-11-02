import { activityDay } from '../dashboard/coachInactive.mjs'

// Entropi 2: konteksten hører til selve kalenderlæsningen, aldrig til gengivelsen.
// Læseren (src/dashboard/laesninger.js) kalder entropi2CalendarRead ved læsningens start og
// done(weeks) dér, hvor læsningen afsluttes. Først da stemples ejer, anmodede atlet-id'er og
// afslutningsdag, sammen med netop det kalenderobjekt, læsningen gav.
// Alle igangværende læsninger registreres pr. statussetter (én pr. Dashboard). Kun den nyeste
// læsning er gældende (current); et ældre svar afsluttes med settle() uden at overskrive noget.
// Så længe nogen læsning er i gang, er der ingen kontekst (se pending nedenfor).
const trackers = new WeakMap()
export function entropi2CalendarRead({ enabled, coachId, athleteIds, setStatus }) {
  if (enabled !== true || typeof setStatus !== 'function') return null
  let tracker = trackers.get(setStatus)
  if (!tracker) { tracker = { latest: null, pending: new Set() }; trackers.set(setStatus, tracker) }
  const token = {}, scope = Array.isArray(athleteIds) ? athleteIds.slice() : []
  tracker.latest = token
  tracker.pending.add(token)
  const started = tracker.pending.size
  setStatus(prev => ({ ...prev, e2Calendar: { token, pending: started } }))
  let open = true
  const finish = () => { if (!open) return false; open = false; tracker.pending.delete(token); return true }
  return {
    current: () => tracker.latest === token,
    done(weeks) {
      if (!finish()) return
      const pending = tracker.pending.size
      if (tracker.latest !== token) {
        setStatus(prev => ({ ...prev, e2Calendar: { ...prev.e2Calendar, pending } }))
        return
      }
      const context = { coachId, athleteIds: scope, day: activityDay() }
      setStatus(prev => ({ ...prev, e2Calendar: { token, pending, weeks, context } }))
    },
    // Afslutter læsningen uden resultat (fejl eller afløst af en nyere læsning).
    settle() {
      if (!finish()) return
      const pending = tracker.pending.size
      setStatus(prev => ({ ...prev, e2Calendar: { ...prev.e2Calendar, pending } }))
    },
  }
}

// Entropi 2: generel vagt for læsere uden eget token. Kun den senest startede læsning med samme
// ejer (en stabil statussetter) og nøgle er gældende; et afløst svar skal kassere sit resultat.
const gates = new WeakMap()
export function entropi2ReadGate(owner, key) {
  if (!owner || (typeof owner !== 'object' && typeof owner !== 'function')) return null
  let byKey = gates.get(owner)
  if (!byKey) { byKey = new Map(); gates.set(owner, byKey) }
  const token = {}
  byKey.set(key, token)
  return { current: () => byKey.get(key) === token }
}

const sameIds = (a, b) => {
  const x = [...a].sort(), y = [...b].sort()
  return x.length === y.length && x.every((id, i) => id === y[i])
}

// Ingen tid, ingen memo: konteksten læses kun fra læseresultatet. Den gives videre uændret
// (samme objekt, samme dag), når den stadig hører til den aktuelle ejer, det aktuelle atletscope
// og det aktuelle kalenderobjekt. Ved ejer- eller scopeskift, en igangværende, ny eller fejlet kalenderlæsning
// eller en igangværende læsning af de øvrige kilder er der ingen kontekst.
export function entropi2ReadContext({ enabled, loading, loadError, coachId, athletes, calendarWeeks, coachActionsStatus, coachMorningData }) {
  if (enabled !== true || loading || loadError || typeof coachId !== 'string' || !coachId) return undefined
  const status = coachActionsStatus || {}, read = status.e2Calendar, context = read?.context
  if (status.calendar !== 'ready' || !context || read.pending !== 0 || read.weeks !== calendarWeeks || context.coachId !== coachId) return undefined
  const ids = (Array.isArray(athletes) ? athletes : []).map(item => item?.id)
  if (!sameIds(ids, context.athleteIds)) return undefined
  if ([status.activity, coachMorningData?.messages, coachMorningData?.videos].some(source => source?.state === 'loading')) return undefined
  return context
}

// Navnet er bevaret fra runde 3, så stubbe og indgang er uændrede; der er ingen React-hook i den.
export const useEntropi2ReadContext = entropi2ReadContext
