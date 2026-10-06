// ORDRE 1485 - QA 1481 fund 3 og 4 + Fase B (coach ser det samme som atleten). Syntetisk atlet (mock, ingen rigtige data):
// samme 8-ugers historik som 1451 (squat, baenk, doedloeft, varianter) + en SUMO-historik:
// "Sumo doedloeft topsaet/backoff/volumen" og en variant (Deficit sumo) der IKKE maa blive en fane.
// Beviser paa 390 og 1280: (1) sumo har sin egen fane og kurve og havner aldrig i Doedloeft-kurven,
// (2) hjaelpetekster/undertekster i Fremgang og rekorder og forsidens styrkeudvikling er min. 4,5:1 og min. 10 px,
// (3) coachen (Log, Staevne, hub-linje, Analyse) bruger samme navne og samme tunge-saet-regel som atleten.
// `node e2e/sumo-1485.spec.mjs`; skaermbilleder i outputs/1485 (ignoreret) eller $E2E_OUT.
import assert from 'node:assert/strict'
import { join, basename } from 'node:path'
import { mkdirSync } from 'node:fs'
import { ATHLETE_USER, COACH_USER, ATHLETE_ID } from './fixtures.mjs'
import { seed1451 } from './fremgang-1451.spec.mjs'

const OUT_DIR = process.env.E2E_OUT || join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '1485')
mkdirSync(OUT_DIR, { recursive: true })
const uuid = (n) => `eeeeeeee-${String(n).padStart(4, '0')}-4eee-8eee-eeeeeeeeeeee`
const DAY = 864e5
// [dage siden, blok, navn, kg, reps]
const SUMO = [
  [48, 'Base', 'Sumo dødløft topsæt', 190, 3], [34, 'Base', 'Sumo dødløft - backoff', 150, 8],
  [31, 'Deload', 'Sumo dødløft topsæt', 150, 5],
  [27, 'Base', 'Sumo dødløft topsæt', 195, 3], [13, 'Base', 'Sumo dødløft topsæt', 200, 3], [13, 'Base', 'Sumo dødløft volumen', 140, 12],
  [6, 'Base', 'Sumo dødløft topsæt', 205, 3], [6, 'Base', 'Deficit sumo dødløft', 150, 5],
]
const FORVENTET_SUMO = [209, 215, 220, 226] // hoejeste e1RM pr. tung dag; deload-, backoff- og volumen-dagene har intet punkt
const FORVENTET_DL = [176, 182, 187, 187]

export function seed1485() {
  const seed = seed1451()
  const wk = (blok) => seed.tables.weeks.find(w => w.block_name === blok && w.week_number === 0)
  const se = (blok) => seed.tables.sessions.find(s => s.week_id === wk(blok).id)
  const exId = new Map(); let n = 0
  for (const [, blok, navn] of SUMO) {
    const k = `${blok}|${navn}`; if (exId.has(k)) continue
    const id = uuid(++n); exId.set(k, id)
    seed.tables.exercises.push({ id, session_id: se(blok).id, name: navn, sets: 1, reps: '3', intensity: 'RPE 8', note: null, exercise_order: 90 + n, recommended_weight: 150 })
  }
  seed.tables.exercise_logs.push(...SUMO.map(([dage, blok, navn, kg, reps], i) => ({
    id: uuid(500 + i), exercise_id: exId.get(`${blok}|${navn}`), athlete_id: ATHLETE_ID, set_number: 1, weight: kg, reps_completed: reps,
    note: null, rpe_actual: null, rpe_planned: null, skipped: false, logged_at: new Date(Date.now() - dage * DAY + (i % 5) * 36e5).toISOString(),
  })))
  // Coachens Staevne-fane viser personal_records (skrives ved live-logning); i mock saa vi dem ind med raa navne.
  seed.tables.personal_records.push(
    { id: uuid(900), athlete_id: ATHLETE_ID, exercise_name: 'Sumo dødløft topsæt', weight: 205, reps: 3, logged_at: new Date(Date.now() - 6 * DAY).toISOString(), created_at: new Date(Date.now() - 6 * DAY).toISOString() },
    { id: uuid(901), athlete_id: ATHLETE_ID, exercise_name: 'Dødløft - topsæt', weight: 175, reps: 2, logged_at: new Date(Date.now() - 3 * DAY).toISOString(), created_at: new Date(Date.now() - 3 * DAY).toISOString() },
  )
  return seed
}

