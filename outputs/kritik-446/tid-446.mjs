// ORDRE 446, blok 1: tid til Dagens pas er brugbart, foer og efter 439.
// 439 henter op til 4000 historik-raekker i baggrunden ved hver aabning. Maales
// paa en "aeldre telefon" (Slow 4G + 4x CPU, se faelles-446.mjs), 390 px, med
// let historik (3 uger, ca. 100 saet) og tung (130 uger, over graensen 4000).
// Foer = main foer 439 (412f2c1, udpakket med git archive), efter = main.
// Pr. kombination: log ind uden drosling (service workeren tager siden), saa 3
// genaabninger med drosling. Maalt: ms fra genaabning til Dagens pas er
// brugbart (se brugbart()), til ugen er hentet, og til historik-kaldet er
// faerdigt, plus historik-svarets stoerrelse.
// Koersel: node outputs/kritik-446/tid-446.mjs [--no-build]  -> tid-446.json
import path from 'node:path'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { ROOT, UD, MOCK_PORT, BYG, byg, statiskServer, hentChromium, bygSeed, nyTelefon, logIndAtlet, brugbart, drosl, NET, CPU } from './faelles-446.mjs'

const FOER = '412f2c1'
const OPEN = 3
const src = { foer: path.join(BYG, 'src-foer439'), efter: ROOT }
const dist = { foer: path.join(BYG, 'dist-foer439'), efter: path.join(BYG, 'dist-efter439') }
if (!process.argv.includes('--no-build')) {
  mkdirSync(BYG, { recursive: true })
  if (!existsSync(path.join(src.foer, 'package.json'))) {
    mkdirSync(src.foer, { recursive: true })
    const tar = path.join(BYG, 'foer439.tar')
    execSync(`git archive --format=tar -o "${tar}" ${FOER}`, { cwd: ROOT })
    execSync(`tar -xf "${tar}" -C "${src.foer}"`)
  }
  if (!existsSync(path.join(src.foer, 'node_modules'))) execSync(`cmd /c mklink /J "${path.join(src.foer, 'node_modules')}" "${path.join(ROOT, 'node_modules')}"`)
  console.log('Bygger foer 439 og efter 439 mod mocken ...')
  byg(src.foer, dist.foer)
  byg(src.efter, dist.efter)
}

const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const browser = await hentChromium().launch({ headless: true })
const resultat = { drosling: { net: NET, cpu: CPU }, aabninger: OPEN, maalinger: [] }

for (const historik of [{ navn: 'let', uger: 3 }, { navn: 'tung', uger: 130 }]) {
  for (const version of ['foer', 'efter']) {
    const { seed } = bygSeed(fx.buildSeed, fx, { uger: historik.uger })
    const mock = createMockSupabase(seed)
    await mock.listen(MOCK_PORT)
    const { server, port } = await statiskServer(dist[version])
    const { context, page } = await nyTelefon(browser)
    await logIndAtlet(page, port, fx)
    await page.evaluate(async () => { await navigator.serviceWorker.ready })
    await brugbart(page)
    await page.waitForTimeout(3000)
    const d = await drosl(page)
    const kald = []
    page.on('requestfinished', async (r) => {
      if (!r.url().includes('/rest/v1/')) return
      const s = await r.sizes().catch(() => null)
      kald.push({ t: Date.now(), url: r.url().replace(/^.*\/rest\/v1\//, ''), bytes: s?.responseBodySize ?? null })
    })
    const runder = []
    for (let i = 0; i < OPEN; i++) {
      kald.length = 0
      const t0 = Date.now()
      await page.reload()
      await brugbart(page)
      const tBrugbart = Date.now() - t0
      // Vent til historik-kaldet (limit=4000) er faerdigt, hvis versionen har det.
      const graense = Date.now() + 60000
      while (Date.now() < graense && !kald.some(k => /limit=4000/.test(k.url) && /exercise_id%2C|exercise_id,/.test(k.url))) await page.waitForTimeout(100)
      await page.waitForTimeout(1500)
      const uge = kald.find(k => k.url.startsWith('weeks?'))
      const hist = kald.find(k => /limit=4000/.test(k.url) && /select=exercise_id/.test(k.url))
      const tonnage = kald.find(k => /limit=4000/.test(k.url) && /select=weight/.test(k.url))
      runder.push({
        brugbartMs: tBrugbart,
        ugeHentetMs: uge ? uge.t - t0 : null,
        historikFaerdigMs: hist ? hist.t - t0 : null,
        historikBytes: hist?.bytes ?? null,
        tonnageBytes: tonnage?.bytes ?? null,
        kald: kald.length,
        bytesIalt: kald.reduce((a, k) => a + (k.bytes || 0), 0),
      })
      console.log(`  ${historik.navn.padEnd(4)} ${version.padEnd(5)} aabning ${i + 1}: brugbart ${tBrugbart} ms, historik ${hist ? `${hist.t - t0} ms, ${Math.round((hist.bytes || 0) / 1024)} kB` : '-'}, ${kald.length} kald`)
    }
    const logs = seed.tables.exercise_logs
    resultat.maalinger.push({
      historik: historik.navn, uger: historik.uger, saetIHistorik: logs.length, saetDerTaeller: logs.filter(l => !l.skipped && l.weight > 0).length,
      version, runder,
      medianBrugbartMs: runder.map(r => r.brugbartMs).sort((a, b) => a - b)[Math.floor(OPEN / 2)],
    })
    await d.cdp.detach().catch(() => {})
    await context.close(); server.close(); await mock.close()
  }
}
await browser.close()
writeFileSync(path.join(UD, 'tid-446.json'), JSON.stringify(resultat, null, 2) + '\n')
for (const m of resultat.maalinger) console.log(`${m.historik} (${m.saetIHistorik} saet) ${m.version}: median ${m.medianBrugbartMs} ms til brugbart`)
