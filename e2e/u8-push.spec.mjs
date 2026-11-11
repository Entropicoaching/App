// U8 "Push": headless mod den ægte app og mock-backenden (port 8991). Kun syntetiske data og nøgler.
// Tre kørsler, så appen ses uden og med nøgle og tabel:
//   E2E_HIDE_TABLES=push_subscriptions_v1,push_preferences_v1,push_log_v1 node e2e/u8-push.spec.mjs uden [billedmappe] [resultat.json]
//   node e2e/u8-push.spec.mjs tabel-uden-noegle [billedmappe] [resultat.json]
//   node e2e/u8-push.spec.mjs med [billedmappe] [resultat.json]      (spec'en laver selv en syntetisk nøgle)
// "foer" er samme kørsel som "uden" mod U7-koden, til sammenligning af tekst og billeder.
// Ærlig grænse: Chromium uden net kan ikke tilmelde sig en rigtig push-tjeneste. Tilmeldingen
// erstattes derfor af en syntetisk i browseren, og en besked leveres til service workeren via
// DevTools (ServiceWorker.deliverPushMessage). Krypteringen og afsendelsen er prøvet i u8Send.test.mjs.
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { generateKeyPairSync } from 'node:crypto'
import { ATHLETE_USER, COACH_USER } from './fixtures.mjs'
import { startVite, launchBrowser, chromium, APP_URL, MOCK_PORT, OUT_DIR } from './harness.mjs'
import { u7Seed } from './u7-kost-data.spec.mjs'

const VIEWPORTS = [{ name: '390', width: 390, height: 844 }, { name: '1280', width: 1280, height: 900 }]
const TABLES = ['push_subscriptions_v1', 'push_preferences_v1', 'push_log_v1']
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ENDPOINT = 'https://push.example.test/e2e-atlet'

const waitFor = async (check, ms = 15000) => {
  const start = Date.now()
  while (Date.now() - start < ms) { if (await check()) return true; await new Promise(r => setTimeout(r, 150)) }
  return false
}
async function noSideScroll(page, width) {
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth)
  if (scroll > width + 1) throw new Error(`Vandret scroll på ${width} px: ${scroll}px`)
}
async function edges(page, width, selector) {
  const out = await page.evaluate(({ selector, width }) => [...document.querySelectorAll(selector)].filter(el => {
    const b = el.getBoundingClientRect(); return b.width && (b.right > width + 1 || b.left < -1)
  }).map(el => el.tagName), { selector, width })
  if (out.length) throw new Error(`${out.length} elementer går ud over kanten på ${width} px: ${out.join(', ')}`)
}

