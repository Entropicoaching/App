// ORDRE 428: en uge som coach paa computeren. Een verificeringskommando pr. blok:
//   node outputs/428/verify-428.mjs --blok 1   maal ugen som coach (C1-C5), billeder, COACHENS-UGE.md
//   node outputs/428/verify-428.mjs --blok 2   maal igen efter rettelsen af C1-C3, krav + foer/efter
//   node outputs/428/verify-428.mjs --blok 3   build, offline-bevis, VideoCoach-test, RAPPORT-428.md
// Flag: --no-build (genbrug dist/), --foer (blok 1: skriv til outputs/428/foer;
// ellers efter/). Headless Chromium mod e2e-mocken: syntetisk coach og 6
// syntetiske atleter (coach-faelles.mjs). Traeningssignalerne regnes med appens
// eget JS-spejl af SQL-reglerne. Ingen prod, ingen atletdata.
//
// Klik taelles i tryk(); tast (Enter) taeller som et klik; indtastede tegn
// taelles for sig. Tid er maskintid (klik til naeste tilstand), ikke menneskelig tid.
import path from 'node:path'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import http from 'node:http'
import { ROOT, MOCK_PORT, startStaticServer, byg, hentChromium, bygCoachSeed, signalerFraSeed, ATLETER } from './coach-faelles.mjs'
import { ensureSyntheticClip } from '../../e2e/harness.mjs'

const arg = (n) => process.argv.includes(n)
const blok = process.argv[process.argv.indexOf('--blok') + 1]
if (!['1', '2', '3'].includes(blok)) { console.error('brug: --blok 1|2|3'); process.exit(2) }
const DIR = path.join(ROOT, 'outputs', '428')

if (blok === '3') {
  const koer = (navn, cmd, env = {}) => {
    console.log(`== ${navn}`)
    const r = spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8', env: { ...process.env, ...env } })
    const ud = (r.stdout || '') + (r.stderr || '')
    writeFileSync(path.join(DIR, `koersel-${navn}.txt`), ud)
    console.log(ud.trim().split('\n').slice(-3).join('\n'))
    assert.equal(r.status, 0, `${navn} fejlede (se outputs/428/koersel-${navn}.txt)`)
  }
  koer('build', 'npm run build')
  koer('offline-bevis', 'node outputs/414/offline-bevis.mjs', { BEVIS_UD: 'outputs/428/offline-bevis' })
  for (const t of ['upload-flow', 'submission', 'buttons-layout', 'upload', 'labels', 'film-guide', 'zoom', 'clip']) koer(`videocoach-${t}`, `npm run verify:videocoach-${t}`)
  koer('build-igen', 'npm run build')
  const r = readFileSync(path.join(ROOT, 'docs', 'RAPPORT-428.md'), 'utf8')
  assert.equal(r.split('\n')[0].trim(), 'Ordre 428', 'foerste linje skal vaere "Ordre 428"')
  for (const h of ['Gren', 'Hvad blev', 'Test', 'Hvad er n', 'rlige gr']) assert.ok(r.includes(h), `RAPPORT-428 mangler afsnit: ${h}`)
  assert.ok(/C4/.test(r) && /C5/.test(r), 'Hvad er naeste skal naevne C4 og C5')
  console.log('GROEN: blok 3')
  process.exit(0)
}

const FOER = blok === '1' && arg('--foer')
const UD = path.join(DIR, blok === '1' ? 'foer' : 'efter')
mkdirSync(UD, { recursive: true })
if (!arg('--no-build')) { console.log('Bygger mod mocken ...'); byg() }

const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const { server, port } = await startStaticServer()
const browser = await hentChromium().launch({ headless: true })
const maaling = { blok, tid: new Date().toISOString(), opgaver: {}, konsolFejl: [] }

// Kald til mocken uden keep-alive (mocken genstartes paa samme port pr. opgave).
function mockKald(method, sti, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: MOCK_PORT, path: sti, method, agent: false, headers: body ? { 'content-type': 'video/mp4', 'content-length': body.length } : {} }, res => {
      let d = ''; res.on('data', c => { d += c }); res.on('end', () => resolve(d))
    })
    req.on('error', reject); if (body) req.write(body); req.end()
  })
}

