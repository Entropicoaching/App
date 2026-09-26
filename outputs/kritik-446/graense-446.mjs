// ORDRE 446, blok 1: rekorden mod raekke-graensen. 439 regner "bedst foer" ud
// fra historik-kaldet (limit 4000, nyeste foerst). Supabase' PostgREST har en
// egen loftgraense ("Max rows", standard 1000 i et nyt projekt); prod's
// indstilling er ikke laest (ingen kald mod prod). Her simuleres loftet ved at
// skrive limit=4000 om til limit=1000 i browseren.
// Syntetisk atlet med 130 ugers historik, hvor squat for 130 eller 60 uger siden var
// 110 x 5 (e1RM 128). I dag loeftes 100 x 5 (e1RM 117): ingen rekord.
//   top for 130 uger siden (uden for 4000 raekker): fejres falsk?
//   top for 60 uger siden: ingen fejring med 4000, falsk fejring med loft 1000?
// Koersel: node outputs/kritik-446/graense-446.mjs -> graense-446.json + G-*.png
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { UD, MOCK_PORT, BYG, statiskServer, hentChromium, bygSeed, nyTelefon, logIndAtlet, brugbart } from './faelles-446.mjs'

const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const browser = await hentChromium().launch({ headless: true })
const { server, port } = await statiskServer(path.join(BYG, 'dist-efter439'))
const resultat = { gammelTop: '110 x 5', idag: '100 x 5', koersler: [] }

try {
  for (const [topUge, loft] of [[-130, null], [-60, null], [-60, 1000]]) {
    const { seed } = bygSeed(fx.buildSeed, fx, { uger: 130, gammelTop: 110, gammelTopUge: topUge })
    const mock = createMockSupabase(seed)
    await mock.listen(MOCK_PORT)
    const { context, page } = await nyTelefon(browser)
    let historikRaekker = null
    if (loft) await page.route(/\/rest\/v1\/exercise_logs\?.*limit=4000/, (route) => route.continue({ url: route.request().url().replace('limit=4000', `limit=${loft}`) }))
    page.on('response', async (res) => {
      if (/select=exercise_id/.test(res.url()) && /limit=(4000|1000)/.test(res.url())) historikRaekker = (await res.json().catch(() => [])).length
    })
    await logIndAtlet(page, port, fx)
    await brugbart(page)
    await page.waitForFunction(() => {
      const k = Object.keys(localStorage).find(x => x.startsWith('entropi_offline_pas:'))
      return !!(k && JSON.parse(localStorage.getItem(k))?.rekordFoer?.grundlag)
    }, null, { timeout: 60000 })
    const bedstFoer = await page.evaluate(() => {
      const k = Object.keys(localStorage).find(x => x.startsWith('entropi_offline_pas:'))
      return Math.round(JSON.parse(localStorage.getItem(k)).rekordFoer.grundlag.squat?.e1rm || 0)
    })
    await page.waitForTimeout(500)
    const vaegt = await page.locator('input[aria-label^="Vægt, sæt"]').inputValue()
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    const fejring = await page.locator('[data-rekord-fejring]').waitFor({ state: 'visible', timeout: 5000 }).then(() => page.locator('[data-rekord-fejring]').innerText(), () => null)
    await page.screenshot({ path: path.join(UD, `G-top${-topUge}-${loft ? 'loft-1000' : 'graense-4000'}.png`) })
    resultat.koersler.push({ topForUger: -topUge, loft: loft || 'ingen (4000)', historikRaekker, bedstFoerSquatE1rm: bedstFoer, feltetsVaegt: vaegt, fejring })
    console.log(`top for ${-topUge} uger siden, loft ${loft || 'ingen'}: ${historikRaekker} raekker, bedst foer squat e1RM ${bedstFoer}, fejring: ${fejring || 'ingen'}`)
    await context.close(); await mock.close()
  }
} finally {
  writeFileSync(path.join(UD, 'graense-446.json'), JSON.stringify(resultat, null, 2) + '\n')
  await browser.close(); server.close()
}
