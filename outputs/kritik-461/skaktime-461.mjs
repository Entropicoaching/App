// ORDRE 461 blok 2: Marcs skaktime fra RAPPORT-454 med 11 elever (ulige antal).
// Headless Chromium, file://, intet netvaerk. Navnene er kaldenavne (ingen elever).
//   A  timen som den er taenkt: 11 navne, schweizisk, Start, projektoren i eget
//      vindue paa 1920 x 1080, resultater (med en fejltast der rettes), Parr runde
//      N, til turneringen er slut; Stilling alene paa projektoren; Gem stillingen
//      som fil og sikkerhedskopi; Slet navnene - og er de saa vaek alle steder?
//   B  uheld i timen: en elev bliver syg, en kommer for sent, "Parr" trykket for
//      tidligt, et resultat i en tidligere runde rettes, to elever med samme navn,
//      lange navne paa projektoren, knappen "eget vindue".
//   C  parringen i Node: 300 turneringer med 11 elever og tilfaeldige resultater
//      (ingen omkamp, fri runde, farver, pointforskel ved bordene, tid).
//   node outputs/kritik-461/skaktime-461.mjs
// Skriver skaktime-461.json og skaermbilleder b2-*.png.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skakKopi } from './skak-kopi-461.mjs'
import { mulberry32 } from './elev-profiler-461.mjs'

const HER = path.dirname(fileURLToPath(import.meta.url))
const kopi = skakKopi()
const { chromium } = createRequire(path.join(kopi.mappe, 'package.json'))('playwright')
const T = await kopi.importer('src/turnering.js')
const URL = kopi.url('laerer.html')
const NAVNE = ['Løven', 'Tårnet', 'Springeren', 'Dronningen', 'Bonden', 'Løberen', 'Kongen', 'Rokaden', 'Gaflen', 'Spyddet', 'Passanten']
const LANGE = ['Dronningegambitten', 'Springer-på-f3-Kalle', 'Kongeindisk-forsvar', 'Løberparret', 'Siciliansk-Najdorf', 'Bonde', 'Tårn', 'Gaflen', 'Spyddet', 'Remis', 'Mat']

const fejl = []
const tjek = (b, t) => { console.log(`${b ? 'OK  ' : 'FEJL'} ${t}`); if (!b) fejl.push(t) }
const skaerm = (page, navn, opts = {}) => page.screenshot({ path: path.join(HER, navn), ...opts })
const ud = { skakMain: kopi.hash, A: {}, B: {}, C: {}, sidefejl: [], netvaerk: [] }

function vaagt(rng) { const x = rng(); return x < 0.45 ? '1-0' : x < 0.55 ? '1/2' : '0-1' }
async function skrivRunde(page, rng) {
  const raekker = page.locator('.tur-parringer').first().locator('tbody tr')
  const n = await raekker.count()
  const res = []
  for (let b = 0; b < n; b += 1) { const r = vaagt(rng); res.push(r); await raekker.nth(b).locator(`[data-resultat="${r}"]`).click() }
  return res
}
const gemt = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('skak-laerer-turnering-v1')))
async function projMaal(page) {
  return page.evaluate(() => {
    const p = document.getElementById('projektor')
    if (!p || p.hidden || getComputedStyle(p).display === 'none') return { synlig: false }
    const tekster = [...p.querySelectorAll('*')].filter((e) => e.childNodes.length && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && e.getBoundingClientRect().width > 0 && !e.closest('.proj-styring'))
    const px = tekster.map((e) => parseFloat(getComputedStyle(e).fontSize))
    const navneCeller = [...p.querySelectorAll('.proj-par *, .proj-stilling td')].filter((e) => e.children.length === 0 && e.textContent.trim())
    const afskaaret = navneCeller.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim())
    const r = p.getBoundingClientRect()
    const udenfor = [...p.querySelectorAll('.proj-par, .proj-stilling tr')].filter((e) => { const b = e.getBoundingClientRect(); return b.bottom > r.bottom + 1 || b.right > r.right + 1 }).length
    return {
      synlig: true,
      overflowY: p.scrollHeight - p.clientHeight,
      overflowX: p.scrollWidth - p.clientWidth,
      mindstePx: Math.min(...px), stoerstePx: Math.max(...px),
      parPx: parseFloat(getComputedStyle(p.querySelector('.proj-par') ?? p).fontSize),
      stillingPx: parseFloat(getComputedStyle(p.querySelector('.proj-stilling') ?? p).fontSize),
      afskaaret, udenfor,
      tekst: p.innerText,
    }
  })
}

