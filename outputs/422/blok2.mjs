// ORDRE 422, blok 2: maalinger for I5 og de tre smaa fra 419. Kaldes fra
// verify-422.mjs --blok 2 (samme opsaetning, samme syntetiske uge).
import { ensureSyntheticClip } from '../../e2e/harness.mjs'

export async function blok2({ page, shot, krav, resultat, fane, mockUrl, fx }) {
  const godkendt = () => page.getByRole('button', { name: 'Godkendt', exact: true })
  const venterPaa = (navn, n) => page.waitForFunction(([navn, n]) => {
    const t = document.body.innerText
    return t.includes(`Sæt ${n}/`) && t.includes(navn)
  }, [navn, n], { timeout: 15000 })
  async function log(navn, n) {
    await venterPaa(navn, n)
    await page.waitForTimeout(400)
    await godkendt().click()
    await page.waitForTimeout(300)
  }
  const tilstand = () => page.evaluate(() => document.querySelector('[data-klarede-saet]')?.getAttribute('data-klarede-saet') || null)

  // ---- "vis / ret" foldes sammen ved ny oevelse ----
  await log('Squat', 1)
  await log('Squat', 2)
  await venterPaa('Squat', 3)
  await page.getByRole('button', { name: 'Vis 2 klarede sæt', exact: true }).click()
  resultat.fund.squatEfterVis = await tilstand()
  await log('Squat', 3)
  await log('Squat', 4)
  await log('Bænkpres', 1)
  await venterPaa('Bænkpres', 2)
  resultat.fund.baenkEfterSkift = await tilstand()
  console.log(`  [vis/ret] squat efter tryk: ${resultat.fund.squatEfterVis}; baenk efter skift: ${resultat.fund.baenkEfterSkift}`)
  krav(resultat.fund.squatEfterVis === 'foldet-ud', '"vis / ret" skal folde listen ud')
  krav(resultat.fund.baenkEfterSkift === 'kollapset', '"vis / ret" skal vaere foldet sammen, naar kortet skifter oevelse')

  // ---- ret-panelet paa 390 px ----
  await log('Bænkpres', 2)
  await log('Bænkpres', 3)
  await log('Bulgarsk split squat', 1)
  await venterPaa('Bulgarsk split squat', 2)
  // Foer rettelsen stod listen allerede foldet ud fra squatten.
  const vis1 = page.getByRole('button', { name: 'Vis 1 klarede sæt', exact: true })
  if (await vis1.count()) await vis1.click()
  await page.getByRole('button', { name: 'Ret sæt 1', exact: true }).click()
  await page.getByLabel('Reps, ret sæt 1').waitFor({ state: 'visible', timeout: 5000 })
  const ret = await page.evaluate(() => {
    const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), right: Math.round(b.right) } }
    return {
      repsMindre: box('button[aria-label="1 rep mindre (ret)"]'),
      repsFelt: box('input[aria-label="Reps, ret sæt 1"]'),
      repsMere: box('button[aria-label="1 rep mere (ret)"]'),
      kgMindre: box('button[aria-label="2,5 kg mindre (ret)"]'),
      kgMere: box('button[aria-label="2,5 kg mere (ret)"]'),
      bredde: innerWidth,
    }
  })
  resultat.fund.retPanel = ret
  await page.getByLabel('Reps, ret sæt 1').scrollIntoViewIfNeeded()
  await shot('06-ret-panel')
  const repsSammeLinje = ret.repsMindre.top === ret.repsFelt.top && ret.repsFelt.top === ret.repsMere.top
  const kgSammeLinje = ret.kgMindre.top === ret.kgMere.top
  const indenfor = Math.max(ret.repsMere.right, ret.kgMere.right) <= ret.bredde
  console.log(`  [ret-panel] reps -/felt/+ top ${ret.repsMindre.top}/${ret.repsFelt.top}/${ret.repsMere.top}; kg -/+ top ${ret.kgMindre.top}/${ret.kgMere.top}; hoejre kant ${Math.max(ret.repsMere.right, ret.kgMere.right)} af ${ret.bredde}`)
  krav(repsSammeLinje, 'ret-panelet braekker midt i reps-kontrollerne')
  krav(kgSammeLinje, 'ret-panelet braekker midt i vaegt-kontrollerne')
  krav(indenfor, 'ret-panelet gaar ud over skaermen')
  await page.getByRole('button', { name: 'Fortryd, ret sæt 1', exact: true }).click()

  // ---- pauselinjen stopper efter passets sidste saet ----
  await log('Bulgarsk split squat', 2)
  resultat.fund.pauseFoerSidste = await page.getByRole('button', { name: 'Skjul pausetimer' }).count()
  await log('Bulgarsk split squat', 3)
  await page.getByText(/Hvordan gik det/).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)
  resultat.fund.pauseEfterSidste = await page.getByRole('button', { name: 'Skjul pausetimer' }).count()
  await shot('11-pas-faerdigt')
  console.log(`  [pause] pauselinjer foer sidste saet: ${resultat.fund.pauseFoerSidste}; efter passets sidste saet: ${resultat.fund.pauseEfterSidste}`)
  krav(resultat.fund.pauseFoerSidste === 1, 'pausen skal stadig starte mellem saet')
  krav(resultat.fund.pauseEfterSidste === 0, 'pauselinjen skal stoppe efter passets sidste saet')

  // ---- I5: een kvittering efter Send ----
  const clip = ensureSyntheticClip()
  await fane('Hjem')
  const mere = page.getByRole('button', { name: 'Mere', exact: true })
  if (await mere.getAttribute('aria-expanded') !== 'true') await mere.click()
  await page.getByText('VideoCoach', { exact: true }).click()
  const frame = page.frameLocator('iframe[title="VideoCoach"]')
  await frame.locator('body.athlete').waitFor({ state: 'attached', timeout: 15000 })
  await frame.locator('#fileInput').setInputFiles(clip)
  await frame.locator('#athleteSubmitSheet[hidden]').waitFor({ state: 'detached', timeout: 15000 })
  await frame.locator('#liftSel').selectOption({ label: 'Squat' })
  await frame.locator('#saveBtn').click()
  await page.waitForFunction(async ([u, a]) => (await (await fetch(`${u}/__e2e/table?name=video_analyses`)).json()).some(r => r.athlete_id === a && r.analysis_state === 'awaiting_analysis'), [mockUrl, fx.ATHLETE_ID], { timeout: 20000 })
  await frame.locator('#banner:not([hidden])').waitFor({ state: 'visible', timeout: 10000 })
  const kvit = async () => frame.locator('body').evaluate(() => {
    const synlig = (e) => !!e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0
    const banner = document.getElementById('banner')
    const status = document.getElementById('athleteStatus')
    const bb = banner.getBoundingClientRect()
    const cs = getComputedStyle(banner)
    return {
      banner: synlig(banner) ? banner.textContent : null,
      status: synlig(status) ? status.innerText.replace(/\s+/g, ' ') : null,
      px: parseFloat(cs.fontSize), baggrund: cs.backgroundColor,
      indenfor: bb.left >= 0 && bb.right <= innerWidth, linjer: Math.round(bb.height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2)),
    }
  })
  const k = await kvit()
  resultat.fund.kvittering = k
  await shot('16-video-sendt')
  await page.waitForTimeout(6000)
  resultat.fund.kvitteringEfter6s = await kvit()
  console.log(`  [I5] banner: "${k.banner}" (${k.px}px, ${k.baggrund}); statuskort: ${k.status ? `"${k.status}"` : 'skjult'}; efter 6 s: ${resultat.fund.kvitteringEfter6s.banner ? 'staar der' : 'væk'}`)
  const kvitteringer = [k.banner, k.status].filter(Boolean)
  krav(kvitteringer.length === 1 && /Video modtaget/.test(k.banner || ''), `een kvittering ("Video modtaget"), fik ${JSON.stringify(kvitteringer)}`)
  krav(k.px >= 15 && k.indenfor, 'kvitteringen skal vaere laeselig og inden for skaermen')
  krav(/rgb\(20, 20, 16\)/.test(k.baggrund), 'kvitteringen skal have taet baggrund')
  krav(/Video modtaget/.test(resultat.fund.kvitteringEfter6s.banner || ''), 'kvitteringen skal blive staaende')
}
