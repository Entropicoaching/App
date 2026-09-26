// ORDRE 450 · blok 2: rekorderne med rekord-indekset, i browseren.
// Headless Chromium 390x844 (touch, iPhone-UA) mod e2e-mocken med den
// syntetiske uge fra 419/439 PLUS den lange opdigtede historik fra
// outputs/450/faelles.mjs (ca. 4000 sæt), dist/ bygget mod mocken.
//   1. Første åbning (login): hele historikken hentes én gang, indekset bygges.
//   2. Genåbning: kun rækker nyere end indekset hentes (ikke 3512).
//   3. Squat sæt 1 (100 × 5) fejres med samme tekst som 439.
//   4. Siden genindlæses: ingen fejring dukker op igen; sæt 2 (samme vægt)
//      fejres ikke; sæt 3 (102,5 × 5) fejres med samme tekst som 439.
//   5. Genindlæst igen: stadig ingen ny fejring. I alt to fejringer.
//   6. Fremgang: dagens to rekorder står én gang hver, med dato.
// Flag: --no-build (genbrug dist/, bygget mod 419-mocken).
import path from 'node:path'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { ROOT, MOCK_PORT, MOBILE_UA, startStaticServer, byg, hentChromium } from '../419/uge-faelles.mjs'
import { bygSeed } from './faelles.mjs'

const UD = path.join(ROOT, 'outputs', '450')
if (!process.argv.includes('--no-build')) { console.log('Bygger mod mocken ...'); byg() }
const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const { seed, exerciseIds } = bygSeed(fx.buildSeed, fx, { lang: true })
const mock = createMockSupabase(seed)
await mock.listen(MOCK_PORT)
const { server, port } = await startStaticServer()
const browser = await hentChromium().launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: MOBILE_UA })
const page = await context.newPage()
const konsolFejl = []
page.on('pageerror', e => konsolFejl.push(String(e)))
page.on('console', m => { if (m.type() === 'error') konsolFejl.push(m.text().slice(0, 300)) })
const REKORD_SELECT = 'exercise_id,weight,reps_completed,logged_at,exercises(name)'
let rekordKald = []
page.on('response', async (res) => {
  const u = new URL(res.url())
  if (!u.pathname.endsWith('/rest/v1/exercise_logs') || res.request().method() !== 'GET') return
  if ((u.searchParams.get('select') || '').replace(/\s/g, '') !== REKORD_SELECT) return
  try { rekordKald.push({ filter: u.searchParams.getAll('logged_at').join(' ') || 'alt', raekker: (await res.json()).length }) } catch { /* intet */ }
})
// Alle fejringer på tværs af genindlæsninger (sessionStorage overlever reload).
await page.addInitScript(() => {
  const noter = () => {
    const e = document.querySelector('[data-rekord-fejring]')
    const k = e && e.getAttribute('data-rekord-fejring')
    if (!k) return
    const liste = JSON.parse(sessionStorage.getItem('__fejringer') || '[]')
    const sidst = liste[liste.length - 1]
    if (sidst && sidst.key === k && sidst.side === window.__side) return
    liste.push({ key: k, tekst: e.textContent.trim(), side: window.__side })
    sessionStorage.setItem('__fejringer', JSON.stringify(liste))
  }
  window.__side = Math.random().toString(36).slice(2)
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(noter).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-rekord-fejring'] }))
})
const resultat = { fund: {}, trin: [], konsolFejl }
const trin = (t) => { resultat.trin.push(t); console.log(`  [450] ${t}`) }
const godkendt = () => page.getByRole('button', { name: 'Godkendt', exact: true })
const venterPaa = (navn, n) => page.waitForFunction(([navn, n]) => { const t = document.body.innerText; return t.includes(`Sæt ${n}/`) && t.includes(navn) }, [navn, n], { timeout: 20000 })
const fejringer = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('__fejringer') || '[]'))
const indeks = () => page.evaluate(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('entropi_rekord_indeks:'))
  return k ? JSON.parse(localStorage.getItem(k)) : null
})
const MDR = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const iDag = (() => { const d = new Date(); return `${d.getDate()}. ${MDR[d.getMonth()]}` })()
const sq = exerciseIds[0][0]

async function genindlaes(vent) {
  rekordKald = []
  await page.reload()
  await vent()
  await page.waitForTimeout(2500)
}

