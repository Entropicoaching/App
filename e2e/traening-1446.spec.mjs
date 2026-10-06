// ORDRE 1446 - en hel traening som atlet paa 390x844 (mock): Dagens pas, opvarmning,
// log alle saet, pause, afslut, Fremgang. Skaermbilleder (viewport) + tekstdump pr. trin.
// Egen koersel: `node e2e/traening-1446.spec.mjs` (billeder i outputs/1446/<E2E_TAG||efter>).
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ATHLETE_USER, ATHLETE_ID, WEEK_ID, SESSION_ID, buildSeed } from './fixtures.mjs'

const TAG = process.env.E2E_TAG || 'efter'
const OUT_DIR = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), '..', 'outputs', '1446', TAG)
mkdirSync(OUT_DIR, { recursive: true })
const W = 390, H = 844
const uuid = (n) => `${String(n).padStart(8, '0')}-1446-4446-8446-${String(n).padStart(12, '0')}`

function seed() {
  const s = buildSeed()
  s.tables.exercises = [
    { id: uuid(1), session_id: SESSION_ID, name: 'Squat - topsæt', sets: 2, reps: '3', intensity: 'RPE 8', note: 'Hold spændingen i bunden', exercise_order: 1, recommended_weight: 120 },
    { id: uuid(2), session_id: SESSION_ID, name: 'Squat - backoff', sets: 2, reps: '6', intensity: 'RPE 7', note: null, exercise_order: 2, recommended_weight: 100 },
    { id: uuid(3), session_id: SESSION_ID, name: 'Rumænsk dødløft', sets: 2, reps: '8', intensity: 'RPE 7', note: null, exercise_order: 3, recommended_weight: 90 },
  ]
  return s
}

async function main() {
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const { startVite, launchBrowser, APP_URL, MOCK_PORT } = await import('./harness.mjs')
  const vite = await startVite(); const browser = await launchBrowser()
  const mock = createMockSupabase(seed()); await mock.listen(MOCK_PORT)
  const fejl = []
  let n = 0
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H } })
    const p = await ctx.newPage()
    p.on('pageerror', e => fejl.push('pageerror: ' + e.message))
    p.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) fejl.push('console.error: ' + m.text()) })
    const snap = async (navn) => {
      await p.waitForTimeout(500)
      n++
      const id = `${String(n).padStart(2, '0')}-${navn}`
      await p.screenshot({ path: join(OUT_DIR, id + '.png'), fullPage: false })
      const txt = await p.evaluate(() => document.body.innerText)
      writeFileSync(join(OUT_DIR, id + '.txt'), txt)
      const sw = await p.evaluate(() => document.documentElement.scrollWidth)
      const smaa = await p.evaluate(() => [...document.querySelectorAll('button,a,input,[role=button],label')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && (r.height < 40 || r.width < 40) }).map(e => { const r = e.getBoundingClientRect(); return `${(e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || e.outerHTML.slice(0, 90)).trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}` }))
      console.log(`--- ${id} (scrollWidth ${sw})
SMAA: ${JSON.stringify(smaa)}
${txt.slice(0, 1800)}`)
    }
    await p.goto(APP_URL)
    await p.locator('#athlete-auth-email').fill(ATHLETE_USER.email)
    await p.locator('#athlete-auth-password').fill(ATHLETE_USER.password)
    await p.getByRole('button', { name: 'Log ind' }).click()
    await p.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 15000 })
    await snap('hjem')
    const hjemTxt = await p.evaluate(() => document.body.innerText)
    assert.ok(await p.getByTestId('varm-op-link').isVisible(), 'Varm op-link mangler foer foerste saet')
    assert.match(hjemTxt, /Anbefalet: 120 kg/); assert.match(hjemTxt, /2 SÆT · × 3 REPS/i); assert.ok(!/Sæt 1 · Sæt/.test(hjemTxt))
    // Opvarmning (Mobilitet -> Varm op)
    const klik = async (loc, ms = 800) => { await loc.first().click({ timeout: 4000 }).catch(e => console.log('KLIK-FEJL', String(e).slice(0, 120))); await p.waitForTimeout(ms) }
    await klik(p.getByRole('button', { name: 'Mobilitet', exact: true }))
    await snap('mobilitet')
    await klik(p.getByText('Varm op'))
    await snap('varm-op')
    await klik(p.getByRole('button', { name: /Næste →/ })); await snap('opvarmning-problemer')
    await klik(p.getByRole('button', { name: /Start opvarmning/ })); await snap('opvarmning-1')
    for (let i = 2; i <= 14; i++) {
      const nxt = p.getByRole('button', { name: /Næste øvelse →|Afslut opvarmning/ })
      if (!(await nxt.first().isVisible().catch(() => false))) break
      const sidste = /Afslut/.test(await nxt.first().innerText())
      await klik(nxt, 500)
      if (i <= 3 || sidste) await snap(`opvarmning-${i}`)
      if (sidste) break
    }
    await snap('opvarmning-slut')
    assert.ok(await p.getByRole('button', { name: /Til dagens pas/ }).isVisible(), 'Til dagens pas-knap mangler efter opvarmning')
    await klik(p.getByRole('button', { name: 'Hjem', exact: true }))
    for (let i = 1; i <= 7; i++) {
      const g = p.getByRole('button', { name: 'Godkendt', exact: true })
      if (!(await g.isVisible().catch(() => false))) break
      await g.click()
      await p.waitForTimeout(700)
      await snap(`efter-saet-${i}`)
      const luk = p.getByTestId('rest-pause-close')
      if (await luk.isVisible().catch(() => false)) await luk.click()
    }
    await snap('slut-hjem')
    for (const [navn, id] of [['Program', 'program'], ['Fremgang', 'fremgang']]) {
      await p.getByRole('button', { name: navn, exact: true }).first().click().catch(() => {})
      await p.waitForTimeout(1000); await snap(id)
    }
    if (process.env.EXPLORE) { await p.waitForTimeout(600000) }
  } catch (e) { console.error('ASSERT-FEJL', e); process.exitCode = 1
  } finally {
    console.log('FEJL:', JSON.stringify(fejl))
    await browser.close(); await mock.close?.(); vite.kill?.()
    process.exit(process.exitCode || (fejl.length ? 1 : 0))
  }
}
main().catch(e => { console.error(e); process.exit(1) })