// ---------- C: parringen i Node ----------
{
  const t0 = Date.now()
  const s = { turneringer: 300, omkampe: 0, dobbeltFri: 0, runderUdenFri: 0, friIkkeLavest: 0, treEnsFarver: 0, farveSkaev3: 0, maksFarveSkaev: 0, borde: 0, bordeMedPointforskel: 0, maksPointforskel: 0, maksMsPrRunde: 0, fejl: [] }
  for (let k = 0; k < s.turneringer; k += 1) {
    const rng = mulberry32(4611 + k)
    let t = T.nyTurnering(NAVNE, 'schweizisk')
    try {
      for (let r = 0; r < t.antalRunder; r += 1) {
        const hFoer = T.historik(t)
        const st = T.stilling(t)
        const a = Date.now(); t = T.parrNaesteRunde(t); s.maksMsPrRunde = Math.max(s.maksMsPrRunde, Date.now() - a)
        const runde = t.runder[r]
        if (runde.fri === null || runde.fri === undefined) s.runderUdenFri += 1
        else {
          if (hFoer.get(runde.fri).fri > 0) s.dobbeltFri += 1
          // Den laveste i stillingen, der ikke har haft fri, skal have den.
          const kandidater = st.filter((x) => hFoer.get(x.id).fri === 0)
          const lavestPoint = Math.min(...kandidater.map((x) => x.point))
          if (hFoer.get(runde.fri).point > lavestPoint) s.friIkkeLavest += 1
        }
        for (const p of runde.partier) {
          s.borde += 1
          if (hFoer.get(p.hvid).modstandere.includes(p.sort)) s.omkampe += 1
          const d = Math.abs(hFoer.get(p.hvid).point - hFoer.get(p.sort).point)
          if (d > 0) s.bordeMedPointforskel += 1
          s.maksPointforskel = Math.max(s.maksPointforskel, d)
          t = T.saetResultat(t, r, p.bord, vaagt(rng))
        }
      }
      for (const h of T.historik(t).values()) {
        const f = h.farver.join('')
        if (/hhh|sss/.test(f)) s.treEnsFarver += 1
        const skaev = Math.abs((f.match(/h/g) ?? []).length - (f.match(/s/g) ?? []).length)
        s.maksFarveSkaev = Math.max(s.maksFarveSkaev, skaev)
        if (skaev >= 3) s.farveSkaev3 += 1
      }
    } catch (e) { s.fejl.push(`${k}: ${e.message}`) }
  }
  // Delt foersteplads (lige point OG lige Buchholz) med 3 og 4 runder: kaarer
  // Marc een vinder i timen, eller skal han forklare en deling?
  for (const runder of [3, 4]) {
    let delt = 0, flereMedTop = 0
    for (let k = 0; k < s.turneringer; k += 1) {
      const rng = mulberry32(9461 + k)
      let t = T.nyTurnering(NAVNE, 'schweizisk', runder)
      for (let r = 0; r < runder; r += 1) { t = T.parrNaesteRunde(t); for (const p of t.runder[r].partier) t = T.saetResultat(t, r, p.bord, vaagt(rng)) }
      const st = T.stilling(t)
      if (st.filter((x) => x.plads === 1).length > 1) delt += 1
      if (st.filter((x) => x.point === st[0].point).length > 1) flereMedTop += 1
    }
    s[`deltFoerstePct${runder}`] = Math.round((100 * delt) / s.turneringer)
    s[`lige PointITopPct${runder}`.replace(' ', '')] = Math.round((100 * flereMedTop) / s.turneringer)
  }
  s.sekunder = Math.round((Date.now() - t0) / 1000)
  s.standardRunder11 = T.standardAntalRunder(11)
  ud.C = s
  console.log('C:', JSON.stringify(s))
  tjek(s.fejl.length === 0 && s.omkampe === 0, `C: 300 turneringer med 11 elever uden omkamp og uden fejl (${s.fejl.slice(0, 2).join(' | ')})`)
  tjek(s.dobbeltFri === 0 && s.runderUdenFri === 0, 'C: hver runde har een fri runde, og ingen faar to')
  tjek(s.treEnsFarver === 0, `C: ingen faar tre ens farver i traek (${s.treEnsFarver})`)
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })
  ctx.on('page', (p) => {
    p.on('pageerror', (e) => ud.sidefejl.push(e.message))
    p.on('request', (r) => { if (!/^(file|data|blob):/.test(r.url())) ud.netvaerk.push(r.url()) })
  })
  const page = await ctx.newPage()
  await page.goto(URL)
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.reload()

  // ---------- A: timen ----------
  const A = ud.A
  const rng = mulberry32(461)
  A.turneringFoerst = await page.locator('#fane-turnering').getAttribute('aria-selected') === 'true' || await page.isVisible('#tur-navne')
  // Marc indsaetter navnene fra en liste: en tom linje og mellemrum til sidst.
  await page.fill('#tur-navne', [...NAVNE.slice(0, 6), '', ...NAVNE.slice(6).map((n) => `${n}  `)].join('\n'))
  A.optaelling = (await page.locator('.tur-opret').innerText()).match(/\d+ spillere[^\n]*/)?.[0] ?? ''
  tjek(/^11 spillere, 4 runder, én sidder over/.test(A.optaelling), `A: optaelling "${A.optaelling}"`)
  await skaerm(page, 'b2-1280-opret.png', { fullPage: true })
  await page.click('#tur-start')
  tjek((await page.innerText('#tur-runde-titel')) === 'Runde 1 af 4', 'A: runde 1 af 4 er parret')
  const t1 = await gemt(page)
  A.navneRenset = t1.spillere.map((s) => s.navn).join(',') === NAVNE.join(',')
  tjek(A.navneRenset, 'A: tom linje og mellemrum er renset vaek (11 navne)')
  tjek(t1.runder[0].partier.length === 5 && t1.spillere[t1.runder[0].fri].navn === 'Passanten', `A: 5 borde og fri runde til den nederste (${t1.spillere[t1.runder[0].fri]?.navn})`)

  // Projektoren i eget vindue via knappen (som Marc goer det).
  const [proj] = await Promise.all([ctx.waitForEvent('page'), page.click('#tur-projektor-vindue')])
  await proj.setViewportSize({ width: 1920, height: 1080 })
  await proj.waitForLoadState()
  await proj.waitForTimeout(400)
  A.egetVinduePopup = /#projektor$/.test(proj.url())
  let m = await projMaal(proj)
  A.projRunde1 = { ...m, tekst: undefined }
  tjek(A.egetVinduePopup && m.synlig, 'A: "Aabn projektorvisningen i eget vindue" aabner laerer.html#projektor')
  tjek(m.overflowY <= 0 && m.overflowX <= 0 && m.udenfor === 0, `A: 1920 x 1080 runde 1 uden at rulle (y ${m.overflowY}, x ${m.overflowX})`)
  tjek(m.afskaaret.length === 0, `A: ingen navne skaaret af paa projektoren (${m.afskaaret.join(', ')})`)
  await skaerm(proj, 'b2-1920-projektor-runde1.png')

  // Runde 1: en fejltast (bord 2 forkert), rettes; et tryk igen fjerner.
  const raekke = (b) => page.locator('.tur-parringer').first().locator('tbody tr').nth(b)
  await raekke(1).locator('[data-resultat="1-0"]').click()
  await raekke(1).locator('[data-resultat="0-1"]').click()
  A.retTilAndet = (await gemt(page)).runder[0].partier[1].resultat === '0-1'
  await raekke(1).locator('[data-resultat="0-1"]').click()
  A.tryktIgenFjerner = (await gemt(page)).runder[0].partier[1].resultat === null
  tjek(A.retTilAndet && A.tryktIgenFjerner, 'A: et andet resultat erstatter det forkerte, og samme knap igen fjerner det')
  A.runde1 = await skrivRunde(page, rng)
  await proj.waitForTimeout(500)
  const projTekst = (await projMaal(proj)).tekst
  A.projFoelgerMed = A.runde1.every((r) => projTekst.includes(r === '1/2' ? '½-½' : r))
  tjek(A.projFoelgerMed, 'A: projektorvinduet viser resultaterne med det samme')
  A.statusEfterRunde = await page.innerText('.tur-status')
  tjek(!(await page.isDisabled('#tur-naeste')), 'A: "Parr runde 2" kan trykkes, naar alle resultater er skrevet')

  for (let r = 2; r <= 4; r += 1) {
    const a = Date.now()
    await page.click('#tur-naeste')
    A[`msParr${r}`] = Date.now() - a
    tjek((await page.innerText('#tur-runde-titel')) === `Runde ${r} af 4`, `A: runde ${r} af 4 er parret (${A[`msParr${r}`]} ms)`)
    await proj.waitForTimeout(400)
    m = await projMaal(proj)
    A[`projRunde${r}`] = { ...m, tekst: undefined }
    tjek(m.synlig && m.overflowY <= 0 && m.udenfor === 0 && new RegExp(`Runde ${r} af 4`).test(m.tekst), `A: projektoren foelger med til runde ${r} og ruller ikke`)
    if (r === 2) await skaerm(proj, 'b2-1920-projektor-runde2.png')
    A[`runde${r}`] = await skrivRunde(page, rng)
  }
  const tSlut = await gemt(page)
  A.slutStatus = await page.innerText('.tur-status')
  tjek(/Turneringen er slut\. Vinder: /.test(A.slutStatus), `A: "${A.slutStatus}"`)
  // Parringens kvalitet i timen.
  const h = T.historik(tSlut)
  A.fri = tSlut.runder.map((r) => tSlut.spillere[r.fri].navn)
  A.friUnikke = new Set(A.fri).size === 4
  A.farver = [...h.values()].map((x) => x.farver.join(''))
  A.omkampe = tSlut.runder.flatMap((r, i) => r.partier.filter((p) => tSlut.runder.slice(0, i).some((q) => q.partier.some((x) => (x.hvid === p.hvid && x.sort === p.sort) || (x.hvid === p.sort && x.sort === p.hvid))))).length
  tjek(A.friUnikke && A.omkampe === 0, `A: fire forskellige fri runder (${A.fri.join(', ')}) og ingen omkamp`)
  A.stilling = T.stilling(tSlut).map((r) => ({ plads: r.plads, point: r.point, buchholz: r.buchholz }))
  A.deltePladser = A.stilling.filter((r, i, a) => a.some((x, j) => j !== i && x.plads === r.plads)).length
  await skaerm(page, 'b2-1280-laerer-slut.png', { fullPage: true })
  A.laererSidelaens = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  tjek(A.laererSidelaens <= 1, `A: laerersiden paa 1280 ruller ikke sidelaens (${A.laererSidelaens})`)

  // Stilling alene paa projektoren, vinderen med krone.
  await proj.locator('#projektor [data-visning="stilling"]').click()
  await proj.waitForTimeout(300)
  m = await projMaal(proj)
  A.projStilling = { ...m, tekst: undefined }
  // Kronen er CSS (::after), saa den taelles paa klassen, ikke i teksten.
  A.vinderKrone = await proj.locator('#projektor tr.proj-vinder').count()
  tjek(m.overflowY <= 0 && A.vinderKrone, `A: Stilling alene, vinderen med krone, uden at rulle (${m.stillingPx} px)`)
  for (const tema of ['trae', 'nat']) {
    await proj.locator(`#projektor [data-tema="${tema}"]`).click()
    await skaerm(proj, `b2-1920-projektor-stilling-${tema}.png`)
  }
  await proj.locator('#projektor [data-visning="begge"]').click()
  await proj.waitForTimeout(300)
  m = await projMaal(proj)
  A.projBeggeSlut = { ...m, tekst: undefined }
  await skaerm(proj, 'b2-1920-projektor-slut-begge.png')

  // Gem stillingen som fil og sikkerhedskopi.
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#tur-eksport')])
  const csvTekst = readFileSync(await csv.path(), 'utf8')
  A.csvNavn = csv.suggestedFilename()
  A.csvBom = csvTekst.charCodeAt(0) === 0xfeff
  A.csvLinjer = csvTekst.split(/\r?\n/).filter((l) => l.trim()).length
  A.csvAlleNavne = NAVNE.every((n) => csvTekst.includes(n))
  A.csvFri = (csvTekst.match(/Fri runde;/g) ?? []).length
  tjek(/\.csv$/.test(A.csvNavn) && A.csvBom && A.csvAlleNavne && A.csvFri === 4, `A: CSV (${A.csvNavn}, BOM ${A.csvBom}, ${A.csvLinjer} linjer, 4 fri runder)`)
  const [kopiFil] = await Promise.all([page.waitForEvent('download'), page.click('#tur-sikkerhed')])
  const kopiSti = await kopiFil.path()
  A.sikkerhedskopiOk = JSON.parse(readFileSync(kopiSti, 'utf8')).runder.length === 4

  // Slet navnene: er de vaek alle steder?
  await page.click('#tur-slet')
  await proj.waitForTimeout(500)
  const efterSlet = await page.evaluate(() => ({
    ls: Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])),
    ss: Object.keys(sessionStorage).length,
    tekst: document.body.innerText,
  }))
  A.sletNoegler = Object.keys(efterSlet.ls)
  A.sletNavnIStorage = NAVNE.filter((n) => Object.values(efterSlet.ls).some((v) => v.includes(n)))
  A.sletNavnPaaSiden = NAVNE.filter((n) => efterSlet.tekst.includes(n))
  const projEfterSlet = await proj.evaluate(() => document.body.innerText)
  A.sletNavnPaaProjektor = NAVNE.filter((n) => projEfterSlet.includes(n))
  tjek(A.sletNavnIStorage.length === 0, `A: efter Slet er ingen navne i browserens lager (noegler: ${A.sletNoegler.join(', ')})`)
  tjek(A.sletNavnPaaSiden.length === 0, `A: efter Slet staar ingen navne paa laerersiden (${A.sletNavnPaaSiden.join(', ')})`)
  tjek(A.sletNavnPaaProjektor.length === 0, `A: efter Slet staar ingen navne paa projektoren (${A.sletNavnPaaProjektor.join(', ')})`)
  A.fortrydSletSynlig = await page.isVisible('#tur-fortryd-slet')
  await page.reload()
  A.efterGenindlaesFortryd = await page.isVisible('#tur-fortryd-slet')
  const efterReload = await page.evaluate(() => document.body.innerText + JSON.stringify(localStorage))
  A.efterGenindlaesNavne = NAVNE.filter((n) => efterReload.includes(n))
  tjek(A.efterGenindlaesNavne.length === 0, 'A: efter Slet og genindlaesning er navnene vaek')
  await skaerm(page, 'b2-1280-efter-slet.png')
  await proj.close()

  // ---------- B: uheld i timen ----------
  const B = ud.B
  const rngB = mulberry32(4612)
  // B1: to elever med samme navn.
  await page.fill('#tur-navne', ['Bonden', 'Tårnet', 'Bonden', 'Løven', 'Gaflen'].join('\n'))
  await page.click('#tur-start')
  const tDub = await gemt(page)
  B.dubletAccepteret = Boolean(tDub) && tDub.spillere.length === 5
  B.dubletAdvarsel = (await page.locator('.tur-besked').allInnerTexts()).join(' ')
  B.dubletSkelnes = tDub ? new Set(tDub.spillere.map((s) => s.navn)).size === tDub.spillere.length : null
  await page.click('#tur-slet')
  // B2: lange navne paa projektoren (11 elever, 1920).
  await page.fill('#tur-navne', LANGE.join('\n'))
  await page.click('#tur-start')
  await page.click('#tur-projektor')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.waitForTimeout(400)
  m = await projMaal(page)
  B.langeNavne = { ...m, tekst: undefined }
  await skaerm(page, 'b2-1920-projektor-lange-navne.png')
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.click('#tur-slet')
  // B3: syg elev, sen elev, Parr for tidligt, ret et gammelt resultat.
  await page.fill('#tur-navne', NAVNE.join('\n'))
  await page.click('#tur-start')
  await skrivRunde(page, rngB)
  // Syg foer runde 2: fjern fluebenet ved "Kongen".
  await page.locator('summary', { hasText: 'Spillere' }).click()
  await page.locator('.tur-spillere li', { hasText: 'Kongen' }).locator('input').uncheck()
  await page.click('#tur-naeste')
  let tB = await gemt(page)
  const kongen = tB.spillere.find((s) => s.navn === 'Kongen').id
  B.sygIkkeParret = !tB.runder[1].partier.some((p) => p.hvid === kongen || p.sort === kongen) && tB.runder[1].fri !== kongen
  B.sygRunde2Borde = tB.runder[1].partier.length
  B.sygRunde2Fri = tB.runder[1].fri === null ? null : tB.spillere[tB.runder[1].fri].navn
  tjek(B.sygIkkeParret && B.sygRunde2Borde === 5 && B.sygRunde2Fri === null, `B: syg elev parres ikke; 10 elever = 5 borde uden fri runde (${B.sygRunde2Borde}, fri ${B.sygRunde2Fri})`)
  // "Parr" for tidligt: knappen er laast; Marc parrer efter runden og fortryder saa.
  B.parrLaastUdenResultater = await page.isDisabled('#tur-naeste')
  await skrivRunde(page, rngB)
  await page.click('#tur-naeste')
  B.fortrydKnap = await page.isVisible('button:has-text("Fortryd parringen af runde 3")')
  if (B.fortrydKnap) await page.click('button:has-text("Fortryd parringen af runde 3")')
  B.fortrydVirker = (await page.innerText('#tur-runde-titel')) === 'Runde 2 af 4'
  tjek(B.parrLaastUdenResultater && B.fortrydKnap && B.fortrydVirker, 'B: Parr er laast uden resultater, og "Fortryd parringen af runde 3" virker')
  // Sen elev + den syge er tilbage: 12 elever i runde 3.
  if (!(await page.isVisible('.tur-spillere'))) await page.locator('summary', { hasText: 'Spillere' }).click()
  await page.locator('.tur-spillere li', { hasText: 'Kongen' }).locator('input').check()
  await page.fill('.tur-nyt-navn', 'Nykommeren')
  await page.click('button:has-text("Tilføj spiller")')
  B.senBesked = (await page.locator('.tur-besked').allInnerTexts()).join(' ')
  await page.click('#tur-naeste')
  tB = await gemt(page)
  const ny = tB.spillere.find((s) => s.navn === 'Nykommeren').id
  B.senParret = tB.runder[2].partier.some((p) => p.hvid === ny || p.sort === ny)
  B.runde3Borde = tB.runder[2].partier.length
  tjek(B.senParret && B.runde3Borde === 6, `B: sen elev og den raske er med i runde 3 (6 borde: ${B.runde3Borde})`)
  // Ret et resultat i runde 1: stillingen regnes om.
  const foer = T.stilling(tB).map((r) => `${r.id}:${r.point}`).join(',')
  await page.locator('summary', { hasText: 'Runde 1 (ret et resultat)' }).click()
  const r1 = page.locator('details:has(summary:has-text("Runde 1 (ret et resultat)")) .tur-parringer tbody tr').first()
  const gammel = tB.runder[0].partier[0].resultat
  const nytRes = gammel === '1-0' ? '0-1' : '1-0'
  await r1.locator(`[data-resultat="${nytRes}"]`).click()
  tB = await gemt(page)
  B.retGammelt = tB.runder[0].partier[0].resultat === nytRes && T.stilling(tB).map((r) => `${r.id}:${r.point}`).join(',') !== foer
  tjek(B.retGammelt, 'B: et resultat i runde 1 kan rettes, og stillingen regnes om')
  B.senStilling = T.stilling(tB).find((r) => r.navn === 'Nykommeren')
  B.sygStilling = T.stilling(tB).find((r) => r.navn === 'Kongen')
  await skaerm(page, 'b2-1280-uheld.png', { fullPage: true })
  await page.click('#tur-slet')
  B.sidefejl = ud.sidefejl.length
} finally {
  await browser.close()
}
tjek(ud.sidefejl.length === 0, `ingen JavaScript-fejl (${ud.sidefejl.join(' | ')})`)
tjek(ud.netvaerk.length === 0, `intet netvaerk (${ud.netvaerk.slice(0, 3).join(' ')})`)
ud.fejl = fejl
writeFileSync(path.join(HER, 'skaktime-461.json'), JSON.stringify(ud, null, 1))
console.log(fejl.length ? `\n${fejl.length} tjek fejlede (fund, ikke scriptfejl)` : '\nAlle tjek OK')
