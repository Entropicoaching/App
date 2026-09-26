// ORDRE 446, blok 1: en hel uge som atlet i kaelderen, alt fra 397-439 samlet.
// Headless Chromium 390x844 (touch, iPhone-UA), "aeldre telefon" (Slow 4G + 4x
// CPU, faelles-446.mjs), e2e-mocken, syntetisk Testatlet med tung historik (130
// uger, over graensen 4000). Appen er main bygget mod mocken, med service worker.
//
// Ugen (atletens regel som i 419: staar der "Anbefalet", loeftes den):
//   Pas 1 med net: squat saet 1 er en rekord (100 x 5, bedst foer 97,5 x 5).
//     Efter squat saet 4 forsvinder nettet (kaelderen): baenkpres saet 1 er en
//     rekord uden net (70 x 8). Resten af pas 1 og hele pas 2 uden net: RPE 9 og
//     en note paa et saet, "Spring over" paa et saet, vurdering af passet, appen
//     lukkes og aabnes igen midt i pas 2.
//   Nettet tilbage: koeen sendes, og appen lukkes midt i afsendelsen.
//   Pas 3 og 4 med net, "din uge" med en linje til coachen, Fremgang og en video.
// Taelles: raekker pr. saet i mocken (tabt/dublet), saettets tid mod tidspunktet
// for "Godkendt", fejringer pr. saet (ogsaa paa tvaers af genaabninger), rekorder
// i Fremgang og i personal_records.
//
// Koersel alene: node outputs/kritik-446/uge-446.mjs  -> uge-446.json + U-*.png
// Blok 2 importerer koerUge() og fortsaetter som coach paa samme mock.
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { UD, MOCK_PORT, MOCK_URL, BYG, statiskServer, hentChromium, bygSeed, nyTelefon, logIndAtlet, brugbart, drosl, tabel, PAS } from './faelles-446.mjs'
import { ensureSyntheticClip } from '../../e2e/harness.mjs'

