// Ordre 427, blok 1: hvor mange beloenninger faar en elev, der regner, og hvor
// ofte moeder hun "hvil"? Ren node, ingen browser. Koerer mod en KOPI af
// matematik (git archive af matematik/main); intet i spillet er rettet.
//
// Brug: node outputs/kritik-427/sim-427.mjs <matematik-kopi>
// Skriver outputs/kritik-427/sim-427.json.
//
// Reglerne er spillets egne funktioner (questbog.js, spil-quest.js,
// spil-verden.js, spil-figur.js): mestringsKrav/erMestret, hvilQuest/hviler,
// klarQuest, questStatus, stedAabent, tilfoejErfaring, erfaringForForsoeg.
// Det eneste, der er mit, er eleven:
//  - Hun svarer rigtigt i foerste forsoeg med sandsynlighed p (en terning pr.
//    opgave, uafhaengigt), i andet med max(p, 1/2), ellers faar hun loesningen.
//  - Hun tager foerst en aaben quest (et "!"), ellers naeste forloeb paa det
//    foerste aabne sted i raekkefoelgen Moellen, Grusgraven, Landsbygaden,
//    Kirken, Sporvognen. Det er sadan kortet laeser ovenfra.
//  - 150 opgaver pr. elev (ca. 3 lektioner a 45 min med 20 s pr. opgave).
// Et "hvil" er den besked, personen giver, naar questen er loest, men ikke
// mestret ("Tak, fordi du proevede ...").
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const mat = path.resolve(process.argv[2] ?? '')
const her = path.dirname(fileURLToPath(import.meta.url))
const imp = (f) => import(pathToFileURL(path.join(mat, 'src', f)).href)
const bog = await imp('questbog.js')
const sq = await imp('spil-quest.js')
const verden = await imp('spil-verden.js')
const fig = await imp('spil-figur.js')

const RAEKKE = ['moellen', 'stenbrud', 'marked', 'landsby', 'havn']
const OPGAVER = 150
const ELEVER = 4000

// Lille deterministisk terning (mulberry32), saa tallene kan genskabes.
function terning(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function nyTilstand() {
  const questFremdrift = Object.fromEntries(RAEKKE.map((s) => [s, Array(sq.QUEST_BANK[s].length).fill(false)]))
  return { figur: fig.nyFigur('Model', 'lilla'), questFremdrift, questbog: bog.tomBog() }
}

function elev(p, seed) {
  const r = terning(seed)
  let t = nyTilstand()
  let brugt = 0
  const log = { beloenninger: [], hvil: [], gentagForloeb: 0, questForsoeg: 0, foersteBeloenning: null, foersteHvil: null, hvilSammeIgen: 0, venteEfterHvil: [] }
  const hvileStart = {} // quest-id -> opgave nr, da hun fik hvil
  const hvilAntal = {}
  // Een opgave: giver [rigtigIFoerste, erfaring].
  const opgave = () => {
    if (r() < p) return [true, sq.erfaringForForsoeg(1)]
    if (r() < Math.max(p, 0.5)) return [false, sq.erfaringForForsoeg(2)]
    return [false, sq.erfaringForForsoeg(3)]
  }
  const regn = (antal, egenskab) => {
    let rigtige = 0
    for (let i = 0; i < antal && brugt < OPGAVER; i++) {
      const [ok, xp] = opgave()
      if (ok) rigtige++
      t = { ...t, figur: fig.tilfoejErfaring(t.figur, xp, egenskab).figur }
      brugt++
    }
    return rigtige
  }
  while (brugt < OPGAVER) {
    const aaben = bog.questsMedStatus(t, 'aaben')[0]
    if (aaben) {
      const antal = aaben.opgaver.length
      const start = brugt
      const rigtige = regn(antal, 'hoved')
      if (brugt - start < antal) break // tiden slap op midt i questen
      log.questForsoeg++
      if (hvileStart[aaben.id] !== undefined) { log.venteEfterHvil.push(start - hvileStart[aaben.id]); delete hvileStart[aaben.id] }
      if (sq.erMestret(rigtige, antal)) {
        t = { ...t, questbog: bog.klarQuest(t, aaben.id).bog }
        log.beloenninger.push({ id: aaben.id, opgave: brugt })
        log.foersteBeloenning ??= brugt
      } else {
        t = { ...t, questbog: bog.hvilQuest(t, aaben.id) }
        log.hvil.push({ id: aaben.id, opgave: brugt, rigtige, af: antal })
        log.foersteHvil ??= brugt
        hvilAntal[aaben.id] = (hvilAntal[aaben.id] ?? 0) + 1
        if (hvilAntal[aaben.id] >= 2) log.hvilSammeIgen++
        hvileStart[aaben.id] = brugt
      }
      continue
    }
    const sted = RAEKKE.find((s) => verden.stedAabent(s, t.figur, t.questFremdrift) && t.questFremdrift[s].some((x) => !x))
    if (!sted) break
    const idx = t.questFremdrift[sted].findIndex((x) => !x)
    const forloeb = sq.QUEST_BANK[sted][idx]
    const start = brugt
    const rigtige = regn(forloeb.antalOpgaver, forloeb.egenskab ?? 'hoved')
    if (brugt - start < forloeb.antalOpgaver) break
    if (forloeb.kraeverMestring && !sq.erMestret(rigtige, forloeb.antalOpgaver)) { log.gentagForloeb++; continue }
    const f = [...t.questFremdrift[sted]]
    f[idx] = true
    t = { ...t, questFremdrift: { ...t.questFremdrift, [sted]: f } }
  }
  log.niveau = t.figur.niveau
  log.hue = t.questbog.klaret.includes('broed-til-alle')
  log.mestret = bog.antalMestret(t.questFremdrift)
  return log
}

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
const andel = (xs, f) => +(xs.filter(f).length / xs.length).toFixed(3)
const gennemsnit = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : null)

