// ORDRE 456: KOPI af outputs/kritik-446/graense-446.mjs (Bhishak), koert mod grenen
// klar-til-push. AEndret: faelles-456 (skriver her), loftet efterlignes nu i
// mocken (createMockSupabase(seed, { maxRows: 1000 }), som Supabase' "Max rows"
// paa ALLE svar) i stedet for at skrive limit=4000 om, fordi 456 henter side for
// side; historikRaekker er summen over alle sider; "bedst foer" laeses i
// rekord-indekset (450) i stedet for oejebliksbilledet. Scenariet er uaendret.
//
// ORDRE 446, blok 1: rekorden mod raekke-graensen. 439 regner "bedst foer" ud
// fra historik-kaldet (limit 4000, nyeste foerst). Supabase' PostgREST har en
// egen loftgraense ("Max rows", standard 1000 i et nyt projekt); prod's
// indstilling er ikke laest (ingen kald mod prod). Her simuleres loftet ved at
// skrive limit=4000 om til limit=1000 i browseren.
// Syntetisk atlet med 130 ugers historik, hvor squat for 130 eller 60 uger siden var
// 110 x 5 (e1RM 128). I dag loeftes 100 x 5 (e1RM 117): ingen rekord.
//   top for 130 uger siden (uden for 4000 raekker): fejres falsk?
//   top for 60 uger siden: ingen fejring med 4000, falsk fejring med loft 1000?
// Koersel: node outputs/456/graense-456.mjs -> outputs/456/graense-446.json + G-*.png
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { UD, MOCK_PORT, DIST, statiskServer, hentChromium, bygSeed, nyTelefon, logIndAtlet, brugbart, rekordIndeksBygget, bedstFoerE1rm } from './faelles-456.mjs'

const { createMockSupabase } = await import('../../e2e/mock-supabase.mjs')
const fx = await import('../../e2e/fixtures.mjs')
const browser = await hentChromium().launch({ headless: true })
const { server, port } = await statiskServer(DIST)
const resultat = { gammelTop: '110 x 5', idag: '100 x 5', koersler: [] }

try {
  for (const [topUge, loft] of [[-130, null], [-60, null], [-60, 1000]]) {
    const { seed } = bygSeed(fx.buildSeed, fx, { uger: 130, gammelTop: 110, gammelTopUge: topUge })
    const mock = createMockSupabase(seed, { maxRows: loft })
    await mock.listen(MOCK_PORT)
    const { context, page } = await nyTelefon(browser)
    let historikRaekker = null
    // Hver side taelles, naar dens svar er laest (ogsaa den tomme sidste side).
    const svar = []
    page.on('response', (res) => {
      if (/select=exercise_id/.test(res.url()) && /offset=/.test(res.url())) svar.push(res.json().then(j => j.length, () => null))
    })
    await logIndAtlet(page, port, fx)
    await brugbart(page)
    await rekordIndeksBygget(page)
    const bedstFoer = await bedstFoerE1rm(page, 'squat')
    const laengder = await Promise.all(svar)
    const sider = laengder.length
    historikRaekker = laengder.every(n => n != null) ? laengder.reduce((a, n) => a + n, 0) : null
    await page.waitForTimeout(500)
    const vaegt = await page.locator('input[aria-label^="Vægt, sæt"]').inputValue()
    await page.getByRole('button', { name: 'Godkendt', exact: true }).click()
    const fejring = await page.locator('[data-rekord-fejring]').waitFor({ state: 'visible', timeout: 5000 }).then(() => page.locator('[data-rekord-fejring]').innerText(), () => null)
    await page.screenshot({ path: path.join(UD, `G-top${-topUge}-${loft ? 'loft-1000' : 'graense-4000'}.png`) })
    resultat.koersler.push({ topForUger: -topUge, loft: loft || 'ingen', historikRaekker, sider, bedstFoerSquatE1rm: bedstFoer, feltetsVaegt: vaegt, fejring })
    console.log(`top for ${-topUge} uger siden, loft ${loft || 'ingen'}: ${historikRaekker} raekker paa ${sider} sider, bedst foer squat e1RM ${bedstFoer}, fejring: ${fejring || 'ingen'}`)
    await context.close(); await mock.close()
  }
} finally {
  writeFileSync(path.join(UD, 'graense-446.json'), JSON.stringify(resultat, null, 2) + '\n')
  await browser.close(); server.close()
}
