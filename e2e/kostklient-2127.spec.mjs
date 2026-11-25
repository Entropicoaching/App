// Ordre 2127 (Marc 24. nov.: "kost kan købes alene"): kostklientens indkøbsliste ved 390 px, lys og mørk.
// Mål: hvor langt fra toppen af indkøbsafsnittet ligger første vare og "Kopiér indkøbsliste", og hvor mange tryk fra Kost.
// Kør: E2E_VITE_PORT=5227 E2E_MOCK_PORT=8927 VITE_SUPABASE_URL=http://127.0.0.1:8927 node e2e/kostklient-2127.spec.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { ATHLETE_USER } from './fixtures.mjs'
import { startVite, launchBrowser, MOCK_PORT, APP_URL } from './harness.mjs'
import { seed as ugeSeed } from './kost-set-paa-main.spec.mjs'

const MOBILE = { width: 390, height: 844 }
// Grænser i skærmhøjder (844 px) fra indkøbsafsnittets top til varen/knappen.
// Ordre 2380: Kopiér-knapperne står nu foran listen (to rækker på 390 px), så første vare ligger ca. 0,13 skærm lavere: 0,73.
const MAX_FOERSTE_VARE = Number(process.env.MAX_FOERSTE_VARE || 0.8)
const MAX_KOPIKNAP = Number(process.env.MAX_KOPIKNAP || 1.1)
const MAX_TRYK = 2
const MAALE = process.env.MAALE === '1'
function seed() {
  const s = ugeSeed()
  s.tables.weeks = []; s.tables.sessions = []; s.tables.exercises = []; s.tables.exercise_logs = []
  return s
}
const krav = (ok, tekst) => { if (!ok) throw new Error(tekst) }
const fund = []; const sjekk = (ok, tekst) => { if (!ok) fund.push(tekst) }
const knap = (page, navn) => page.getByRole('button', { name: navn, exact: true }).first()
async function login(page) {
  await page.goto(APP_URL); await page.evaluate(() => { try { localStorage.clear() } catch { /* ignoreret */ } }); await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(ATHLETE_USER.email); await page.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}
// Afstand fra dokumentets top til elementets top, i skærmhøjder; kun synlige (ikke lukkede details) elementer.
const afstand = (page, vaelger) => page.evaluate(([v, hoejde]) => {
  const el = document.querySelector(v); if (!el) return null
  return (el.getBoundingClientRect().top + window.scrollY) / hoejde
}, [vaelger, MOBILE.height])
const vite = await startVite(), browser = await launchBrowser(), errors = []
let fejl = null
try {
  for (const scheme of ['light', 'dark']) {
    const s = seed(); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
    const ctx = await browser.newContext({ viewport: MOBILE, colorScheme: scheme }); const page = await ctx.newPage()
    page.on('pageerror', err => errors.push(`${scheme}: ${err.message}`))
    try {
      await login(page)
      let tryk = 0
      await knap(page, 'Åbn kost').waitFor({ timeout: 20000 }); await knap(page, 'Åbn kost').click(); tryk++
      await knap(page, 'Vis detaljer').waitFor({ timeout: 20000 }); await knap(page, 'Vis detaljer').click(); tryk++
      await page.getByText('Indkøb fra kostplanen').first().waitFor({ timeout: 20000 })
      await page.locator('section[aria-label="Indkøb fra kostplanen"] [data-shopping-complete="true"]').waitFor({ timeout: 20000 })
      await page.locator('ul[aria-label="Samlet bruttobehov"] li').first().waitFor({ timeout: 20000 })
      const sek = await afstand(page, 'section[aria-label="Indkøb fra kostplanen"]')
      const vare = await afstand(page, 'ul[aria-label="Samlet bruttobehov"] li')
      const kopi = await page.evaluate(h => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Kopiér indkøbsliste')
        return b ? (b.getBoundingClientRect().top + window.scrollY) / h : null
      }, MOBILE.height)
      const side = await page.evaluate(h => document.documentElement.scrollHeight / h, MOBILE.height)
      // Blokke i afsnittet før første vare: top for hver direkte undereleement, i px.
      const blokke = await page.evaluate(() => {
        const sec = document.querySelector('section[aria-label="Indkøb fra kostplanen"]'); const ul = document.querySelector('ul[aria-label="Samlet bruttobehov"]')
        const top = ul.getBoundingClientRect().top; const ud = []
        const gaa = (el) => { for (const c of el.children) { if (c.contains(ul)) { gaa(c); continue } const r = c.getBoundingClientRect(); if (r.top < top && r.height) ud.push(`${c.tagName.toLowerCase()} ${Math.round(r.height)}px: ${(c.textContent || '').trim().slice(0, 50)}`) } }
        gaa(sec); return ud
      })
      const lige = (n) => Math.round(n * 100) / 100
      console.log(`${scheme}: tryk ${tryk}; afsnit ${lige(sek)} skærme; første vare ${lige(vare)} (${lige(vare - sek)} efter afsnittets top); Kopiér indkøbsliste ${lige(kopi)} (${lige(kopi - sek)} efter top); side ${lige(side)} skærme`)
      if (MAALE) console.log(blokke.join('\n'))
      sjekk(tryk <= MAX_TRYK, `${scheme}: ${tryk} tryk, højst ${MAX_TRYK}`)
      sjekk(vare - sek <= MAX_FOERSTE_VARE, `${scheme}: første vare ${lige(vare - sek)} skærmhøjder under afsnittets top, højst ${MAX_FOERSTE_VARE}`)
      sjekk(kopi !== null && kopi - sek <= MAX_KOPIKNAP, `${scheme}: Kopiér indkøbsliste ${kopi === null ? 'findes ikke' : lige(kopi - sek)} skærmhøjder under afsnittets top, højst ${MAX_KOPIKNAP}`)
      sjekk(await page.evaluate(() => document.documentElement.scrollWidth) <= MOBILE.width + 1, `${scheme}: vandret scroll`)
      // Teksten må ikke fjernes, kun foldes: kilder, versioner og bruttobehov findes stadig i siden.
      const tekst = await page.evaluate(() => document.querySelector('section[aria-label="Indkøb fra kostplanen"]').textContent)
      for (const t of ['Bruttobehov', 'Kilde og varegrundlag', 'version', 'Købt-markeringer er kun lokale', 'ikke dokumenteret næringsdækning', 'omregnes ikke til råvarer'])
        sjekk(tekst.includes(t), `${scheme}: teksten "${t}" mangler i indkøbsafsnittet`)
    } finally { await ctx.close(); await mock.close() }
  }
  krav(!errors.length, 'pageerror: ' + errors.join(' | '))
  krav(!fund.length, fund.join('\n'))
} catch (err) { fejl = err } finally { await browser.close(); await vite.stop() }
if (fejl) { console.error('FEJL:', fejl.message); process.exit(1) }
console.log('2127 e2e grøn')
