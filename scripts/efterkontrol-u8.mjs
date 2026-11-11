// Efterkontrol efter push og migration af U1 til U8 (ordre 80). KUN LÆSNING.
// Dhurva kører den lige efter pushet, mod live:
//   node scripts/efterkontrol-u8.mjs                       (forventer ny app, B, C og D, nøgler sat)
//   node scripts/efterkontrol-u8.mjs --tabeller u7         (B og C kørt, D endnu ikke)
//   node scripts/efterkontrol-u8.mjs --tabeller ingen --app live   (efter fuld tilbagerulning)
//   node scripts/efterkontrol-u8.mjs --uden-noegler        (D kørt, push-nøglerne ikke sat endnu)
//   node scripts/efterkontrol-u8.mjs --efter 2026-11-12T02:00:00Z   (build skal være nyere end pushet)
// Hvad den gør (kun GET, HEAD og ét POST til edge-funktionens offentlige nøgle):
//   1. Siden svarer 200 og er appen.
//   2. version.json svarer, og den udrullede kode er den rigtige (U7- og U8-markører i koden).
//   3. Tabellerne findes eller findes ikke: som anonym giver en tabel, der findes, "permission
//      denied" (42501), og en tabel, der ikke findes, 404 PGRST205. Ingen rækker læses.
//   4. Edge-funktionen u8-push giver en offentlig nøgle (kun når nøglerne er sat).
//   5. RLS mellem atleter: KUN med en syntetisk testatlet i miljøet
//      (EFTERKONTROL_ATLET_EMAIL og EFTERKONTROL_ATLET_KODE). Ellers springes punktet over, og det står i
//      udskriften. Med testatleten læses kun rækker, der IKKE er atletens egne; svaret skal være tomt.
//      Ærlig grænse: login og logud registreres i Supabase Auth (ingen appdata skrives). Et grønt
//      RLS-punkt på en tabel, hvor ingen andre atleter har rækker endnu, beviser intet.
// Supabase-adressen og den offentlige anon-nøgle læses fra den udrullede app (de står i dens kode);
// intet gemmes, og ingen hemmelig nøgle bruges. Exitkode 0 = alt grønt, 1 = noget er rødt.
const args = process.argv.slice(2)
const flag = name => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] ?? true) : null }
const SITE = String(flag('--url') ?? 'https://app.entropicoaching.dk').replace(/\/+$/, '')
const APP = flag('--app') ?? 'ny'
const TABLES = flag('--tabeller') ?? 'u7,u8'
const AFTER = flag('--efter')
const KEYS = !args.includes('--uden-noegler') && TABLES.includes('u8')
const TIMEOUT = 15000

const U7 = ['tracking_daily_v1', 'nutrition_targets_v1']
const U8 = ['push_subscriptions_v1', 'push_preferences_v1', 'push_log_v1']
const LIVE = ['kostplan_v1_plans', 'kostplan_v1_versions', 'kostplan_v1_approvals']
const MARKERS = ['data-u7-day-feeling', 'data-u8-push']

const results = []
const report = (ok, what, detail = '') => { results.push({ ok, what, detail }); console.log(`${ok === null ? 'SPRUNGET OVER' : ok ? 'GRØN' : 'RØD '}  ${what}${detail ? `: ${detail}` : ''}`) }
const get = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: 'no-store', redirect: 'follow' })

