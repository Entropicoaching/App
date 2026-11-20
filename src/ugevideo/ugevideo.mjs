// ORDRE 1953 (Marc 20. nov.: "jeg kan ligge video ind til min klienter hvor ejg forklare hvordan ugen er gået
// samt næste uges træning"): coachens ugevideo til én atlet for én uge.
// Rækken ligger i coach_week_videos (udkast: supabase/sql/udkast/20261120210000_coach_ugevideo_DRAFT.sql),
// klippet i videolageret (R2) når det er slået til, ellers i Supabase-lageret som atletens videoer.
// Kun atleten selv og hendes coach kan se rækken og klippet (RLS og lagerets mappe-policies).
import { calendarDay, addCalendarDays } from '../calendarDate.js'
import { VIDEOCOACH_UPLOAD_BUCKET, VIDEOCOACH_UPLOAD_MAX_BYTES } from '../videoCoachUpload.js'

export const UGEVIDEO_TABLE = 'coach_week_videos'
const KOLONNER = 'id,athlete_id,week_start,video_path,note,created_at,athlete_seen_at'
const UDVIDELSER = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }

// Mandagen i den uge, dagen ligger i (YYYY-MM-DD, kalenderdag i Danmark).
export function mandagI(day = calendarDay()) {
  const d = new Date(`${day}T12:00:00Z`)
  return addCalendarDays(day, -((d.getUTCDay() + 6) % 7))
}

// "Denne uge" og "Næste uge" for coachen, regnet fra i dag.
export function ugeValg(day = calendarDay()) {
  const denne = mandagI(day)
  return [{ key: 'denne', label: 'Denne uge', weekStart: denne }, { key: 'naeste', label: 'Næste uge', weekStart: addCalendarDays(denne, 7) }]
}

export function ugevideoSti(athleteId, id, mimeType) {
  const ext = UDVIDELSER[String(mimeType || '').split(';')[0].trim().toLowerCase()]
  return athleteId && /^[0-9a-f-]{36}$/i.test(String(id)) && ext ? `${athleteId}/${id}.${ext}` : null
}

const nyId = () => globalThis.crypto.randomUUID()

async function lagerKlient(env) {
  if (!env?.VITE_VIDEOLAGER_URL) return null
  const klient = await import('../videolager/klient.js')
  const base = klient.videolagerUrl(env)
  return base ? { klient, base } : null
}

// Atletens skærm har kun en tabelklient (guardTrainingClient uden lager og login); så bruges appens fælles klient til klippet.
async function lagerKilde(client) {
  return client?.storage && client?.auth ? client : (await import('../supabase.js')).supabase
}

const token = async client => (await (await lagerKilde(client)).auth?.getSession?.())?.data?.session?.access_token

// Coachen lægger en video. Klippet først, så rækken; fejler rækken, findes klippet uden række og vises aldrig.
export async function laegUgevideo({ client, athleteId, weekStart, file, note = '', env = import.meta.env, id = nyId() }) {
  if (!client || !athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(String(weekStart)) || !file) return { error: 'Vælg en video først' }
  const mimeType = file.type || 'video/mp4'
  const path = ugevideoSti(athleteId, id, mimeType)
  if (!path) return { error: 'Videoen skal være mp4, mov eller webm' }
  let upload = null
  const lager = await lagerKlient(env)
  if (lager) upload = await lager.klient.uploadTilVideolager({ base: lager.base, token: await token(client),
    athleteId, clientAnalysisId: id, path, file, mimeType })
  // Supabase-lageret tager højst 50 MB pr. fil; en længere video kan kun ligge i videolageret.
  if ((!upload || upload.error) && file.size > VIDEOCOACH_UPLOAD_MAX_BYTES) {
    return { error: upload?.error?.message || 'Videoen er over 50 MB og kræver videolageret' }
  }
  if (!upload || upload.error) {
    upload = await (await lagerKilde(client)).storage.from(VIDEOCOACH_UPLOAD_BUCKET).upload(path, file, { contentType: mimeType, upsert: false })
  }
  if (upload?.error) return { error: 'Videoen kunne ikke gemmes. Prøv igen' }
  const tekst = String(note || '').trim()
  const { data, error } = await client.from(UGEVIDEO_TABLE)
    .insert({ id, athlete_id: athleteId, week_start: weekStart, video_path: path, ...(tekst ? { note: tekst } : {}) })
    .select(KOLONNER).single()
  if (error || !data) return { error: 'Videoen er gemt, men atleten kan ikke se den endnu. Prøv igen' }
  return { video: data }
}

// Coachens liste for én atlet, nyeste uge først.
export async function hentCoachUgevideoer({ client, athleteId, limit = 4 }) {
  if (!client || !athleteId) return { videoer: [] }
  const { data, error } = await client.from(UGEVIDEO_TABLE).select(KOLONNER)
    .eq('athlete_id', athleteId).order('week_start', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
  return error ? { videoer: [], error: 'Ugevideoerne kunne ikke hentes' } : { videoer: Array.isArray(data) ? data : [] }
}

// Atletens video: denne uges eller næste uges (lagt i weekenden), nyeste først.
export async function hentAtletUgevideo({ client, athleteId, day = calendarDay() }) {
  if (!client || !athleteId) return null
  const denne = mandagI(day)
  const { data, error } = await client.from(UGEVIDEO_TABLE).select(KOLONNER)
    .eq('athlete_id', athleteId).gte('week_start', denne).lte('week_start', addCalendarDays(denne, 7))
    .order('week_start', { ascending: false }).order('created_at', { ascending: false }).limit(1)
  return !error && Array.isArray(data) && data[0] ? data[0] : null
}

// Kort adresse til at afspille klippet: videolageret først, så Supabase-lageret.
export async function ugevideoAdresse({ client, videoPath, env = import.meta.env }) {
  if (!client || !videoPath) return null
  const lager = await lagerKlient(env)
  const fraLager = lager ? await lager.klient.hentFraVideolager({ base: lager.base, token: await token(client), videoPath }) : null
  if (fraLager) return fraLager
  const { data, error } = await (await lagerKilde(client)).storage.from(VIDEOCOACH_UPLOAD_BUCKET).createSignedUrl(videoPath, 3600)
  return error ? null : data?.signedUrl || null
}

// Atleten har set videoen. Kun første gang; rækkens trigger lader atleten ændre intet andet.
export async function markerUgevideoSet({ client, video, now = new Date() }) {
  if (!client || !video?.id || video.athlete_seen_at) return video?.athlete_seen_at || null
  const tid = now.toISOString()
  const { error } = await client.from(UGEVIDEO_TABLE).update({ athlete_seen_at: tid }).eq('id', video.id).is('athlete_seen_at', null)
  return error ? null : tid
}

const dato = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', timeZone: 'Europe/Copenhagen' })
const klok = new Intl.DateTimeFormat('da-DK', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Copenhagen' })

export function ugeTekst(weekStart) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(weekStart)) ? `Ugen fra ${dato.format(new Date(`${weekStart}T12:00:00Z`))}` : 'Ugen'
}

export function setTekst(seenAt) {
  if (!seenAt) return 'Ikke set endnu'
  const t = new Date(seenAt)
  return Number.isNaN(t.getTime()) ? 'Set' : `Set ${dato.format(t)} kl. ${klok.format(t)}`
}
