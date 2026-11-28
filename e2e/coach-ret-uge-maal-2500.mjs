// ORDRE 2500: maaler coachens rettelse af naeste uge i tryk og felter (mock, syntetisk atlet). Kun maaling.
// Koersel: E2E_VITE_PORT=5500 E2E_MOCK_PORT=8900 VITE_SUPABASE_URL=http://127.0.0.1:8900 node e2e/coach-ret-uge-maal-2500.mjs
import { createMockSupabase } from './mock-supabase.mjs'
import { COACH_USER, ATHLETE_ID, WEEK_ID, buildSeed } from './fixtures.mjs'
import { startVite, launchBrowser, APP_URL, MOCK_PORT } from './harness.mjs'
const id = (a, b) => `50${String(a).padStart(2, '0')}0000-0000-4000-8000-${String(b).padStart(12, '0')}`
export function seed() {
  const s = buildSeed(); const t = s.tables
  const monday = t.weeks[0].start_date
  t.weeks = [{ id: WEEK_ID, athlete_id: ATHLETE_ID, week_number: 1, block_name: 'Base', start_date: monday }]
  t.sessions = []; t.exercises = []
  const pas = [
    ['Dag 1 Squat', 0, [['Squat', 4, '5', 'RPE 8', 100], ['Pausesquat', 3, '6', 'RPE 7', 80], ['Rumaensk dodloeft', 3, '8', 'RPE 7', 90], ['Planke', 3, '30 sek', '', null]]],
    ['Dag 2 Baenk', 2, [['Baenkpres', 4, '5', 'RPE 8', 80], ['Tung baenk', 3, '3', 'RPE 8', 85], ['Roning', 4, '8', 'RPE 7', 60], ['Triceps', 3, '12', '', null], ['Face pull', 3, '15', '', null]]],
    ['Dag 3 Dodloeft', 4, [['Dodloeft', 4, '4', 'RPE 8', 140], ['Goodmorning', 3, '8', 'RPE 7', 70], ['Pull-ups', 4, '6', '', null], ['Bagside', 3, '10', '', null]]],
  ]
  pas.forEach(([title, wd, ex], i) => {
    const sid = id(1, i + 1); t.sessions.push({ id: sid, week_id: WEEK_ID, title, session_order: i + 1, weekday: wd, athlete_rating: null, athlete_comment: null })
    ex.forEach(([name, sets, reps, intensity, w], j) => t.exercises.push({ id: id(2, i * 10 + j + 1), session_id: sid, name, sets, reps, intensity, note: null, exercise_order: j + 1, recommended_weight: w }))
  })
  t.exercise_library = [{ id: id(3, 1), name: 'Pause baenk', category: 'Baenkpres' }, { id: id(3, 2), name: 'Hip thrust', category: 'Andet' }]
  return s
}
const tema = (p, n) => p.evaluate(v => (v === 'lys' ? document.documentElement.setAttribute('data-tema', 'lys') : document.documentElement.removeAttribute('data-tema')), n)
async function start(browser, bredde, hoejde, navn) {
  const ctx = await browser.newContext({ viewport: { width: bredde, height: hoejde }, colorScheme: navn === 'lys' ? 'light' : 'dark' }); const p = await ctx.newPage()
  const fejl = []; p.on('pageerror', e => fejl.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fejl.push(m.text()) })
  await p.goto(APP_URL); await p.evaluate(() => { try { localStorage.clear() } catch {} }); await p.goto(APP_URL)
  await p.locator('#athlete-auth-email').fill(COACH_USER.email); await p.locator('#athlete-auth-password').fill(COACH_USER.password)
  await p.getByRole('button', { name: 'Log ind' }).click(); await p.locator('[data-coach-idag]').waitFor({ timeout: 20000 }); await tema(p, navn)
  const m = { tryk: 0, felter: 0, rul: 0, p, ctx, fejl }
  const udenfor = async l => { await l.waitFor({ timeout: 15000 }); const b = await l.boundingBox(); const h = p.viewportSize().height; return !b || b.y < 0 || b.y + b.height > h }
  m.klik = async l => { m.tryk++; if (await udenfor(l)) m.rul++; await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 15000 }) }
  m.fyld = async (l, v) => { m.felter++; if (await udenfor(l)) m.rul++; await l.fill(String(v), { timeout: 15000 }) }
  m.overloeb = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  return m
}
export async function aaben(browser, bredde, hoejde, navn, mock) {
  const m = await start(browser, bredde, hoejde, navn)
  await m.klik(m.p.getByRole('button', { name: 'Åbn programmet for Testatlet' }).first()); await m.p.waitForTimeout(1500)
  return m
}
export async function maal(browser, bredde, hoejde, navn) {
  const ud = []; const s = seed(); const mock = createMockSupabase({ users: s.users, tables: structuredClone(s.tables) }); await mock.listen(MOCK_PORT)
  const m = await start(browser, bredde, hoejde, navn); const p = m.p
  const trin = async (navnet, f) => { const t0 = m.tryk, f0 = m.felter, r0 = m.rul; const info = await f(); await p.waitForTimeout(900); ud.push([navnet, m.tryk - t0, m.felter - f0, m.rul - r0, info ?? '', await m.overloeb()]) }
  try {
    await trin('0 aaben atletens program', async () => { await m.klik(p.getByRole('button', { name: 'Åbn programmet for Testatlet' }).first()); await p.waitForTimeout(1200) })
    await trin('1 kopier ugen til naeste uge', async () => {
      await m.klik(p.getByRole('button', { name: /Kopiér seneste uge/ })); await p.waitForTimeout(1500)
      const pas = mock.table('sessions').filter(x => x.week_id !== WEEK_ID)
      return 'uger ' + mock.table('weeks').length + '; pas i ny uge ' + pas.length + '; ugedage ' + pas.map(x => x.weekday).join(',') + '; oevelser ' + mock.table('exercises').length
    })
    await p.screenshot({ path: '/tmp/o2500/efter-kopi-' + bredde + '-' + navn + '.png' })
    const nyUge = mock.table('weeks').find(w => w.id !== WEEK_ID)?.id
    const nyePas = () => mock.table('sessions').filter(x => x.week_id === nyUge)
    const aabnPas = async titel => { const knap = p.getByRole('button', { name: titel, exact: true }).last(); if ((await knap.getAttribute('aria-expanded')) !== 'true') await m.klik(knap) }
    const hoved = [['Squat', 'Dag 1 Squat'], ['Baenkpres', 'Dag 2 Baenk'], ['Dodloeft', 'Dag 3 Dodloeft']]
    await trin('2 haev vaegt paa tre hovedloeft', async () => {
      for (const [ex, pas] of hoved) {
        await aabnPas(pas)
        const nu = mock.table('exercises').filter(e => e.name === ex).at(-1).recommended_weight
        await m.klik(p.getByRole('button', { name: 'Rediger anbefalet vægt for ' + ex }).last())
        await m.fyld(p.getByLabel('Anbefalet vægt (kg)'), nu + 5); await m.klik(p.getByRole('button', { name: 'Gem', exact: true }).last()); await p.waitForTimeout(700)
      }
      return hoved.map(([ex]) => mock.table('exercises').filter(e => e.name === ex).map(e => e.recommended_weight).join('/')).join(' ')
    })
    await p.screenshot({ path: '/tmp/o2500/efter-vaegt-' + bredde + '-' + navn + '.png' })
    await trin('3 ret reps paa ét loeft', async () => {
      await aabnPas('Dag 1 Squat'); await m.klik(p.getByRole('button', { name: 'Rediger Squat', exact: true }).last())
      await m.fyld(p.getByLabel('Reps', { exact: true }), '4'); await m.klik(p.getByRole('button', { name: 'Gem', exact: true }).last()); await p.waitForTimeout(700)
      return 'reps ' + mock.table('exercises').filter(e => e.name === 'Squat').map(e => e.reps).join('/')
    })
    await trin('4 slet én oevelse', async () => {
      const foer = mock.table('exercises').length
      await aabnPas('Dag 1 Squat'); await m.klik(p.getByRole('button', { name: 'Slet Planke', exact: true }).last()); await p.waitForTimeout(500)
      const bek = p.getByRole('button', { name: /^(Slet|Ja|Bekræft)/ }); const dlg = await p.getByRole('dialog').count()
      return 'oevelser ' + foer + ' -> ' + mock.table('exercises').length + '; dialog ' + dlg
    })
    await trin('5 tilfoej oevelse fra biblioteket', async () => {
      await aabnPas('Dag 2 Baenk'); await m.klik(p.getByRole('button', { name: '+ Tilføj øvelse' }).first())
      await m.fyld(p.getByLabel('Navn', { exact: true }).last(), 'Pause')
      await m.klik(p.getByText('Pause baenk', { exact: true }).last())
      const sæt = p.getByLabel('Sæt', { exact: true }).last(); await m.fyld(sæt, '3'); await m.fyld(p.getByLabel('Reps', { exact: true }).last(), '5')
      await m.klik(p.getByRole('button', { name: 'Tilføj', exact: true }).last()); await p.waitForTimeout(700)
      return 'oevelser ' + mock.table('exercises').length
    })
    await trin('6 flyt ét pas til en anden ugedag', async () => {
      await m.klik(p.getByRole('button', { name: 'Rediger', exact: true }).nth(2)); await p.waitForTimeout(400)
      const tor = p.getByRole('group', { name: 'Fast ugedag (valgfri)' }).getByRole('button', { name: /^tor/i })
      const bb = await tor.boundingBox()
      await m.klik(tor); await m.klik(p.getByRole('button', { name: 'Gem', exact: true }).last()); await p.waitForTimeout(700)
      return 'ugedage ' + nyePas().map(x => x.title.slice(0, 5) + '=' + x.weekday).join(',') + '; ugedagsknap ' + Math.round(bb.width) + 'x' + Math.round(bb.height) + ' px'
    })
    await trin('7 send/udgiv ugen (kopi er straks synlig for atleten)', async () => {
      return 'ingen send-knap efter Kopiér seneste uge: ugen ligger i databasen straks (uger ' + mock.table('weeks').length + ')'
    })
    await p.screenshot({ path: '/tmp/o2500/slut-' + bredde + '-' + navn + '.png' })
  } catch (e) { ud.push(['FEJL', 0, 0, 0, String(e).slice(0, 400), false]); await p.screenshot({ path: '/tmp/o2500/fejl-' + bredde + '-' + navn + '.png' }).catch(() => {}) }
  finally { ud.fejl = m.fejl; await m.ctx.close(); await mock.close() }
  return ud
}
if (process.argv[1].endsWith('coach-ret-uge-maal-2500.mjs')) {
  const vite = await startVite(), browser = await launchBrowser()
  try { for (const [b, h] of [[390, 844], [1280, 800]]) for (const n of ['lys', 'moerk']) { console.log('== ' + b + ' ' + n); const u = await maal(browser, b, h, n); for (const r of u) console.log(r.join(' | ')); console.log('konsolfejl', u.fejl.length, u.fejl.slice(0, 3)) } }
  catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); await vite.stop() }
}
