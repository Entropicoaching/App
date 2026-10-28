import './coachWeekTestLoader.mjs'
const { lavLaesninger } = await import('./laesninger.js')
export function readerFixture(payload = {}, { enabled = true, fail = false } = {}) {
  const calls = [], values = {}, status = {}
  globalThis.coachWeekFake = { from(table) {
    const call = { table }; calls.push(call)
    const query = {}
    for (const name of ['select','in','gte','order','limit']) query[name] = (...args) => { call[name] = args; return query }
    query.then = (resolve, reject) => (fail === 'throw' ? Promise.reject(Error('synthetic')) :
      Promise.resolve(fail ? { data: null, error: Error('synthetic') } : { data: payload[table] || [], error: null })).then(resolve, reject)
    return query
  } }
  const reader = lavLaesninger({ coachWeekEnabled: enabled, coachActions: false,
    setCoachWeekDataStatus: update => Object.assign(status, update(status)),
    setCalendarWeeks: value => { values.weeks = value },
    setAthleteCurrentWeek: value => { values.current = value },
    setAthleteWeekCompletion: value => { values.completion = value },
  })
  return { reader, calls, values: { get CalendarWeeks() { return values.weeks }, get AthleteWeekCompletion() { return values.completion } }, statuses: status, valuesInternal: values }
}
