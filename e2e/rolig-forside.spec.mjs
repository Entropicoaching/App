// ORDRE 330 · proeven for "dagene staar tydeligt adskilt, og forsiden er
// rolig" (Marcs dom 22. sep aften: forsiden er overfyldt, og man ser ikke
// tydeligt hvilken dag man staar paa). Paa 390x844 og 360x780:
//   1) taeller elementer over folden (foerste skaerm uden at rulle) — to tal:
//      "blokke" (kort/sektioner direkte i sidens indhold) og "ting" (knapper,
//      felter og tekststykker man kan laese), og skriver dem til
//      outputs/330/taelling-<fase>.json,
//   2) tager skaermbilleder (skaerm + hele siden) til outputs/330/,
//   3) logger et tungt saet, saa "Ny personlig rekord"-toasten kommer, og
//      maaler om den daekker topbaren (F12 fra 292).
// Med ROLIG_FASE=foer (koert paa main foer aendringen) maales og fotograferes
// der kun. Uden (standard, "efter") tjekkes ogsaa det ordren kraever:
// overskrift "<Ugedag> · <pas>", dagen i dag og den viste dag er maerket paa
// andet end farve, hviledage ser anderledes ud end pas-dage, hoejst tre
// sekundaere ting, alt andet bag "Mere", og toasten under topbaren.
// Egen koersel: `npm run e2e:rolig-forside`.

import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ATHLETE_USER, buildSeed } from './fixtures.mjs'

const FASE = process.env.ROLIG_FASE || 'efter'
const OUT_DIR = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '330')
mkdirSync(OUT_DIR, { recursive: true })

// Koeres i browseren. Sidens indhold = div'en med s.page (maxWidth 680px,
// padding-bund 6rem) — findes ens foer og efter, saa tallene kan sammenlignes.
function countAboveFold() {
  const page = [...document.querySelectorAll('div')].find(d => d.style.maxWidth === '680px' && d.style.paddingBottom === '6rem')
  if (!page) return null
  const fold = window.innerHeight
  const visible = el => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false
    return r.top < fold && r.bottom > 0
  }
  // Blokke: sidens direkte boern (efter at have pakket fragment-loese
  // wrappers ud er det netop kortene/sektionerne).
  const blocks = [...page.children].filter(visible)
  // Ting: knapper/felter taelles som een hver; tekst taelles pr. blad-element
  // der ikke sidder inde i en knap/label.
  const interactive = 'button, input, select, textarea, a'
  // thingsTotal: samme optaelling for HELE forsiden (ogsaa under folden).
  let things = 0
  let thingsTotal = 0
  for (const el of page.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const isThing = el.matches(interactive) || (!el.closest('button, label, a') && el.children.length === 0 && (el.textContent || '').trim())
    if (!isThing) continue
    thingsTotal++
    if (visible(el)) things++
  }
  return { blocks: blocks.length, things, thingsTotal, fold }
}