async function login(page, user) {
  await page.addInitScript(id => {
    try { localStorage.setItem('entropi2:onboarding:v1', '1'); localStorage.setItem(`entropi2:onboarding:v1:athlete:${encodeURIComponent(id)}`, '1') }
    catch { /* syntetisk */ }
  }, '33333333-3333-4333-8333-333333333333')
  await page.goto(APP_URL)
  await page.locator('#athlete-auth-email').fill(user.email)
  await page.locator('#athlete-auth-password').fill(user.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
}

// Chromium uden net: tilmeldingen til push-tjenesten erstattes af en syntetisk med samme form.
// Som en rigtig tilmelding overlever den en genindlæsning (gemt i localStorage under sin egen nøgle).
const fakeSubscription = endpoint => {
  const KEY = 'e2e-u8-syntetisk-tilmelding'
  const make = key => ({ endpoint, options: { applicationServerKey: key },
    toJSON: () => ({ endpoint, keys: { p256dh: 'B' + 'a'.repeat(86), auth: 'c'.repeat(22) } }),
    unsubscribe: async () => { localStorage.removeItem(KEY); return true } })
  PushManager.prototype.getSubscription = async function () {
    const saved = localStorage.getItem(KEY)
    return saved ? make(Uint8Array.from(JSON.parse(saved)).buffer) : null
  }
  PushManager.prototype.subscribe = async function (options) {
    const key = new Uint8Array(options.applicationServerKey.buffer ?? options.applicationServerKey)
    localStorage.setItem(KEY, JSON.stringify([...key]))
    return make(key.buffer)
  }
}

async function home(page) {
  await page.locator('[data-entropi2-home]').waitFor({ state: 'visible', timeout: 30000 })
  await page.locator('[data-u5-meal]').waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(2000)
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function athlete(page, vp, outDir, mode, mock, cdp) {
  await login(page, ATHLETE_USER)
  await home(page)
  await noSideScroll(page, vp.width)
  const card = page.locator('[data-u8-push]')
  const result = { mode }
  await page.screenshot({ path: join(outDir, `u8-${mode}-atlet-${vp.name}-1-forside.png`) })
  if (mode !== 'med') {
    if (await card.count()) throw new Error('Push-kortet vises uden nøgle eller tabel')
    result.homeText = (await page.locator('[data-entropi2-home]').textContent()).replace(/\s+/g, ' ')
    return result
  }
  await card.waitFor({ state: 'visible', timeout: 20000 })
  await card.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await edges(page, vp.width, '[data-u8-push], [data-u8-push] *')
  await card.screenshot({ path: join(outDir, `u8-med-atlet-${vp.name}-2-paamindelse-fra.png`) })
  // Ét tryk: tidspunktet står allerede på 19.00; her vælges 07.30 først for at se, at valget gemmes.
  await card.getByLabel('Tidspunkt for påmindelsen').selectOption('07:30')
  await card.getByRole('button', { name: 'Slå påmindelser til' }).click()
  await page.getByText('Påmindelser er slået til. Du hører fra os kl. 07.30, hvis noget mangler.').waitFor({ timeout: 10000 })
  const saved = await waitFor(() => mock.table('push_subscriptions_v1').some(r => r.endpoint === ENDPOINT && r.user_id === ATHLETE_USER.id) &&
    mock.table('push_preferences_v1').some(r => r.user_id === ATHLETE_USER.id && r.remind_at === '07:30' && r.reminders_on === true))
  if (!saved) throw new Error('Tilmeldingen blev ikke gemt som egen række: ' + JSON.stringify([mock.table('push_subscriptions_v1'), mock.table('push_preferences_v1')]))
  await page.locator('[data-u8-push="on"]').waitFor({ timeout: 10000 })
  const on = await page.locator('[data-u8-push="on"] summary').textContent()
  if (on !== 'Påmindelse kl. 07.30, hvis noget mangler. Skift') throw new Error('Linjen efter tilmelding er forkert: ' + on)
  await page.locator('[data-u8-push="on"]').screenshot({ path: join(outDir, `u8-med-atlet-${vp.name}-3-paamindelse-til.png`) })
  result.tilmeldt = { endpoint: ENDPOINT, remind_at: '07:30', linje: on }
  // Service workeren viser en besked, som edge-funktionen ville sende den.
  const regs = cdp.registrations.filter(r => r.scopeURL === APP_URL && !r.isDeleted)
  if (!regs.length) throw new Error('Ingen service worker registreret')
  await cdp.session.send('ServiceWorker.deliverPushMessage', { origin: APP_URL.slice(0, -1), registrationId: regs.at(-1).registrationId,
    data: JSON.stringify({ title: 'Din coach har svaret', body: 'Tryk for at læse beskeden.', url: '/?u8=beskeder', tag: 'coach-svar' }) })
  let shown = []
  await waitFor(async () => (shown = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications())
    .map(n => ({ title: n.title, body: n.body, tag: n.tag, data: n.data })))).length > 0, 10000)
  const expected = { title: 'Din coach har svaret', body: 'Tryk for at læse beskeden.', tag: 'coach-svar', data: { url: '/?u8=beskeder' } }
  if (JSON.stringify(shown) !== JSON.stringify([expected])) throw new Error('Service workeren viste ikke beskeden: ' + JSON.stringify(shown))
  result.notifikation = shown[0]
  // Klik åbner appen på /?u8=beskeder: beskedfanen åbnes, og adressen ryddes.
  await page.goto(`${APP_URL}?u8=beskeder`)
  const opened = await waitFor(async () => !(await page.locator('[data-entropi2-home]').count()) && !page.url().includes('u8='), 20000)
  if (!opened) throw new Error('Klik på beskeden åbnede ikke beskeder: ' + page.url())
  await page.waitForTimeout(1500)
  result.aabnet = { url: page.url(), tekst: (await page.locator('body').textContent()).replace(/\s+/g, ' ').slice(0, 160) }
  await page.screenshot({ path: join(outDir, `u8-med-atlet-${vp.name}-4-klik-aabner-beskeder.png`) })
  // Slå fra: rækken slettes.
  await page.goto(APP_URL)
  await home(page)
  await page.locator('[data-u8-push="on"] summary').click()
  await page.getByRole('button', { name: 'Slå påmindelser fra' }).click()
  await page.getByText('Påmindelser er slået fra på denne telefon.').waitFor({ timeout: 10000 })
  if (!await waitFor(() => !mock.table('push_subscriptions_v1').some(r => r.endpoint === ENDPOINT))) throw new Error('Rækken blev ikke slettet')
  result.slaaetFra = true
  return result
}

