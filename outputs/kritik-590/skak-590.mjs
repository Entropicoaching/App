// Kritik 590, blok 2: skakken efter Chaturangas 577, 581, 587 og 592 (main, hentet med git archive; skak-
// traeet roeres ikke). 587 (QR og kamera) og 592 (klassens fremgang) blev merget, mens jeg maalte.
// Del D (587): QR-koden i skak.html laeses af MIN egen lille QR-laeser (version 2, uden fejlrettelse) fra
// SVG-stien, og laerer.html scanner elevens QR-billede fra et falsk kamera (canvas.captureStream).
// Del E (592): klassens fremgang med to saet syntetiske koder.
//   node outputs/kritik-590/skak-590.mjs
// Min elev fra 517-558 (mat i 1, ellers stoerste slag, ellers skak, ellers tilfaeldigt) proever de fem
// nye temaer som begynder, 3 gaader hver, paa 390 (touch) og 1280 (mus), headless, uden net.
// Saa: "Vis min kode" (udgave 2), samme tal med andet ur og uden uger, hvad der ligger i lageret,
// og laerer.html med 25 syntetiske koder (20 udgave 2 + 5 udgave 1), een kode alene, HTML i feltet og
// fluebenet. Skriver skak-590.json og S-*.png her. Kun syntetiske data.
import path from 'node:path'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const { chromium } = require('C:/Users/Entropi/Desktop/skak/node_modules/playwright')
const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const REF = process.env.SKAK_REF || 'main'
const SHA = execSync(`git -C ${SKAK} rev-parse --short ${REF}`).toString().trim()
const dir = mkdtempSync(path.join(tmpdir(), 'k590-skak-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" ${REF}`)
execSync('tar -xf s.tar', { cwd: dir })
const imp = (f) => import(pathToFileURL(path.join(dir, f)).href)
const { Chess } = await import(pathToFileURL(`${SKAK}/node_modules/chess.js/dist/esm/chess.js`).href)
const KK = await imp('src/kompetencekode.js')
const KL = await imp('src/klassekoder.js')
const { LICHESS_TEMAER } = await imp('src/lichesstemaer.js')
const LICHESS = JSON.parse(readFileSync(path.join(dir, 'data', 'gaader-lichess.json'), 'utf8'))
const { GAADEBANK_STOR_GZIP_BASE64: B64 } = await imp('src/gaadebank-stor.js')
const STOR = gunzipSync(Buffer.from(B64, 'base64')).toString('utf8').split('\n').filter(Boolean).map((l) => { const [id, fen, moves, rating, tema] = l.split('\t'); return { id, fen, solutionUci: moves.split(','), rating: Number(rating), tema } })
const egne = (f) => JSON.parse(readFileSync(path.join(dir, 'data', f), 'utf8')).map((g) => ({ ...g, rating: g.rating ?? g.svaerhed }))
const ALLE = [...LICHESS, ...STOR, ...egne('gaader.json'), ...egne('gaader-lette.json'), ...egne('gaader-slutspil.json')]
const placering = (fen) => fen.split(' ')[0]
const NYE = ['hangingPiece', 'deflection', 'attraction', 'trappedPiece', 'mateIn3']
const navnAf = (id) => KK.KODE_KOMPETENCER.find((k) => k.id === id)?.navn ?? id

const tjek = []
const ok = (hvad, b, data) => { tjek.push({ hvad, ok: !!b, data }); console.log(`${b ? 'OK  ' : 'ROED'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 300) : ''}`) }

// ------------------------------------------------------------ A: koden og filerne (node)
const A = {}
{
  const FARLIG = /\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|RTCPeerConnection|geolocation|userAgent|document\.cookie|indexedDB|getUserMedia)\b/g
  for (const f of ['skak.html', 'laerer.html']) {
    const t = readFileSync(path.join(dir, f), 'utf8')
    A[f] = { kb: Math.round(t.length / 1024), farlige: [...new Set(t.match(FARLIG) ?? [])], laesKode: (t.match(/\blaesKode\b/g) ?? []).length }
  }
  const lt = readFileSync(path.join(dir, 'laerer.html'), 'utf8')
  const st = readFileSync(path.join(dir, 'skak.html'), 'utf8')
  A.billede = { laerer: [...new Set(lt.match(/(toDataURL|toBlob|MediaRecorder|captureStream|createObjectURL)/g) ?? [])], skakLaeser: [...new Set(st.match(/(qrLaesMatrix|qrLaesBillede|getUserMedia)/g) ?? [])] }
  ok('A1 skak.html: ingen fetch, XHR, beacon, websocket, cookie, userAgent, geolocation eller kamera', !A['skak.html'].farlige.length, { skak: A['skak.html'].farlige })
  ok('A1b laerer.html: kun kameraet (getUserMedia); ingen fetch/XHR/beacon/websocket/cookie og ingen toDataURL, toBlob, MediaRecorder eller createObjectURL', A['laerer.html'].farlige.every((x) => x === 'getUserMedia') && !A.billede.laerer.length, { laerer: A['laerer.html'].farlige, billede: A.billede.laerer })
  ok('A1c skak.html har ingen QR-laeser og intet kamera', !A.billede.skakLaeser.length, A.billede.skakLaeser)
  ok('A2 skak.html kan ikke laese en kode (laesKode findes kun i laerer.html)', A['skak.html'].laesKode === 0 && A['laerer.html'].laesKode > 0, { skak: A['skak.html'].laesKode, laerer: A['laerer.html'].laesKode })
  // Koden: udgave 1 og 2 ind og ud.
  let rundt = 0
  let r = 590
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff }
  for (let i = 0; i < 2000; i++) {
    const u = i % 2 ? 2 : 1
    const v = Array.from({ length: KK.KODE_UDGAVER[u].antal }, () => Math.floor(rnd() * 12))
    const l = KK.laesKode(KK.lavKode(v, u).toLowerCase().replace(/-/g, ' '))
    if (l.ok && l.udgave === u && JSON.stringify(l.vaerdier) === JSON.stringify([...v, ...Array(23 - v.length).fill(0)])) rundt++
  }
  ok('A3 2.000 koder (udgave 1 og 2, smaa bogstaver, mellemrum) ind og ud giver de samme tal; udgave 1 faar 0 i de fem nye', rundt === 2000, { rundt })
  // Hvor meget siger en kode? Antal mulige koder, og hvor mange er entydige i en taenkt klasse.
  const koder577 = KL.syntetiskeKoder(25, 577)
  const koder590 = KL.syntetiskeKoder(25, 590)
  const entydige = (ks) => { const m = new Map(); ks.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1)); return ks.filter((k) => m.get(k) === 1).length }
  A.unik = { mulige: '12^23 = ' + (12n ** 23n).toString(), matematik: '6^7 = 279936', entydige577: entydige(koder577), entydige590: entydige(koder590) }
  // Et kode-cifre fra kun 3 forsoeg: 0, 33, 67 eller 100 % -> 1, 4, 8 eller 11.
  A.tre = [0, 1, 2, 3].map((rr) => KK.kodeVaerdi(3, rr))
  // Nye temaer: hvor lette er gaaderne under 900?
  A.temaer = {}
  for (const t of NYE) {
    const g = LICHESS.filter((x) => x.tema === t || (x.temaer ?? []).includes?.(t)).map((x) => x.rating).sort((a, b) => a - b)
    const under = g.filter((x) => x < 900)
    A.temaer[t] = { navn: navnAf(t), i_alt: g.length, under900: under.length, letteste: under[0], median900: under[Math.floor(under.length / 2)], under700: g.filter((x) => x < 700).length }
  }
  ok('A4 de fem nye temaer har hver 85 gaader og 40 under 900', NYE.every((t) => A.temaer[t].i_alt === 85 && A.temaer[t].under900 === 40), A.temaer)
}

