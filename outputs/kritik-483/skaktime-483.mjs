// ORDRE 483, blok 2: Marcs skaktime paa 45 minutter med klassens storm (Chaturanga 474, "Til Marc").
// Laereren paa 1280 px (laerer.html + projektorvinduer), eleverne paa 390 px (skak.html), flere vinduer, samme dato.
// Kun syntetiske data: elevnavne "Elev 01".."Elev 25". Headless Chromium via file://, intet netvaerk.
//
// Filerne er skak-repoets main (9c5114f), hentet read-only med `git show main:skak.html` / `laerer.html`
// og `git archive main src data` til en mappe uden for repoet (arbejdstraeet har Chaturangas igangvaerende 485).
//   node outputs/kritik-483/skaktime-483.mjs <mappe med skak.html, laerer.html og skak-main/>
// Skriver skaktime-483.json og S-*.png i outputs/kritik-483.
import { writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HER = path.dirname(fileURLToPath(import.meta.url))
const KILDE = process.argv[2]
if (!KILDE) { console.error('brug: node skaktime-483.mjs <mappe>'); process.exit(2) }
const imp = (f) => import(pathToFileURL(path.join(KILDE, 'skak-main', f)).href)
const { chromium } = await import(pathToFileURL(path.join(KILDE, 'skak-main', 'node_modules', 'playwright', 'index.mjs')).href)
const { Chess } = await import(pathToFileURL(path.join(KILDE, 'skak-main', 'node_modules', 'chess.js', 'dist', 'esm', 'chess.js')).href)
const { GAADEBANK_STOR_GZIP_BASE64 } = await imp('src/gaadebank-stor.js')
const { afkodGaadebankStor } = await imp('src/gaadedata.js')
const { erLovligStilling } = await imp('src/taktikanalyse.js')
const { stormPulje, vaelgDagensStorm } = await imp('src/gaadestorm.js')
const { stormKode } = await imp('src/klassestorm.js')

const SKAK = pathToFileURL(path.join(KILDE, 'skak.html')).href
const LAERER = pathToFileURL(path.join(KILDE, 'laerer.html')).href
const DATO = '2026-09-28'
const KL = `${DATO}T10:00:00`

const r = { dato: DATO, tjek: [], maal: {}, elever: {}, skaermbilleder: [], sideFejl: [], netvaerk: [], dialoger: [] }
const tjek = (navn, ok, detalje = '') => { r.tjek.push({ navn, ok: !!ok, detalje: String(detalje).slice(0, 300) }); console.log(`${ok ? 'OK  ' : 'FUND'} ${navn}${detalje ? ` (${String(detalje).slice(0, 160)})` : ''}`) }
const vagt = (page, hvem) => {
  page.on('pageerror', (e) => r.sideFejl.push(`${hvem}: ${e.message}`))
  page.on('request', (q) => { if (!/^(file|data|blob):/.test(q.url())) r.netvaerk.push(`${hvem}: ${q.url()}`) })
  page.on('dialog', (d) => { r.dialoger.push(`${hvem}: ${d.type()} "${d.message()}"`); d.accept() })
}
const skud = async (page, navn, opts = {}) => { await page.screenshot({ path: path.join(HER, navn), ...opts }); r.skaermbilleder.push(navn) }
const tekst = (page, sel) => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, ' ').trim()).catch(() => null)
const yAf = (page, sel) => page.locator(sel).first().evaluate((e) => Math.round(e.getBoundingClientRect().top + scrollY)).catch(() => null)

// Gaadebanken som i Chaturangas 474-test, saa vi kender dagens gaader og deres loesninger.
const egne = ['gaader.json', 'gaader-lette.json'].flatMap((f) => JSON.parse(readFileSync(path.join(KILDE, 'skak-main', 'data', f), 'utf8'))
  .map((g) => ({ id: g.id, fen: g.fen, solutionUci: g.solutionUci, rating: g.svaerhed, tema: g.tema })))
