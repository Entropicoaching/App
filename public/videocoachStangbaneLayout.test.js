// Marc 3. nov.: i stangbane-flowet laa guideteksten oven paa videoens overkant
// (hvor skiven ofte er) og tidslinjen bag coachens vaerktoejer. Skaermbilleder
// foer/efter ligger i Hara\worktrees\_e2-logs\samlet-r2\.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('./videocoach.html', import.meta.url), 'utf8')

test('coach guide banner sits outside the top of the video and the timeline above the tools', () => {
  assert.match(html, /body\.coachweb #banner \{ top:auto; bottom:192px;/)
  assert.match(html, /@media \(min-width:900px\) \{\s*body\.coachweb #banner, body\.desktop #banner \{ top:88px; bottom:auto; left:16px;/)
  assert.match(html, /body\.slim\.coachweb #scrubRow \{ bottom:124px !important; \}/)
  assert.match(html, /body\.coachweb #timeLabel \{ white-space:nowrap;/)
})

// Runde 3 (Marcs test): guiden maa aldrig ligge over videoen, heller ikke i 7 s. Den
// skjules ikke laengere automatisk; i stedet faar den sit eget baand, og videoens flade
// flyttes. Den faktiske maaling (getBoundingClientRect, 390 og 1280 px) ligger i
// Hara/worktrees/_e2-logs/samlet-r3/.
test('guide text keeps its own band: say() refits the coach stage instead of hiding after 7 s', () => {
  const say = html.slice(html.indexOf('let sayTimer = 0;'), html.indexOf('// MOBIL-FIX: bjælkerne'))
  assert.ok(say.includes('function say(txt)'))
  assert.ok(say.includes('banner.hidden = !txt;'))
  assert.ok(say.includes('if (COACHWEB) vcCoachFitStage();'))
  assert.ok(!/7000\)/.test(say))
})

test('coach stage is fitted between the fixed bars, measured on the real elements', () => {
  const fit = html.slice(html.indexOf('function vcCoachFitStage()'), html.indexOf("window.addEventListener('resize', () => { layoutBars(); reflowFit(); });"))
  for (const id of ['vcSystemBar', 'scrubRow', 'moreBar', 'barPathHUD']) assert.ok(fit.includes(id), id)
  assert.match(fit, /stage\.style\.setProperty\('top'/)
  assert.match(fit, /stage\.style\.setProperty\('bottom'/)
  assert.match(html, /if \(COACHWEB\) \{ setInterval\(vcCoachFitStage, 400\);/)
})