async function assets() {
  const html = await (await get(`${SITE}/?efterkontrol=${Date.now()}`)).text()
  const seen = new Set(), queue = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(m => m[1])
  const files = new Map()
  while (queue.length && seen.size < 400) {
    const path = queue.shift()
    if (seen.has(path)) continue
    seen.add(path)
    const answer = await get(`${SITE}${path}`)
    if (!answer.ok) continue
    const text = await answer.text()
    files.set(path, text)
    for (const m of text.matchAll(/(?:\/assets\/|["'`(]\.\/)([A-Za-z0-9_.-]+\.js)/g)) queue.push(`/assets/${m[1]}`)
  }
  return { html, files }
}

// Appens kode har adressen og anon-nøglen som to tekster lige efter hinanden (src/supabase.js).
// Bibliotekerne har også standardadresser (fx localhost:9999), så hver kandidat prøves: den første,
// hvis PostgREST svarer, bruges.
async function supabaseFrom(files) {
  const url = process.env.EFTERKONTROL_SUPABASE_URL, key = process.env.EFTERKONTROL_ANON_KEY
  if (url && key) return { url, key }
  const candidates = []
  for (const [path, text] of files) {
    if (!/supabase/i.test(path)) continue
    for (const m of text.matchAll(/=\s*[`"'](https?:\/\/[^`"'\s]+)[`"']\s*,\s*[\w$]+\s*=\s*[`"']([^`"'\s]{10,})[`"']/g))
      candidates.push({ url: m[1].replace(/\/+$/, ''), key: m[2] })
  }
  // Kun Supabase-værter eller maskinen selv: anon-nøglen sendes ikke til fremmede værter.
  for (const candidate of candidates.filter(c => /^https:\/\/[a-z0-9]+\.supabase\.co$|^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(c.url))) {
    try {
      const answer = await fetch(`${candidate.url}/rest/v1/`, { headers: { apikey: candidate.key }, signal: AbortSignal.timeout(5000) })
      if (answer.status < 500) return candidate
    } catch { /* næste kandidat */ }
  }
  return null
}

async function tableState(base, key, table, token) {
  const answer = await get(`${base}/rest/v1/${table}?select=*&limit=0`, { method: 'GET',
    headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, Accept: 'application/json' } })
  const body = await answer.json().catch(() => ({}))
  if (answer.status === 404 && body?.code === 'PGRST205') return 'mangler'
  if ((answer.status === 401 || answer.status === 403) && body?.code === '42501') return 'findes (anonym afvist)'
  if (answer.ok) return 'findes (anonym kan læse!)'
  return `ukendt svar ${answer.status} ${body?.code ?? ''}`
}

async function main() {
  console.log(`Efterkontrol U8 mod ${SITE} (forventet app: ${APP}, tabeller: ${TABLES}, nøgler: ${KEYS ? 'ja' : 'nej'})`)
  // 1. Siden.
  const page = await get(`${SITE}/`)
  const html = await page.text()
  report(page.status === 200 && /<div id="root"/.test(html), 'Siden svarer', `HTTP ${page.status}`)
  // 2. Version og kode.
  let version = null
  try { version = (await (await get(`${SITE}/version.json?ts=${Date.now()}`)).json()).buildId } catch { /* nedenfor */ }
  const built = version ? new Date(`${version.slice(0, 4)}-${version.slice(4, 6)}-${version.slice(6, 8)}T${version.slice(9, 11)}:${version.slice(11, 13)}:${version.slice(13, 15)}Z`) : null
  report(Boolean(built && !isNaN(built)), 'version.json svarer', String(version))
  if (AFTER) report(Boolean(built && built >= new Date(AFTER)), 'Buildet er nyere end pushet', `${built?.toISOString()} mod ${AFTER}`)
  const { files } = await assets()
  const code = [...files.values()].join('\n')
  const found = MARKERS.filter(m => code.includes(m))
  report(APP === 'ny' ? found.length === MARKERS.length : found.length === 0,
    APP === 'ny' ? 'Den udrullede kode er U1 til U8' : 'Den udrullede kode er den gamle (uden U7 og U8)', `${files.size} filer, markører: ${found.join(', ') || 'ingen'}`)
  // 3. Tabellerne.
  const supa = await supabaseFrom(files)
  if (!supa) { report(false, 'Supabase-adressen kunne ikke findes i appens kode'); return }
  console.log(`      Supabase: ${supa.url}`)
  const expectExists = new Set([...LIVE, ...(TABLES.includes('u7') ? U7 : []), ...(TABLES.includes('u8') ? U8 : [])])
  for (const table of [...LIVE, ...U7, ...U8]) {
    const got = await tableState(supa.url, supa.key, table)
    const ok = expectExists.has(table) ? got === 'findes (anonym afvist)' : got === 'mangler'
    report(ok, `Tabel ${table} ${expectExists.has(table) ? 'findes, anonym afvist' : 'findes ikke'}`, got)
  }
  // 4. Edge-funktionen.
  if (KEYS) {
    const answer = await get(`${supa.url}/functions/v1/u8-push`, { method: 'POST',
      headers: { apikey: supa.key, Authorization: `Bearer ${supa.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'public-key' }) })
    const body = await answer.json().catch(() => ({}))
    report(answer.ok && /^B[A-Za-z0-9_-]{86}$/.test(body?.publicKey ?? ''), 'Edge-funktionen u8-push giver den offentlige nøgle', `HTTP ${answer.status}`)
  } else report(null, 'Edge-funktionen u8-push', 'nøglerne er ikke sat endnu (forventet)')
  // 5. RLS med syntetisk testatlet.
  const email = process.env.EFTERKONTROL_ATLET_EMAIL, password = process.env.EFTERKONTROL_ATLET_KODE
  if (!email || !password) { report(null, 'RLS atlet mod anden atlet', 'ingen syntetisk testatlet angivet (EFTERKONTROL_ATLET_EMAIL/EFTERKONTROL_ATLET_KODE)'); return }
  const login = await get(`${supa.url}/auth/v1/token?grant_type=password`, { method: 'POST',
    headers: { apikey: supa.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const session = await login.json().catch(() => ({}))
  if (!login.ok || !session.access_token) { report(false, 'Testatleten kan logge ind', `HTTP ${login.status}`); return }
  const token = session.access_token, uid = session.user?.id
  const rows = async path => {
    const answer = await get(`${supa.url}/rest/v1/${path}`, { headers: { apikey: supa.key, Authorization: `Bearer ${token}` } })
    return { status: answer.status, body: await answer.json().catch(() => null) }
  }
  const own = await rows(`athletes?select=id&user_id=eq.${encodeURIComponent(uid)}`)
  const ids = Array.isArray(own.body) ? own.body.map(r => r.id) : []
  report(own.status === 200 && ids.length === 1, 'Testatleten har én atletprofil', `${ids.length}`)
  if (ids.length !== 1) return
  const notMine = `athlete_id=neq.${encodeURIComponent(ids[0])}`
  for (const table of [...(TABLES.includes('u7') ? U7 : []), 'kostplan_v1_plans']) {
    const r = await rows(`${table}?select=athlete_id&${notMine}&limit=5`)
    report(r.status === 200 && Array.isArray(r.body) && r.body.length === 0, `RLS: testatleten ser ingen andres rækker i ${table}`, `HTTP ${r.status}, ${Array.isArray(r.body) ? r.body.length : '?'} rækker (beviser kun noget, når andre atleter har rækker i tabellen)`)
  }
  if (TABLES.includes('u8')) for (const table of ['push_subscriptions_v1', 'push_preferences_v1']) {
    const r = await rows(`${table}?select=user_id&user_id=neq.${encodeURIComponent(uid)}&limit=5`)
    report(r.status === 200 && Array.isArray(r.body) && r.body.length === 0, `RLS: testatleten ser ingen andres rækker i ${table}`, `HTTP ${r.status}, ${Array.isArray(r.body) ? r.body.length : '?'} rækker (beviser kun noget, når andre atleter har rækker i tabellen)`)
  }
  if (TABLES.includes('u8')) {
    const r = await rows('push_log_v1?select=id&limit=1')
    report(r.status === 401 || r.status === 403, 'RLS: afsendelsesloggen er lukket for atleter', `HTTP ${r.status}`)
  }
  // Log ud igen, så testatletens session ikke bliver liggende.
  await get(`${supa.url}/auth/v1/logout`, { method: 'POST', headers: { apikey: supa.key, Authorization: `Bearer ${token}` } }).catch(() => {})
}

main().catch(err => report(false, 'Efterkontrollen stoppede', String(err?.message ?? err).slice(0, 200)))
  .finally(() => {
    const red = results.filter(r => r.ok === false).length
    console.log(red ? `RØD: ${red} punkt(er) fejlede. Se tegnene på tilbagerulning i KLAR-filen.` : 'GRØN: alle punkter, der kunne prøves, er grønne.')
    process.exitCode = red ? 1 : 0
  })