// Frisk mock og side pr. opgave, saa en opgaves skrivning ikke paavirker den naeste.
async function session(bredde) {
  const { seed } = bygCoachSeed(fx.buildSeed, fx)
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const v = seed.tables.video_analyses[0]
  await mockKald('POST', `/storage/v1/object/videocoach-uploads/${v.video_path}`, readFileSync(ensureSyntheticClip()))
  const mobil = bredde < 600
  const context = await browser.newContext(mobil
    ? { viewport: { width: bredde, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: bredde, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', e => maaling.konsolFejl.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') maaling.konsolFejl.push(m.text().slice(0, 200)) })
  const signaler = await signalerFraSeed(seed)
  await page.route('**/rest/v1/rpc/entropi_training_signals_v1', r => r.fulfill({ json: signaler }))
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.locator('#athlete-auth-email').fill(fx.COACH_USER.email)
  await page.locator('#athlete-auth-password').fill(fx.COACH_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Alfa Testsen').first().waitFor({ timeout: 30000 })
  await page.getByText(/åbne ting/).first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(1200)
  const slut = async () => { await context.close(); await mock.close() }
  return { page, slut, seed }
}

function opgave(navn) {
  const o = { klik: 0, tegn: 0, ms: 0, log: [], fund: {} }
  maaling.opgaver[navn] = o
  const t0 = Date.now()
  return {
    o,
    async tryk(loc, hvad) { await loc.waitFor({ state: 'visible', timeout: 15000 }); await loc.click(); o.klik++; o.log.push(hvad) },
    async skriv(loc, tekst, hvad) { await loc.fill(tekst); o.tegn += tekst.length; await loc.press('Enter'); o.klik++; o.log.push(hvad) },
    slut() { o.ms = Date.now() - t0 },
  }
}
const shot = (page, navn, opt = {}) => page.screenshot({ path: path.join(UD, `${navn}.png`), ...opt })
const tekstAf = (page) => page.evaluate(() => document.body.innerText)
// Tekst i atletlistens raekke for en atlet (listen er kortet under "Atleter").
async function listeRaekke(page, navn) {
  return page.evaluate((navn) => {
    const rows = [...document.querySelectorAll('[role="button"]')].filter(r => r.innerText.split('\n')[0].trim() === navn || r.innerText.includes(navn + '\n'))
    return rows.length ? rows[rows.length - 1].innerText : ''
  }, navn)
}

// Forventet "ugens stemme" pr. atlet: laveste vurdering og nyeste tekst
// (pas-kommentar eller saet-note) i denne uge.
function forventetStemme(p) {
  const tekster = []
  for (const [pi, k] of Object.entries(p.kommentar || {})) tekster.push({ pi: Number(pi), t: k })
  if (p.note) tekster.push({ pi: p.note.pas - 0.5, t: p.note.tekst })
  tekster.sort((a, b) => b.pi - a.pi)
  return { min: p.vurdering?.length ? Math.min(...p.vurdering) : null, tekst: tekster[0]?.t || null }
}

// ---- C3: hvem har traenet denne uge (1280) ----
async function c1() {
  const { page, slut } = await session(1280)
  const { o, tryk, slut: s } = opgave('C3-hvem-har-traenet')
  const laesbar = async () => {
    let n = 0
    for (const p of ATLETER) if (/\d+ af \d+ pas|gennemført \d+ sæt/.test(await listeRaekke(page, p.navn))) n++
    return n
  }
  o.fund.laesbareUdenKlik = await laesbar()
  await shot(page, 'C3-forside-1280')
  if (o.fund.laesbareUdenKlik < ATLETER.length) {
    await tryk(page.getByRole('button', { name: 'Afvigelse denne uge' }), 'Afvigelse denne uge')
    await page.waitForTimeout(600)
    await shot(page, 'C3-afvigelse-1280')
  }
  o.fund.laesbareEfterKlik = await laesbar()
  s()
  o.fund.raekker = {}
  for (const p of ATLETER) o.fund.raekker[p.navn] = (await listeRaekke(page, p.navn)).replace(/\n/g, ' | ')
  // Alfa har gennemfoert hele planen: planlagt og gennemfoert kg boer ligge taet.
  const m = o.fund.raekker['Alfa Testsen'].match(/Planlagt [^·]*· ([\d.]+) kg[^·]*— gennemført [^·]*· ([\d.]+) kg/) || o.fund.raekker['Alfa Testsen'].match(/([\d.]+) af ([\d.]+) kg/)
  o.fund.alfaKg = m ? { planlagt: Number(m[1]), gennemfoert: Number(m[2]) } : null
  o.fund.alfaKgForhold = m ? Math.round((Number(m[2]) / Number(m[1])) * 100) / 100 : null
  await slut()
}

// ---- C2: laes ugens vurderinger, kommentarer og noter for alle 6 (1280) ----
async function c2() {
  const { page, slut } = await session(1280)
  const { o, tryk, slut: s } = opgave('C2-ugens-stemme')
  o.fund.paaForsiden = []
  o.fund.aabnet = []
  for (const p of ATLETER) {
    const f = forventetStemme(p)
    if (!f.tekst && f.min == null) { o.fund.paaForsiden.push(p.navn + ' (intet at laese)'); continue }
    const raekke = await listeRaekke(page, p.navn)
    const tekstOk = !f.tekst || raekke.includes(f.tekst.slice(0, 20))
    const vurdOk = f.min == null || raekke.includes(`${f.min}/5`) || raekke.includes('★'.repeat(f.min) + '☆'.repeat(5 - f.min))
    if (tekstOk && vurdOk) { o.fund.paaForsiden.push(p.navn); continue }
    await tryk(page.locator('[role="button"]', { hasText: p.navn }).last(), `aabn ${p.navn}`)
    await page.waitForTimeout(900)
    await tryk(page.getByRole('button', { name: /Log$/ }).first(), 'Log')
    await page.getByText('Træningslog', { exact: false }).first().waitFor({ timeout: 10000 })
    await page.waitForTimeout(700)
    const t = await tekstAf(page)
    o.aabnetFundet = o.aabnetFundet || {}
    o.aabnetFundet[p.navn] = !f.tekst || t.includes(f.tekst)
    if (p.navn === 'Bravo Testsen') await shot(page, 'C2-log-bravo-1280')
    o.fund.aabnet.push(p.navn)
    await tryk(page.getByText('Tilbage til atleter', { exact: false }).first(), 'tilbage')
    await page.getByText('Alfa Testsen').first().waitFor({ timeout: 10000 })
    await page.waitForTimeout(500)
  }
  s()
  await shot(page, 'C2-forside-efter-runden-1280')
  await slut()
}

// ---- C4: sprunget over i Log (1280) ----
async function c3() {
  const { page, slut } = await session(1280)
  const { o, tryk, slut: s } = opgave('C4-sprunget-over-i-log')
  await tryk(page.locator('[role="button"]', { hasText: 'Bravo Testsen' }).last(), 'aabn Bravo')
  await page.waitForTimeout(900)
  await tryk(page.getByRole('button', { name: /Log$/ }).first(), 'Log')
  await page.getByText('Dag 2 — Bænk').first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(600)
  s()
  const t = await tekstAf(page)
  const i = t.indexOf('Dag 2 — Bænk')
  o.fund.dag2 = t.slice(Math.max(0, i - 40), i + 260).replace(/\n/g, ' | ')
  o.fund.visesSomFuldt = /7\/7 SÆT|7\/7 sæt/i.test(t.slice(Math.max(0, i - 40), i + 20)) || /Rows[^]*?3\/3 sæt/.test(t.slice(i, i + 200))
  o.fund.naevnerSprunget = /sprunget over/i.test(t.slice(Math.max(0, i - 60), i + 260))
  await page.getByText('Dag 2 — Bænk').first().scrollIntoViewIfNeeded()
  await shot(page, 'C4-log-dag2-1280')
  await slut()
}

// ---- C1: ret naeste uge: kopier uge 5 og haev squat (dag 1) og doedloeft 2,5 kg,
// resten som sidst, samme ugedage (1280). Scriptet goer praecis det, der
// mangler efter "Kopiér seneste uge": ugedag pr. pas og vaegt pr. oevelse. ----
const UGEDAG_LANG = /mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag/i
const UGEDAG_KORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
async function cKopier() {
  const { page, slut, seed } = await session(1280)
  const { o, tryk, skriv, slut: s } = opgave('C1-kopier-og-ret-naeste-uge')
  const t = seed.tables
  const echo = t.athletes.find(a => a.name === 'Echo Testsen')
  const uge5 = t.weeks.find(w => w.athlete_id === echo.id && w.week_number === 5)
  const pasListe = t.sessions.filter(x => x.week_id === uge5.id).sort((a, b) => a.session_order - b.session_order)
  await tryk(page.locator('[role="button"]', { hasText: 'Echo Testsen' }).last(), 'aabn Echo')
  await page.waitForTimeout(900)
  await tryk(page.getByRole('button', { name: /Kopiér seneste uge/i }), 'Kopiér seneste uge')
  await page.getByText('28. sep.', { exact: false }).first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(1500)
  o.fund.ugedagManglede = 0
  o.fund.vaegtManglede = 0
  o.fund.vaegtRettet = 0
  for (const pas of pasListe) {
    const hoved = () => page.locator('div[style*="cursor: pointer"]', { hasText: pas.title }).last()
    if (!UGEDAG_LANG.test(await hoved().innerText())) {
      o.fund.ugedagManglede++
      await tryk(hoved().getByRole('button', { name: 'Rediger' }), `Rediger ${pas.title}`)
      await tryk(page.getByRole('button', { name: UGEDAG_KORT[pas.weekday], exact: true }), `ugedag ${UGEDAG_KORT[pas.weekday]}`)
      await tryk(page.getByRole('button', { name: 'Gem', exact: true }), 'Gem')
      await page.waitForTimeout(700)
    }
    await tryk(hoved(), `fold ${pas.title} ud`)
    await page.waitForTimeout(600)
    const oevelser = t.exercises.filter(e => e.session_id === pas.id).sort((a, b) => a.exercise_order - b.exercise_order)
    for (let i = 0; i < oevelser.length; i++) {
      const ex = oevelser[i]
      if (ex.recommended_weight == null) continue
      const hovedloeft = (pas.session_order === 1 && ex.name === 'Squat') || ex.name === 'Dødløft'
      const maal = ex.recommended_weight + (hovedloeft ? 2.5 : 0)
      const felt = page.locator('div, button').filter({ hasText: /^(Anbefalet: [\d.]+kg ✎|Sidst logget: .* ✎|\+ Anbefalet vægt)$/ }).nth(i)
      const nu = (await felt.innerText()).trim()
      if (i === 0 && pas.session_order === 1) { o.fund.foersteFelt = nu; await shot(page, 'C1-efter-kopi-dag1-1280') }
      if (nu.startsWith(`Anbefalet: ${maal}kg`)) continue
      if (!nu.startsWith('Anbefalet:')) o.fund.vaegtManglede++
      else o.fund.vaegtRettet++
      await tryk(felt, `${ex.name}: ${nu}`)
      await skriv(page.locator('input[placeholder="kg"]'), String(maal), `skriv ${maal} + Enter`)
      await page.waitForTimeout(600)
    }
  }
  s()
  await shot(page, 'C1-uge6-faerdig-1280', { fullPage: true })
  // Kontrol mod mocken: uge 6 staar som uge 5 med de to hovedloeft +2,5.
  const tbl = async (n) => JSON.parse(await mockKald('GET', `/__e2e/table?name=${n}`))
  const [weeks, sessions, exercises] = await Promise.all([tbl('weeks'), tbl('sessions'), tbl('exercises')])
  const uge6 = weeks.find(w => w.athlete_id === echo.id && w.week_number === 6)
  const s6 = sessions.filter(x => x.week_id === uge6.id)
  o.fund.uge6Ugedage = s6.sort((a, b) => a.session_order - b.session_order).map(x => x.weekday)
  o.fund.uge6Vaegte = s6.flatMap(x => exercises.filter(e => e.session_id === x.id).sort((a, b) => a.exercise_order - b.exercise_order).map(e => `${e.name} ${e.recommended_weight ?? '-'}`))
  await slut()
}

// ---- C5: telefonen: hvor langt nede staar atleterne (390) ----
async function c5() {
  const { page, slut } = await session(390)
  const { o, slut: s } = opgave('C5-telefon-kraever-dit-blik')
  const pos = await page.evaluate((navne) => navne.map(n => {
    const r = [...document.querySelectorAll('[role="button"]')].filter(e => e.innerText.includes(n)).pop()
    if (!r) return null
    const b = r.getBoundingClientRect()
    return { top: Math.round(b.top + window.scrollY), bund: Math.round(b.bottom + window.scrollY) }
  }), ATLETER.map(p => p.navn))
  // "Kraever dit blik": hvor meget af overskrift og handling kan laeses uden at aabne punktet?
  o.fund.klip = await page.evaluate(() => [...document.querySelectorAll('[data-coach-briefing-point], div')].filter(d => d.querySelector(':scope > button span[style*="ellipsis"]') && d.innerText.includes('→')).slice(0, 3).map(d => {
    const spans = [...d.querySelectorAll('span')].filter(x => x.style.textOverflow === 'ellipsis')
    return spans.map(x => ({ tekst: x.textContent.slice(0, 60), synligAndel: Math.round((x.clientWidth / x.scrollWidth) * 100) / 100 }))
  }))
  s()
  o.fund.foersteAtletTop = pos[0]?.top
  o.fund.sidsteAtletBund = pos[pos.length - 1]?.bund
  o.fund.skaermhoejde = 844
  o.fund.skaerme = pos[pos.length - 1] ? Math.round((pos[pos.length - 1].bund / 844) * 10) / 10 : null
  await shot(page, 'C5-telefon-forside-390')
  await shot(page, 'C5-telefon-forside-390-fuld', { fullPage: true })
  await slut()
}

try {
  for (const f of [cKopier, c2, c1, c3, c5]) await f()
} finally {
  await browser.close(); server.close()
}
writeFileSync(path.join(UD, 'maaling.json'), JSON.stringify(maaling, null, 2))
for (const [n, o] of Object.entries(maaling.opgaver)) console.log(`${n}: ${o.klik} klik, ${o.tegn} tegn, ${o.ms} ms  ${JSON.stringify(o.fund).slice(0, 400)}`)
console.log('konsolfejl:', maaling.konsolFejl.length)

if (blok === '1' && !FOER) {
  const doc = readFileSync(path.join(ROOT, 'docs', 'COACHENS-UGE.md'), 'utf8')
  for (const c of ['C1', 'C2', 'C3', 'C4', 'C5']) assert.ok(doc.includes(`## ${c}`), `COACHENS-UGE.md mangler ${c}`)
  for (const b of doc.match(/outputs\/428\/[\w/.-]+\.png/g) || []) assert.ok(existsSync(path.join(ROOT, b)), `billede mangler: ${b}`)
  console.log('GROEN: blok 1')
}
if (blok === '2') {
  const foer = JSON.parse(readFileSync(path.join(DIR, 'foer', 'maaling.json'), 'utf8')).opgaver
  const e = maaling.opgaver
  const k = e['C1-kopier-og-ret-naeste-uge'].fund
  assert.equal(k.ugedagManglede, 0, 'C1: kopien skal beholde ugedagene')
  assert.equal(k.vaegtManglede, 0, 'C1: kopien skal beholde den anbefalede vaegt')
  assert.deepEqual(k.uge6Ugedage, [0, 1, 3, 4], 'C1: uge 6 har samme ugedage som uge 5')
  assert.ok(e['C1-kopier-og-ret-naeste-uge'].klik < foer['C1-kopier-og-ret-naeste-uge'].klik, 'C1: faerre klik end foer')
  assert.ok(e['C2-ugens-stemme'].klik < foer['C2-ugens-stemme'].klik, 'C2: faerre klik end foer')
  assert.equal(e['C2-ugens-stemme'].fund.aabnet.length, 0, `C2: ugens stemme for alle paa forsiden (${e['C2-ugens-stemme'].fund.aabnet.join(', ')} kraevede klik)`)
  assert.equal(e['C3-hvem-har-traenet'].fund.laesbareUdenKlik, 6, 'C3: alle 6 atleters uge skal kunne laeses uden klik')
  assert.equal(e['C3-hvem-har-traenet'].klik, 0, 'C3: 0 klik')
  assert.ok(Math.abs(e['C3-hvem-har-traenet'].fund.alfaKgForhold - 1) <= 0.1, `C3: planlagt og gennemfoert kg skal regnes ens (Alfa: ${e['C3-hvem-har-traenet'].fund.alfaKgForhold})`)
  assert.deepEqual(maaling.konsolFejl, [], 'ingen konsolfejl')
  const linjer = Object.keys(e).map(k => `| ${k} | ${foer[k].klik} klik · ${foer[k].ms} ms | ${e[k].klik} klik · ${e[k].ms} ms |`)
  writeFileSync(path.join(UD, 'foer-efter.md'), `| Opgave | Foer | Efter |\n|---|---|---|\n${linjer.join('\n')}\n`)
  console.log('GROEN: blok 2')
}