// ------------------------------------------------------------ B: eleven i skak.html (browser)
function froe(n) { let s = n; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff } }
const VAERDI = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
function elevTraek(fen, rnd) {
  const c = new Chess(fen)
  const tr = c.moves({ verbose: true })
  if (!tr.length) return null
  const mat = tr.find((m) => m.san.endsWith('#'))
  if (mat) return mat
  const slag = tr.filter((m) => m.captured).sort((a, b) => VAERDI[b.captured] - VAERDI[a.captured])
  if (slag.length && rnd() < 0.8) return slag[0]
  const skak = tr.filter((m) => m.san.includes('+'))
  if (skak.length && rnd() < 0.5) return skak[Math.floor(rnd() * skak.length)]
  return tr[Math.floor(rnd() * tr.length)]
}
const uciAf = (m) => m.from + m.to + (m.promotion ?? '')

// Min egen QR-laeser (kun version 2, ingen fejlrettelse): fra SVG-stien "M{x} {y}h{l}v1h-{l}z" (kant 4)
// til et 25x25-gitter, saa formatinfo, maske, dataord i zigzag og bogstav-tilstand efter ISO/IEC 18004.
// Uafhaengig af Chaturangas qrLaesMatrix.
function gitterFraSti(d, kant = 4) {
  const felter = [...d.matchAll(/M(\d+) (\d+)h(\d+)/g)].map((m) => [Number(m[1]) - kant, Number(m[2]) - kant, Number(m[3])])
  const n = Math.max(...felter.map(([x, , l]) => x + l), ...felter.map(([, y]) => y + 1))
  const g = Array.from({ length: n }, () => Array(n).fill(0))
  for (const [x, y, l] of felter) for (let i = 0; i < l; i++) g[y][x + i] = 1
  return g
}
function minQrLaeser(g) {
  const n = g.length
  if (n !== 25) return { fejl: `version ${(n - 17) / 4}, kun version 2 kan laeses` }
  let fb = 0
  const bit = (x, y) => { fb = (fb << 1) | g[y][x] }
  for (let i = 0; i <= 5; i++) bit(i, 8)
  bit(7, 8); bit(8, 8); bit(8, 7)
  for (let j = 5; j >= 0; j--) bit(8, j)
  const fmt = fb ^ 0x5412
  const ec = ['M', 'L', 'H', 'Q'][(fmt >> 13) & 3]
  const maske = (fmt >> 10) & 7
  const M = [(i, j) => (i + j) % 2 === 0, (i) => i % 2 === 0, (i, j) => j % 3 === 0, (i, j) => (i + j) % 3 === 0, (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0, (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0, (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0, (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0][maske]
  const funktion = (r, c) => (r <= 8 && c <= 8) || (r <= 8 && c >= 17) || (r >= 17 && c <= 8) || r === 6 || c === 6 || (r >= 16 && r <= 20 && c >= 16 && c <= 20)
  const bits = []
  let op = true
  for (let j = n - 1; j > 0; j -= 2) {
    if (j === 6) j = 5
    for (let k = 0; k < n; k++) {
      const r = op ? n - 1 - k : k
      for (const c of [j, j - 1]) if (!funktion(r, c)) bits.push(g[r][c] ^ (M(r, c) ? 1 : 0))
    }
    op = !op
  }
  const data = bits.slice(0, { L: 34, M: 28, Q: 22, H: 16 }[ec] * 8)
  let p = 0
  const laes = (k) => { let v = 0; for (let i = 0; i < k; i++) v = (v << 1) | data[p++]; return v }
  const tilstand = laes(4)
  if (tilstand !== 2) return { ec, maske, fejl: `tilstand ${tilstand}, ikke bogstav (2)` }
  const antal = laes(9)
  const T = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'
  let t = ''
  for (let i = 0; i + 1 < antal; i += 2) { const v = laes(11); t += T[Math.floor(v / 45)] + T[v % 45] }
  if (antal % 2) t += T[laes(6)]
  return { ec, maske, antal, tekst: t, slut: laes(4) }
}
const browser = await chromium.launch({ headless: true })
const tryk = (S, sel) => (S.mobil ? S.page.locator(sel).first().tap() : S.page.locator(sel).first().click())
const tekst = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null }, sel)
const synlig = (S, sel) => S.page.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && !e.hidden && e.offsetParent) }, sel)
const fen = (S) => S.page.locator('#fen-tekst').inputValue()
async function uciTraek(S, uci) {
  await tryk(S, `#braet .felt[data-square="${uci.slice(0, 2)}"]`)
  await tryk(S, `#braet .felt[data-square="${uci.slice(2, 4)}"]`)
  if (uci.length > 4) { await S.page.waitForTimeout(200); if (await S.page.locator('#forvandling-modal').isVisible()) await S.page.locator('#forvandling-valg button').nth('qrbn'.indexOf(uci[4])).evaluate((b) => b.click()) }
}
async function ventDinTur(S, foer) {
  for (let k = 0; k < 50; k++) { await S.page.waitForTimeout(100); const f = await fen(S); if (f !== foer && /Din tur|trækker/.test((await tekst(S, '#status')) ?? '')) return }
}
async function nySide(bredde, init = null) {
  const mobil = bredde < 500
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 844 : 800 }, isMobile: mobil, hasTouch: mobil, deviceScaleFactor: mobil ? 2 : 1 })
  if (init) await ctx.addInitScript(init.fn, init.arg)
  const S = { ctx, mobil, bredde, net: [], fejl: [] }
  const page = await ctx.newPage()
  page.on('pageerror', (e) => S.fejl.push(e.message))
  page.on('dialog', (d) => { S.fejl.push('dialog: ' + d.message()); d.dismiss() })
  await page.route('**/*', (r) => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); S.net.push(u); return r.abort() })
  S.page = page
  return S
}
async function aabnGaader(S) {
  await S.page.goto(pathToFileURL(path.join(dir, 'skak.html')).href)
  await S.page.waitForSelector('#braet .felt')
  await S.page.waitForTimeout(400)
  await tryk(S, '#fane-gaader'); await S.page.waitForTimeout(300)
  await S.page.waitForFunction(() => document.getElementById('gaade-indlaeser').hidden, null, { timeout: 20000 })
  await S.page.waitForTimeout(300)
}
async function aabnFold(S, id) {
  if (!(await S.page.locator(`#${id}`).evaluate((d) => d.open))) { await S.page.locator(`#${id} > summary`).scrollIntoViewIfNeeded(); await tryk(S, `#${id} > summary`) }
  await S.page.waitForTimeout(300)
}
const lager = (S) => S.page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])))
async function visKode(S) {
  await aabnFold(S, 'fold-mit-bibliotek')
  const foer = await lager(S)
  await S.page.locator('#knap-vis-min-kode').scrollIntoViewIfNeeded()
  await tryk(S, '#knap-vis-min-kode'); await S.page.waitForTimeout(250)
  const kode = (await S.page.locator('#min-kode-tekst').innerText()).trim()
  const boks = await tekst(S, '#min-kode-boks')
  return { kode, boks, lagerUaendret: JSON.stringify(foer) === JSON.stringify(await lager(S)) }
}

