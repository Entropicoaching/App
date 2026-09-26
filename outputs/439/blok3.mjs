// ORDRE 439, blok 3: offline-beviset for rekorder. Kaldes fra
// verify-439.mjs --blok 3. dist/ serveres med public/sw.js som i produktion.
//   1. Online: log ind, service workeren tager siden, historikken hentes og
//      rekord-grundlaget lægges på telefonen (ORDRE 450: i rekord-indekset).
//   2. Uden net: appen genåbnes (kælderen), Dagens pas vises fra telefonen.
//      Squat sæt 1 (100 kg × 5, bedst før 97,5 × 5) logges: fejringen står på
//      kortet, så snart sættet ligger i den lokale kø, uden et eneste kald.
//      Sæt 2 (samme vægt) fejres ikke.
//   3. Nettet tilbage: køen sendes af sig selv. Ingen ny fejring, én række pr.
//      sæt i mocken, og Fremgang viser dagens rekord præcis én gang.
import assert from 'node:assert/strict'

const tabel = async (mockUrl, navn) => (await (await fetch(`${mockUrl}/__e2e/table?name=${navn}`)).json())

export async function blok3({ page, context, port, sq, shot, trin, resultat, mockUrl, fx, godkendt, venterPaa, fane, rekordRaekker, iDag }) {
  const koeNoegle = `entropi_offline_sets:${fx.ATHLETE_ID}`
  const kaldUdenNet = []
  let offline = false
  context.on('request', (r) => { if (offline && r.url().startsWith(mockUrl)) kaldUdenNet.push(`${r.method()} ${r.url().replace(mockUrl, '').split('?')[0]}`) })

  // 1. Online.
  await page.goto(`http://127.0.0.1:${port}/`)
  await page.locator('#athlete-auth-email').fill(fx.ATHLETE_USER.email)
  await page.locator('#athlete-auth-password').fill(fx.ATHLETE_USER.password)
  await page.getByRole('button', { name: 'Log ind' }).click()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await page.getByText('Dagens pas', { exact: true }).waitFor({ state: 'visible', timeout: 30000 })
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service workeren skal styre siden')
  // ORDRE 450: grundlaget ligger nu i rekord-indekset (entropi_rekord_indeks:<bruger>),
  // ikke i øjebliksbilledet. Samme krav: bygget, med de forgangne ugers maksima.
  await page.waitForFunction(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('entropi_rekord_indeks:'))
    const s = k && JSON.parse(localStorage.getItem(k))
    return s && s.bygget && Object.keys(s.base || {}).length > 0
  }, null, { timeout: 20000 })
  const grundlag = await page.evaluate(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith('entropi_rekord_indeks:'))
    const ix = JSON.parse(localStorage.getItem(k))
    const g = ix.base
    return { oevelser: Object.keys(g).length, squatE1rm: Math.round(g.squat?.e1rm || 0), bytes: localStorage.getItem(k).length }
  })
  resultat.fund.grundlag = grundlag
  trin(`online: logget ind, service workeren styrer siden; rekord-grundlaget ligger på telefonen (${grundlag.oevelser} øvelser, squat bedst e1RM ${grundlag.squatE1rm} kg, ${grundlag.bytes} bytes)`)

  // 2. Uden net, appen genåbnet.
  offline = true
  await context.setOffline(true)
  await page.reload()
  await venterPaa('Squat', 1)
  assert.equal(await page.locator('#athlete-auth-email').count(), 0, 'ingen login-skærm uden net')
  await page.evaluate(() => {
    window.__fejringer = []
    const noter = () => {
      const e = document.querySelector('[data-rekord-fejring]')
      const k = e && e.getAttribute('data-rekord-fejring')
      if (k && window.__fejringer[window.__fejringer.length - 1]?.key !== k) window.__fejringer.push({ key: k, tekst: e.textContent.trim(), t: Date.now() })
    }
    new MutationObserver(noter).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-rekord-fejring'] })
  })
  trin('uden net: appen genåbnet, Dagens pas vist fra telefonen (Squat sæt 1/4)')

  await page.waitForTimeout(300)
  await godkendt().click()
  await page.locator('[data-rekord-fejring]').waitFor({ state: 'visible', timeout: 5000 })
  const koe = await page.evaluate((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')), koeNoegle)
  const f1 = await page.evaluate(() => window.__fejringer.slice())
  resultat.fund.fejringUdenNet = f1
  trin(`uden net: sæt 1 (100 kg × 5) fejret: "${f1[0]?.tekst}"; i køen: ${koe.join(', ')}; appens øvrige hentninger forsøgt uden net (ingen nåede frem): ${kaldUdenNet.length}`)
  resultat.fund.kaldUdenNet = kaldUdenNet
  assert.ok(!kaldUdenNet.some(k => /^(POST|PATCH|DELETE) \/rest\/v1\/exercise_logs/.test(k)), 'ingen skrivning af sættet uden net')
  assert.equal(f1.length, 1)
  assert.equal(f1[0].key, `${sq}_1`)
  assert.match(f1[0].tekst, /Ny rekord: Squat e1RM 117 kg, \+3 kg$/)
  assert.ok(koe.includes(`${sq}_1`), 'sættet ligger i den lokale kø')
  await page.locator('[data-rekord-fejring]').scrollIntoViewIfNeeded()
  await shot('05-offline-rekord-fejret')

  await venterPaa('Squat', 2)
  await page.waitForTimeout(300)
  await godkendt().click()
  await venterPaa('Squat', 3)
  await page.getByText('2 sæt gemt lokalt', { exact: false }).waitFor({ state: 'visible', timeout: 5000 })
  trin('uden net: sæt 2 (samme vægt) logget, ingen ny fejring; "2 sæt gemt lokalt"')

  // 3. Nettet tilbage.
  offline = false
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForFunction((k) => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length === 0, koeNoegle, { timeout: 60000 })
  await page.waitForTimeout(3000)
  const rows = (await tabel(mockUrl, 'exercise_logs')).filter(r => r.exercise_id === sq)
  const pr = rows.map(r => r.set_number).sort()
  const alle = await page.evaluate(() => window.__fejringer.slice())
  resultat.fund.fejringerIalt = alle
  trin(`nettet tilbage: køen tømt; mocken har squat-sæt [${pr.join(',')}]; fejringer i alt: ${alle.length} (${alle.map(f => f.key.endsWith('_1') ? 'sæt 1' : f.key).join(', ')})`)
  assert.deepEqual(pr, [1, 2], 'én række pr. sæt')
  assert.equal(alle.length, 1, 'rekorden fejres kun én gang, også efter afsendelsen')

  await fane('Fremgang')
  await page.locator('[data-rekord-liste]').waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(800)
  const idag = (await rekordRaekker()).filter(r => r.startsWith(iDag))
  resultat.fund.fremgangIDag = idag
  trin(`Fremgang efter afsendelsen: i dag = ${JSON.stringify(idag)}`)
  assert.equal(idag.length, 1, 'præcis én rekord i dag, ikke én fra køen og én fra serveren')
  assert.match(idag[0], /Squat e1RM 117 kg/)
  await page.locator('[data-rekord-liste]').scrollIntoViewIfNeeded()
  await shot('06-fremgang-efter-net')
}