async function iphone(page, vp, outDir, mock) {
  await login(page, ATHLETE_USER)
  await home(page)
  const card = page.locator('[data-u8-push="ios"]')
  await card.waitFor({ state: 'visible', timeout: 20000 })
  const text = (await card.textContent()).replace(/\s+/g, ' ')
  if (!/Føj til hjemmeskærm/.test(text) || /Slå påmindelser til/.test(text)) throw new Error('iPhone-forklaringen er forkert: ' + text)
  await card.evaluate(el => el.scrollIntoView({ block: 'center' }))
  await edges(page, vp.width, '[data-u8-push], [data-u8-push] *')
  await card.screenshot({ path: join(outDir, `u8-med-iphone-${vp.name}-1-hjemmeskaerm.png`) })
  await card.getByRole('button', { name: 'Ikke nu' }).click()
  await page.locator('[data-u8-push="ios"] summary').waitFor({ timeout: 5000 })
  if (mock.table('push_subscriptions_v1').length) throw new Error('iPhone i Safari må ikke tilmelde sig')
  return { mode: 'med', iphone: text.slice(0, 200) }
}

async function coach(page, vp, outDir, mode) {
  await login(page, COACH_USER)
  await page.getByText('Kræver dit blik').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(2000)
  await noSideScroll(page, vp.width)
  if (await page.locator('[data-u8-push]').count()) throw new Error('Coachen ser push-kortet')
  const section = page.locator('section[aria-label="Atleter der kræver handling"]')
  await page.screenshot({ path: join(outDir, `u8-${mode}-coach-${vp.name}-1-forside.png`) })
  return { mode, coachText: (await section.textContent()).replace(/\s+/g, ' ') }
}

async function main() {
  const mode = process.argv[2]
  if (!['uden', 'tabel-uden-noegle', 'med', 'foer'].includes(mode)) throw new Error('Angiv uden, tabel-uden-noegle, med eller foer')
  const hidden = (process.env.E2E_HIDE_TABLES || '').split(',').map(s => s.trim()).filter(Boolean)
  if (['uden', 'foer'].includes(mode) && TABLES.some(t => !hidden.includes(t))) throw new Error('uden kræver E2E_HIDE_TABLES=' + TABLES.join(','))
  if (!['uden', 'foer'].includes(mode) && hidden.length) throw new Error(`${mode} må ikke skjule tabeller`)
  // En syntetisk offentlig nøgle, kun til denne kørsel.
  if (mode === 'med') {
    const jwk = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ format: 'jwk' })
    process.env.E2E_U8_PUBLIC_KEY = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url')
  } else delete process.env.E2E_U8_PUBLIC_KEY
  const { createMockSupabase } = await import('./mock-supabase.mjs')
  const outDir = process.argv[3] || OUT_DIR
  const resultFile = process.argv[4]
  mkdirSync(outDir, { recursive: true })
  const vite = await startVite()
  const browser = await launchBrowser().catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const results = []
  const fresh = async (vp, run, { userAgent } = {}) => {
    const mock = createMockSupabase(u7Seed(true))
    await mock.listen(MOCK_PORT)
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, ...(userAgent ? { userAgent } : {}) })
    await context.grantPermissions(['notifications'], { origin: APP_URL.slice(0, -1) })
    await context.addInitScript(fakeSubscription, ENDPOINT)
    const page = await context.newPage()
    const cdp = { session: await context.newCDPSession(page), registrations: [] }
    cdp.session.on('ServiceWorker.workerRegistrationUpdated', e => cdp.registrations.push(...e.registrations))
    await cdp.session.send('ServiceWorker.enable')
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    try {
      const result = await run(page, mock, cdp)
      if (errors.length) throw new Error(`browserfejl: ${errors.join('; ')}`)
      return result
    } finally { await context.close(); await mock.close?.() }
  }
  try {
    for (const vp of VIEWPORTS) {
      results.push(['atlet', vp.width, await fresh(vp, (page, mock, cdp) => athlete(page, vp, outDir, mode, mock, cdp))])
      results.push(['coach', vp.width, await fresh(vp, page => coach(page, vp, outDir, mode))])
    }
    if (mode === 'med') results.push(['iphone', 390, await fresh(VIEWPORTS[0], (page, mock) => iphone(page, VIEWPORTS[0], outDir, mock), { userAgent: IPHONE })])
    for (const r of results) console.log(`GRØN: ${r[0]} på ${r[1]} px ${JSON.stringify(r[2]).slice(0, 300)}`)
  } finally {
    await browser.close(); await vite.stop()
  }
  if (resultFile) writeFileSync(resultFile, JSON.stringify({ mode, results }, null, 2))
  console.log(`U8 e2e (${mode}): ${results.length} af ${mode === 'med' ? 5 : 4} grønne`)
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) main().catch(err => { console.error(err); process.exitCode = 1 })
