// ORDRE 1953: coachens ugevideo. Datalaget mod en falsk klient, udkastets adgangsregler og koblingen i appen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mandagI, ugeValg, ugevideoSti, laegUgevideo, hentAtletUgevideo, hentCoachUgevideoer, markerUgevideoSet, ugevideoAdresse, setTekst, UGEVIDEO_TABLE } from './ugevideo.mjs'
import { forvalgtUge } from './CoachUgevideo.mjs'

const ATLET = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function falskKlient({ insertFejl = null, uploadFejl = null, raekker = [] } = {}) {
  const kald = []
  const kaede = (tabel) => {
    const q = { tabel, filtre: [] }
    const api = {
      select: () => api, insert: v => { q.insert = v; return api }, update: v => { q.update = v; return api },
      eq: (k, v) => { q.filtre.push(['eq', k, v]); return api }, gte: (k, v) => { q.filtre.push(['gte', k, v]); return api },
      lte: (k, v) => { q.filtre.push(['lte', k, v]); return api }, is: (k, v) => { q.filtre.push(['is', k, v]); return api },
      order: () => api, limit: () => { kald.push(q); return Promise.resolve({ data: raekker, error: null }) },
      single: () => { kald.push(q); return Promise.resolve(insertFejl ? { data: null, error: insertFejl } : { data: { ...q.insert, athlete_seen_at: null }, error: null }) },
      then: (ok, nej) => { kald.push(q); return Promise.resolve({ error: null }).then(ok, nej) },
    }
    return api
  }
  return {
    kald,
    from: kaede,
    auth: { getSession: async () => ({ data: { session: null } }) },
    storage: { from: bucket => ({
      upload: (path, file, opts) => { kald.push({ upload: { bucket, path, opts } }); return Promise.resolve(uploadFejl ? { error: uploadFejl } : { data: { path }, error: null }) },
      createSignedUrl: (path, s) => Promise.resolve({ data: { signedUrl: `https://lager.test/${path}?s=${s}` }, error: null }),
    }) },
  }
}

test('mandagI og ugeValg giver mandage i dansk kalender', () => {
  assert.equal(mandagI('2026-11-20'), '2026-11-16') // fredag
  assert.equal(mandagI('2026-11-22'), '2026-11-16') // søndag
  assert.equal(mandagI('2026-11-23'), '2026-11-23') // mandag
  assert.deepEqual(ugeValg('2026-11-20').map(v => v.weekStart), ['2026-11-16', '2026-11-23'])
})

test('forvalgt uge: fredag til søndag er næste uge, ellers denne', () => {
  assert.equal(forvalgtUge('2026-11-20'), 'naeste')
  assert.equal(forvalgtUge('2026-11-22'), 'naeste')
  assert.equal(forvalgtUge('2026-11-23'), 'denne')
  assert.equal(forvalgtUge('2026-11-19'), 'denne')
})

test('stien ligger i atletens mappe og kræver en kendt videotype', () => {
  assert.equal(ugevideoSti(ATLET, ID, 'video/mp4'), `${ATLET}/${ID}.mp4`)
  assert.equal(ugevideoSti(ATLET, ID, 'video/quicktime'), `${ATLET}/${ID}.mov`)
  assert.equal(ugevideoSti(ATLET, ID, 'image/png'), null)
  assert.equal(ugevideoSti(null, ID, 'video/mp4'), null)
})

test('laegUgevideo lægger klippet først og så rækken for den valgte atlet og uge', async () => {
  const client = falskKlient()
  const r = await laegUgevideo({ client, athleteId: ATLET, weekStart: '2026-11-23', file: { type: 'video/mp4', size: 1000 }, id: ID, env: {} })
  assert.equal(r.error, undefined)
  assert.deepEqual(client.kald[0].upload, { bucket: 'videocoach-uploads', path: `${ATLET}/${ID}.mp4`, opts: { contentType: 'video/mp4', upsert: false } })
  assert.equal(client.kald[1].tabel, UGEVIDEO_TABLE)
  assert.deepEqual(client.kald[1].insert, { id: ID, athlete_id: ATLET, week_start: '2026-11-23', video_path: `${ATLET}/${ID}.mp4` })
  assert.equal(r.video.athlete_seen_at, null)
})

test('laegUgevideo stopper ved fejl i lageret, i rækken og ved over 50 MB uden videolager', async () => {
  const fil = { type: 'video/mp4', size: 1000 }
  assert.match((await laegUgevideo({ client: falskKlient({ uploadFejl: { message: 'nej' } }), athleteId: ATLET, weekStart: '2026-11-23', file: fil, id: ID, env: {} })).error, /kunne ikke gemmes/)
  assert.match((await laegUgevideo({ client: falskKlient({ insertFejl: { message: 'rls' } }), athleteId: ATLET, weekStart: '2026-11-23', file: fil, id: ID, env: {} })).error, /kan ikke se den endnu/)
  const stor = falskKlient()
  assert.match((await laegUgevideo({ client: stor, athleteId: ATLET, weekStart: '2026-11-23', file: { type: 'video/mp4', size: 60 * 1048576 }, id: ID, env: {} })).error, /50 MB/)
  assert.equal(stor.kald.length, 0, 'intet sendt')
  assert.match((await laegUgevideo({ client: falskKlient(), athleteId: ATLET, weekStart: 'i morgen', file: fil, id: ID, env: {} })).error, /Vælg/)
})

