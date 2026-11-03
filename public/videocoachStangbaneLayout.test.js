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

test('guide text hides itself after 7 s on a narrow coach screen and still clears like before', () => {
  const say = html.slice(html.indexOf('let sayTimer = 0;'), html.indexOf('// MOBIL-FIX: bjælkerne'))
  assert.ok(say.includes('function say(txt)'))
  assert.ok(say.includes('banner.hidden = !txt;'))
  assert.match(say, /COACHWEB && innerWidth < 900\) sayTimer = setTimeout\([^)]*\) => \{ if \(banner\.textContent === txt\) banner\.hidden = true; \}, 7000\)/)
  assert.ok(say.includes('clearTimeout(sayTimer);'))
})
