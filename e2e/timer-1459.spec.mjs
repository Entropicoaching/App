// ORDRE 1459 — pausetimeren skal kunne findes. Ny atlet (mock, 390x844):
// 1) Dagens pas viser en pause-linje FØR første Godkendt, med forklaring første gang.
// 2) Tryk på linjen starter pausen og åbner pop-up'en; Luk lader pausen køre, den
//    skjulte linje nederst åbner pop-up'en igen.
// 3) Forklaringen er væk, når pausen har kørt én gang.
// 4) Skærmlås: tiden regnes fra starttid. Date.now skubbes 40 s frem + visibilitychange
//    (som at låse op), og efter genindlæsning af siden med starttid 40 s tilbage.
// Egen kørsel: `npm run e2e:timer-1459`. Billeder: UDMAPPE=<sti> (ingen i repoet).
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, buildSeed } from './fixtures.mjs'

const OUT_DIR = process.env.UDMAPPE || ''
if (OUT_DIR) mkdirSync(OUT_DIR, { recursive: true })

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite()
  const browser = await launchBrowser()
  const mock = createMockSupabase(buildSeed())
  await mock.listen(MOCK_PORT)
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    page.on('pageerror', err => console.error('[browser pageerror]', err))
    const shot = async (name) => { if (OUT_DIR) await page.screenshot({ path: join(OUT_DIR, `efter-${name}.png`) }) }

    await page.goto(APP_URL)
    await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await page.getByRole('button', { name: 'Log ind' }).click()
    await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })

    // 1) Linjen findes før noget sæt er godkendt
    const linje = page.getByTestId('pause-start-linje')
    await linje.waitFor({ state: 'visible', timeout: 5000 })
    const tekst = await linje.innerText()
    // Ordre 1485 (QA 1481 fund 2): foer foerste saet intet pausetal; pausen naevnes foerst efter foerste saet.
    assert.match(tekst, /tryk for at se/i, 'foer foerste saet: ingen "start" paa en pause')
    assert.doesNotMatch(tekst, /pause|d:dd/i, `ingen pausetal foer foerste saet: ${tekst}`)
    const box = await linje.boundingBox()
    assert.ok(box.height >= 44, `tryk-flade ≥ 44 px, fik ${box.height}`)
    assert.equal(await page.getByTestId('rest-pause-open').count(), 0, 'ingen pause kører endnu')
    // Ordre 1469 (1464-1): kontrast maalt paa de rigtige farver (tekst mod effektiv baggrund, alpha blandet ned).
    const kontraster = await linje.evaluate((el) => {
      const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
      const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 })
      const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
      const bg = (node) => { const lag = []; for (let n = node; n; n = n.parentElement) lag.push(parse(getComputedStyle(n).backgroundColor)); let c = { r: 10, g: 10, b: 8, a: 1 }; for (const l of lag.reverse()) c = blend(l, c); return c }
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
      const ud = []
      for (const t of el.querySelectorAll('span')) {
        const fg = parse(getComputedStyle(t).color)
        ud.push({ tekst: t.textContent.slice(0, 24), ratio: Math.round(ratio(blend(fg, bg(t)), bg(t)) * 100) / 100, px: parseFloat(getComputedStyle(t).fontSize) })
      }
      const fg = parse(getComputedStyle(el).color)
      ud.push({ tekst: 'linje', ratio: Math.round(ratio(blend(fg, bg(el)), bg(el)) * 100) / 100, px: parseFloat(getComputedStyle(el).fontSize) })
      return ud
    })
    console.log('KONTRAST', JSON.stringify(kontraster))
    for (const k of kontraster) assert.ok(k.ratio >= 4.5, `kontrast under 4.5:1 paa "${k.tekst}": ${k.ratio}`)
    assert.ok(kontraster.every(k => k.px >= 10), `tekst under 10 px: ${JSON.stringify(kontraster)}`)
    // Ordre 1475 (QA 1474 fund 6): "Næste: 4 reps @ 80 kg" og "Vis næste sæt" min. 4,5:1 mod den effektive baggrund.
    const naesteKontrast = await page.evaluate(() => {
      const parse = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
      const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 })
      const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
      const bg = (node) => { const lag = []; for (let n = node; n; n = n.parentElement) lag.push(parse(getComputedStyle(n).backgroundColor)); let c = { r: 10, g: 10, b: 8, a: 1 }; for (const l of lag.reverse()) c = blend(l, c); return c }
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
      const ud = []
      for (const el of document.querySelectorAll('div, span')) {
        if (el.children.length > 0 && el.tagName === 'DIV' && !/^Næste: \d/.test(el.textContent)) continue
        const t = el.textContent.trim()
        if (!/^Næste: [\d—]/.test(t) && t !== 'Vis næste sæt') continue
        if (el.children.length > 0) continue
        const c = bg(el)
        ud.push({ tekst: t.slice(0, 30), ratio: Math.round(ratio(blend(parse(getComputedStyle(el).color), c), c) * 100) / 100 })
      }
      return ud
    })
    console.log('KONTRAST-NAESTE', JSON.stringify(naesteKontrast))
    assert.ok(naesteKontrast.some(k => /^Næste:/.test(k.tekst)), 'fandt ikke "Næste: ... reps"-linjen')
    for (const k of naesteKontrast) assert.ok(k.ratio >= 4.5, `kontrast under 4.5:1 paa "${k.tekst}": ${k.ratio}`)
    await shot('1-linje-paa-saet-kortet')

    // 2) Ordre 1475: foer foerste saet siger pop-up'en hvad der skal ske, uden taeller; pausen starter ved Godkendt.
    await linje.click()
    const foerste = page.getByTestId('foerste-saet-popup')
    await foerste.waitFor({ state: 'visible', timeout: 3000 })
    const ft = await foerste.innerText()
    assert.match(ft, /Første sæt: Squat, \d+ reps( @ [\d,]+ kg)?/, `foerste-saet-pop-up: ${ft}`)
    assert.equal(await foerste.locator('svg').count(), 0, 'ingen taeller-ring foer foerste saet')
    assert.doesNotMatch(ft, /\d:\d\d|90/, 'ingen nedtaelling foer foerste saet')
    assert.equal(await page.getByTestId('rest-pause-open').count(), 0, 'ingen pause kører endnu')
    await shot('2a-foerste-saet-popup')
    await page.getByTestId('foerste-saet-start').click()
    await foerste.waitFor({ state: 'detached', timeout: 3000 })
    await page.getByRole('button', { name: 'Godkendt', exact: true }).first().click()
    await page.getByTestId('rest-pause-open').click()
    const popup = page.getByTestId('rest-pause-popup')
    await popup.waitFor({ state: 'visible', timeout: 3000 })
    const sek = async () => Number((await popup.locator('svg + div span').first().innerText()).trim())
    const a = await sek()
    assert.ok(a > 80 && a <= 90, `pausen starter på ca. 90 s, fik ${a}`)
    const popTxt = await popup.innerText()
    assert.match(popTxt, /Næste: Squat · sæt 2\/4/, `pop-up efter foerste saet: ${popTxt}`)
    await shot('2-popup-aabnet-fra-linjen')
    await page.getByTestId('rest-pause-close').click()
    await popup.waitFor({ state: 'detached', timeout: 3000 })
    assert.equal(await linje.count(), 0, 'sæt-kortets linje skjules mens pausen kører (højst én ny ting)')
    const open = page.getByTestId('rest-pause-open')
    await shot('3-pause-linje-nederst')
    // skjult linje over bundmenuen åbner pop-up'en igen
    await open.click()
    await popup.waitFor({ state: 'visible', timeout: 3000 })
    await page.getByTestId('rest-pause-close').click()
    await popup.waitFor({ state: 'detached', timeout: 3000 })

    // 4a) Skærmlås: Date.now 40 s frem + visibilitychange
    await page.evaluate(() => {
      const orig = Date.now
      Date.now = () => orig() + 40000
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await open.click()
    await popup.waitFor({ state: 'visible', timeout: 3000 })
    await page.waitForTimeout(400)
    const b = await sek()
    assert.ok(b <= 52 && b >= 45, `efter 40 s "i lommen" skal der være ca. 50 s tilbage, fik ${b} (var ${a})`)
    await shot('4-efter-skaermlaas-40s')
    await page.getByTestId('rest-pause-close').click()

    // 4b) Genindlæsning: starttid ligger i storage, 40 s tilbage i tid
    await page.evaluate(() => {
      const k = Object.keys(localStorage).find(x => x.startsWith('entropi_rest_pause:'))
      const v = JSON.parse(localStorage.getItem(k)); v.startedAt = Date.now() - 80000 /* Date.now er skubbet +40 s ovenfor */
      localStorage.setItem(k, JSON.stringify(v))
    })
    await page.reload()
    await page.getByTestId('rest-pause-open').waitFor({ state: 'visible', timeout: 15000 })
    await page.getByTestId('rest-pause-open').click()
    await popup.waitFor({ state: 'visible', timeout: 3000 })
    const c = await sek()
    assert.ok(c <= 52 && c >= 45, `efter genindlæsning skal der være ca. 50 s tilbage, fik ${c}`)
    await page.getByRole('button', { name: 'Skjul pausen', exact: true }).click()

    // 3) Forklaringen er væk, når pausen har kørt én gang; linjen er stadig der
    await linje.waitFor({ state: 'visible', timeout: 5000 })
    const tekst2 = await linje.innerText()
    assert.doesNotMatch(tekst2, /starter også af sig selv/i, 'forklaringen vises kun første gang')
    await shot('5-linje-uden-forklaring')

    // Pausen starter stadig af sig selv ved Godkendt
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    await page.getByTestId('rest-pause-open').waitFor({ state: 'visible', timeout: 5000 })
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(sw <= 390, `vandret overflow ${sw}`)
    console.log(`\nGRØN: timer-1459 — linje før første sæt (44px+, forklaring kun 1. gang), pop-up fra linje (${a}s), skjult linje åbner igen, skærmlås +40s -> ${b}s, genindlæsning -> ${c}s, Godkendt starter stadig pausen, ingen overflow.`)
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    await mock.close()
    await vite.stop()
  }
}

main()
