// ORDRE 461 blok 1d: hvad ser en elev, der aabner skak.html og trykker Spil?
// Frisk profil (tom localStorage), 390 og 1280 px, file://. Maaler stillingen paa
// braettet, hvilken modstander der ser valgt ud, og hvad der sker ved Mod computeren
// og ved foerste traek, hvis eleven ikke trykker "Start forfra".
//   node outputs/kritik-461/spil-start-461.mjs   -> spil-start-461.json + b1-*-spil-start*.png
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { skakKopi } from './skak-kopi-461.mjs'

const HER = path.dirname(fileURLToPath(import.meta.url))
const kopi = skakKopi()
const { chromium } = createRequire(path.join(kopi.mappe, 'package.json'))('playwright')
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w'
const ud = { skakMain: kopi.hash, bredder: {} }
const browser = await chromium.launch()
try {
  for (const [b, h] of [[390, 844], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: b, height: h } })
    const page = await ctx.newPage()
    await page.goto(kopi.url('skak.html'))
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    const r = {}
    r.startFane = await page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"], .fane[aria-selected="true"]')?.textContent.trim() ?? null)
    await page.click('#fane-spil')
    await page.waitForTimeout(300)
    const laes = () => page.evaluate(() => ({
      fen: document.getElementById('fen-tekst').value,
      modusValgt: document.querySelector('#segment-spil-modus [aria-pressed="true"]')?.dataset.value ?? null,
      niveauerSynlige: !document.getElementById('modstander-valg').hidden,
      status: document.getElementById('status')?.textContent.trim(),
    }))
    r.efterSpil = await laes()
    await page.screenshot({ path: path.join(HER, `b1-${b}-spil-start.png`) })
    await page.click('#segment-spil-modus [data-value="computer"]')
    await page.waitForTimeout(300)
    r.efterModComputeren = await laes()
    await page.screenshot({ path: path.join(HER, `b1-${b}-spil-start-computer.png`) })
    r.startstilling = r.efterModComputeren.fen.startsWith(START)
    // Eleven trykker ikke "Start forfra" men proever et traek: hvad sker der?
    r.hvemITraek = r.efterModComputeren.fen.split(' ')[1]
    await page.click('#knap-spil-forfra')
    r.forfraBeder = await page.isVisible('#knap-spil-forfra-bekraeft')
    if (r.forfraBeder) await page.click('#knap-spil-forfra-bekraeft')
    await page.waitForTimeout(200)
    r.efterForfra = await laes()
    // Efter partiet: "Traen ..." og tilbage til Spil. Staar partiet der stadig?
    // Et kort makkerparti (narremat: f3 e5 g4 Dh4#) giver vendepunkter paa et oejeblik.
    await page.click('#segment-spil-modus [data-value="makker"]')
    await page.click('#knap-spil-forfra')
    if (await page.isVisible('#knap-spil-forfra-bekraeft')) await page.click('#knap-spil-forfra-bekraeft')
    for (const [f, t] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) {
      await page.click(`#braet .felt[data-square="${f}"]`)
      await page.click(`#braet .felt[data-square="${t}"]`)
    }
    await page.waitForFunction(() => !document.getElementById('vendepunkt-indhold').hidden, null, { timeout: 20000 })
    const foer = await page.evaluate(() => ({ fen: document.getElementById('fen-tekst').value, traek: document.querySelectorAll('#traekliste li').length, knap: document.getElementById('knap-vendepunkt-traen').textContent }))
    await page.click('#knap-vendepunkt-traen')
    await page.waitForTimeout(400)
    await page.click('#fane-spil')
    await page.waitForTimeout(400)
    const efter = await page.evaluate(() => ({ fen: document.getElementById('fen-tekst').value, traek: document.querySelectorAll('#traekliste li').length, vendepunkter: !document.getElementById('vendepunkt-indhold').hidden }))
    r.traenOgTilbage = { foer, efter, partietStaar: foer.fen === efter.fen && foer.traek === efter.traek }
    await page.screenshot({ path: path.join(HER, `b1-${b}-tilbage-fra-bibliotek.png`) })
    ud.bredder[b] = r
    console.log(b, JSON.stringify(r))
    await ctx.close()
  }
} finally {
  await browser.close()
}
writeFileSync(path.join(HER, 'spil-start-461.json'), JSON.stringify(ud, null, 1))
