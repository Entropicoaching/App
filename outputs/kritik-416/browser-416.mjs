// Ordre 416, blok 2 i browseren (headless Chromium, 390 x 844, touch, 2x).
// Koerer mod en KOPI af matematik (git archive af matematik/main).
//
// Brug: node outputs/kritik-416/browser-416.mjs <matematik-kopi>
// Skriver outputs/kritik-416/browser-416.json og Q-*.png.
//
//  A. Belønningerne: en landsby med alle 14 quests klaret (tilstanden sat
//     direkte, som i 413's eget script). Hver ting paa kortet maales (stoerrelse
//     i px paa 390) og tjekkes for om noget ligger ovenpaa den (elementFromPoint).
//     Titlerne og figurens pynt i hovedet.
//  B. Gaette-eleven: en ny figur, der ALDRIG regner. Hun proever knapperne i
//     raekkefoelge (foerst den oeverste) og trykker paa alle "!" hun kan finde.
//     Naar Landsbygaden er aaben, gaar hun derhen (dens forloeb kraever ikke
//     mestring). Hvor langt naar hun paa 150 opgaver?
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const mat = path.resolve(process.argv[2] ?? '')
const her = path.dirname(fileURLToPath(import.meta.url))
const kraev = createRequire(path.join(mat, 'package.json'))
const { chromium } = kraev('playwright')
const bog = await import(pathToFileURL(path.join(mat, 'src/questbog.js')).href)
const URL_SPIL = pathToFileURL(path.join(mat, 'spil.html')).href
const ud = {}
const browser = await chromium.launch()
const nyKontekst = () => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: 'light' })

function tilstand({ forloeb = {}, niveau = 2, erfaring = 40, questbog = { klaret: [], hoved: null }, sted = 'moellen' }) {
  const n = { moellen: 8, stenbrud: 6, marked: 6, landsby: 6, havn: 5 }
  const questFremdrift = Object.fromEntries(Object.entries(n).map(([id, k]) => [id, Array.from({ length: k }, (_, i) => i < (forloeb[id] ?? 0))]))
  return { figur: { navn: 'Ravn', udseendeId: 'lilla', niveau, erfaring, hoved: 1, haand: 1, hjerte: 1 }, sted, questFremdrift, questbog }
}

// --- A. belønningerne -------------------------------------------------------
{
  const ctx = await nyKontekst()
  const page = await ctx.newPage()
  const fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  await page.goto(URL_SPIL)
  const alle = bog.BOG_QUESTS.map((q) => q.id)
  await page.evaluate((t) => localStorage.setItem('ganita:spil', JSON.stringify(t)), tilstand({
    forloeb: { moellen: 8, stenbrud: 6, marked: 6, landsby: 6, havn: 5 }, niveau: 9, erfaring: 560, questbog: { klaret: alle, hoved: 'straahat' },
  }))
  await page.reload()
  await page.waitForTimeout(500)
  if (await page.locator('#niveau-banner-luk').count()) await page.locator('#niveau-banner-luk').click()
  // Hvor stor en del af tingen ligger under en stedknap, et skilt eller et "!"
  // (kortets knaplag ligger over tegningen).
  const ting = await page.evaluate(() => {
    const over = [...document.querySelectorAll('.sted-knap, .klynge-etiket, .kort-skilt, .bog-udraab, .kort-figur-token')].map((e) => ({ navn: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) || e.className, r: e.getBoundingClientRect() }))
    return [...document.querySelectorAll('.bog-ting')].map((g) => {
      const r = g.getBoundingClientRect()
      const areal = r.width * r.height
      const daekket = over.map(({ navn, r: o }) => {
        const b = Math.max(0, Math.min(r.right, o.right) - Math.max(r.left, o.left))
        const h = Math.max(0, Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top))
        return { navn, andel: areal ? +(b * h / areal).toFixed(2) : 0 }
      }).filter((x) => x.andel > 0.05)
      return { id: g.dataset.beloenning, bredde: Math.round(r.width), hoejde: Math.round(r.height), daekket }
    })
  })
  const hoved = await page.evaluate(() => ({
    titel: document.querySelector('.spil-bogtitel')?.textContent.trim() ?? null,
    niveauTitel: document.querySelector('.spil-niveau')?.textContent.trim(),
    hue: document.querySelectorAll('.spil-portræt .figur-hue').length,
    hals: document.querySelectorAll('.spil-portræt [class*="hals"], .spil-portræt [class*="toerklaede"]').length,
    udraab: document.querySelectorAll('.bog-udraab').length,
    personerPaaKortet: document.querySelectorAll('.bog-person').length,
  }))
  await page.screenshot({ path: path.join(her, 'Q-01-alle-klaret-hoved.png') })
  await page.locator('.kort').scrollIntoViewIfNeeded()
  await page.locator('.kort').screenshot({ path: path.join(her, 'Q-02-alle-klaret-kortet.png') })
  await page.locator('#questbog-knap').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(her, 'Q-03-alle-klaret-questbogen.png'), fullPage: true })
  ud.beloenninger = { ting, hoved, sidefejl: fejl }
  console.log('A', JSON.stringify(ud.beloenninger))
  await ctx.close()
}

