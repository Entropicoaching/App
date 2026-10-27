import { buildPreviewSeed } from './fridayPreviewSeed.mjs'
const failure = message => ({ data: null, error: { message, code: 'PREVIEW_ONLY' } })
const get = (row, key) => key.split('.').reduce((value, part) => value?.[part], row)

// Deliberately read only. Unsupported operations return a visible error.
export function createPreviewDatabase(seed = buildPreviewSeed()) {
  const tables = structuredClone(seed)
  const weekFor = session => (tables.weeks || []).find(w => w.id === session?.week_id) || null
  const exerciseFor = exercise => exercise ? { ...exercise, sessions: (() => {
    const session = (tables.sessions || []).find(s => s.id === exercise.session_id)
    return session ? { ...session, weeks: weekFor(session) } : null
  })() } : null
  function rows(name) {
    return (tables[name] || []).map(row => {
      const value = { ...row }
      if (name === 'weeks') value.sessions = (tables.sessions || []).filter(s => s.week_id === row.id)
        .map(s => ({ ...s, exercises: (tables.exercises || []).filter(e => e.session_id === s.id) }))
      if (name === 'sessions') {
        value.exercises = (tables.exercises || []).filter(e => e.session_id === row.id)
        value.weeks = weekFor(row)
      }
      if (name === 'exercises') return structuredClone(exerciseFor(row))
      if (name === 'exercise_logs') value.exercises = exerciseFor((tables.exercises || []).find(e => e.id === row.exercise_id))
      return structuredClone(value)
    })
  }
  function from(name) {
    const filters = [], orders = []
    let offset = 0, end = Infinity, one = false, error = Object.hasOwn(tables,name) ? null : 'Ukendt previewtabel'
    const query = {
      select() { return query },
      eq(key, value) { filters.push(row => get(row,key) === value); return query },
      neq(key, value) { filters.push(row => get(row,key) !== value); return query },
      is(key, value) { filters.push(row => (get(row,key) ?? null) === value); return query },
      in(key, values) { filters.push(row => values.includes(get(row,key))); return query },
      gt(key, value) { filters.push(row => get(row,key) > value); return query },
      gte(key, value) { filters.push(row => get(row,key) >= value); return query },
      lt(key, value) { filters.push(row => get(row,key) < value); return query },
      lte(key, value) { filters.push(row => get(row,key) <= value); return query },
      not(key, operator, value) { if (operator === 'is') filters.push(row => (get(row,key) ?? null) !== value); else error = 'Ikke understøttet filter'; return query },
      or(expression) {
        const parts = expression.split(',').map(part => part.match(/^([a-z_]+)\.(eq|is)\.(.*)$/))
        if (parts.some(part => !part)) error = 'Ikke understøttet OR-filter'
        else filters.push(row => parts.some(([,key,,value]) => value === 'null' ? row[key] == null : String(row[key]) === value))
        return query
      },
      order(key, { ascending = true, referencedTable, foreignTable } = {}) {
        // Embedded rows are seeded in display order.
        if (!referencedTable && !foreignTable) orders.push([key, ascending]); return query
      },
      limit(count) { end = offset+count; return query },
      range(start, last) { offset = start; end = last+1; return query },
      single() { one = true; return query }, maybeSingle() { one = true; return query },
      abortSignal() { return query },
      then(resolve, reject) {
        if (error) return Promise.resolve(failure(error)).then(resolve,reject)
        let data = rows(name).filter(row => filters.every(filter => filter(row)))
        const count = data.length
        data.sort((a,b) => { for (const [key,asc] of orders) {
          const x = get(a,key), y = get(b,key)
          if (x !== y) return (x > y ? 1 : -1)*(asc ? 1 : -1)
        } return 0 })
        data = data.slice(offset,end)
        return Promise.resolve({ data: one ? data[0] ?? null : data, error: null, count }).then(resolve,reject)
      },
    }
    for (const method of ['insert','update','upsert','delete']) query[method] = () => {
      error = 'Syntetisk preview er skrivebeskyttet'; return query
    }
    return query
  }
  return { from, rpc: async name => ['entropi_training_signals_v1', 'get_my_shared_video_analyses_v3'].includes(name)
    ? { data: [], error: null } : failure('RPC er slået fra i preview'),
    functions: { invoke: async () => failure('Funktioner er slået fra i syntetisk preview') },
    storage: { from: () => ({ createSignedUrl: async () => failure('Intet klip i syntetisk preview'),
      upload: async () => failure('Upload er slået fra i preview'), remove: async () => failure('Sletning er slået fra i preview') }) },
    auth: { signOut: async () => ({ error: null }) } }
}
export const supabase = createPreviewDatabase()
export const withRetry = async run => run()
export const queueWrite = async run => run()
export const isPasswordRecoveryUrl = () => false
export const warmupAuth = async () => {}
export const signOutHard = async () => ({ error: null })
export const createAbortableUploadClient = () => supabase