const bank = (await afkodGaadebankStor(GAADEBANK_STOR_GZIP_BASE64)).concat(egne).filter((g) => erLovligStilling(g.fen))
const noegle = (fen) => fen.split(' ').slice(0, 2).join(' ')
const dagens = vaelgDagensStorm(stormPulje(bank), DATO, 'gaffel')
const dagensKode = stormKode(dagens)
const gaarsdagens = vaelgDagensStorm(stormPulje(bank), '2026-09-27', 'gaffel')
r.maal.ventetKode = dagensKode
r.maal.kodeForkertDato = stormKode(gaarsdagens)

async function klikTraek(page, uci) {
  await page.click(`#braet .felt[data-square="${uci.slice(0, 2)}"]`)
  await page.click(`#braet .felt[data-square="${uci.slice(2, 4)}"]`)
  if (uci.length > 4) await page.locator('#forvandling-valg button').nth('qrbn'.indexOf(uci[4])).click()
}
async function loesAktuel(page, liste, clock) {
  const fen = await page.inputValue('#fen-tekst')
  const g = liste.find((x) => noegle(x.fen) === noegle(fen))
  if (!g) return false
  for (let i = 0; i < g.solutionUci.length; i += 2) {
    await klikTraek(page, g.solutionUci[i])
    await clock.runFor(i + 1 < g.solutionUci.length ? 700 : 400)
  }
  return true
}
async function forkertTraek(page, liste, clock) {
  const fen = await page.inputValue('#fen-tekst')
  const g = liste.find((x) => noegle(x.fen) === noegle(fen))
  const c = new Chess(fen)
  const m = c.moves({ verbose: true }).find((x) => x.from + x.to !== g.solutionUci[0].slice(0, 4))
  await klikTraek(page, m.from + m.to + (m.promotion ?? ''))
  await clock.runFor(800)
}

