import { calendarDay } from '../../calendarDate.js'

// U7 del 3: datalaget med reserve. Vand, "færdig for i dag", søvnkvalitet, smerte og
// væskemålet skrives til tracking_daily_v1 og nutrition_targets_v1, når tabellerne findes
// (migrationspakken A til C). Findes de ikke, sker intet her, og appen bruger telefonens
// localStorage som i U6. Kostplanen har allerede sin egen reserve (kostplan/planAdapter.mjs).
export const DAILY = 'tracking_daily_v1'
export const TARGETS = 'nutrition_targets_v1'
export const DAILY_FIELDS = Object.freeze(['sleep_quality', 'pain', 'pain_location', 'water_ml', 'kost_done_at'])
const DAILY_COLUMNS = 'athlete_id, logged_date, ' + DAILY_FIELDS.join(', ')
const DAILY_CAP = 1000
const TARGET_COLUMNS = 'athlete_id, effective_from, kcal, protein_g, water_ml, created_at'

// Samme genkendelse af en manglende tabel som planAdapter og coachBriefingSeen.
export const tableMissing = error => ['42P01', 'PGRST205'].includes(error?.code) ||
  /does not exist|could not find the table/i.test(typeof error?.message === 'string' ? error.message : '')

// Én prøve pr. klient og tabel. "missing" huskes; en anden fejl prøves igen næste gang.
const probes = new WeakMap()
export function tableState(client, table) {
  if (!client || typeof client.from !== 'function') return Promise.resolve('error')
  if (!probes.has(client)) probes.set(client, new Map())
  const cache = probes.get(client)
  if (cache.has(table)) return cache.get(table)
  const probe = (async () => {
    try {
      const result = await client.from(table).select(table === DAILY ? 'athlete_id' : 'id').limit(0)
      if (!result?.error) return 'ready'
      return tableMissing(result.error) ? 'missing' : 'error'
    } catch { return 'error' }
  })()
  cache.set(table, probe)
  probe.then(state => { if (state === 'error' && cache.get(table) === probe) cache.delete(table) })
  return probe
}
export const forgetTableState = client => { if (client) probes.delete(client) }

const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 128
const validDay = day => typeof day === 'string' && calendarDay(day) === day

export function cleanDaily(patch = {}) {
  const out = {}
  for (const field of DAILY_FIELDS) if (Object.hasOwn(patch, field)) out[field] = patch[field]
  if ('sleep_quality' in out && out.sleep_quality !== null && !(Number.isInteger(out.sleep_quality) && out.sleep_quality >= 1 && out.sleep_quality <= 5)) return null
  if ('pain' in out && out.pain !== null && !(Number.isInteger(out.pain) && out.pain >= 0 && out.pain <= 10)) return null
  if ('water_ml' in out && out.water_ml !== null && !(Number.isInteger(out.water_ml) && out.water_ml >= 0 && out.water_ml <= 50000)) return null
  if ('pain_location' in out && out.pain_location !== null) {
    const text = typeof out.pain_location === 'string' ? out.pain_location.trim().slice(0, 120) : ''
    out.pain_location = text || null
  }
  if ('kost_done_at' in out && out.kost_done_at !== null && !Number.isFinite(Date.parse(out.kost_done_at))) return null
  return Object.keys(out).length ? out : null
}

export async function readDaily({ client, athleteId, from, to }) {
  if (!validId(athleteId) || !validDay(from) || !validDay(to)) return { state: 'error', rows: [] }
  const state = await tableState(client, DAILY)
  if (state !== 'ready') return { state, rows: [] }
  try {
    const result = await client.from(DAILY).select(DAILY_COLUMNS).eq('athlete_id', athleteId)
      .gte('logged_date', from).lte('logged_date', to).order('logged_date').limit(DAILY_CAP + 1)
    // Over loftet er svaret ufuldstændigt; så hellere intet end en flytning, der tror en dag er tom.
    if (result?.error || !Array.isArray(result?.data) || result.data.length > DAILY_CAP) return { state: 'error', rows: [] }
    return { state: 'ready', rows: result.data.filter(r => r?.athlete_id === athleteId && validDay(r.logged_date)) }
  } catch { return { state: 'error', rows: [] } }
}