test('atleten henter kun sin egen atlet-id for denne og næste uge', async () => {
  const client = falskKlient({ raekker: [{ id: ID, athlete_id: ATLET, week_start: '2026-11-23', video_path: `${ATLET}/${ID}.mp4` }] })
  const v = await hentAtletUgevideo({ client, athleteId: ATLET, day: '2026-11-22' })
  assert.equal(v.id, ID)
  assert.deepEqual(client.kald[0].filtre, [['eq', 'athlete_id', ATLET], ['gte', 'week_start', '2026-11-16'], ['lte', 'week_start', '2026-11-23']])
  assert.equal(await hentAtletUgevideo({ client: falskKlient(), athleteId: ATLET, day: '2026-11-22' }), null)
  assert.equal(await hentAtletUgevideo({ client, athleteId: null }), null)
  const coach = falskKlient({ raekker: [] })
  assert.deepEqual(await hentCoachUgevideoer({ client: coach, athleteId: ATLET }), { videoer: [] })
  assert.deepEqual(coach.kald[0].filtre, [['eq', 'athlete_id', ATLET]])
})

test('set markeres én gang og kun fra tom', async () => {
  const client = falskKlient()
  const t = await markerUgevideoSet({ client, video: { id: ID, athlete_seen_at: null }, now: new Date('2026-11-23T07:12:00Z') })
  assert.equal(t, '2026-11-23T07:12:00.000Z')
  assert.deepEqual(client.kald[0].update, { athlete_seen_at: t })
  assert.deepEqual(client.kald[0].filtre, [['eq', 'id', ID], ['is', 'athlete_seen_at', null]])
  const igen = falskKlient()
  assert.equal(await markerUgevideoSet({ client: igen, video: { id: ID, athlete_seen_at: t } }), t)
  assert.equal(igen.kald.length, 0)
  assert.equal(setTekst(null), 'Ikke set endnu')
  assert.equal(setTekst('2026-11-23T07:12:00Z'), 'Set 23. nov. kl. 08.12')
})

test('adressen kommer fra Supabase-lageret uden videolager', async () => {
  assert.equal(await ugevideoAdresse({ client: falskKlient(), videoPath: `${ATLET}/${ID}.mp4`, env: {} }), `https://lager.test/${ATLET}/${ID}.mp4?s=3600`)
  assert.equal(await ugevideoAdresse({ client: falskKlient(), videoPath: '', env: {} }), null)
})

test('udkastet: kun atleten selv og hendes coach kan se en ugevideo, og en rollback findes', () => {
  const sql = readFileSync(new URL('../../supabase/sql/udkast/20261120210000_coach_ugevideo_DRAFT.sql', import.meta.url), 'utf8')
  assert.ok(readFileSync(new URL('../../supabase/sql/udkast/20261120210000_coach_ugevideo_DRAFT_ROLLBACK.sql', import.meta.url), 'utf8').includes('drop table if exists public.coach_week_videos'))
  assert.match(sql, /enable row level security/)
  assert.match(sql, /revoke all on public\.coach_week_videos from anon/)
  const policies = [...sql.matchAll(/create policy (coach_week_videos_\w+)[\s\S]*?;/g)]
  assert.equal(policies.length, 5)
  for (const [tekst, navn] of policies) {
    assert.match(tekst, /a\.id = coach_week_videos\.athlete_id and a\.(coach_id|user_id) = \(select auth\.uid\(\)\)/, navn)
    assert.doesNotMatch(tekst, /using \(true\)|with check \(true\)/, navn)
  }
})

test('appen viser kortene de rigtige steder', () => {
  // Hjem: kun atleten selv, ikke coachens forhåndsvisning (readOnly) eller coachens egen træning.
  const hjem = readFileSync(new URL('../entropi2/home/HomeSession.mjs', import.meta.url), 'utf8')
  assert.match(hjem, /athleteId && props\.readOnly !== true && props\.coachOwnTraining !== true &&\s+h\(AtletUgevideo/)
  assert.match(hjem, /h\(AtletUgevideo, \{ key: `ugevideo-\$\{athleteId\}`, athleteId, client: props\.ugevideoClient \}\)/)
  // Samtale: kun coachen, og kun når atleten er i coachens egen liste (scoped).
  const samtale = readFileSync(new URL('../entropi2/conversation/ConversationEntry.mjs', import.meta.url), 'utf8')
  assert.match(samtale, /role === 'coach' && scoped && h\(CoachUgevideo, \{ key: `ugevideo-\$\{athleteId\}`, client: entry\.inboxDatabase, athlete: entry\.selectedAthlete \}\)/)
})