const B = {}
const SEED_TEMA = { fork: { loest: 10, fejlet: 6 }, pin: { loest: 10, fejlet: 1 }, mateIn1: { loest: 20, fejlet: 0, sidste: '11111111111111111111' } }
for (const bredde of [390, 1280]) {
  const R = (B[bredde] = { temaer: {} })
  // Mandag 28. sep 2026 kl. 9 (en skoledag), pc'ens eget ur.
  const S = await nySide(bredde, { fn: (t) => { if (!sessionStorage.getItem('k590')) { localStorage.setItem('skak-gaade-fremgang-v1', JSON.stringify({ temaStatistik: t })); sessionStorage.setItem('k590', '1') } }, arg: SEED_TEMA })
  await S.page.clock.install({ time: new Date(2026, 8, 28, 9) })
  await aabnGaader(S)
  const rnd = froe(590 + bredde)
  for (const tag of NYE) {
    const T = (R.temaer[tag] = { navn: navnAf(tag), gaader: [] })
    for (let n = 0; n < 3; n++) {
      await aabnFold(S, 'fold-gaade-temaer')
      const knap = `#gaade-temaer .gaade-tema-knap[data-tema="${tag}"]`
      await S.page.locator(knap).scrollIntoViewIfNeeded()
      if (n === 0) T.knap = await tekst(S, knap)
      await tryk(S, knap); await S.page.waitForTimeout(700)
      const f = await fen(S)
      const g = ALLE.find((x) => placering(x.fen) === placering(f))
      const G = { elevRating: await tekst(S, '#gaade-rating'), gaadeRating: g?.rating ?? null, valgt: await tekst(S, '#gaade-tema-valgt'), fundet: !!g, tema: g?.tema }
      if (n === 0) G.forklaring = await tekst(S, '#gaade-tema-forklaring, .gaade-tema-forklaring, #gaade-info')
      if (!g) { T.gaader.push(G); continue }
      // Elevens foerste traek: hendes egen model. Rigtigt -> hun loeser resten; forkert -> fortryd og loes.
      const m = elevTraek(f, rnd)
      const rigtigt = m && uciAf(m) === g.solutionUci[0]
      G.foersteTraek = m?.san ?? null
      G.rigtigtFoerste = !!rigtigt
      if (!rigtigt && m) {
        await uciTraek(S, uciAf(m)); await S.page.waitForTimeout(500)
        G.besked = (await tekst(S, '#status'))?.slice(0, 160)
        if (await synlig(S, '#knap-gaade-fortryd')) { await tryk(S, '#knap-gaade-fortryd'); await S.page.waitForTimeout(400) }
      }
      for (let i = 0; i < g.solutionUci.length; i += 2) {
        const foer = await fen(S)
        await uciTraek(S, g.solutionUci[i])
        if (i + 1 < g.solutionUci.length) await ventDinTur(S, foer)
      }
      await S.page.waitForTimeout(600)
      G.status = (await tekst(S, '#status'))?.slice(0, 160)
      G.loest = /løst/i.test(G.status ?? '')
      T.gaader.push(G)
      if (n === 0 && tag === 'deflection') await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-aflede.png`) })
    }
  }
  // Mit bibliotek og koden
  await aabnFold(S, 'fold-mit-bibliotek')
  R.nyeRaekker = await S.page.evaluate((nye) => nye.map((id) => document.querySelector(`#mit-bibliotek-grupper .mit-bib-raekke[data-id="${id}"]`)?.innerText.replace(/\s+/g, ' ').trim() ?? null), NYE)
  R.ugeSaetning = await tekst(S, '#mit-uge-tekst')
  const k1 = await visKode(S)
  await S.page.locator('#min-kode-boks').screenshot({ path: path.join(HERE, `S-${bredde}-min-kode.png`) })
  // 587: QR-koden. Hvad baerer den? Min egen laeser paa SVG-stien.
  const qrD = await S.page.evaluate(() => document.querySelector('#min-kode-qr svg path')?.getAttribute('d') ?? null)
  const qr = qrD ? minQrLaeser(gitterFraSti(qrD)) : { fejl: 'ingen QR' }
  R.qr = qr
  R.qrPng = (await S.page.locator('#min-kode-qr').screenshot()).toString('base64')
  ok(`D1 ${bredde}: QR-koden i Mit bibliotek baerer praecis koden og intet andet (min egen laeser: ${qr.ec ?? '?'}, maske ${qr.maske ?? '?'})`, qr.tekst === k1.kode && qr.slut === 0, { qr: qr.tekst ?? qr.fejl, kode: k1.kode })
  const l = KK.laesKode(k1.kode)
  const v = (id) => l.vaerdier?.[KK.KODE_KOMPETENCER.findIndex((k) => k.id === id)]
  // Forventet: elevens egne tal efter de 3 gaader pr. nyt tema (3 forsoeg) + de lagte ind.
  const gemt = JSON.parse((await lager(S))['skak-gaade-fremgang-v1'])
  const forvent = (id) => { const t = gemt.temaStatistik[id]; if (!t) return 0; const s = t.sidste; if (s && s.length >= 20) return KK.kodeVaerdi(20, [...s.slice(-20)].filter((c) => c === '1').length); const loest = t.loest ?? 0; return KK.kodeVaerdi(loest + (t.opgivet ?? 0), loest - Math.min(t.fejlet ?? 0, loest)) }
  R.kode = k1.kode
  R.vaerdier = Object.fromEntries(['fork', 'pin', 'mateIn1', ...NYE].map((id) => [id, { kode: v(id), forventet: forvent(id) }]))
  ok(`B1 ${bredde}: koden er udgave 2 (20 tegn) og baerer elevens tal i gafler, bindinger, mat i 1 og de fem nye`, l.ok && l.udgave === 2 && Object.values(R.vaerdier).every((x) => x.kode === x.forventet), R.vaerdier)
  ok(`B2 ${bredde}: at vise koden aendrer intet i lageret; teksten naevner intet navn eller dato`, k1.lagerUaendret && !/\d{1,2}\.\s*(sep|okt)|2026/.test(k1.boks ?? ''), { boks: k1.boks?.slice(0, 200) })
  // Hvad ligger der i lageret om tid? (ugenumre, datoer, tidsstempler)
  const alt = await lager(S)
  R.lagerNoegler = Object.keys(alt)
  R.tid = Object.fromEntries(Object.entries(alt).map(([k, x]) => [k, { tidsstempler: (x.match(/\b1[6-9]\d{11}\b/g) ?? []).length, datoer: (x.match(/20\d\d-\d\d-\d\d/g) ?? []).length, uger: (x.match(/"uger":\{[^}]*\}/g) ?? []).slice(0, 3) }]).filter(([, t]) => t.tidsstempler || t.datoer || t.uger.length))
  // Samme tal en maaned senere om aftenen, og uden uger: samme kode?
  await S.page.clock.setSystemTime(new Date(2026, 9, 29, 20, 13))
  await aabnGaader(S)
  const k2 = await visKode(S)
  await S.page.evaluate(() => { const d = JSON.parse(localStorage.getItem('skak-gaade-fremgang-v1')); for (const t of Object.values(d.temaStatistik)) delete t.uger; localStorage.setItem('skak-gaade-fremgang-v1', JSON.stringify(d)) })
  await aabnGaader(S)
  const k3 = await visKode(S)
  ok(`B3 ${bredde}: samme tal en maaned senere om aftenen og uden ugerne giver samme kode`, k1.kode === k2.kode && k2.kode === k3.kode, { k1: k1.kode, k2: k2.kode, k3: k3.kode })
  R.net = S.net.length; R.fejl = S.fejl
  ok(`B4 ${bredde}: skak.html 0 netkald, 0 JS-fejl, ingen vandret rulning`, !S.net.length && !S.fejl.length && (await S.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)), { net: S.net.slice(0, 3), fejl: S.fejl.slice(0, 3) })
  await S.ctx.close()
}

