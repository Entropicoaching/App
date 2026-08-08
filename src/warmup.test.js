// Egenskaber opvarmningsformlen skal holde. Ikke enkeltvaerdier — egenskaber.
// En test der laaser en bestemt raekke tal fast forhindrer enhver forbedring;
// en test der laaser REGLEN fast fanger den dag reglen braekker.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calcWarmupSets, isMainLift, BAR } from './warmup.js'

const vægte = (s, W) => [...s.map((x) => x.weight), W]
const spring = (s, W) => {
  const v = vægte(s, W)
  return v.slice(1).map((w, i) => +(w - v[i]).toFixed(3))
}

// Vaegtene med .5 er ikke pynt. De foerste udgaver af testen brugte naesten kun
// multipla af 5 og var groenne, mens en fuzz paa 26.140 kombinationer fandt 5.208
// brud. Hver vaegt herunder braekkede formlen én gang.
const HOVEDLØFT = [
  [250, 1], [200, 1], [187.5, 1], [182.5, 1], [180, 3], [150, 1], [140, 3],
  [122.5, 1], [120, 5], [100, 5], [82.5, 1], [80, 3], [60, 5], [52.5, 1],
  [47.5, 1], [45, 5], [32.5, 5], [27.5, 5], [22.5, 5]
]

// ---------- den regel hele formlen findes for ----------

test('springene bliver mindre hele vejen op — ogsaa ind i arbejdssaettet', () => {
  for (const [W, n] of HOVEDLØFT) {
    const s = calcWarmupSets(W, n, 'Squat')
    const g = spring(s, W)
    for (let i = 1; i < g.length; i++) {
      assert.ok(
        g[i] <= g[i - 1] + 1e-9,
        `${W}kg x${n}: spring ${i + 1} (${g[i]}) er stoerre end spring ${i} (${g[i - 1]}) — ${g.join(', ')}`
      )
    }
  }
})

test('det sidste spring ind i arbejdssaettet er aldrig det stoerste', () => {
  // Den gamle formel faldt praecis her: 200kg gav ...175 -> 185 (10) -> 200 (15).
  for (const [W, n] of HOVEDLØFT) {
    const g = spring(calcWarmupSets(W, n, 'Squat'), W)
    assert.ok(g[g.length - 1] <= Math.max(...g) + 1e-9)
    if (g.length > 1) assert.ok(g[g.length - 1] <= g[g.length - 2] + 1e-9, `${W}kg: sidste spring ${g[g.length - 1]} > forrige ${g[g.length - 2]}`)
  }
})

test('vaegtene stiger, ligger over stangen og naar aldrig arbejdsvaegten', () => {
  for (const [W, n] of HOVEDLØFT) {
    const s = calcWarmupSets(W, n, 'Squat')
    for (let i = 0; i < s.length; i++) {
      assert.ok(s[i].weight < W, `${W}kg: opvarmning ${s[i].weight} >= arbejdsvaegt`)
      assert.ok(s[i].weight >= BAR, `${W}kg: opvarmning ${s[i].weight} under stangen`)
      if (i) assert.ok(s[i].weight > s[i - 1].weight, `${W}kg: ikke stigende`)
    }
  }
})

// ---------- stangen ----------

test('rampen starter paa stangen', () => {
  const s = calcWarmupSets(60, 5, 'Bænkpres')
  assert.equal(s[0].weight, BAR)
  assert.equal(s[0].pct, 'Stang')
})

test('arbejdsvaegt paa eller under stangen giver ingen opvarmning', () => {
  // Stangen er altid 20 kg (Marc, 8. august 2026), saa et arbejdssaet paa 20 kg
  // ER stangen. Der er intet at varme op med, og det er korrekt at svare tomt.
  assert.deepEqual(calcWarmupSets(20, 5, 'Bænkpres'), [])
  assert.deepEqual(calcWarmupSets(15, 5, 'Bænkpres'), [])
})

// ---------- etiketten skal passe til vaegten ----------

test('pct-etiketten er regnet af den afrundede vaegt', () => {
  for (const [W, n] of HOVEDLØFT) {
    for (const s of calcWarmupSets(W, n, 'Squat')) {
      if (s.pct === 'Stang') continue
      const faktisk = Math.round((s.weight / W) * 100)
      assert.equal(s.pct, `${faktisk}%`, `${W}kg: ${s.weight}kg maerket ${s.pct}`)
    }
  }
})

// ---------- reps ----------

test('reps falder naar vaegten stiger', () => {
  for (const [W, n] of HOVEDLØFT) {
    const s = calcWarmupSets(W, n, 'Squat')
    for (let i = 1; i < s.length; i++) assert.ok(s[i].reps <= s[i - 1].reps, `${W}kg: reps steg`)
  }
})

// ---------- hovedloeft mod accessory ----------

test('sumo doedloeft er et hovedloeft, RDL er ikke', () => {
  assert.equal(isMainLift('Sumo dødløft'), true)
  assert.equal(isMainLift('Romanian deadlift'), false)
  assert.equal(isMainLift('Overhead triceps extension'), false)
  assert.equal(isMainLift('OHP'), true)
})

