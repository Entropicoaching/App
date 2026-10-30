import { useTestRelease } from '../trin1TestProfile.mjs'
// These fixtures exercise the legacy contract, independently of the shipped step.
useTestRelease(0)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { readinessNavigation, openReadinessSurface } = await import('./readinessShortcut.mjs')
const { previewNavigation, DEFAULT_ENKEL_PROTOTYPE } = await import('./enkelPrototype.mjs')
const { weightTrendText } = await import('./weightTrend.mjs')
const { checkinNoteTimingText } = await import('../readinessInsight.js')

// Fresh counterexamples, separate from the six repair probes.
test('modproeve: only explicit true changes route; every tab change closes shortcut', () => {
  assert.equal(DEFAULT_ENKEL_PROTOTYPE, false)
  for (const enabled of [undefined, null, false, 0, 1, 'true', true]) {
    for (const destination of ['program', 'beskeder', 'fremgang', 'mere', 'hjem']) {
      let open=true, route='unchanged', tab
      const go=readinessNavigation(previewNavigation(enabled, x=>tab=x, x=>route=x), x=>open=x)
      go(destination)
      assert.equal(open, false)
      assert.equal(route === 'unchanged', enabled !== true)
      assert.ok(tab)
    }
  }
})

test('modproeve: reopen after navigation focuses actual synthetic card without editing storage', () => {
  let open=false, tab, focused=0, scrolled=0
  const frames=[]
  const go=readinessNavigation(x=>tab=x, x=>open=x)
  const opts={ setTab:go, setReadinessOpen:x=>open=x, setMereOpen() {}, requestFrame:cb=>frames.push(cb),
    readinessCardRef:{current:{focus(){focused++},scrollIntoView(){scrolled++}}} }
  openReadinessSurface(opts)
  while(frames.length) frames.shift()()
  go('program'); go('hjem')
  assert.equal(open,false)
  openReadinessSurface(opts)
  while(frames.length) frames.shift()()
  assert.equal(open,true); assert.equal(tab,'hjem')
  assert.equal(focused,2); assert.equal(scrolled,2)
})

test('modproeve: both Home variants bind identical current text helpers; short weight history remains empty', () => {
  const texts=['HjemTab.jsx','EnkelHjemTab.jsx'].map(name=>readFileSync(new URL(name,import.meta.url),'utf8').replace(/\r\n/g,'\n'))
  for(const code of texts) {
    assert.match(code,/const noteTiming = planChange && checkinNoteTimingText\(planChange, fmtD\)/)
    assert.match(code,/const trendText = weightTrendText\(sorted\)/)
    assert.doesNotMatch(code,/Sidst det gjorde en forskel|siden forrige uge/)
    // Long trend text has its own line, independent of the numeric weight.
    assert.match(code,/\{trendText && \(\s*<div[^>]*>\{trendText\}<\/div>/)
  }
  for(let n=0;n<8;n++) assert.equal(weightTrendText(Array.from({length:n},(_,i)=>({logged_at:`2026-10-0${i+1}`,weight:80}))),null)
  assert.match(checkinNoteTimingText({checkinDate:'a',weekStartDate:'b'},x=>x).description,/ikke hvorfor noten blev skrevet/)
})