// Gem kun de felter, der er givet. Først UPDATE af dagens række (athlete_id og dato kan ikke
// flyttes); findes rækken ikke, INSERT. Kommer en anden skrivning først (23505), UPDATE igen.
// Nøglen (athlete_id, logged_date) gør, at der aldrig bliver to rækker for samme dag.
export async function saveDaily({ client, athleteId, date, patch }) {
  const data = cleanDaily(patch)
  if (!validId(athleteId) || !validDay(date) || !data) return 'error'
  const state = await tableState(client, DAILY)
  if (state !== 'ready') return state
  const update = async () => {
    const result = await client.from(DAILY).update(data).eq('athlete_id', athleteId).eq('logged_date', date).select('athlete_id')
    if (result?.error) return tableMissing(result.error) ? 'missing' : 'error'
    return Array.isArray(result?.data) && result.data.length > 0 ? 'saved' : 'none'
  }
  try {
    const first = await update()
    if (first !== 'none') return first
    const inserted = await client.from(DAILY).insert({ athlete_id: athleteId, logged_date: date, ...data })
    if (!inserted?.error) return 'saved'
    if (inserted.error.code === '23505') { const again = await update(); return again === 'none' ? 'error' : again }
    return tableMissing(inserted.error) ? 'missing' : 'error'
  } catch { return 'error' }
}

export async function readTargets({ client, athleteIds }) {
  const ids = [...new Set((Array.isArray(athleteIds) ? athleteIds : [athleteIds]).filter(validId))]
  if (!ids.length) return { state: 'error', rows: [] }
  const state = await tableState(client, TARGETS)
  if (state !== 'ready') return { state, rows: [] }
  try {
    const result = await client.from(TARGETS).select(TARGET_COLUMNS).in('athlete_id', ids)
      .order('effective_from').order('created_at').limit(2001)
    if (result?.error || !Array.isArray(result?.data) || result.data.length > 2000) return { state: 'error', rows: [] }
    return { state: 'ready', rows: result.data.filter(r => ids.includes(r?.athlete_id) && validDay(r.effective_from)) }
  } catch { return { state: 'error', rows: [] } }
}

// Det mål, der gjaldt dagen: for hvert felt den seneste række (effective_from, created_at)
// med effective_from <= dagen og feltet udfyldt. null, når intet dateret mål dækker dagen.
export function targetOn(rows, athleteId, day, field) {
  let best = null
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.athlete_id !== athleteId || !validDay(row.effective_from) || row.effective_from > day) continue
    const value = Number(row[field])
    if (row[field] == null || !Number.isFinite(value) || value <= 0) continue
    if (!best || row.effective_from > best.effective_from ||
      (row.effective_from === best.effective_from && String(row.created_at ?? '') >= String(best.created_at ?? ''))) best = row
  }
  return best ? { value: Number(best[field]), from: best.effective_from } : null
}

export async function appendTarget({ client, athleteId, day, fields }) {
  const row = { athlete_id: athleteId, effective_from: day }
  for (const field of ['kcal', 'protein_g', 'water_ml']) {
    if (fields?.[field] == null) continue
    const value = Math.round(Number(fields[field]))
    if (!Number.isFinite(value) || value <= 0) return 'error'
    row[field] = value
  }
  if (!validId(athleteId) || !validDay(day) || Object.keys(row).length === 2) return 'error'
  const state = await tableState(client, TARGETS)
  if (state !== 'ready') return state
  try {
    const result = await client.from(TARGETS).insert(row)
    if (!result?.error) return 'saved'
    return tableMissing(result.error) ? 'missing' : 'error'
  } catch { return 'error' }
}