// Kontrast: hver synlig tekst-node (HTML eller SVG) mod sin effektive baggrund (alpha blandet ned).
const MAAL_KONTRAST = (medNav = false) => {
  const parse = (c) => { const m = (c.match(/[\d.]+/g) || [0, 0, 0]).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] ?? 1 } }
  const blend = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 })
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const bg = (node) => { const lag = []; for (let n = node; n; n = n.parentElement) lag.push(parse(getComputedStyle(n).backgroundColor)); let c = { r: 10, g: 10, b: 8, a: 1 }; for (const l of lag.reverse()) c = blend(l, c); return c }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const ud = []
  for (const el of document.querySelectorAll('#root *')) {
    if (!medNav && el.closest('nav')) continue
    const egen = [...el.childNodes].filter(c => c.nodeType === 3 && c.textContent.trim()).map(c => c.textContent.trim()).join(' ')
    if (!egen) continue
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect()
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || r.height === 0) continue
    const svg = el instanceof SVGElement
    const fg = parse(svg ? cs.fill : cs.color)
    const px = svg ? parseFloat(cs.fontSize) * (r.width / (el.getBBox?.().width || r.width)) : parseFloat(cs.fontSize)
    ud.push({ nav: !!el.closest('nav'), tekst: egen.slice(0, 40), ratio: Math.round(ratio(blend(fg, bg(el)), bg(el)) * 100) / 100, px: Math.round(px * 10) / 10 })
  }
  return ud
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  const mock = createMockSupabase(seed1485()); await mock.listen(MOCK_PORT)
  const log = (...a) => console.log(...a)
  try {
    for (const [bredde, hoejde] of [[390, 844], [1280, 900]]) {
      // ---------- Atlet
      const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde } })
      const page = await ctx.newPage()
      page.on('pageerror', err => console.error('[browser pageerror]', err))
      const shot = (n) => page.screenshot({ path: join(OUT_DIR, `${n}-${bredde}.png`), fullPage: true })
      await page.goto(APP_URL)
      await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
      await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
      await page.getByRole('button', { name: 'Log ind' }).click()
      await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
      await page.waitForTimeout(1000)
      await page.getByText('Fremgang', { exact: true }).last().click(); await page.waitForTimeout(2500)
      const udover = async (navn) => { await page.getByRole('button', { name: navn, exact: true }).first().click(); await page.waitForTimeout(500) }
      const knapper = () => page.evaluate(() => [...document.querySelectorAll('button')].filter(b => !b.closest('nav')).map(b => b.textContent.trim()))
      const punkter = () => page.evaluate(() => [...document.querySelectorAll('[data-punkt]')].map(g => ({ dag: g.getAttribute('data-punkt'), e1rm: Number(g.getAttribute('data-e1rm')) })))
      const linje = () => page.evaluate(() => document.querySelector('[data-fremgang-linje]')?.textContent ?? null)

      // 1) Fire hovedloeft-faner inkl. Sumo; varianten (Deficit sumo) ligger under "Andre oevelser".
      const k = await knapper()
      for (const n of ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']) assert.equal(k.filter(t => t === n).length, 1, `${n} skal staa praecis een gang: ${k.join(' | ')}`)
      assert.ok(!k.some(t => /deficit/i.test(t)), 'variant er ikke en fane')
      const valg = await page.evaluate(() => [...document.querySelectorAll('select option')].map(o => o.textContent.trim()))
      assert.ok(valg.includes('Deficit sumo dødløft'), `variant under "Andre øvelser": ${valg.join(' | ')}`)

      // 2) Sumo-fanen: egen kurve, kun sumo-tal.
      await udover('Sumo dødløft')
      const su = await punkter()
      assert.deepEqual(su.map(x => x.e1rm), FORVENTET_SUMO, `sumo-kurve: ${JSON.stringify(su)}`)
      assert.match(await linje(), /^Sumo dødløft e1RM 226 kg, \+17 kg siden/, await linje())
      assert.equal(await page.locator('svg:has([data-punkt]) polyline').count(), 1)
      await shot('sumo-fane')
      // 3) Doedloeft-fanen: kun konventionelle tal, ingen sumo (sumo-e1RM er mindst 209).
      await udover('Dødløft')
      const dl = await punkter()
      assert.deepEqual(dl.map(x => x.e1rm), FORVENTET_DL, `doedloeft-kurve: ${JSON.stringify(dl)}`)
      assert.ok(dl.every(x => x.e1rm < 200), 'sumo laekker ikke ind i Doedloeft-kurven')
      assert.match(await linje(), /^Dødløft e1RM 187 kg, \+11 kg siden/, await linje())
      await shot('doedloeft-fane')
      // 4) Rekorder: sumo og doedloeft hver sin raekke.
      const hoved = await page.evaluate(() => [...document.querySelectorAll('[data-rekord-hoved]')].map(e => e.getAttribute('data-rekord-hoved')))
      assert.ok(hoved.includes('doedloeft') && hoved.includes('sumo'), 'doedloeft og sumo har hver sin rekordraekke: ' + hoved)
      assert.equal(new Set(hoved).size, hoved.length)
      const rekTekst = await page.evaluate(() => document.querySelector('[data-rekord-liste]')?.innerText ?? '')
      assert.match(rekTekst, /Sumo dødløft/); assert.ok(!/Deficit/.test(rekTekst), 'variant staar ikke mellem hovedloeftene')
      await page.locator('[data-rekord-liste]').scrollIntoViewIfNeeded(); await shot('rekorder')

      // 5) Kontrast og stoerrelse paa ALLE tekster i Fremgang + rekorder.
      await udover('Sumo dødløft')
      const m = await page.evaluate(MAAL_KONTRAST, false)
      const daarlige = m.filter(t => t.ratio < 4.5 || t.px < 10)
      log(`KONTRAST ${bredde}: ${m.length} tekster, laveste ${Math.min(...m.map(t => t.ratio))}:1, mindste ${Math.min(...m.map(t => t.px))} px`)
      assert.ok(m.length > 15, 'for faa tekster maalt: ' + m.length)
      assert.deepEqual(daarlige, [], `tekst under 4,5:1 eller 10 px paa Fremgang: ${JSON.stringify(daarlige)}`)
      assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= bredde, 'vandret overflow paa Fremgang')

      // 5b) Fase C: bundnavigationen (hovednavigationen) laeses og klippes ikke, paa de rigtige farver.
      const nav = await page.evaluate((maal) => {
        const f = new Function('return (' + maal + ')')()
        return { alle: f(true), klippet: [...document.querySelectorAll('nav button')].filter(b => b.scrollWidth > b.clientWidth + 1 || [...b.querySelectorAll('span')].some(s => s.getBoundingClientRect().width > b.getBoundingClientRect().width + 1)).map(b => b.textContent) }
      }, MAAL_KONTRAST.toString())
      const navLav = nav.alle.filter(t => t.nav && t.ratio < 4.5)
      assert.deepEqual(navLav, [], 'bundnavigationens labels under 4,5:1: ' + JSON.stringify(navLav))
      assert.deepEqual(nav.klippet, [], 'bundnavigationens labels klippes: ' + nav.klippet)
      assert.ok(nav.alle.filter(t => t.nav).length >= 6, 'bundnavigationen blev ikke maalt')
      await shot('bundnav')
      // Ordre 1492 (fund 1+2): selvstaendigt billede af selve navigationen og en forklaring paa knaptallet.
      const navKnapper = await page.evaluate(() => [...document.querySelectorAll('nav button')].map(b => ({ tekst: b.textContent.trim(), px: parseFloat(getComputedStyle(b.querySelector('span')).fontSize) })))
      log('BUNDNAV ' + bredde + ': ' + navKnapper.length + ' knapper (' + navKnapper.map(k => k.tekst).join(', ') + '), label ' + navKnapper[0].px.toFixed(1) + ' px. Staevne vises kun med staevnedato/-plan, derfor 7 uden og 8 med.')
      assert.ok(navKnapper.length === 7 || navKnapper.length === 8, 'uventet antal bundnav-knapper: ' + navKnapper.length)
      await page.locator('nav').first().screenshot({ path: join(OUT_DIR, 'bundnav-kun-nav-' + bredde + '.png') })
      // 6) Forsiden: Styrkeudvikling har samme fire navne og samme kontrastkrav.
      await page.getByText('Hjem', { exact: true }).last().click().catch(() => {}); await page.waitForTimeout(800)
      await page.getByRole('button', { name: 'Mere', exact: true }).click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800)
      const leg = await page.evaluate(() => [...document.querySelectorAll('div')].filter(d => d.textContent.startsWith('Styrkeudvikling') && d.textContent.includes('regnestykke')).pop()?.textContent ?? '')
      assert.ok(leg.includes('Sumo dødløft') && leg.includes('Dødløft') && leg.includes('Squat'), `forsidens legender: ${leg.slice(0, 220)}`)
      assert.ok(!/(Deficit|topsæt|backoff)/i.test(leg), 'variant/suffiks paa forsiden')
      await page.getByText(/styrkeudvikling/i).first().scrollIntoViewIfNeeded().catch(() => {})
      const mh = await page.evaluate(MAAL_KONTRAST, false)
      const hLav = mh.filter(t => /bedste e1RM|regnestykke|^(SQUAT|Squat|Bænkpres|Dødløft|Sumo dødløft)$/i.test(t.tekst) && (t.ratio < 4.5 || t.px < 10))
      assert.deepEqual(hLav, [], 'forsidens styrkeudvikling: hjaelpetekst under 4,5:1 eller 10 px: ' + JSON.stringify(hLav))
      await shot('hjem-styrkeudvikling')
      await ctx.close()

      // ---------- Coach: samme navne, samme tunge-saet-regel
      const cctx = await browser.newContext({ viewport: { width: bredde, height: hoejde } })
      const cp = await cctx.newPage()
      cp.on('pageerror', err => console.error('[browser pageerror]', err))
      const cshot = (n) => cp.screenshot({ path: join(OUT_DIR, `${n}-${bredde}.png`), fullPage: true })
      await cp.goto(APP_URL)
      await cp.locator('#athlete-auth-email').fill(COACH_USER.email)
      await cp.locator('#athlete-auth-password').fill(COACH_USER.password)
      await cp.getByRole('button', { name: 'Log ind' }).click()
      const row = cp.getByRole('button', { name: /Testatlet.*Uge/ }).first()
      await row.waitFor({ state: 'visible', timeout: 10000 }); await row.click(); await cp.waitForTimeout(1500)
      const tab = async (label) => {
        const knap = cp.getByRole('button', { name: new RegExp(`${label}$`) }).first()
        if (!(await knap.isVisible().catch(() => false))) { await cp.getByRole('button', { name: /(Mere|Oversigt|Kost|Analyse|Opvarmning|Stævne|Noter)\s*▾/ }).first().click().catch(() => {}); await cp.waitForTimeout(300) }
        await cp.getByRole('button', { name: new RegExp(`${label}$`) }).first().click(); await cp.waitForTimeout(1200)
      }
      await cp.waitForSelector('[data-styrke-linje]', { timeout: 8000 })
      const sl = await cp.evaluate(() => document.querySelector('[data-styrke-linje]').innerText)
      assert.ok(!/(topsæt|backoff|teknik|Deficit|Rumænsk|Front)/i.test(sl.split('Kun tunge')[0]), 'suffiks/variant i coachens styrkelinje: ' + sl)
      await cshot('coach-hub')
      await tab('Log')
      const logValg = await cp.evaluate(() => [...document.querySelectorAll('select')].flatMap(s => [...s.options].map(o => o.textContent.trim())))
      for (const n of ['Squat', 'Bænkpres', 'Dødløft', 'Sumo dødløft']) assert.equal(logValg.filter(t => t === n).length, 1, `coachens Log-vaelger: ${n} een gang: ${logValg.join(' | ')}`)
      const e1 = async (navn) => {
        await cp.locator('select').first().selectOption(navn); await cp.waitForTimeout(500)
        return [...(await cp.evaluate(() => document.body.innerText)).matchAll(/e1RM (\d+(?:\.\d)?)kg/g)].map(x => Math.round(Number(x[1])))
      }
      assert.deepEqual(await e1('Sumo dødløft'), [...FORVENTET_SUMO].reverse(), 'coachens Log: sumo = atletens sumo-kurve (samme tunge dage, samme tal)')
      await cshot('coach-log-sumo')
      assert.deepEqual(await e1('Dødløft'), [...FORVENTET_DL].reverse(), 'coachens Log: doedloeft uden sumo, samme tal som atletens')
      await cshot('coach-log-doedloeft')
      await tab('Stævne')
      const crek = await cp.evaluate(() => document.body.innerText)
      assert.ok(!/(topsæt|backoff|teknik|volumen)/i.test(crek.split(/REKORDER/i).slice(1).join(' ')), 'suffiks-navn i coachens rekorder')
      const prDel = crek.split(/REKORDER/i).slice(1).join(' ')
      assert.match(prDel, /Sumo dødløft\s+205 kg/); assert.match(prDel, /Dødløft\s+175 kg/)
      assert.equal((prDel.match(/Sumo dødløft/g) || []).length, 1, 'sumo staar een gang hos coachen')
      await cshot('coach-rekorder')
      await tab('Analyse'); await cp.waitForTimeout(800)
      const analyse = await cp.evaluate(() => document.body.innerText)
      assert.match(analyse, /e1RM af tungeste tunge sæt/i, 'coachens Analyse viser e1RM af tunge saet som atletens kurve (fund 3)')
      assert.match(analyse, /Sumo dødløft/i, 'sumo har sin egen serie hos coachen')
      await cshot('coach-analyse')
      assert.ok((await cp.evaluate(() => document.documentElement.scrollWidth)) <= bredde, 'vandret overflow hos coach')
      await cctx.close()
    }
    log('\nGRØN: sumo egen fane/kurve/rekord, aldrig i Doedloeft-kurven; kontrast >= 4,5:1 og >= 10 px; coach = atlet (navne, tunge saet, tal) paa 390 og 1280.')
  } catch (err) { console.error('\nFEJL:', err.message); process.exitCode = 1 }
  finally { await browser.close(); await mock.close(); await vite.stop() }
}
if (process.argv[1] && import.meta.url.endsWith('/' + basename(process.argv[1]))) main()