// ------------------------------------------------------------ C: laerer.html
const C = {}
const nye20 = KL.syntetiskeKoder(20, 590)
const gamle5 = [11, 8, 6, 4, 1].map((c, i) => KK.lavKode(Array.from({ length: 18 }, (_, j) => (j + i) % 3 === 0 ? 0 : c), 1))
const alle25 = [...nye20, ...gamle5]
for (const bredde of [390, 1280]) {
  const S = await nySide(bredde)
  await S.page.goto(pathToFileURL(path.join(dir, 'laerer.html')).href)
  await tryk(S, '#fane-knap-koder'); await S.page.waitForTimeout(200)
  const tast = alle25.map((k, i) => (i % 3 === 0 ? k.toLowerCase() : i % 3 === 1 ? k.replace(/-/g, ' ') : k.replace(/0/g, 'O'))).join('\n')
  await S.page.locator('#koder-felt').fill(tast); await S.page.waitForTimeout(300)
  const status = await tekst(S, '#koder-status')
  const res = await S.page.locator('#koder-resultat').innerText()
  const raekker = await S.page.locator('#koder-svagest li, #koder-faa li').count()
  const kodeIRes = alle25.filter((k) => res.includes(k) || res.includes(k.replace(/-/g, '')))
  const gemtUden = await S.page.evaluate(() => localStorage.getItem('skak-laerer-koder-v1'))
  const forslag = await tekst(S, '#koder-forslag')
  ok(`C1 ${bredde}: 25 syntetiske koder (20 udgave 2, 5 udgave 1; smaa bogstaver, mellemrum, O for 0): "25 koder laest.", 23 kompetencer, ingen enkelt kode i resultatet, intet gemt uden flueben`, /^25 koder læst\./.test(status ?? '') && raekker === 23 && !kodeIRes.length && gemtUden === null, { status, forslag, kodeIRes })
  await S.page.locator('#koder-felt').evaluate((e) => e.closest('section, .fane, main')?.scrollIntoView())
  await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-laerer-25.png`), fullPage: true })
  // Flueben
  await S.page.locator('#koder-husk').check(); await S.page.waitForTimeout(100)
  const med = await S.page.evaluate(() => localStorage.getItem('skak-laerer-koder-v1'))
  await S.page.locator('#koder-husk').uncheck(); await S.page.waitForTimeout(100)
  const af = await S.page.evaluate(() => localStorage.getItem('skak-laerer-koder-v1'))
  ok(`C2 ${bredde}: med flueben gemt, taget af: slettet`, med === tast && af === null)
  // HTML i feltet
  await S.page.locator('#koder-felt').fill(`${alle25[0]}\n<img src=x onerror="window.__xss=1">\n<b>fed</b>`); await S.page.waitForTimeout(300)
  const x = await S.page.evaluate(() => ({ xss: window.__xss ?? null, img: document.querySelectorAll('#koder-status img, #koder-resultat img').length, b: document.querySelectorAll('#koder-status b').length }))
  ok(`C3 ${bredde}: HTML i feltet vises som tekst og koeres ikke`, x.xss === null && !x.img && !x.b, x)
  // Een kode alene
  await S.page.locator('#koder-felt').fill(nye20[4]); await S.page.waitForTimeout(300)
  const en = { status: await tekst(S, '#koder-status'), forslag: await tekst(S, '#koder-forslag'), linjer: await S.page.locator('#koder-svagest .koder-linje').evaluateAll((els) => els.slice(0, 4).map((e) => e.textContent.trim())) }
  ok(`C4 ${bredde}: een kode alene viser den ene elevs procent pr. tema (siden har ingen mindste klasse)`, /^1 kode læst/.test(en.status ?? ''), en)
  // Lang linje (en hel klasse sat ind uden linjeskift): deles efter kontrolsummen
  await S.page.locator('#koder-felt').fill(alle25.join('')); await S.page.waitForTimeout(400)
  const lang = await tekst(S, '#koder-status')
  ok(`C5 ${bredde}: alle 25 koder sat ind i een lang linje uden mellemrum: "25 koder laest."`, /^25 koder læst\./.test(lang ?? ''), { lang: lang?.slice(0, 120) })
  C[bredde] = { status, forslag, en, x, lang }
  ok(`C6 ${bredde}: laerer.html 0 netkald, 0 JS-fejl, ingen vandret rulning`, !S.net.length && !S.fejl.length && (await S.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)), { net: S.net.slice(0, 3), fejl: S.fejl.slice(0, 3) })
  await S.ctx.close()
}
// ------------------------------------------------------------ D: kameraet paa laerer.html (587)
// Et falsk kamera: getUserMedia giver en canvas.captureStream(), der viser tomt, elev A's QR (skaermbillede
// fra skak.html paa 390), tomt, elev B's QR (1280), tomt, A igen. Jeg taeller kald til toDataURL, toBlob og
// MediaRecorder paa siden og ser, om sporet slukkes ved Stop og ved faneskift.
const D = {}
const kodeA = B[390].kode
const kodeB = B[1280].kode
const falskKamera = (png) => {
  window.__billede = { toDataURL: 0, toBlob: 0, optag: 0 }
  const tD = HTMLCanvasElement.prototype.toDataURL
  HTMLCanvasElement.prototype.toDataURL = function (...a) { window.__billede.toDataURL++; return tD.apply(this, a) }
  const tB = HTMLCanvasElement.prototype.toBlob
  HTMLCanvasElement.prototype.toBlob = function (...a) { window.__billede.toBlob++; return tB.apply(this, a) }
  if (window.MediaRecorder) { const MR = window.MediaRecorder; window.MediaRecorder = function (...a) { window.__billede.optag++; return new MR(...a) } }
  const billeder = png.map((p) => { const i = new Image(); i.src = 'data:image/png;base64,' + p; return i })
  const plan = [[null, 800], [0, 2500], [null, 2200], [1, 2500], [null, 2200], [0, 2500], [null, 600000]]
  window.__spor = []
  if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {} })
  navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720
    const x = c.getContext('2d')
    const t0 = performance.now()
    const tegn = () => {
      let t = performance.now() - t0
      let k = 0
      while (k < plan.length - 1 && t > plan[k][1]) { t -= plan[k][1]; k++ }
      x.fillStyle = '#8a8a80'; x.fillRect(0, 0, 1280, 720)
      const b = plan[k][0] === null ? null : billeder[plan[k][0]]
      if (b && b.complete) { const h = 420; const w = (b.width / b.height) * h; x.fillStyle = '#fff'; x.fillRect(640 - w / 2 - 20, 130, w + 40, h + 40); x.drawImage(b, 640 - w / 2, 150, w, h) }
      setTimeout(tegn, 40)
    }
    tegn()
    const s = c.captureStream(25)
    window.__spor.push(...s.getTracks())
    return s
  }
}
for (const bredde of [390, 1280]) {
  const S = await nySide(bredde, { fn: falskKamera, arg: [B[390].qrPng, B[1280].qrPng] })
  await S.page.goto(pathToFileURL(path.join(dir, 'laerer.html')).href)
  await tryk(S, '#fane-knap-koder'); await S.page.waitForTimeout(200)
  const lagerFoer = await lager(S)
  await tryk(S, '#koder-scan-knap')
  await S.page.waitForTimeout(13500)
  const felt = await S.page.locator('#koder-felt').inputValue()
  const status = await tekst(S, '#koder-scan-status')
  const koder = felt.split(/\n/).map((x) => x.trim()).filter(Boolean)
  const paaSiden = await S.page.evaluate(() => ({ canvas: document.querySelectorAll('canvas').length, img: document.querySelectorAll('img').length }))
  await S.page.screenshot({ path: path.join(HERE, `S-${bredde}-scan.png`) })
  await tryk(S, '#koder-scan-knap'); await S.page.waitForTimeout(300)
  const efterStop = await S.page.evaluate(() => window.__spor.map((t) => t.readyState))
  await tryk(S, '#koder-scan-knap'); await S.page.waitForTimeout(1200)
  const koerer = await S.page.evaluate(() => window.__spor.slice(-1).map((t) => t.readyState))
  await tryk(S, '#fane-knap-storm'); await S.page.waitForTimeout(1500)
  const efterFane = await S.page.evaluate(() => window.__spor.map((t) => t.readyState))
  const billede = await S.page.evaluate(() => window.__billede)
  const lagerEfter = await lager(S)
  const nyeNoegler = Object.keys(lagerEfter).filter((k) => lagerFoer[k] !== lagerEfter[k] && !/fane/.test(k))
  D[bredde] = { koder, status, efterStop, koerer, efterFane, billede, nyeNoegler, paaSiden, net: S.net.length, fejl: S.fejl }
  ok(`D2 ${bredde}: falsk kamera med A, B, A: feltet faar A, B, A (A to gange, efter en pause)`, koder.join(',') === [kodeA, kodeB, kodeA].join(','), { koder, status })
  ok(`D3 ${bredde}: Stop og faneskift slukker kameraet (sporet "ended")`, efterStop.every((x) => x === 'ended') && koerer[0] === 'live' && efterFane.every((x) => x === 'ended'), { efterStop, koerer, efterFane })
  ok(`D4 ${bredde}: intet billede gemmes: 0 toDataURL, 0 toBlob, 0 optagelser, intet nyt i lageret, intet lærred eller billede paa siden`, !billede.toDataURL && !billede.toBlob && !billede.optag && !nyeNoegler.length && !paaSiden.canvas && !paaSiden.img, { billede, nyeNoegler, paaSiden })
  ok(`D5 ${bredde}: kameraet: 0 netkald, 0 JS-fejl`, !S.net.length && !S.fejl.length, { net: S.net.slice(0, 3), fejl: S.fejl.slice(0, 3) })
  await S.ctx.close()
}
{
  const S = await nySide(390, { fn: () => { navigator.mediaDevices.getUserMedia = async () => { const e = new Error('nej'); e.name = 'NotAllowedError'; throw e } }, arg: null })
  await S.page.goto(pathToFileURL(path.join(dir, 'laerer.html')).href)
  await tryk(S, '#fane-knap-koder'); await S.page.waitForTimeout(200)
  await tryk(S, '#koder-scan-knap'); await S.page.waitForTimeout(600)
  D.nej = await tekst(S, '#koder-scan-status')
  await S.page.locator('#koder-felt').fill(kodeA); await S.page.waitForTimeout(200)
  D.nejTast = await tekst(S, '#koder-status')
  ok('D6 kameraet naegtet: beskeden siger "tast", og tastefeltet virker', /[Tt]ast/.test(D.nej ?? '') && /^1 kode læst/.test(D.nejTast ?? ''), { nej: D.nej, tast: D.nejTast })
  await S.ctx.close()
}

// ------------------------------------------------------------ E: klassens fremgang (592)
const E = {}
const begge = (S) => S.page.evaluate(() => [localStorage.getItem('skak-laerer-koder-v1'), localStorage.getItem('skak-laerer-koder-sidst-v1')])
for (const bredde of [390, 1280]) {
  const S = await nySide(bredde)
  await S.page.goto(pathToFileURL(path.join(dir, 'laerer.html')).href)
  await tryk(S, '#fane-knap-koder'); await S.page.waitForTimeout(200)
  await aabnFold(S, 'koder-sidst-fold')
  await tryk(S, '#koder-sidst-proev'); await tryk(S, '#koder-proev'); await S.page.waitForTimeout(400)
  const sidst = (await S.page.locator('#koder-sidst-felt').inputValue()).split(/\n/).filter(Boolean)
  const nu = (await S.page.locator('#koder-felt').inputValue()).split(/\n/).filter(Boolean)
  const res = await S.page.locator('#koder-resultat').innerText()
  const saetning = await tekst(S, '#koder-fremgang-saetning')
  const iRes = [...sidst, ...nu].filter((k) => res.includes(k) || res.includes(k.replace(/-/g, '')))
  const uden = await begge(S)
  await S.page.locator('#koder-husk').check(); await S.page.waitForTimeout(150)
  const med = (await begge(S)).map((x) => (x ? x.split('\n').length : null))
  await S.page.locator('#koder-husk').uncheck(); await S.page.waitForTimeout(150)
  const af = await begge(S)
  E[bredde] = { sidst: sidst.length, nu: nu.length, saetning, iRes, uden, med, af }
  ok(`E1 ${bredde}: klassens fremgang med 25 + 25 syntetiske koder: een saetning, ingen enkelt kode i resultatet`, sidst.length === 25 && nu.length === 25 && /Siden sidst/.test(saetning ?? '') && !iRes.length, { saetning, iRes })
  ok(`E2 ${bredde}: begge saet gemmes kun med flueben og slettes, naar det tages af`, uden.every((x) => x === null) && med.every((x) => x === 25) && af.every((x) => x === null), { uden, med, af })
  ok(`E3 ${bredde}: 0 netkald, 0 JS-fejl`, !S.net.length && !S.fejl.length)
  await S.ctx.close()
}
await browser.close()
for (const b of [390, 1280]) delete B[b].qrPng

const ud = { skak: SHA, ref: REF, A, B, C, D, E, tjek, groen: tjek.filter((t) => t.ok).length, ialt: tjek.length }
writeFileSync(path.join(HERE, 'skak-590.json'), JSON.stringify(ud, null, 1) + '\n')
console.log(`${ud.groen}/${ud.ialt} groenne`)
