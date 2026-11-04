// Synthetic backend only: never contacts a service or reads auth/environment.
export const fixture = { rows: [], weeks: [], calls: [], failure: false, planFailure: false, wait: null }
export const supabase = { from(table) {
  const call = { table }; fixture.calls.push(call)
  const query = {
    select(value) { call.select = value; return query },
    eq(field, value) { call.eq = [field, value]; return query },
    in(field, value) { call.in = [field, value]; return query },
    order(field, options) { call.order = [field, options]; return query },
    async range(from, to) {
      call.range = [from, to]
      if (table === 'weeks') return fixture.planFailure ? { error: true } : { data: fixture.weeks.slice(from, to + 1) }
      if (fixture.wait) await fixture.wait
      return fixture.failure ? { error: { message: 'raw synthetic failure' }, data: null }
        : { data: fixture.rows.filter(r => call.in[1].includes(r.exercise_id)).slice(from, to + 1) }
    },
  }
  return query
} }