export async function koerUge({ browser, dist, fx, createMockSupabase, uger = 130, prefix = 'U' }) {
  const { seed, exerciseIds } = bygSeed(fx.buildSeed, fx, { uger })
  const mock = createMockSupabase(seed)
  await mock.listen(MOCK_PORT)
  const { server, port } = await statiskServer(dist)
  const { context, page } = await nyTelefon(browser)
  const r = { trin: [], tjek: [], fejringer: [], klik: {}, konsolFejl: [], flash: [] }
  koerUge.sidste = r
  const trin = (t) => { r.trin.push(t); console.log(`  [uge] ${t}`) }
  const tjek = (navn, ok, detalje) => { r.tjek.push({ navn, ok: !!ok, detalje }); console.log(`  [uge] ${ok ? 'OK ' : 'FUND'} ${navn}${detalje ? `: ${detalje}` : ''}`) }
  const shot = (navn) => page.screenshot({ path: path.join(UD, `${prefix}-${navn}.png`) })
  page.on('pageerror', e => r.konsolFejl.push(String(e).slice(0, 300)))
  page.on('console', m => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/ERR_INTERNET_DISCONNECTED|Failed to load resource|Failed to fetch|ERR_NETWORK_CHANGED/.test(t)) return
    r.konsolFejl.push(t.slice(0, 300))
  })
  // Fejringer og flash-beskeder noteres paa tvaers af genaabninger.
  await context.exposeBinding('__k446', (_s, hvad, data) => {
    if (hvad === 'fejring') r.fejringer.push({ ...data, t: Date.now() })
    if (hvad === 'flash') r.flash.push({ tekst: data, t: Date.now() })
  })
  await context.addInitScript(() => {
    let sidste = null
    const set = new Set()
    const noter = () => {
      const e = document.querySelector('[data-rekord-fejring]')
      const k = e && e.getAttribute('data-rekord-fejring')
      if (k && k !== sidste) window.__k446('fejring', { key: k, tekst: e.textContent.trim() })
      sidste = k
      for (const el of document.querySelectorAll('[role="alert"], [role="status"]')) {
        const t = el.textContent.trim()
        if (t && !set.has(t)) { set.add(t); window.__k446('flash', t.slice(0, 160)) }
      }
    }
    addEventListener('DOMContentLoaded', () => new MutationObserver(noter).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }))
  })

  // Oevelses-id ud fra pas og navn.
  const exId = (pi, navn) => exerciseIds[pi][PAS[pi].oevelser.findIndex(o => o.navn === navn)]
  const godkendt = () => page.getByRole('button', { name: 'Godkendt', exact: true })
  const kortet = () => page.evaluate(() => {
    const v = document.querySelector('input[aria-label^="Vægt, sæt"]')
    let card = v; while (card && !(card.innerText || '').includes('Dagens pas')) card = card.parentElement
    const tekst = card?.innerText || document.body.innerText
    const anb = tekst.match(/Anbefalet: ([\d.,]+) ?kg/)
    return { tekst, vaegt: v?.value ?? null, saet: Number((tekst.match(/Sæt (\d+)\//) || [])[1] || 0), anbefalet: anb ? Number(anb[1].replace(',', '.')) : null }
  })
  const venter = (navn, n, timeout = 30000) => page.waitForFunction(([navn, n]) => {
    const t = document.body.innerText
    return t.includes(`Sæt ${n}/`) && t.includes(navn) && !!document.querySelector('input[aria-label^="Vægt, sæt"]')
  }, [navn, n], { timeout })

  async function logSaet(pi, navn, n, { foer } = {}) {
    await venter(navn, n)
    await page.waitForTimeout(400)
    const k = await kortet()
    if (k.anbefalet != null) {
      for (let i = 0; i < 60; i++) {
        const v = Number(((await kortet()).vaegt || '0').replace(',', '.'))
        if (v === k.anbefalet) break
        await page.getByRole('button', { name: v < k.anbefalet ? '2,5 kg mere' : '2,5 kg mindre', exact: true }).click()
      }
    }
    if (foer) await foer()
    const key = `${exId(pi, navn)}_${n}`
    r.klik[key] = { t: Date.now(), navn, n, pas: pi + 1, felt: (await kortet()).vaegt }
    await godkendt().click()
    await page.waitForFunction(([navn, n]) => {
      const t = document.body.innerText
      return !(t.includes(`Sæt ${n}/`) && t.includes(navn)) || t.includes('er klaret')
    }, [navn, n], { timeout: 30000 }).catch(() => {})
  }
  async function logPas(pi, fra = null) {
    let i = 0
    for (const o of PAS[pi].oevelser) for (let n = 1; n <= o.saet; n++) {
      i++
      if (fra && i < fra) continue
      await logSaet(pi, o.navn, n)
    }
  }
  const koeNoegle = `entropi_offline_sets:${fx.ATHLETE_ID}`
  const koe = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), koeNoegle)

  // ---- log ind (med drosling) ----
  const d = await drosl(page)
  let t0 = Date.now()
  await logIndAtlet(page, port, fx)
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await brugbart(page)
  r.logIndTilBrugbartMs = Date.now() - t0
  // Som en atlet, der har brugt appen foer: en genaabning med net, saa service
  // workeren styrer siden og har app-skallen (ellers kan intet aabne uden net).
  t0 = Date.now()
  await page.reload()
  await brugbart(page)
  r.genaabnetMedNetMs = Date.now() - t0
  trin(`logget ind paa en aeldre telefon; Dagens pas brugbart efter ${r.logIndTilBrugbartMs} ms, ved genaabning ${r.genaabnetMedNetMs} ms`)
  // Rekord-grundlaget skal vaere hentet og gemt, foer atleten gaar i kaelderen.
  t0 = Date.now()
  await page.waitForFunction(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('entropi_offline_pas:'))
    const s = k && JSON.parse(localStorage.getItem(k))
    return s?.rekordFoer?.grundlag && Object.keys(s.rekordFoer.grundlag).length > 0
  }, null, { timeout: 90000 })
  r.grundlagGemtMs = Date.now() - t0
  trin(`rekord-grundlaget gemt paa telefonen ${r.grundlagGemtMs} ms efter brugbart`)
  await shot('01-hjem')

  // ---- pas 1: squat med net, saa kaelderen ----
  for (let n = 1; n <= 4; n++) {
    await logSaet(0, 'Squat', n)
    if (n === 1) {
      await page.locator('[data-rekord-fejring]').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
      await shot('02-rekord-med-net')
    }
  }
  trin('pas 1: squat 4 saet med net')
  await d.offline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  trin('kaelderen: nettet vaek efter squat saet 4')
  await logSaet(0, 'Bænkpres', 1)
  await page.locator('[data-rekord-fejring]').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  await shot('03-rekord-uden-net')
  for (let n = 2; n <= 3; n++) await logSaet(0, 'Bænkpres', n)
  for (let n = 1; n <= 3; n++) await logSaet(0, 'Bulgarsk split squat', n)
  // Vurdering af pas 1 uden net.
  const vurder = async (pi, tal) => {
    const linje = page.locator('[data-vurder-pas]')
    if (!(await linje.count())) return { vist: false }
    const flashFoer = r.flash.length
    await page.getByRole('button', { name: `Passet gik: ${tal} af 5`, exact: true }).click()
    await page.waitForTimeout(12000)
    const tilbage = await linje.count()
    return { vist: true, linjenStaarTilbage: tilbage > 0, flash: r.flash.slice(flashFoer).map(f => f.tekst) }
  }
  r.vurderingUdenNet = await vurder(0, 4)
  await shot('04-vurdering-uden-net')
  trin(`pas 1 klaret uden net; vurdering 4: ${JSON.stringify(r.vurderingUdenNet)}`)

  // ---- pas 2 uden net: RPE + note, spring over, luk og aabn ----
  await logSaet(1, 'Bænkpres', 1)
  await logSaet(1, 'Bænkpres', 2)
  await logSaet(1, 'Bænkpres', 3, {
    foer: async () => {
      await page.getByRole('button', { name: /^RPE, sæt 3/ }).click()
      await page.getByRole('button', { name: 'RPE 9', exact: true }).click()
      await page.getByRole('button', { name: 'Note, sæt 3', exact: true }).click()
      await page.getByLabel('Note til sæt 3', { exact: true }).pressSequentially('skulder lidt oem')
    },
  })
  // Spring over uden net.
  await venter('Bænkpres', 4)
  const flashFoer = r.flash.length
  await page.getByRole('button', { name: 'Spring over', exact: true }).click()
  await page.waitForTimeout(12000)
  const efterSpring = await kortet()
  r.springOverUdenNet = { kortetStaarPaa: efterSpring.tekst.match(/[^\n]*\n?Sæt \d+\/\d+/)?.[0]?.replace(/\n/g, ' '), saet: efterSpring.saet, flash: r.flash.slice(flashFoer).map(f => f.tekst) }
  await shot('05-spring-over-uden-net')
  const springVirkede = r.springOverUdenNet.flash.length === 0 && !(efterSpring.saet === 4 && /Bænkpres/.test(efterSpring.tekst))
  tjek('Spring over virker uden net', springVirkede, JSON.stringify(r.springOverUdenNet))
  if (!springVirkede) {
    // Atleten kommer ikke videre: saettet godkendes i stedet, som en atlet ville.
    await logSaet(1, 'Bænkpres', 4)
    r.springOverErstattet = true
    trin('Spring over gav ingen fremdrift uden net; atleten godkender saet 4 i stedet')
  }
  await logSaet(1, 'Rows', 1)
  // Luk appen og aabn den igen uden net.
  const koeFoerLuk = Object.keys(await koe()).length
  t0 = Date.now()
  await page.reload().catch(e => { r.genaabningUdenNetFejl = String(e.message).slice(0, 160) })
  let genaabnet = true
  try { await godkendt().waitFor({ state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500) } catch { genaabnet = false }
  r.genaabnetUdenNetMs = genaabnet ? Date.now() - t0 : null
  const k2 = await kortet()
  const loginSkaerm = await page.locator('#athlete-auth-email').count()
  tjek('genaabnet uden net: Dagens pas staar paa Rows saet 2', genaabnet && /Rows/.test(k2.tekst) && k2.saet === 2 && !loginSkaerm, `${r.genaabnetUdenNetMs} ms, saet ${k2.saet}, koe ${koeFoerLuk}, login ${loginSkaerm}`)
  r.feltEfterGenaabning = { vaegt: k2.vaegt, senest: (k2.tekst.match(/senest [^\n]+/) || [null])[0] }
  tjek('genaabnet uden net: vaegtfeltet er udfyldt', !!k2.vaegt, JSON.stringify(r.feltEfterGenaabning))
  await shot('06-genaabnet-uden-net')
  await logSaet(1, 'Rows', 2)
  await logSaet(1, 'Rows', 3)
  for (let n = 1; n <= 3; n++) await logSaet(1, 'Triceps pushdown', n)
  r.vurderingPas2UdenNet = await vurder(1, 3)
  const koeUdenNet = await koe()
  r.koeUdenNet = { poster: Object.keys(koeUdenNet).length, tekst: await page.getByText(/gemt lokalt/).first().innerText().catch(() => null) }
  trin(`pas 2 klaret uden net; ${r.koeUdenNet.poster} saet i koeen ("${r.koeUdenNet.tekst}")`)
  await shot('07-pas2-uden-net')

  // ---- nettet tilbage, appen lukkes midt i afsendelsen ----
  let posts = 0
  const taelPost = (req) => { if (/\/rest\/v1\/exercise_logs/.test(req.url()) && ['POST', 'PATCH'].includes(req.method())) posts++ }
  context.on('request', taelPost)
  await d.offline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  const tNet = Date.now()
  await page.waitForFunction(() => true)
  while (posts < 3 && Date.now() - tNet < 60000) await page.waitForTimeout(50)
  const koeVedLuk = Object.keys(await koe()).length
  await page.reload()
  await brugbart(page, 60000).catch(() => {})
  await page.waitForFunction((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length === 0, koeNoegle, { timeout: 120000 }).catch(() => {})
  r.afsendelse = { skrivningerFoerLuk: posts, koeVedLuk, sekunderTilTom: Math.round((Date.now() - tNet) / 100) / 10, koeTilSidst: Object.keys(await koe()).length }
  context.off('request', taelPost)
  trin(`nettet tilbage: appen lukket efter ${r.afsendelse.skrivningerFoerLuk} skrivninger (${koeVedLuk} i koeen), koeen tom efter ${r.afsendelse.sekunderTilTom} s`)
  await page.waitForTimeout(2000)
  await shot('08-efter-afsendelse')

  // ---- pas 3 og 4 med net ----
  await logPas(2)
  trin('pas 3 med net')
  await logPas(3)
  trin('pas 4 med net')
  r.vurderingPas4 = await vurder(3, 4)
  const dinUge = page.locator('[data-din-uge]')
  r.dinUge = { vist: await dinUge.waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false) }
  if (r.dinUge.vist) {
    await page.waitForTimeout(1500)
    r.dinUge.tekst = (await dinUge.innerText()).replace(/\s+/g, ' ')
    r.dinUge.rekorder = Number(await page.locator('[data-din-uge-rekorder]').getAttribute('data-din-uge-rekorder').catch(() => null))
    r.dinUge.vurderinger = await page.locator('[data-vurdering]').evaluateAll(els => els.map(e => e.getAttribute('data-vurdering')))
    await dinUge.scrollIntoViewIfNeeded()
    await shot('09-din-uge')
    await page.locator('#din-uge-linje').fill('Kaelderen var uden net tirsdag, men alt kom med.')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    r.dinUge.sendt = await page.locator('[data-din-uge-sendt]').waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false)
  }
  trin(`"din uge": ${JSON.stringify({ vist: r.dinUge.vist, rekorder: r.dinUge.rekorder, vurderinger: r.dinUge.vurderinger, sendt: r.dinUge.sendt })}`)

  // ---- Fremgang ----
  await page.locator('nav').getByText('Fremgang', { exact: true }).click()
  await page.locator('[data-rekord-liste]').waitFor({ state: 'visible', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const MDR = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  const nu = new Date()
  const ugeStart = new Date(nu); ugeStart.setDate(nu.getDate() - ((nu.getDay() + 6) % 7)); ugeStart.setHours(0, 0, 0, 0)
  const datoer = new Set(); for (let t = new Date(ugeStart); t <= nu; t.setDate(t.getDate() + 1)) datoer.add(`${t.getDate()}. ${MDR[t.getMonth()]}`)
  const raekker = await page.evaluate(() => [...document.querySelectorAll('[data-rekord]')].map(x => x.innerText.replace(/\s+/g, ' ').trim()))
  r.fremgang = { alle: raekker.length, iUgen: raekker.filter(x => [...datoer].some(d => x.startsWith(d + ' '))) }
  await page.locator('[data-rekord-liste]').scrollIntoViewIfNeeded().catch(() => {})
  await shot('10-fremgang')
  trin(`Fremgang: ${r.fremgang.iUgen.length} rekorder i ugen: ${JSON.stringify(r.fremgang.iUgen)}`)

  // ---- video ----
  await page.locator('nav').getByText('Hjem', { exact: true }).click()
  await page.waitForTimeout(800)
  const mere = page.getByRole('button', { name: 'Mere', exact: true })
  if (await mere.getAttribute('aria-expanded') !== 'true') await mere.click()
  await page.getByText('VideoCoach', { exact: true }).click()
  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 60000 })
  await frame.locator('#fileInput').setInputFiles(ensureSyntheticClip())
  await frame.locator('#athleteSubmitSheet[hidden]').waitFor({ state: 'detached', timeout: 60000 })
  await frame.locator('#liftSel').selectOption({ label: 'Squat' })
  const tVideo = Date.now()
  await frame.locator('#saveBtn').click()
  const kvit = await frame.getByText(/Video modtaget/).first().waitFor({ state: 'visible', timeout: 90000 }).then(() => true, () => false)
  r.video = { kvitteringMs: kvit ? Date.now() - tVideo : null }
  await page.waitForTimeout(1500)
  r.video.synligeKvitteringer = await frame.locator('body').evaluate(() => {
    const syn = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }
    return [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && syn(e) && /modtaget|sendt til|er sendt/i.test(e.textContent)).map(e => e.textContent.trim().slice(0, 80))
  })
  await shot('11-video-sendt')
  const videoer = (await tabel('video_analyses')).filter(v => v.athlete_id === fx.ATHLETE_ID)
  r.video.raekker = videoer.length
  trin(`video: kvittering efter ${r.video.kvitteringMs} ms, synlige kvitteringer ${JSON.stringify(r.video.synligeKvitteringer)}, ${videoer.length} raekke i video_analyses`)

  // ---- regnskab mod mocken ----
  const ugensIds = new Set(exerciseIds.flat())
  const logs = (await tabel('exercise_logs')).filter(l => ugensIds.has(l.exercise_id))
  const pr = new Map()
  for (const l of logs) pr.set(`${l.exercise_id}_${l.set_number}`, [...(pr.get(`${l.exercise_id}_${l.set_number}`) || []), l])
  const forventet = PAS.reduce((a, p) => a + p.oevelser.reduce((b, o) => b + o.saet, 0), 0)
  const dubletter = [...pr.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => `${k} x${v.length}`)
  const mangler = []
  PAS.forEach((p, pi) => p.oevelser.forEach((o, oi) => { for (let n = 1; n <= o.saet; n++) if (!pr.has(`${exerciseIds[pi][oi]}_${n}`)) mangler.push(`pas ${pi + 1} ${o.navn} ${n}`) }))
  const nulKg = logs.filter(l => !l.skipped && !(l.weight > 0)).map(l => { const k = r.klik[`${l.exercise_id}_${l.set_number}`]; return k ? `pas ${k.pas} ${k.navn} ${k.n}` : l.exercise_id }).filter(x => !/Pull-ups|Planke/.test(x))
  tjek('ingen vaegtoevelse gemt med 0 kg', nulKg.length === 0, nulKg.join(', '))
  r.regnskab = { nulKg, forventet, raekker: logs.length, dubletter, mangler, sprunget: logs.filter(l => l.skipped).length }
  tjek('intet saet tabt', mangler.length === 0, mangler.join(', '))
  tjek('ingen dubletter', dubletter.length === 0, dubletter.join(', '))
  // Tid: saettets logged_at mod tidspunktet for Godkendt (maaleskriptets ur).
  const tider = []
  for (const [key, k] of Object.entries(r.klik)) {
    const row = pr.get(key)?.[0]
    if (!row) continue
    tider.push({ key, pas: k.pas, navn: k.navn, n: k.n, afvigelseS: Math.round((new Date(row.logged_at).getTime() - k.t) / 100) / 10, skipped: !!row.skipped })
  }
  r.tider = tider
  const skaeve = tider.filter(x => Math.abs(x.afvigelseS) > 5)
  tjek('hvert saet har tiden fra Godkendt (+-5 s)', skaeve.length === 0, skaeve.map(x => `pas ${x.pas} ${x.navn} ${x.n}: ${x.afvigelseS} s`).join(', '))
  const rpeNote = logs.find(l => l.exercise_id === exId(1, 'Bænkpres') && l.set_number === 3)
  tjek('RPE 9 og note fra kaelderen naaede frem', rpeNote?.rpe_actual === 9 && rpeNote?.note === 'skulder lidt oem', JSON.stringify({ rpe: rpeNote?.rpe_actual, note: rpeNote?.note }))
  const sessions = await tabel('sessions')
  const ugensPas = PAS.map((_, pi) => sessions.find(s => s.id === seed.tables.exercises.find(e => e.id === exerciseIds[pi][0]).session_id))
  r.vurderingerIMocken = ugensPas.map(s => s?.athlete_rating ?? null)
  tjek('vurderingerne givet uden net naaede frem', r.vurderingerIMocken[0] === 4 && r.vurderingerIMocken[1] === 3, JSON.stringify(r.vurderingerIMocken))
  // Rekorder: fejringer pr. saet, Fremgang, personal_records.
  const prKey = {}
  for (const f of r.fejringer) prKey[f.key] = (prKey[f.key] || 0) + 1
  r.fejringPrSaet = Object.entries(prKey).map(([key, n]) => ({ key, gange: n, navn: r.klik[key]?.navn, saet: r.klik[key]?.n, pas: r.klik[key]?.pas, tekst: r.fejringer.find(f => f.key === key)?.tekst }))
  tjek('hver rekord fejres een gang', Object.values(prKey).every(n => n === 1), JSON.stringify(r.fejringPrSaet))
  const unikkeFremgang = new Set(r.fremgang.iUgen)
  tjek('Fremgang viser hver rekord een gang', unikkeFremgang.size === r.fremgang.iUgen.length, `${r.fremgang.iUgen.length} raekker, ${unikkeFremgang.size} forskellige`)
  const prs = (await tabel('personal_records')).filter(p => p.athlete_id === fx.ATHLETE_ID)
  r.personalRecords = prs.map(p => ({ oevelse: p.exercise_name, weight: p.weight, reps: p.reps }))
  const kaelderFejringer = r.fejringPrSaet.filter(f => f.pas === 1 && f.navn === 'Bænkpres')
  tjek('en rekord sat uden net staar ogsaa i personal_records (coachens og "Mere"s rekorder)', kaelderFejringer.every(f => prs.some(p => p.exercise_name === 'Bænkpres' && p.weight === 70 && p.reps === 8)), `fejret uden net: ${kaelderFejringer.map(f => f.tekst).join(' | ')}; personal_records: ${JSON.stringify(r.personalRecords)}`)
  tjek('ingen konsolfejl', r.konsolFejl.length === 0, r.konsolFejl.slice(0, 5).join(' | '))
  const bredde = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  tjek('ingen vandret rul paa 390 px', bredde <= 0, `${bredde} px`)

  await d.cdp.detach().catch(() => {})
  await context.close()
  server.close()
  return { r, mock, seed, exerciseIds, port }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
  const fx = await import('../../e2e/fixtures.mjs')
  const browser = await hentChromium().launch({ headless: true })
  let res
  try {
    res = await koerUge({ browser, dist: path.join(BYG, 'dist-efter439'), fx, createMockSupabase })
  } catch (e) {
    res = { r: { ...(koerUge.sidste || {}), fejl: String(e?.stack || e) } }
    console.error(e)
    process.exitCode = 1
  } finally {
    writeFileSync(path.join(UD, 'uge-446.json'), JSON.stringify(res.r, null, 2) + '\n')
    await res.mock?.close()
    await browser.close()
    // En fejl midt i ugen efterlader mock og server aabne; afslut processen.
    process.exit(process.exitCode || 0)
  }
  void MOCK_URL
}