// Oevelsesdata bruger BEGGE stavemaader. Formlen kendte kun de danske tegn, saa
// "Baenkpres" og "Doedloeft" — almindelig baenkpres og almindeligt doedloeft —
// blev accessories og fik ÉT opvarmningssaet paa 60 %. 17 af 127 oevelsesnavne
// var ramt. Marc opdagede det paa sin slingshot-baenkpres 8. august 2026.
test('ASCII-stavemaader genkendes som de danske', () => {
  for (const [dansk, ascii] of [
    ['Bænkpres', 'Baenkpres'],
    ['Dødløft', 'Doedloeft'],
    ['Slingshot Bænkpres', 'Slingshot baenkpres - topsaet'],
    ['Pause bænkpres', 'Pause baenkpres'],
    ['Rumænsk dødløft', 'Rumaensk doedloeft']
  ]) {
    assert.equal(isMainLift(ascii), isMainLift(dansk), `"${ascii}" doemmes anderledes end "${dansk}"`)
  }
  assert.equal(isMainLift('Baenkpres'), true)
  assert.equal(isMainLift('Doedloeft'), true)
  assert.equal(isMainLift('Rumaensk doedloeft'), false, 'RDL er stadig accessory')
})

test('redskabet vejer tungere end hvor man ligger', () => {
  // "Prone Y raise /liggende på bænk)" indeholder "bænk" og blev hovedloeft
  // med fuld stang-ramp, da ASCII-foldningen kom til.
  assert.equal(isMainLift('Prone Y raise /liggende på bænk)'), false)
  assert.equal(isMainLift('Incline DB press'), false)
  assert.equal(isMainLift('Close-grip bænkpres'), true)
  assert.equal(isMainLift('Pause bænk 3 sek'), true)
})

test('et tungt hovedloeft faar aldrig kun ét opvarmningssaet', () => {
  // Symptomet Marc saa: 95x4 som eneste opvarmning foer en tung slingshot-baenk.
  for (const navn of ['Slingshot baenkpres - topsaet', 'Baenkpres', 'Doedloeft'])
    for (const W of [120, 150, 160, 190])
      assert.ok(calcWarmupSets(W, 4, navn).length >= 4, `${navn} ${W}kg gav for faa saet`)
})

test('accessory faar kort ramp uden stang-saet', () => {
  const s = calcWarmupSets(100, 10, 'Lat pulldown')
  assert.ok(s.length <= 2)
  assert.ok(s.every((x) => x.pct !== 'Stang'))
})

test('accessory foelger samme regel om aftagende spring', () => {
  // 47,5 kg benpres gav 25 → 35 → [47,5]: spring 10 og derefter 12,5.
  for (const W of [47.5, 60, 82.5, 100, 137.5, 200]) {
    const g = spring(calcWarmupSets(W, 10, 'Benpress'), W)
    for (let i = 1; i < g.length; i++) assert.ok(g[i] <= g[i - 1] + 1e-9, `benpres ${W}: ${g.join(', ')}`)
  }
})

test('alle vaegte kan saettes paa en stang — multipla af 2,5', () => {
  for (const [W, n] of HOVEDLØFT)
    for (const s of calcWarmupSets(W, n, 'Squat'))
      assert.ok(Math.abs(s.weight / 2.5 - Math.round(s.weight / 2.5)) < 1e-9, `${W}kg gav ${s.weight}`)
})

test('et oevelsesnavn der ikke er tekst maa ikke kaste', () => {
  // (name || '').toLowerCase() kastede paa objekter og tal, og hele
  // opvarmningen forsvandt med en fejl i konsollen.
  for (const navn of [null, undefined, 0, 42, {}, [], true])
    assert.doesNotThrow(() => calcWarmupSets(100, 5, navn), `navn: ${String(navn)}`)
})

// ---------- BRAEK-ANKRE ----------
// Uden disse ville en formel der returnerer [] bestaa naesten alt ovenfor.

test('en tung loefter faar en RIGTIG ramp, ikke en tom liste', () => {
  const s = calcWarmupSets(200, 1, 'Dødløft')
  assert.ok(s.length >= 4, `kun ${s.length} opvarmningssaet til 200 kg`)
  assert.equal(s[0].weight, BAR)
  assert.ok(s[s.length - 1].weight >= 200 * 0.8, 'sidste opvarmning ligger for langt fra arbejdsvaegten')
})

test('sidste opvarmning ligger taet nok paa arbejdsvaegten', () => {
  for (const [W, n] of HOVEDLØFT) {
    const s = calcWarmupSets(W, n, 'Squat')
    if (s.length < 2) continue
    const sidste = s[s.length - 1].weight
    assert.ok(sidste / W >= 0.7, `${W}kg: sidste opvarmning ${sidste} er kun ${Math.round((sidste / W) * 100)}%`)
  }
})

test('ugyldige input giver tom liste, ikke NaN i fladen', () => {
  for (const bad of [undefined, null, 0, -50, NaN, 'tung']) {
    const s = calcWarmupSets(bad, 5, 'Squat')
    assert.ok(Array.isArray(s))
    assert.ok(s.every((x) => Number.isFinite(x.weight)))
  }
})