async function runViewport(page, { tag, width, height }) {
  const shotView = (name) => page.screenshot({ path: join(OUT_DIR, `${FASE}-${tag}-${name}.png`) })
  const shotFull = (name) => page.screenshot({ path: join(OUT_DIR, `${FASE}-${tag}-${name}-hele.png`), fullPage: true })

  await page.goto(process.env.__ROLIG_APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await page.getByText('Sæt 1/4', { exact: true }).waitFor({ state: 'visible' })
  // Lad de oevrige hentninger (besked, rekorder, vaegt ...) lande, saa
  // taellingen er for den faerdige forside, ikke en halvt indlaest.
  await page.waitForTimeout(1500)

  const count = await page.evaluate(countAboveFold)
  assert.ok(count, `${tag}: fandt ikke sidens indhold`)
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  await shotView('01-forside')
  await shotFull('01-forside')

  const result = { tag, width, height, ...count, fullHeight, scrollWidth }

  if (FASE === 'efter') {
    assert.ok(scrollWidth <= width, `${tag}: vandret overflow (${scrollWidth} > ${width})`)

    // Overskriften: "<Ugedag> · <pas>".
    const heading = await page.locator('h1').first().textContent()
    assert.match(heading, /^(Mandag|Tirsdag|Onsdag|Torsdag|Fredag|Lørdag|Søndag) · .+/, `${tag}: overskriften skal vaere "<Ugedag> · <pas>", fik "${heading}"`)
    result.heading = heading

    // Ugestrimlen: i dag + vist dag maerket paa andet end farve.
    const strip = page.locator('[data-dagstrimmel]')
    await strip.waitFor({ state: 'visible' })
    const cells = await strip.locator('[data-dag]').evaluateAll(els => els.map(el => ({
      state: el.getAttribute('data-dag'),
      current: el.getAttribute('aria-current'),
      shown: el.getAttribute('data-vist') === 'ja',
      borderWidth: getComputedStyle(el).borderTopWidth,
      borderStyle: getComputedStyle(el).borderTopStyle,
      weight: getComputedStyle(el.querySelector('[data-ugedag]')).fontWeight,
      left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right,
    })))
    assert.equal(cells.length, 7, `${tag}: syv dage i strimlen`)
    const todayCells = cells.filter(c => c.current === 'date')
    assert.equal(todayCells.length, 1, `${tag}: praecis een dag er "i dag" (aria-current=date)`)
    const shown = cells.filter(c => c.shown)
    assert.equal(shown.length, 1, `${tag}: praecis een dag er den viste`)
    assert.equal(shown[0].borderWidth, '2px', `${tag}: den viste dag har tykkere kant (form, ikke kun farve)`)
    assert.ok(Number(shown[0].weight) >= 600, `${tag}: den viste dags ugedag staar med fed skrift`)
    const rest = cells.filter(c => c.state === 'hvile')
    const planned = cells.filter(c => c.state !== 'hvile')
    if (rest.length && planned.length) {
      assert.equal(rest[0].borderStyle, 'dashed', `${tag}: hviledage har stiplet kant`)
      assert.notEqual(planned.find(c => !c.shown)?.borderStyle ?? 'solid', 'dashed', `${tag}: pas-dage har ikke stiplet kant`)
    }
    // ORDRE 339 · blok 1 (F2 fra KRITIK-330-326): mindst 44 px brede celler, også på 360 px.
    for (const [i, c] of cells.entries()) {
      assert.ok(c.right - c.left >= 44, `${tag}: dag ${i + 1} er ${(c.right - c.left).toFixed(1)} px bred (< 44 px tap-mål)`)
    }
    // ORDRE 339 · blok 1 (F1): strimlens tekst kan læses uden at zoome (>= 9 px).
    const stripFonts = await strip.evaluate(el => ({
      ugedag: Math.min(...[...el.querySelectorAll('[data-ugedag]')].map(n => parseFloat(getComputedStyle(n).fontSize))),
      status: Math.min(...[...el.querySelectorAll('[data-dagstatus]')].map(n => parseFloat(getComputedStyle(n).fontSize))),
    }))
    assert.ok(stripFonts.ugedag >= 10, `${tag}: ugedagen er ${stripFonts.ugedag} px (< 10 px)`)
    assert.ok(stripFonts.status >= 9, `${tag}: "hvile"/status-teksten er ${stripFonts.status} px (< 9 px)`)
    result.stripFonts = stripFonts
    result.cellWidth = Math.min(...cells.map(c => c.right - c.left))
    for (let i = 1; i < cells.length; i++) {
      assert.ok(cells[i].left - cells[i - 1].right >= 5, `${tag}: luft mellem dag ${i} og ${i + 1} (${(cells[i].left - cells[i - 1].right).toFixed(1)} px)`)
    }

    // Hoejst tre sekundaere ting, og "Mere" er lukket fra start.
    const secondary = await page.locator('[data-sekundaer] button').count()
    assert.ok(secondary >= 1 && secondary <= 3, `${tag}: 1-3 sekundaere ting, fik ${secondary}`)
    result.secondary = secondary
    const mere = page.getByRole('button', { name: 'Mere', exact: true })
    assert.equal(await mere.getAttribute('aria-expanded'), 'false', `${tag}: "Mere" er lukket fra start`)
    for (const text of ['Kropsvægt', 'Mit program', 'Seneste besked fra coach']) {
      assert.equal(await page.getByText(text, { exact: true }).count(), 0, `${tag}: "${text}" skal ligge bag "Mere"`)
    }
    await mere.click()
    await page.getByText('Mit program', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
    await page.getByText('Kropsvægt', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
    await shotFull('02-mere-aaben')
    await mere.click()
    await page.getByText('Mit program', { exact: true }).waitFor({ state: 'detached', timeout: 5000 })
  }

  // PR-toasten (F12 fra 292): foerste saet paa en oevelse uden rekorder gemmes
  // kun som baseline (ingen toast, se logSet) — derfor et almindeligt saet 1,
  // saa et tungt saet 2, og toasten maales mod topbaren.
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  await page.getByText('Sæt 2/4', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(1000)
  await page.getByLabel('Vægt, sæt 2').fill('200')
  await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
  const toast = page.getByText('Ny personlig rekord', { exact: false })
  let toastBox = null
  try {
    await toast.first().waitFor({ state: 'visible', timeout: 5000 })
    toastBox = await toast.first().evaluate(el => {
      let n = el
      while (n && getComputedStyle(n).position !== 'fixed') n = n.parentElement
      const r = (n || el).getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    })
    await shotView('03-pr-toast')
  } catch { /* ingen toast — skrives som null i taellingen */ }
  const topbarBottom = await page.evaluate(() => {
    const bar = [...document.querySelectorAll('div')].find(d => getComputedStyle(d).position === 'sticky' && d.style.height === '52px')
    return bar ? bar.getBoundingClientRect().bottom : null
  })
  // ORDRE 339 · blok 1 (F5): toasten maa heller ikke daekke overskriften
  // eller strimlen (maalt i den rulle-position siden har efter "Godkendt" -
  // paa 360x780 er den rullet, se KRITIK-330-326 F5).
  const h1Box = await page.locator('h1').first().evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom } })
  const stripBox = await page.locator('[data-dagstrimmel]').evaluate(el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom } })
  const overlaps = (a, b) => a.top < b.bottom && a.bottom > b.top
  result.prToast = toastBox
  result.topbarBottom = topbarBottom
  result.h1Top = h1Box.top
  if (FASE === 'efter') {
    assert.ok(toastBox, `${tag}: "Ny personlig rekord"-toasten kom ikke`)
    assert.ok(toastBox.top >= topbarBottom, `${tag}: toasten (top ${toastBox.top}) daekker topbaren (bund ${topbarBottom})`)
    assert.ok(toastBox.left >= 0 && toastBox.right <= width, `${tag}: toasten gaar ud over skaermkanten`)
    assert.ok(!overlaps(toastBox, h1Box), `${tag}: toasten (${Math.round(toastBox.top)}-${Math.round(toastBox.bottom)}) daekker overskriften (${Math.round(h1Box.top)}-${Math.round(h1Box.bottom)})`)
    assert.ok(!overlaps(toastBox, stripBox), `${tag}: toasten (${Math.round(toastBox.top)}-${Math.round(toastBox.bottom)}) daekker strimlen (${Math.round(stripBox.top)}-${Math.round(stripBox.bottom)})`)

    // ORDRE 339 · blok 1 (F3): midt i et pas (tre saet logget) ligger de
    // sekundaere chips stadig over folden, fordi "ret"-raekkerne er kollapset.
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    await page.getByText('Sæt 4/4', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
    await page.getByText('Ny personlig rekord', { exact: false }).first().waitFor({ state: 'detached', timeout: 6000 }).catch(() => {})
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(300)
    assert.equal(await page.getByRole('button', { name: /^Ret sæt \d$/ }).count(), 0, `${tag}: "ret"-raekkerne skal vaere kollapset som standard`)
    const chips = await page.locator('[data-sekundaer]').evaluate(el => el.getBoundingClientRect().bottom)
    const fold = await page.evaluate(() => window.innerHeight)
    result.chipsBottomMidtIPas = chips
    assert.ok(chips <= fold, `${tag}: chips (bund ${Math.round(chips)}) ligger under folden (${fold}) med tre saet logget`)
    await shotView('04-tre-saet-logget')
  }
  return result
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  process.env.__ROLIG_APP_URL = APP_URL

  const vite = await startVite()
  const browser = await launchBrowser()
  const results = []
  try {
    for (const vp of [{ tag: '390x844', width: 390, height: 844 }, { tag: '360x780', width: 360, height: 780 }]) {
      const mock = createMockSupabase(buildSeed())
      await mock.listen(MOCK_PORT)
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      const page = await context.newPage()
      page.on('pageerror', err => console.error('[browser pageerror]', err))
      try {
        results.push(await runViewport(page, vp))
      } finally {
        await context.close()
        await mock.close()
      }
    }
    writeFileSync(join(OUT_DIR, `taelling-${FASE}.json`), JSON.stringify(results, null, 2) + '\n')
    for (const r of results) console.log(`${FASE} ${r.tag}: ${r.blocks} blokke / ${r.things} ting over folden (${r.thingsTotal} paa hele forsiden), siden ${r.fullHeight} px hoej, PR-toast top ${r.prToast ? Math.round(r.prToast.top) : '—'} (topbar-bund ${r.topbarBottom}, h1-top ${r.h1Top != null ? Math.round(r.h1Top) : '—'}), celle ${r.cellWidth != null ? r.cellWidth.toFixed(1) : '—'} px, chips-bund midt i pas ${r.chipsBottomMidtIPas != null ? Math.round(r.chipsBottomMidtIPas) : '—'}`)
    console.log(`\nGRØN: rolig-forside (ordre 330, fase ${FASE}).`)
    process.exitCode = 0
  } catch (err) {
    console.error('\nFEJL:', err.message)
    process.exitCode = 1
  } finally {
    await browser.close()
    await vite.stop()
  }
}

if (process.argv[1] && process.argv[1].endsWith('rolig-forside.spec.mjs')) main()