function koer(p) {
  const alle = Array.from({ length: ELEVER }, (_, i) => elev(p, 1000 + i * 7919 + Math.round(p * 1e6)))
  const b = alle.map((e) => e.beloenninger.length)
  const h = alle.map((e) => e.hvil.length)
  const qf = alle.map((e) => e.questForsoeg)
  const hvilPrQuest = +(h.reduce((a, x) => a + x, 0) / Math.max(1, qf.reduce((a, x) => a + x, 0))).toFixed(3)
  // Hvor mange hvil hver quest giver (andel af alle hvil).
  const pr = {}
  for (const e of alle) for (const x of e.hvil) pr[x.id] = (pr[x.id] ?? 0) + 1
  const sumH = Object.values(pr).reduce((a, x) => a + x, 0) || 1
  return {
    p,
    elever: ELEVER,
    opgaver: OPGAVER,
    beloenninger: { gennemsnit: gennemsnit(b), median: median(b), min: Math.min(...b), max: Math.max(...b), ingen: andel(b, (x) => x === 0) },
    hvil: { gennemsnit: gennemsnit(h), median: median(h), ingen: andel(h, (x) => x === 0), treEllerFlere: andel(h, (x) => x >= 3), andelAfQuestForsoeg: hvilPrQuest, sammeQuestIgen: gennemsnit(alle.map((e) => e.hvilSammeIgen)) },
    questForsoeg: gennemsnit(qf),
    foersteBeloenningOpgave: median(alle.map((e) => e.foersteBeloenning).filter((x) => x !== null)),
    foersteHvilOpgave: median(alle.map((e) => e.foersteHvil).filter((x) => x !== null)),
    venteFraHvilTilNyeTal: median(alle.flatMap((e) => e.venteEfterHvil)),
    foersteQuestErHvil: andel(alle, (e) => e.hvil[0] && (!e.beloenninger[0] || e.hvil[0].opgave < e.beloenninger[0].opgave)),
    melTilBagerenFoersteGangHvil: andel(alle, (e) => { const h = e.hvil.find((x) => x.id === 'mel-til-bageren'); const b = e.beloenninger.find((x) => x.id === 'mel-til-bageren'); return Boolean(h) && (!b || h.opgave < b.opgave) }),
    hueEfter150: andel(alle, (e) => e.hue),
    gentagForloeb: gennemsnit(alle.map((e) => e.gentagForloeb)),
    mestredeForloeb: gennemsnit(alle.map((e) => e.mestret)),
    niveau: median(alle.map((e) => e.niveau)),
    hvilFordeling: Object.fromEntries(Object.entries(pr).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / sumH).toFixed(3)])),
  }
}

// Mestringskravet pr. quest-laengde: 3 opgaver -> 3 af 3 (ingen fejl).
const krav = [...new Set(bog.BOG_QUESTS.map((q) => q.opgaver.length))].sort().map((n) => ({ opgaver: n, krav: sq.mestringsKrav(n), quests: bog.BOG_QUESTS.filter((q) => q.opgaver.length === n).map((q) => q.id) }))
const ud = { elever: ELEVER, opgaver: OPGAVER, krav, resultater: [1 / 3, 0.6, 0.8, 0.9].map((p) => koer(+p.toFixed(3))) }
writeFileSync(path.join(her, 'sim-427.json'), JSON.stringify(ud, null, 2) + '\n', 'utf8')
console.log('krav', JSON.stringify(krav.map((k) => `${k.krav} af ${k.opgaver} (${k.quests.length} quests)`)))
for (const r of ud.resultater) {
  console.log(`p=${r.p}: beloenninger ${r.beloenninger.gennemsnit} (median ${r.beloenninger.median}, ingen ${Math.round(r.beloenninger.ingen * 100)} %), hvil ${r.hvil.gennemsnit} (median ${r.hvil.median}, >=3: ${Math.round(r.hvil.treEllerFlere * 100)} %, ${Math.round(r.hvil.andelAfQuestForsoeg * 100)} % af quest-forsoeg), foerste quest = hvil ${Math.round(r.foersteQuestErHvil * 100)} %, huen ${Math.round(r.hueEfter150 * 100)} %, niveau ${r.niveau}, venter ${r.venteFraHvilTilNyeTal} opgaver`)
}