// ===== Engangsflytning af telefonens data =====
// Første gang appen åbner med tabellerne, flyttes vand pr. dag, "færdig for i dag" og
// væskemålet op. Et felt, der allerede har en værdi på serveren, overskrives aldrig, og
// nøglen pr. dag gør flytningen idempotent: kører den to gange, bliver der ingen dubletter.
// Lykkes alt, huskes det på telefonen, så den ikke kører igen.
const movedKey = athleteId => `entropi2:u7-flyttet:v1:${encodeURIComponent(athleteId)}`
const waterPrefix = athleteId => `entropi2:water-intake:v1:${encodeURIComponent(athleteId)}:`
const donePrefix = athleteId => `entropi2:kostvane-faerdig:v1:${encodeURIComponent(athleteId)}:`
const goalKey = athleteId => `entropi2:water-goal:v1:${encodeURIComponent(athleteId)}`

export function localDayData(storage, athleteId) {
  const days = new Map(), at = day => { if (!days.has(day)) days.set(day, {}); return days.get(day) }
  let goal = null
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (typeof key !== 'string') continue
      if (key.startsWith(waterPrefix(athleteId))) {
        const day = key.slice(waterPrefix(athleteId).length)
        const value = JSON.parse(storage.getItem(key))
        if (!validDay(day) || value?.schema !== 'entropi2-water-day/v1' || value.athleteId !== athleteId || value.date !== day || !Array.isArray(value.entries)) continue
        const total = value.entries.reduce((n, e) => n + (Number.isInteger(e?.ml) && e.ml > 0 ? e.ml : 0), 0)
        if (total > 0) at(day).water_ml = Math.min(total, 50000)
      } else if (key.startsWith(donePrefix(athleteId))) {
        const day = key.slice(donePrefix(athleteId).length)
        if (validDay(day) && storage.getItem(key) === '1') at(day).kost_done_at = `${day}T12:00:00.000Z`
      } else if (key === goalKey(athleteId)) {
        const value = JSON.parse(storage.getItem(key))
        if (value?.schema === 'entropi2-water-goal/v1' && value.athleteId === athleteId && Number.isInteger(value.ml)) goal = value.ml
      }
    }
  } catch { return null }
  return { days, goal }
}

const running = new Map()
export function moveLocalOnce({ client, athleteId, storage, today }) {
  const device = storage === undefined ? globalThis.localStorage : storage
  if (!validId(athleteId) || !validDay(today) || !device) return Promise.resolve('error')
  try { if (device.getItem(movedKey(athleteId)) != null) return Promise.resolve('done') } catch { return Promise.resolve('error') }
  const key = athleteId
  if (running.has(key)) return running.get(key)
  const job = (async () => {
    const [daily, targets] = await Promise.all([tableState(client, DAILY), tableState(client, TARGETS)])
    if (daily !== 'ready' || targets !== 'ready') return daily === 'missing' || targets === 'missing' ? 'missing' : 'error'
    const local = localDayData(device, athleteId)
    if (!local) return 'error'
    const dates = [...local.days.keys()].sort()
    let ok = true
    if (dates.length) {
      const server = await readDaily({ client, athleteId, from: dates[0], to: dates.at(-1) })
      if (server.state !== 'ready') return server.state
      const byDay = new Map(server.rows.map(r => [r.logged_date, r]))
      for (const day of dates) {
        const have = byDay.get(day), patch = {}
        for (const [field, value] of Object.entries(local.days.get(day))) if (have?.[field] == null) patch[field] = value
        if (Object.keys(patch).length && await saveDaily({ client, athleteId, date: day, patch }) !== 'saved') ok = false
      }
    }
    if (local.goal != null) {
      const server = await readTargets({ client, athleteIds: [athleteId] })
      if (server.state !== 'ready') return server.state
      if (!targetOn(server.rows, athleteId, '9999-12-31', 'water_ml') &&
        await appendTarget({ client, athleteId, day: today, fields: { water_ml: local.goal } }) !== 'saved') ok = false
    }
    if (!ok) return 'error'
    try { device.setItem(movedKey(athleteId), today) } catch { return 'error' }
    return 'moved'
  })().finally(() => running.delete(key))
  running.set(key, job)
  return job
}
