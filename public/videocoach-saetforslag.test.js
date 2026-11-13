// ORDRE 1206: sætforslaget skal sættes i coach-visningen. begin() armerer
// session-wizarden lige før vcApplySetBoundsSuggestion, og den gamle betingelse
// kasserede derfor altid forslaget. Kører den levende funktion fra videocoach.html.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('./videocoach.html', import.meta.url), 'utf8')
const a = html.indexOf('async function vcApplySetBoundsSuggestion(')
const b = html.indexOf("document.getElementById('setStartSuggestBtn').onclick", a)
assert.ok(a > 0 && b > a, 'vcApplySetBoundsSuggestion findes')
const h = html.indexOf('function vcWizardIGang(')
assert.ok(h > 0, 'vcWizardIGang findes')
const helper = html.slice(h, html.indexOf('function vcMotionSeries(', h))
const src = helper + html.slice(a, b)

test('forudsøgningens løkke afbryder kun på wizard i gang, ikke på ren armering', () => {
  const l = html.indexOf('async function vcRunSetBoundsPresearch(')
  const kropp = html.slice(l, a)
  assert.ok(kropp.includes('vcWizardIGang() || tracking || awaitCalib || plateConfirm'))
  assert.ok(!kropp.includes("if (wizard || tracking"))
})

async function kor(state) {
  const klasse = { add() {}, remove() {} }
  const s = {
    curUrl: 'v1', wizard: null, tracking: false, setBoundsSuggestion: null,
    trimStart: 0, trimEnd: Infinity, manualTrackingBounds: { start: null, end: null }, trimIsSuggestion: false,
    ...state,
  }
  const video = { currentTime: 0 }
  const fn = new Function('s', 'video', 'say', 'paintTrim', 'setTimeout', 'document', 'vcRunSetBoundsPresearch', `
    const S = new Proxy({}, {});
    let { curUrl, wizard, tracking } = s;
    let setBoundsSuggestion, trimStart, trimEnd, manualTrackingBounds = s.manualTrackingBounds, trimIsSuggestion;
    ${src}
    return vcApplySetBoundsSuggestion('v1', 10.7).then(() => ({ setBoundsSuggestion, trimStart, trimEnd, trimIsSuggestion, t: video.currentTime }));`)
  return fn(s, video, () => {}, () => {}, () => {}, { getElementById: () => ({ classList: klasse }) },
    async () => ({ ok: true, foundStart: true, foundEnd: true, start: 0.4, end: 10.4 }))
}

test('uberoert session-armering (som begin() sætter den) blokerer ikke forslaget', async () => {
  const r = await kor({ wizard: { step: 0, pts: [], auto: true, session: true } })
  assert.equal(r.trimIsSuggestion, true)
  assert.equal(r.trimStart, 0.4)
  assert.equal(r.trimEnd, 10.4)
  assert.ok(r.setBoundsSuggestion && r.setBoundsSuggestion.ok)
})

test('ingen wizard: forslaget sættes som før', async () => {
  const r = await kor({})
  assert.equal(r.trimIsSuggestion, true)
})

test('Marc er i gang (wizard med punkter eller sporing): forslaget kasseres', async () => {
  for (const st of [{ wizard: { step: 1, pts: [{ x: 1, y: 1 }], auto: false, manual2: true } },
    { wizard: { step: 0, pts: [], auto: true } }, { tracking: true }]) {
    const r = await kor(st)
    assert.equal(r.trimIsSuggestion, undefined)
    assert.equal(r.setBoundsSuggestion, undefined)
  }
})

test('MediaRecorder-optageren varmes op, før klippet afspilles (første rep tabes ellers)', () => {
  assert.ok(html.includes('async warm()'))
  assert.ok(html.indexOf('await sink.warm()') < html.indexOf('v.play().catch(() => finish({ error:'))
})