const browser = await chromium.launch({ headless: true })
try {
  // ======================= 1. Foer timen: laereren (1280) =======================
  const L = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await L.clock.install({ time: new Date(`${DATO}T09:58:00`) })
  // Laererens ur staar stille mellem skridtene og flyttes kun med runFor, saa rundeurets tider er praecise.
  await L.clock.pauseAt(new Date(`${DATO}T09:58:01`))
  const laerer = await L.newPage(); vagt(laerer, 'laerer')
  await laerer.goto(LAERER)
  await laerer.click('#fane-knap-storm')
  await laerer.click('.ks-tema[data-tema="gaffel"]')
  const [projS] = await Promise.all([L.waitForEvent('page'), laerer.click('#ks-projektor-vindue')])
  vagt(projS, 'projektor-storm'); await projS.waitForLoadState()
  await projS.setViewportSize({ width: 1280, height: 720 })
  r.maal.projektorStormUrl = projS.url().replace(/^.*\//, '')
  tjek('projektoren (eget vindue) viser vejen: Gåder → Tema: Gafler → Dagens storm', /Gåder → Tema: Gafler → Dagens storm/.test(await tekst(projS, '.ks-fase')), await tekst(projS, '.ks-fase'))
  r.maal.projektorViserKode = /kode/i.test(await tekst(projS, '#ks-projektor-lag') ?? '')
  tjek('projektoren viser dagens kode, saa eleverne kan tjekke deres egen', r.maal.projektorViserKode, (await tekst(projS, '#ks-projektor-lag'))?.slice(0, 200))
  r.maal.laererViserKode = (await tekst(laerer, '#fane-storm') ?? '').includes(dagensKode)
  tjek('laerersiden viser dagens kode', r.maal.laererViserKode, 'laerer.html har ikke gaadebanken og kan ikke regne koden ud')
  await skud(laerer, 'S-1280-01-laerer-storm.png')
  await skud(projS, 'S-1280-02-projektor-storm-foer.png')

  // ======================= 2. 0-5 min: eleverne (390), samme dato =======================
  // Fem pc'er: bord 1-4 som planen siger; bord 5 har pc-uret en dag bagud; bord 6 trykker den store knap "Start stormen".
  const pcer = [
    { bord: 1, dato: KL, loes: 4, forkert: 0 },
    { bord: 2, dato: KL, loes: 2, forkert: 1 },
    { bord: 3, dato: KL, loes: 3, forkert: 0 },
    { bord: 4, dato: KL, loes: 1, forkert: 1 },
    { bord: 5, dato: '2026-09-27T10:00:00', loes: 0, forkert: 0 },
    { bord: 6, dato: KL, loes: 0, forkert: 0, stortKnap: true },
  ]
  for (const pc of pcer) {
    pc.ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
    await pc.ctx.clock.install({ time: new Date(pc.dato) })
    pc.page = await pc.ctx.newPage(); vagt(pc.page, `bord ${pc.bord}`)
    const t0 = Date.now()
    await pc.page.goto(SKAK)
    await pc.page.click('#fane-gaader')
    await pc.page.waitForFunction(() => !document.querySelector('#knap-storm-dagens').disabled, null, { timeout: 60000 })
    pc.klarMs = Date.now() - t0
    await pc.page.click('#segment-storm-tema .segment-knap[data-value="gaffel"]')
    pc.knapTekst = await tekst(pc.page, '#knap-storm-dagens')
    r.elever[pc.bord] = { dato: pc.dato.slice(0, 10), klarMs: pc.klarMs, knap: pc.knapTekst }
  }
  const p1 = pcer[0].page
  r.maal.elev390 = {
    stormKortY: await yAf(p1, '#storm-start-kort'),
    startStormenY: await yAf(p1, '#knap-storm-start'),
    dagensStormY: await yAf(p1, '#knap-storm-dagens'),
    startStormenErPrimaer: await p1.locator('#knap-storm-start').evaluate((e) => e.classList.contains('knap-primaer')),
    dagensStormErPrimaer: await p1.locator('#knap-storm-dagens').evaluate((e) => e.classList.contains('knap-primaer')),
    skaermHoejde: 844,
  }
  tjek('390: "Dagens storm" er den knap, der springer i oejnene', r.maal.elev390.dagensStormErPrimaer && !r.maal.elev390.startStormenErPrimaer,
    `"Start stormen" er primaer (y ${r.maal.elev390.startStormenY}), "Dagens storm" er sekundaer lige under (y ${r.maal.elev390.dagensStormY})`)
  tjek('390: "Dagens storm" kan ses uden at rulle, naar Gåder aabnes', r.maal.elev390.dagensStormY < 844, `y ${r.maal.elev390.dagensStormY} paa en 844 px skaerm`)
  tjek('bord 5 (pc-uret en dag bagud) ser en anden dato paa knappen', pcer[4].knapTekst !== pcer[0].knapTekst, `${pcer[4].knapTekst} mod ${pcer[0].knapTekst}`)
  await p1.locator('#storm-start-kort').scrollIntoViewIfNeeded()
  await skud(p1, 'S-390-01-elev-gaader-klar.png')

  // ======================= 3. 5-8 min: nedtaellingen og stormen =======================
  await laerer.click('#ks-start')
  await L.clock.runFor(2000)
  await skud(projS, 'S-1280-03-projektor-nedtaelling.png')
  await L.clock.runFor(3200)
  tjek('projektoren siger "Start!" efter 5 sekunder', (await tekst(projS, '.ks-stort-ur')) === 'Start!', await tekst(projS, '.ks-stort-ur'))
  for (const pc of pcer) {
    if (pc.stortKnap) await pc.page.click('#knap-storm-start')
    else await pc.page.click('#knap-storm-dagens')
    pc.titel = await tekst(pc.page, '#storm-koerer-titel')
    pc.kode = pc.titel?.match(/kode ([A-Z0-9]{4})$/)?.[1] ?? null
    pc.braetSynligt = await pc.page.locator('#braet').evaluate((e) => { const b = e.getBoundingClientRect(); return b.top >= -5 && b.bottom <= innerHeight + 5 })
    r.elever[pc.bord].titel = pc.titel
    r.elever[pc.bord].braetSynligtVedStart = pc.braetSynligt
  }
  const rigtige = pcer.filter((p) => p.dato === KL && !p.stortKnap)
  tjek('bord 1-4 (rigtig dato) faar samme kode som Node regner ud', rigtige.every((p) => p.kode === dagensKode), rigtige.map((p) => p.kode).join(' ') + ' = ' + dagensKode)
  tjek('bord 5 (forkert dato) faar en anden kode', pcer[4].kode && pcer[4].kode !== dagensKode, `${pcer[4].kode} (ventet for 27/9: ${r.maal.kodeForkertDato})`)
  tjek('bord 6 (trykkede "Start stormen") har ingen kode', !pcer[5].kode, pcer[5].titel)
  tjek('390: braettet staar helt paa skaermen, naar stormen starter', pcer.every((p) => p.braetSynligt), pcer.map((p) => `${p.bord}:${p.braetSynligt}`).join(' '))
  await skud(p1, 'S-390-02-elev-storm-koerer.png')
  // Eleverne loeser (og fejler) forskelligt; bord 5 og 6 har andre gaader og loeser ingen.
  for (const pc of rigtige) {
    for (let i = 0; i < pc.loes; i++) await loesAktuel(pc.page, dagens, pc.ctx.clock)
    for (let i = 0; i < pc.forkert; i++) await forkertTraek(pc.page, dagens, pc.ctx.clock)
  }
  // Tiden: elevernes 3 minutter + bonus; laererens ur ogsaa.
  await L.clock.runFor(60000)
  await skud(projS, 'S-1280-04-projektor-storm-koerer.png')
  await L.clock.runFor(125000)
  for (const pc of pcer) await pc.ctx.clock.runFor(200000)
  tjek('projektoren: "Tiden er gået" efter 3 minutter', /Tiden er gået/.test(await tekst(projS, '#ks-projektor-lag') ?? ''), (await tekst(projS, '.ks-fase')))
  for (const pc of pcer) {
    pc.resultat = await tekst(pc.page, '#storm-dagens-tal')
    r.elever[pc.bord].resultat = pc.resultat
    pc.trae = await pc.page.locator('#storm-resultat button, #storm-resultat a').allInnerTexts().catch(() => [])
    r.elever[pc.bord].traenKnapper = pc.trae.filter((t) => /Træn/.test(t)).length
  }
  tjek('bord 1-4: resultatlinjen har tallet og koden', rigtige.every((p) => new RegExp(`${p.loes} gåder? løst\\. Kode ${dagensKode}\\.`).test(p.resultat ?? '')), rigtige.map((p) => p.resultat).join(' | '))
  tjek('bord 6 ("Start stormen"): ingen linje til laereren', !pcer[5].resultat, pcer[5].resultat)
  tjek('bord 2 og 4 (fejlede): "Træn: ..." under "Her gik det galt"', pcer[1].trae.some((t) => /Træn/.test(t)) && pcer[3].trae.some((t) => /Træn/.test(t)), `${r.elever[2].traenKnapper} og ${r.elever[4].traenKnapper} knapper`)
  await p1.locator('#storm-resultat').scrollIntoViewIfNeeded()
  await skud(p1, 'S-390-03-elev-storm-resultat.png', { fullPage: false })
  await pcer[1].page.locator('#storm-resultat').scrollIntoViewIfNeeded()
  await skud(pcer[1].page, 'S-390-04-elev-her-gik-det-galt.png')

  // ======================= 4. 8-12 min: tallene ind =======================
  // Fire rigtige borde + otte syntetiske (12 borde med 25 elever). Vi taeller tryk og tegn.
  const storm = [...rigtige.map((p) => [p.bord, p.loes]), [5, 0], [7, 11], [8, 6], [9, 9], [10, 14], [11, 3], [12, 7], [13, 5]]
  let tryk = 0; let tegn = 0
  for (const [bord, loeste] of storm) {
    await laerer.fill('#ks-bord', String(bord)); await laerer.fill('#ks-loeste', String(loeste)); await laerer.press('#ks-loeste', 'Enter')
    tryk += 3; tegn += String(bord).length + String(loeste).length
  }
  r.maal.stormIndtastning = { borde: storm.length, trykOgFeltskift: tryk, tegn }
  const top = await projS.locator('.ks-topliste li').allInnerTexts()
  tjek('projektoren viser "Bedste borde" (top 10)', top.length === 10, top.slice(0, 3).map((t) => t.replace(/\s+/g, ' ')).join(' | '))
  r.maal.bord5Resultat = pcer[4].resultat
  await skud(projS, 'S-1280-05-projektor-bedste-borde.png')

  // ======================= 6. 15-42 min: turneringen =======================
  await laerer.click('#fane-knap-turnering')
  r.maal.turneringFoer = { navneFeltSynligt: await laerer.locator('#tur-navne').isVisible(), runderStandard: await laerer.inputValue('#tur-runder') }
  const navne = Array.from({ length: 25 }, (_, i) => `Elev ${String(i + 1).padStart(2, '0')}`)
  await laerer.fill('#tur-navne', navne.join('\n'))
  r.maal.navneTegn = navne.join('\n').length
  await laerer.click('#tur-start')
  r.maal.rundeurStandardMin = await laerer.inputValue('#tur-rundeur-min').catch(() => null)
  // Stormens projektorvindue: skifter det til turneringen?
  await L.clock.runFor(500)
  r.maal.stormVindueEfterTurnering = {
    stormLagSynligt: await projS.locator('#ks-projektor-lag').isVisible(),
    turneringSynlig: await projS.locator('.proj-par').first().isVisible().catch(() => false),
  }
  tjek('stormens projektorvindue skifter selv til turneringen', r.maal.stormVindueEfterTurnering.turneringSynlig, JSON.stringify(r.maal.stormVindueEfterTurnering))
  const [projT] = await Promise.all([L.waitForEvent('page'), laerer.click('#tur-projektor-vindue')])
  vagt(projT, 'projektor-turnering'); await projT.waitForLoadState()
  await projT.setViewportSize({ width: 1280, height: 720 })
  r.maal.projektorTurneringUrl = projT.url().replace(/^.*\//, '')
  await laerer.fill('#tur-rundeur-min', '9'); await laerer.click('#tur-rundeur-saet')
  const parringR1 = await projT.locator('.proj-par').allInnerTexts().catch(() => [])
  r.maal.parringR1 = parringR1.map((t) => t.replace(/\s+/g, ' ')).slice(0, 13)
  r.maal.friRundeR1 = await tekst(laerer, '.tur-fri')
  tjek('25 elever: 12 borde og en fri runde', parringR1.length === 12 && /Fri runde/.test(r.maal.friRundeR1 ?? ''), `${parringR1.length} borde, ${r.maal.friRundeR1}`)
  r.maal.projektorTurRaekkerSynlige = await projT.evaluate(() => [...document.querySelectorAll('.proj-par')].filter((e) => { const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight }).length)
  tjek('projektoren (1280x720) viser alle 12 borde uden at rulle', r.maal.projektorTurRaekkerSynlige === 12, `${r.maal.projektorTurRaekkerSynlige} af 12 synlige`)
  await skud(projT, 'S-1280-06-projektor-runde1.png')
  await skud(laerer, 'S-1280-07-laerer-runde1.png', { fullPage: true })

  // Eleverne: Spil -> Mod en makker -> Bord nr. -> Skakur Frit 4 min, 0 sek. Vi taeller handlingerne.
  const spillere = pcer.slice(0, 4)
  for (const pc of spillere) {
    const pg = pc.page
    let h = 0
    await pg.click('#fane-spil'); h++
    pc.modusStandard = await pg.locator('#segment-spil-modus [aria-pressed="true"]').getAttribute('data-value')
    await pg.fill('#makker-bord', String(pc.bord)); h++
    pc.urStandard = await pg.locator('#segment-skakur [aria-pressed="true"]').getAttribute('data-value')
    await pg.click('#segment-skakur .segment-knap[data-value="frit"]'); h++
    pc.fritStandard = `${await pg.inputValue('#skakur-frit-min')}+${await pg.inputValue('#skakur-frit-till')}`
    await pg.fill('#skakur-frit-min', '4'); h++
    await pg.fill('#skakur-frit-till', '0'); h++
    await pg.locator('#skakur-frit-till').press('Tab')
    pc.opsaetning = h
    pc.urVisning = await tekst(pg, '#skakur')
    pc.braetY = await yAf(pg, '#braet'); pc.urValgY = await yAf(pg, '#segment-skakur')
    r.elever[pc.bord].spil = { modusStandard: pc.modusStandard, urStandard: pc.urStandard, fritStandard: pc.fritStandard, handlinger: h, ur: pc.urVisning, braetY: pc.braetY, urValgY: pc.urValgY }
  }
  tjek('elevens ur staar som standard paa noget, der slutter partiet', spillere[0].urStandard !== 'intet', `standard: ${spillere[0].urStandard}; Frit starter paa ${spillere[0].fritStandard}`)
  await spillere[0].page.locator('#segment-skakur').scrollIntoViewIfNeeded()
  await skud(spillere[0].page, 'S-390-05-elev-spil-opsaetning.png')

  // Rundeuret startes; bord 1 mat, bord 2 tid ude, bord 3 giver op, bord 4 starter 90 s for sent.
  await laerer.click('#tur-rundeur-start')
  const [b1, b2, b3, b4] = spillere
  for (const m of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) { await klikTraek(b1.page, m); await b1.ctx.clock.runFor(1500) }
  b1.meld = await tekst(b1.page, '#spil-resultat-meld')
  for (const m of ['e2e4', 'e7e5']) { await klikTraek(b2.page, m); await b2.ctx.clock.runFor(1000) }
  await b2.ctx.clock.runFor(241000)
  b2.meld = await tekst(b2.page, '#spil-resultat-meld')
  for (const m of ['e2e4', 'e7e5']) { await klikTraek(b3.page, m); await b3.ctx.clock.runFor(1000) }
  await b3.page.click('#knap-spil-giv-op')
  const bek = b3.page.locator('#knap-spil-giv-op-bekraeft, [id*="giv-op"][id*="bekraeft"]')
  if (await bek.first().isVisible().catch(() => false)) await bek.first().click()
  b3.meld = await tekst(b3.page, '#spil-resultat-meld')
  // Bord 4: 90 s for sent i gang, begge taenker laenge. Uret slutter partiet efter 9 min 26 s fra rundeurets start.
  await b4.ctx.clock.runFor(90000)
  await klikTraek(b4.page, 'e2e4'); await b4.ctx.clock.runFor(1000)
  await klikTraek(b4.page, 'e7e5'); await b4.ctx.clock.runFor(235000)
  await klikTraek(b4.page, 'g1f3'); await b4.ctx.clock.runFor(235000)
  await klikTraek(b4.page, 'b8c6')
  const b4VedRundeurNul = 90000 + 1000 + 235000 + 235000
  await b4.ctx.clock.runFor(540000 - b4VedRundeurNul > 0 ? 540000 - b4VedRundeurNul : 0)
  b4.meldVedNul = await tekst(b4.page, '#spil-resultat-meld')
  b4.urVedNul = await tekst(b4.page, '#skakur')
  await b4.ctx.clock.runFor(10000)
  b4.meld = await tekst(b4.page, '#spil-resultat-meld')
  for (const pc of spillere) r.elever[pc.bord].meld = pc.meld
  tjek('bord 1 (mat): "Bord 1: 0-1 ..."', /^Bord 1: 0-1/.test(b1.meld ?? ''), b1.meld)
  tjek('bord 2 (tid ude): "Bord 2: 0-1 på tid"', /^Bord 2: 0-1 på tid/.test(b2.meld ?? ''), b2.meld)
  tjek('bord 3 (giver op): boksen siger resultatet', /^Bord 3: 0-1/.test(b3.meld ?? ''), b3.meld)
  tjek('bord 4 (90 s for sent) er faerdigt, naar rundeuret staar paa 0', !!b4.meldVedNul, `ved 9:00: ur "${b4.urVedNul}", boks "${b4.meldVedNul}"; 10 s senere: "${b4.meld}"`)
  await b2.page.locator('#spil-resultat').scrollIntoViewIfNeeded()
  await skud(b2.page, 'S-390-06-elev-tid-ude.png')

  // Laererens rundeur: 9 minutter.
  await L.clock.runFor(8 * 60000)
  r.maal.rundeurSidsteMinut = { laerer: await tekst(laerer, '.tur-rundeur-vis'), projektor: await tekst(projT, '#proj-ur, .proj-ur') }
  await skud(projT, 'S-1280-08-projektor-sidste-minut.png')
  await L.clock.runFor(61000)
  r.maal.rundeurVedNul = { laerer: await tekst(laerer, '.tur-rundeur-vis'), projektor: await tekst(projT, '#proj-ur, .proj-ur') }
  tjek('rundeuret siger tydeligt, at runden er slut', /0:00|slut|tid/i.test(r.maal.rundeurVedNul.projektor ?? ''), JSON.stringify(r.maal.rundeurVedNul))
  await skud(projT, 'S-1280-09-projektor-rundeur-nul.png')

  // Resultaterne ind: 12 borde, "paa tid" ved bord 2 og 4. Taeller tryk.
  const rundeResultater = async (res, paaTid = []) => {
    let t = 0
    const felter = laerer.locator('#fane-turnering .tur-resultat:visible')
    const n = await felter.count()
    for (let i = 0; i < n; i++) {
      await felter.nth(i).locator(`[data-resultat="${res[i % res.length]}"]`).click(); t++
      if (paaTid.includes(i + 1)) { await felter.nth(i).locator('.tur-tid-knap').click(); t++ }
    }
    return { borde: n, tryk: t }
  }
  r.maal.parrLaastUdenResultater = await laerer.locator('#tur-naeste').isDisabled()
  r.maal.statusUdenResultater = await tekst(laerer, '.tur-status')
  tjek('"Parr runde 2" er laast, til alle 12 resultater er inde (et sent bord holder klassen)', r.maal.parrLaastUdenResultater, r.maal.statusUdenResultater)
  r.maal.runde1Indtastning = await rundeResultater(['0-1', '0-1', '0-1', '0-1', '1-0', '1/2'], [2, 4])
  await laerer.click('#tur-naeste')
  r.maal.runde2 = { titel: await tekst(laerer, '#tur-runde-titel'), fri: await tekst(laerer, '.tur-fri') }
  const parringR2 = (await projT.locator('.proj-par').allInnerTexts().catch(() => [])).map((t) => t.replace(/\s+/g, ' '))
  r.maal.parringR2 = parringR2.slice(0, 12)
  // Hvem skal flytte? Sammenlign bord for bord med runde 1.
  const spillerPaaBord = (liste) => Object.fromEntries(liste.map((t) => [t.match(/^\d+/)?.[0], (t.match(/Elev \d+/g) || []).sort().join('+')]))
  const r1 = spillerPaaBord(r.maal.parringR1); const r2 = spillerPaaBord(parringR2)
  r.maal.boerdSammeParRunde2 = Object.keys(r2).filter((k) => r1[k] === r2[k]).length
  const bordAf = (liste) => { const m = {}; for (const t of liste) { const b = t.match(/^\d+/)?.[0]; for (const e of t.match(/Elev \d+/g) || []) m[e] = b } return m }
  const ba1 = bordAf(r.maal.parringR1); const ba2 = bordAf(parringR2)
  r.maal.eleverDerSkalFlytteRunde2 = navne.filter((n) => ba1[n] && ba2[n] && ba1[n] !== ba2[n]).length
  tjek('runde 2 er parret, og projektoren viser den', /Runde 2/.test(r.maal.runde2.titel ?? '') && parringR2.length === 12, r.maal.runde2.titel)
  r.maal.rundeurEfterParring = { laerer: await tekst(laerer, '.tur-rundeur-vis') }

  // Elevens pc til runde 2: hvad skal der trykkes?
  const e1 = b1.page
  await e1.click('#knap-spil-forfra')
  const bek2 = e1.locator('#knap-spil-forfra-bekraeft')
  const skulleBekraefte = await bek2.isVisible().catch(() => false)
  if (skulleBekraefte) await bek2.click()
  r.maal.elevRunde2 = {
    skulleBekraefte,
    bordHuskes: await e1.inputValue('#makker-bord'),
    urHuskes: await e1.locator('#segment-skakur [aria-pressed="true"]').getAttribute('data-value'),
    fritHuskes: `${await e1.inputValue('#skakur-frit-min')}+${await e1.inputValue('#skakur-frit-till')}`,
    ur: await tekst(e1, '#skakur'),
    handlinger: skulleBekraefte ? 2 : 1,
  }
  tjek('runde 2 paa elevens pc: "Start forfra" og uret er 4+0 igen', r.maal.elevRunde2.urHuskes === 'frit' && r.maal.elevRunde2.fritHuskes === '4+0', JSON.stringify(r.maal.elevRunde2))
  await e1.reload(); await e1.click('#fane-spil')
  r.maal.elevEfterGenindlaes = { bord: await e1.inputValue('#makker-bord'), ur: await e1.locator('#segment-skakur [aria-pressed="true"]').getAttribute('data-value'), frit: `${await e1.inputValue('#skakur-frit-min')}+${await e1.inputValue('#skakur-frit-till')}` }
  tjek('efter genindlaesning husker pc\'en bord og 4+0', r.maal.elevEfterGenindlaes.bord === '1' && r.maal.elevEfterGenindlaes.ur === 'frit' && r.maal.elevEfterGenindlaes.frit === '4+0', JSON.stringify(r.maal.elevEfterGenindlaes))

  // Runde 2 og 3 hurtigt; laereren skal nulstille og starte rundeuret hver gang.
  for (const [rn, res] of [[2, ['1-0', '0-1', '1/2']], [3, ['0-1', '1-0']]]) {
    let urTryk = 0
    if (await laerer.locator('#tur-rundeur-nulstil').isVisible()) { await laerer.click('#tur-rundeur-nulstil'); urTryk++ }
    await laerer.click('#tur-rundeur-start'); urTryk++
    await L.clock.runFor(9 * 60000 + 1000)
    r.maal[`runde${rn}Indtastning`] = { ...(await rundeResultater(res)), rundeurTryk: urTryk }
    if (rn === 2) await laerer.click('#tur-naeste')
  }
  r.maal.slut = { titel: await tekst(laerer, '#tur-runde-titel'), status: await tekst(laerer, '.tur-status'), naesteKnap: await tekst(laerer, '#tur-naeste') }
  await L.clock.runFor(500)
  await skud(projT, 'S-1280-10-projektor-slut.png')
  await skud(laerer, 'S-1280-11-laerer-slut.png', { fullPage: true })
  // Stillingen alene paa projektoren: hvor mange af de 25 kan ses uden at rulle paa typiske skoleprojektorer?
  const stillingKnap = projT.getByRole('button', { name: 'Stilling', exact: true })
  r.maal.stillingKnapFindes = await stillingKnap.isVisible().catch(() => false)
  if (r.maal.stillingKnapFindes) await stillingKnap.click()
  r.maal.stillingSynlig = {}
  for (const [w, h] of [[1280, 720], [1024, 768], [1280, 800], [1920, 1080]]) {
    await projT.setViewportSize({ width: w, height: h }); await L.clock.runFor(300)
    r.maal.stillingSynlig[`${w}x${h}`] = await projT.evaluate(() => [...document.querySelectorAll('tr')].filter((e) => {
      const b = e.getBoundingClientRect()
      return e.offsetParent && /Elev \d+/.test(e.textContent) && !e.querySelector('button') && b.height > 0 && b.top >= 0 && b.bottom <= innerHeight && document.elementFromPoint(b.left + 5, b.top + b.height / 2)?.closest('tr') === e
    }).length)
    if (w === 1024) await skud(projT, 'S-1024-12-projektor-stilling.png')
  }
  tjek('stillingen: alle 25 kan ses paa projektoren (1024x768 og 1280x720)', r.maal.stillingSynlig['1024x768'] >= 25 && r.maal.stillingSynlig['1280x720'] >= 25, JSON.stringify(r.maal.stillingSynlig))

  r.maal.lagerLaerer = await laerer.evaluate(() => Object.keys(localStorage))
  tjek('ingen JavaScript-fejl', r.sideFejl.length === 0, r.sideFejl.join(' | '))
  tjek('intet netvaerk', r.netvaerk.length === 0, r.netvaerk.join(' | '))
} catch (e) {
  r.fejl = String(e?.stack || e)
  console.error(e)
  process.exitCode = 1
} finally {
  await browser.close()
  writeFileSync(path.join(HER, 'skaktime-483.json'), JSON.stringify(r, null, 2))
}