// --- B. gaette-eleven -------------------------------------------------------
{
  const ctx = await nyKontekst()
  const page = await ctx.newPage()
  const fejl = []
  page.on('pageerror', (e) => fejl.push(e.message))
  await page.goto(URL_SPIL)
  await page.locator('#op-navn').fill('Ravn')
  await page.locator('#op-start').click()
  await page.waitForTimeout(300)
  const haendelser = []
  let opgaver = 0, tryk = 0, rigtigeFoerste = 0, loesningVist = 0
  const proevet = new Map()
  let sidsteKlaret = []
  const gemt = () => page.evaluate(() => JSON.parse(localStorage.getItem('ganita:spil')))
  const tjekNyt = async () => {
    const t = await gemt()
    const klaret = t.questbog?.klaret ?? []
    for (const id of klaret.filter((x) => !sidsteKlaret.includes(x))) haendelser.push({ opgaver, hvad: `quest klaret: ${id}`, beloenning: bog.bogQuestVedId(id).beloenning })
    sidsteKlaret = klaret
    return t
  }
  let forrigeFremdrift = ''
  for (let n = 0; n < 1200 && opgaver < 150; n++) {
    if (await page.locator('#niveau-banner-luk').count()) {
      haendelser.push({ opgaver, hvad: (await page.locator('.niveau-banner-titel').textContent()).trim() })
      await page.locator('#niveau-banner-luk').click(); continue
    }
    if (await page.locator('#quest-videre').count()) {
      const art = await page.locator('.quest-besked').first().getAttribute('class')
      if (/loesning/.test(art)) loesningVist++
      await page.locator('#quest-videre').click(); tryk++; opgaver++
      const t = await tjekNyt()
      const f = JSON.stringify(t.questFremdrift)
      if (f !== forrigeFremdrift) { haendelser.push({ opgaver, hvad: 'forloeb klaret', fremdrift: Object.fromEntries(Object.entries(t.questFremdrift).map(([k, v]) => [k, v.filter(Boolean).length])) }); forrigeFremdrift = f }
      continue
    }
    // Et "!" og ingen quest i gang: tryk paa det.
    if (!(await page.locator('#bog-laeg-vaek').count()) && await page.locator('.bog-udraab').count()) {
      const u = page.locator('.bog-udraab').first()
      const id = await u.getAttribute('data-quest')
      await u.scrollIntoViewIfNeeded(); await u.click(); tryk++
      await page.locator(`.bog-hjaelp[data-quest="${id}"]`).click(); tryk++
      haendelser.push({ opgaver, hvad: `starter quest: ${id}` })
      continue
    }
    // Landsbygaden aaben og vi er ikke i en quest: gaa derhen.
    const t = await gemt()
    if (t.sted !== 'marked' && !(await page.locator('#bog-laeg-vaek').count()) && t.figur.niveau >= 3 && !t.questFremdrift.marked.every(Boolean)) {
      await page.locator('.sted-knap--klynge').click()
      await page.locator('.klynge-liste .sted-knap', { hasText: 'Landsbygaden' }).click(); tryk += 2
      haendelser.push({ opgaver, hvad: 'gaar til Landsbygaden' })
      continue
    }
    const svar = page.locator('#quest-svar button')
    const antal = await svar.count()
    if (!antal) { haendelser.push({ opgaver, hvad: 'intet at svare paa her' }); break }
    const tekst = await page.locator('.quest-opgave-tekst').textContent()
    const i = proevet.get(tekst) ?? 0
    proevet.set(tekst, i + 1)
    await svar.nth(i % antal).click(); tryk++
    if (i === 0 && await page.locator('.quest-besked--korrekt').count()) rigtigeFoerste++
  }
  const slut = await gemt()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(her, 'Q-04-gaetter-efter-150.png') })
  await page.locator('#questbog-knap').click()
  await page.screenshot({ path: path.join(her, 'Q-05-gaetter-questbogen.png'), fullPage: true })
  ud.gaetter = {
    opgaver, tryk, rigtigeFoerste, loesningVist,
    niveau: slut.figur.niveau, erfaring: slut.figur.erfaring,
    klaret: slut.questbog.klaret,
    beloenninger: slut.questbog.klaret.map((id) => bog.bogQuestVedId(id).beloenning),
    fremdrift: Object.fromEntries(Object.entries(slut.questFremdrift).map(([k, v]) => [k, v.filter(Boolean).length])),
    haendelser, sidefejl: fejl,
  }
  console.log('B', JSON.stringify({ ...ud.gaetter, haendelser: undefined }))
  for (const h of haendelser) console.log('  ', JSON.stringify(h))
  await ctx.close()
}

await browser.close()
writeFileSync(path.join(her, 'browser-416.json'), JSON.stringify(ud, null, 2) + '\n', 'utf8')
