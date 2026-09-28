// Kritik 645, blok 2: START-HER-MARC.html (Setu 633) som Marc ser den. Kun laest, aabnet som file:// i Google Chrome
// headless, 390 touch og 1280 mus, alt net afbrudt.
// 1) Siden selv: kort, links, svar-linjer, hvor langt nede hvert link staar, skaermbilleder.
// 2) Hvert link foelges i samme fane: findes filen, aabner den, titel, tid til load, JS-fejl.
// 3) Svar-linjerne holdt op mod LAES-siden, de peger paa: staar samme linje der (ordret eller som skabelon)?
// 4) Det, Marc ledte efter: artiklen i LAES-SQUAT (hvor langt nede), vaerktoejet i LAES-VAERKTOEJER (kan det aabnes?),
//    Instagram-billederne i LAES-INSTAGRAM og -2 (hvor langt nede er foerste slide).
//   node outputs/kritik-645/start-645.mjs   -> start-645.json og H-645-*.png
import path, { join } from 'node:path'
import { writeFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '../../e2e/harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DESK = 'C:/Users/Entropi/Desktop'
const START = join(DESK, 'START-HER-MARC.html')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 700) : ''}`) }
const ud = { sider: [], links: [], svar: [], leder: {} }
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
const eksterne = new Set()
const ny = async (bredde) => {
  const mobil = bredde < 600
  const ctx = await browser.newContext({ viewport: { width: bredde, height: mobil ? 780 : 900 }, deviceScaleFactor: mobil ? 3 : 1, isMobile: mobil, hasTouch: mobil })
  const page = await ctx.newPage()
  const fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith('file:') || /^(data|blob):/.test(u)) return r.continue(); eksterne.add(u.split('?')[0]); return r.abort() })
  return { ctx, page, fejl, hoejde: mobil ? 780 : 900 }
}

// --- 1) Siden selv ----------------------------------------------------------------------------------------------
for (const bredde of [390, 1280]) {
  const T = await ny(bredde)
  await T.page.goto(pathToFileURL(START).href, { waitUntil: 'load' })
  await T.page.waitForTimeout(300)
  const v = await T.page.evaluate(() => {
    const kort = [...document.querySelectorAll('article, section, .kort, [data-kort]')].filter((k) => k.querySelector('a[href]'))
    const y = (el) => Math.round(el.getBoundingClientRect().top + scrollY)
    return {
      titel: document.title, hoejde: document.documentElement.scrollHeight, sidelaens: document.documentElement.scrollWidth > innerWidth + 1,
      kort: kort.map((k) => ({ overskrift: (k.querySelector('h2, h3')?.textContent || '').replace(/\s+/g, ' ').trim(), y: y(k), links: [...k.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href'), tekst: a.textContent.replace(/\s+/g, ' ').trim(), y: y(a), target: a.getAttribute('target') })), svar: [...k.querySelectorAll('code, .linje, [data-kopi], .svar')].map((c) => c.textContent.replace(/\s+/g, ' ').replace(/Kopiér$/, '').trim()).filter((t, i, a) => t.length > 2 && a.indexOf(t) === i) })),
      alleLinks: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
      knapper: [...document.querySelectorAll('button')].map((b) => b.textContent.trim()),
      forsteSkaerm: document.body.innerText.slice(0, 400),
      instagram712IkkeJa: /7-12: ikke ja endnu/.test(document.body.innerText.replace(/\s+/g, ' ')),
      naevnerKritik: [...new Set((document.body.innerText.replace(/\s+/g, ' ').match(/kritik(ker)? [\d, og]+/g) || []).flatMap((m) => m.match(/\d{3}/g)).map((n) => 'kritik ' + n))],
      ordPaaSiden: { artikel: /artik/i.test(document.body.innerText), vaerktoej: /værktøj/i.test(document.body.innerText), instagram: /instagram/i.test(document.body.innerText), ikkeOnline: /(ikke (på|ude på) (sitet|entropicoaching)|ikke udgivet|ikke online|kun her)/i.test(document.body.innerText), entropicoachingDk: /entropicoaching\.dk/.test(document.body.innerText) },
    }
  })
  await T.page.screenshot({ path: join(HERE, `H-645-${bredde}-top.png`) })
  await T.page.screenshot({ path: join(HERE, `H-645-${bredde}-hele.png`), fullPage: true })
  ud.sider.push({ bredde, ...v, jsFejl: T.fejl, skaerme: +(v.hoejde / T.hoejde).toFixed(1) })
  await T.ctx.close()
}
const s390 = ud.sider[0]
paastaa('START-HER-MARC: 7 kort med link, 0 JS-fejl og ingen sidelaens rulning paa 390 og 1280', ud.sider.every((s) => s.kort.length === 7 && !s.jsFejl.length && !s.sidelaens), ud.sider.map((s) => ({ b: s.bredde, kort: s.kort.length, skaerme: s.skaerme, hoejde: s.hoejde })))
ud.kort = s390.kort.map((k) => ({ overskrift: k.overskrift, y390: k.y, links: k.links, svar: k.svar }))

// --- 2) Hvert link --------------------------------------------------------------------------------------------------
const hrefs = [...new Set(s390.alleLinks)]
for (const href of hrefs) {
  const fil = join(DESK, decodeURIComponent(href))
  const l = { href, findes: existsSync(fil), mb: existsSync(fil) ? +(statSync(fil).size / 1e6).toFixed(2) : null, relativ: !/^[a-z]+:/i.test(href) }
  for (const bredde of [390, 1280]) {
    const T = await ny(bredde)
    await T.page.goto(pathToFileURL(START).href, { waitUntil: 'load' })
    const t0 = Date.now()
    await Promise.all([T.page.waitForEvent('load', { timeout: 30000 }).catch(() => null), T.page.locator(`a[href="${href}"]`).first().click()])
    l[`ms${bredde}`] = Date.now() - t0
    const info = await T.page.evaluate(() => ({ url: location.href, titel: document.title, billeder: document.images.length, brudte: [...document.images].filter((i) => i.complete && !i.naturalWidth).length, tekstLaengde: document.body.innerText.length }))
    l[`s${bredde}`] = { ...info, jsFejl: T.fejl }
    await T.ctx.close()
  }
  ud.links.push(l)
}
paastaa('alle links er relative, filen findes paa skrivebordet, og et tryk aabner den (titel, 0 brudte billeder, 0 JS-fejl) paa 390 og 1280', ud.links.every((l) => l.relativ && l.findes && [390, 1280].every((b) => l[`s${b}`].url.endsWith(l.href) && l[`s${b}`].titel && !l[`s${b}`].brudte && !l[`s${b}`].jsFejl.length)), ud.links.map((l) => `${l.href} ${l.mb} MB, ${l.ms390}/${l.ms1280} ms, "${l.s390.titel}"`))

// --- 3) Svar-linjerne mod LAES-siderne --------------------------------------------------------------------------------
const T = await ny(1280)
const tekstAf = async (href) => { await T.page.goto(pathToFileURL(join(DESK, href)).href, { waitUntil: 'load' }); return T.page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ')) }
const laes = {}
for (const href of hrefs) laes[href] = await tekstAf(href)
const norm = (x) => x.replace(/\s+/g, ' ').replace(/[<>]/g, '').trim().toLowerCase()
for (const k of ud.kort) for (const s of k.svar) {
  const kilder = k.links.map((l) => l.href)
  const ordret = kilder.some((h) => norm(laes[h]).includes(norm(s)))
  const stamme = s.split(/[:\s]/).slice(0, 2).join(' ')
  const skabelon = kilder.some((h) => norm(laes[h]).includes(norm(stamme)))
  ud.svar.push({ kort: k.overskrift, linje: s, ordret, skabelon, kilder })
}
ud.kunPaaStart = ud.svar.filter((x) => !x.ordret && !x.skabelon).map((x) => x.linje)
paastaa('svar-linjer, der hverken ordret eller som skabelon staar paa LAES-siden, kortet linker til: praecis klar til app, film klip lagt og M14 halvdelen (fund H3)', ud.kunPaaStart.join('|') === 'klar til app|film klip lagt: 1 2 3 4 5|M14 halvdelen', ud.kunPaaStart)
ud.svarKunPaaStart = ud.svar.filter((x) => !x.ordret).map((x) => ({ kort: x.kort, linje: x.linje, skabelon: x.skabelon }))
// Setus dommene paa kortene mod Bhishaks seneste (645 ligger efter 633).
ud.domme = { instagram712IkkeJa: s390.instagram712IkkeJa, naevnerKritik: s390.naevnerKritik }
paastaa('kortene naevner kritik 464, 622, 631, 632 og 639 og siger 7-12 ikke ja endnu (645 er efter siden; fund H4)', s390.instagram712IkkeJa && !s390.naevnerKritik.includes('kritik 645') && ['464', '622', '631', '632', '639'].every((n) => s390.naevnerKritik.includes('kritik ' + n)), ud.domme)
// Matematik: siden, kortet linker til, beder om M2/N1-svar, som kortet siger ikke skal gives.
ud.matematik = { beder: /matematik: M2 \?, N1 \?/.test(laes['MARCS-VALG-MATEMATIK.html'] || ''), ingenRegel: /Ingen regel er ændret, før du har svaret/.test(laes['MARCS-VALG-MATEMATIK.html'] || ''), m14: /M14/.test(laes['MARCS-VALG-MATEMATIK.html'] || '') }
// Squat: LAES-SQUAT's egne svarformer.
const sq = laes['LAES-SQUAT.html'] || ''
ud.squat = { udgivForslag: /squat udgiv forslag/.test(sq), udgivMen: /squat udgiv, men/.test(sq), vent: /squat vent:/.test(sq), udgivDato: /squat udgiv \d/.test(sq), kapitel6: /squat kapitel 6: ny/.test(sq), datoErValg3: /3 Datoen U8/.test(sq) }
paastaa('squat: START-HER-linjen "squat udgiv 28. sep 2026" er ikke en form paa LAES-SQUAT; den har squat udgiv forslag / udgiv, men / vent, og datoen er valg 3 (fund H2)', !ud.squat.udgivDato && ud.squat.udgivForslag && ud.squat.udgivMen && ud.squat.vent && ud.squat.datoErValg3, ud.squat)
paastaa('matematik: MARCS-VALG-MATEMATIK beder om "matematik: M2 ?, N1 ?" og naevner ikke M14 (fund H5)', ud.matematik.beder && !ud.matematik.m14, ud.matematik)
await T.ctx.close()

// --- 4) Det, Marc ledte efter -----------------------------------------------------------------------------------------
for (const bredde of [390, 1280]) {
  const P = await ny(bredde)
  const r = {}
  await P.page.goto(pathToFileURL(join(DESK, 'LAES-SQUAT.html')).href, { waitUntil: 'load' })
  r.squat = await P.page.evaluate(() => {
    const h = [...document.querySelectorAll('h1, h2, h3')].find((x) => /Hele artiklen/.test(x.textContent))
    const y = h ? Math.round(h.getBoundingClientRect().top + scrollY) : null
    const toc = [...document.querySelectorAll('a[href^="#"]')].find((a) => /Hele artiklen/.test(a.textContent))
    return { overskrift: h?.textContent.trim() || null, y, hoejde: document.documentElement.scrollHeight, andel: y ? +(y / document.documentElement.scrollHeight).toFixed(2) : null, genvejYderst: toc ? Math.round(toc.getBoundingClientRect().top + scrollY) : null }
  })
  r.squat.skaerme = r.squat.y ? +(r.squat.y / P.hoejde).toFixed(1) : null
  await P.page.goto(pathToFileURL(join(DESK, 'LAES-VAERKTOEJER.html')).href, { waitUntil: 'load' })
  r.vaerktoej = await P.page.evaluate(() => ({ links: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => !h.startsWith('#')), iframes: document.querySelectorAll('iframe').length, billeder: document.images.length, adresseSomTekst: (document.body.innerText.match(/entropicoaching\.dk\/[^\s)]*/g) || []).slice(0, 5), knapper: document.querySelectorAll('button, input').length }))
  for (const f of ['LAES-INSTAGRAM.html', 'LAES-INSTAGRAM-2.html']) {
    await P.page.goto(pathToFileURL(join(DESK, f)).href, { waitUntil: 'load' })
    r[f] = await P.page.evaluate(() => { const i = document.images[0]; const y = i ? Math.round(i.getBoundingClientRect().top + scrollY) : null; return { billeder: document.images.length, foersteY: y, hoejde: document.documentElement.scrollHeight } })
    r[f].skaermeTilFoerste = r[f].foersteY !== null ? +(r[f].foersteY / P.hoejde).toFixed(1) : null
  }
  if (bredde === 390) { await P.page.goto(pathToFileURL(join(DESK, 'LAES-SQUAT.html')).href, { waitUntil: 'load' }); await P.page.screenshot({ path: join(HERE, 'H-645-390-laes-squat-top.png') }) }
  ud.leder[bredde] = r
  await P.ctx.close()
}
paastaa('LAES-SQUAT har "Hele artiklen, som den ville blive udgivet" (oplysning: hvor langt nede)', ud.leder[390].squat.y !== null, { 390: ud.leder[390].squat, 1280: ud.leder[1280].squat })
paastaa('LAES-VAERKTOEJER (oplysning): links til vaerktoejet, iframes og adresser som tekst', true, ud.leder[390].vaerktoej)
paastaa('LAES-INSTAGRAM og -2: slides indlejret (oplysning: skaerme til foerste slide paa 390)', ud.leder[390]['LAES-INSTAGRAM.html'].billeder > 0 && ud.leder[390]['LAES-INSTAGRAM-2.html'].billeder === 20, { i1: ud.leder[390]['LAES-INSTAGRAM.html'], i2: ud.leder[390]['LAES-INSTAGRAM-2.html'] })
paastaa('0 kald ud af huset fra START-HER og LAES-siderne (alle afbrudt)', true, [...eksterne])
await browser.close()
ud.eksterne = [...eksterne]
ud.tjek = tjek
writeFileSync(join(HERE, 'start-645.json'), JSON.stringify(ud, null, 1))
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length}`)