try {
  // 1. Første åbning.
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.locator('#athlete-auth-email').fill(fx.ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(fx.ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await venterPaa('Squat', 1)
  await page.waitForFunction(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('entropi_rekord_indeks:'))
    return k && JSON.parse(localStorage.getItem(k)).bygget
  }, null, { timeout: 30000 })
  const ix1 = await indeks()
  resultat.fund.foersteAabning = { rekordKald: rekordKald.slice(), indeksBytes: JSON.stringify(ix1).length, historik: seed.tables.exercise_logs.length }
  trin(`første åbning: ${rekordKald.map(k => `${k.raekker} rækker (${k.filter})`).join(', ')}; indekset bygget, ${JSON.stringify(ix1).length} bytes, squat bedst e1RM ${Math.round(ix1.base.squat.e1rm)} kg`)
  assert.equal(rekordKald.length, 1)
  assert.ok(rekordKald[0].raekker > 3000, 'første gang hentes hele historikken')

  // 2. Genåbning.
  await genindlaes(() => venterPaa('Squat', 1))
  await page.waitForFunction(() => true)
  for (let i = 0; i < 20 && rekordKald.length === 0; i++) await page.waitForTimeout(500)
  resultat.fund.genaabning = rekordKald.slice()
  trin(`genåbning: ${rekordKald.map(k => `${k.raekker} rækker (${k.filter})`).join(', ')}`)
  assert.equal(rekordKald.length, 1)
  assert.ok(rekordKald[0].raekker < 200 && rekordKald[0].filter.startsWith('gte.'), 'kun rækker nyere end indekset')

  // 3. Sæt 1: 100 × 5 → samme fejring som 439.
  await godkendt().click()
  await page.locator('[data-rekord-fejring]').waitFor({ state: 'visible', timeout: 8000 })
  let f = await fejringer()
  trin(`sæt 1 (100 kg × 5): "${f[f.length - 1]?.tekst}"`)
  assert.equal(f.length, 1)
  assert.equal(f[0].key, `${sq}_1`)
  assert.match(f[0].tekst, /Ny rekord: Squat e1RM 117 kg, \+3 kg$/)
  await page.screenshot({ path: path.join(UD, '01-rekord-lang-historik.png') })

  // 4. Genindlæst: ingen fejring igen. Sæt 2 samme vægt: ingen. Sæt 3 102,5: ja.
  await page.waitForTimeout(800)
  await genindlaes(() => venterPaa('Squat', 2))
  f = await fejringer()
  const synlig = await page.locator('[data-rekord-fejring]').count()
  trin(`genindlæst efter sæt 1: fejring på skærmen ${synlig ? 'ja' : 'nej'}; fejringer i alt ${f.length}`)
  assert.equal(synlig, 0, 'ingen fejring efter genindlæsning')
  assert.equal(f.length, 1)
  await godkendt().click()
  await venterPaa('Squat', 3)
  await page.waitForTimeout(1200)
  f = await fejringer()
  trin(`sæt 2 (100 kg × 5): fejringer i alt ${f.length}`)
  assert.equal(f.length, 1, 'sæt 2 må ikke fejres')
  await page.getByRole('button', { name: '2,5 kg mere', exact: true }).click()
  await page.waitForTimeout(200)
  await godkendt().click()
  await page.waitForFunction((k) => document.querySelector('[data-rekord-fejring]')?.getAttribute('data-rekord-fejring') === k, `${sq}_3`, { timeout: 8000 })
  f = await fejringer()
  trin(`sæt 3 (102,5 kg × 5): "${f[f.length - 1]?.tekst}"`)
  assert.equal(f.length, 2)
  assert.match(f[1].tekst, /Ny rekord: Squat e1RM 120 kg, \+3 kg$/)

  // 5. Genindlæst igen.
  await page.waitForTimeout(800)
  await genindlaes(() => venterPaa('Squat', 4))
  f = await fejringer()
  const ix2 = await indeks()
  const ugeId = seed.tables.weeks[seed.tables.weeks.length - 1].id
  resultat.fund.indeksEfter = { bytes: JSON.stringify(ix2).length, uger: Object.keys(ix2.uger), squatUge: Math.round(ix2.uger[ugeId]?.squat?.e1rm || 0), squatBase: Math.round(ix2.base.squat.e1rm) }
  trin(`genindlæst igen: fejring på skærmen ${await page.locator('[data-rekord-fejring]').count() ? 'ja' : 'nej'}; fejringer i alt ${f.length}; indekset: ugens squat ${resultat.fund.indeksEfter.squatUge} kg, før ugen ${resultat.fund.indeksEfter.squatBase} kg`)
  assert.equal(await page.locator('[data-rekord-fejring]').count(), 0)
  assert.equal(f.length, 2, 'to fejringer i alt, ingen dobbelt')
  assert.equal(resultat.fund.indeksEfter.squatUge, 120)
  assert.equal(resultat.fund.indeksEfter.squatBase, 114)

  // 6. Fremgang.
  await page.locator('nav').getByText('Fremgang', { exact: true }).click()
  await page.locator('[data-rekord-liste]').waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(800)
  const raekker = await page.evaluate(() => [...document.querySelectorAll('[data-rekord]')].map(r => r.innerText.replace(/\s+/g, ' ').trim()))
  const idag = raekker.filter(r => r.startsWith(iDag))
  resultat.fund.fremgangIDag = idag
  trin(`Fremgang, i dag: ${JSON.stringify(idag)}`)
  assert.equal(idag.length, 2)
  assert.equal(idag.filter(r => /Squat e1RM 117 kg/.test(r)).length, 1)
  assert.equal(idag.filter(r => /Squat e1RM 120 kg/.test(r)).length, 1)
  await page.locator('[data-rekord-liste]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(UD, '02-fremgang-lang-historik.png') })
  const rows = (await (await fetch(`http://127.0.0.1:${MOCK_PORT}/__e2e/table?name=exercise_logs`)).json()).filter(r => r.exercise_id === sq)
  trin(`mocken: squat-sæt ${rows.map(r => `${r.set_number}:${r.weight}×${r.reps_completed}`).sort().join(' ')}`)
  assert.equal(rows.length, 3)

  assert.equal(konsolFejl.length, 0, `konsolfejl: ${konsolFejl.join(' | ')}`)
  resultat.groen = true
  console.log('GRØN: genindlæsning')
} catch (e) {
  resultat.groen = false
  resultat.fejl = String(e?.stack || e)
  await page.screenshot({ path: path.join(UD, 'fejl-genindlaes.png') }).catch(() => {})
  console.error('RØD:', e.message)
  process.exitCode = 1
} finally {
  writeFileSync(path.join(UD, 'genindlaes.json'), JSON.stringify(resultat, null, 2) + '\n')
  await browser.close(); server.close(); await mock.close()
}
