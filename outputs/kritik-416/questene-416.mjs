// Ordre 416, blok 2: de 14 quests, regnet efter i node (ingen browser).
// Koerer mod en KOPI af matematik (git archive af matematik/main).
//
// Brug: node outputs/kritik-416/questene-416.mjs <matematik-kopi>
// Skriver outputs/kritik-416/questene-416.json.
//
//  1. Tekst mod grund: 300 salte pr. quest (bogOpgaver, runde 0, som
//     spillet). Hver opgavetekst holdes op mod questens ramme-ord (en grov
//     ordliste pr. quest, skrevet ud fra personens grund). Skabelonerne
//     (tal erstattet med #) tælles, saa man kan se hvad eleven faar.
//  2. Svarmuligheder pr. opgave og forsoeg (MAKS_FORSOEG): kan en gaetter
//     altid ramme rigtigt inden "Loesningen"?
//  3. Kaederne: hvad hver quest kraever, hvornaar den tidligst kan aabne,
//     og om den bruger et trin, eleven ikke har mestret paa det tidspunkt.
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const mat = path.resolve(process.argv[2] ?? '')
const her = path.dirname(fileURLToPath(import.meta.url))
const imp = (f) => import(pathToFileURL(path.join(mat, 'src', f)).href)
const bog = await imp('questbog.js')
const { MAKS_FORSOEG } = await imp('ramme.js')
const verden = await imp('spil-verden.js')

// Ramme-ord: hvad opgaven skal handle om, for at passe til personens grund.
const RAMME = {
  'mel-til-bageren': /mel|sæk|bager|brød/i,
  'broed-til-alle': /brød|bager/i,
  aenderne: /portion|størst|mest|ænd/i,
  'nyt-bed': /\bbed\b|bedet|blomst/i,
  'lys-til-kirken': /\blys/i,
  klokkerebet: /reb|klokke|snor/i,
  'sten-til-diget': /\bsten|dige/i,
  stien: /\bstien?\b|bakke/i,
  maalepaele: /pæl|hele vejen rundt|omkreds|hegn/i,
  aeblerne: /æble/i,
  kassen: /\bsko|skomager|kassen/i,
  bedstemor: /bedstemor|holdeplads|ankom|fremme/i,
  'sidste-vogn': /vogn|køreplan|afgang|afgår/i,
  hoestmarked: /marked|\bbod|høst/i,
}
const skabelon = (t) => t.replace(/\d+([.,]\d+)?/g, '#').replace(/[▰▱]+/g, '▰▱').replace(/#( ?(kr|øre|m|cm|mm|km|m²|minutter|min))\b/g, '#$1')

const quests = []
for (const q of bog.BOG_QUESTS) {
  const antalSalte = 300
  let passer = 0, alle = 0, questsHvorAllePasser = 0, questsHvorIngenPasser = 0
  const skab = new Map()
  const muligheder = new Set()
  for (let salt = 1; salt <= antalSalte; salt++) {
    const opg = bog.bogOpgaver(q, salt * 7919 % 1000003, 0)
    let p = 0
    for (const o of opg) {
      alle++
      const ok = RAMME[q.id].test(o.tekst)
      if (ok) { passer++; p++ }
      const k = skabelon(o.tekst)
      const s = skab.get(k) ?? { n: 0, passer: ok, eksempel: o.tekst }
      s.n++
      skab.set(k, s)
      muligheder.add(o.svarmuligheder.length)
    }
    if (p === opg.length) questsHvorAllePasser++
    if (p === 0) questsHvorIngenPasser++
  }
  const giver = bog.giverData(q.giver)
  quests.push({
    id: q.id,
    titel: q.titel,
    giver: bog.giverNavn(giver),
    sted: giver.sted,
    hvorfor: q.hvorfor,
    opgaver: q.opgaver.map(([g, s]) => `${g} (${s})`),
    kraever: q.kraever,
    beloenning: { id: q.beloenning, ...bog.BELOENNINGER[q.beloenning] },
    tekstModGrund: {
      andelOpgaverDerPasser: +(passer / alle).toFixed(2),
      andelQuestsHvorAllePasser: +(questsHvorAllePasser / antalSalte).toFixed(2),
      andelQuestsHvorIngenPasser: +(questsHvorIngenPasser / antalSalte).toFixed(2),
      skabeloner: [...skab.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => ({ skabelon: k, andel: +(v.n / alle).toFixed(3), passer: v.passer })),
    },
    svarmuligheder: [...muligheder].sort(),
  })
}

// Gaet: med k svarmuligheder og MAKS_FORSOEG forsoeg rammer en der proever
// knapperne i raekkefoelge altid rigtigt, hvis k <= MAKS_FORSOEG.
const gaet = {
  maksForsoeg: MAKS_FORSOEG,
  svarmuligheder: [...new Set(quests.flatMap((q) => q.svarmuligheder))],
  gaetterRammerAltidRigtigt: quests.every((q) => q.svarmuligheder.every((k) => k <= MAKS_FORSOEG)),
  forventetTrykPrOpgaveVedGaet: 2,
  forventetErfaringVedGaet: '+10 pr. opgave (erfaringen gives ved "Rigtigt!" uanset forsoeg nr.)',
  sandsynlighedRigtigFoersteGang: '1/3',
}

// Kaederne: hvilke trin hver quest bruger, og hvad eleven har mestret, naar
// questen tidligst kan aabne.
const TRAPPE = { broek: 'moellen', maal: 'stenbrud' }
function mestretVedAabning(q, set = new Set()) {
  // Hvad er med sikkerhed mestret, naar q kan startes: dens egne forloeb-krav,
  // stedets aabningskrav og alt det, kaede-questene selv kraevede.
  const m = { moellen: 0, stenbrud: 0 }
  const k = q.kraever
  const saet = (sted, n) => { if (sted in m) m[sted] = Math.max(m[sted], n) }
  if (k.forloeb) saet(k.forloeb[0], k.forloeb[1])
  const steder = [bog.giverData(q.giver).sted, k.aabent].filter(Boolean)
  for (const s of steder) {
    const krav = verden.stedKrav(s)
    if (krav?.type === 'mestring') saet(krav.sted, krav.antal)
  }
  for (const id of k.quests ?? []) {
    if (set.has(id)) continue
    set.add(id)
    const under = mestretVedAabning(bog.bogQuestVedId(id), set)
    for (const s of Object.keys(m)) m[s] = Math.max(m[s], under[s])
  }
  return m
}
const kaeder = bog.BOG_QUESTS.map((q) => {
  const m = mestretVedAabning(q)
  const trin = q.opgaver.map(([g]) => g)
  const kirkeMaal = { kirkeOmkreds: ['stenbrud', 4], kirkeAreal: ['stenbrud', 5] }
  const brud = []
  for (const g of trin) {
    const t = g.match(/^(broek|maal)(\d)$/)
    if (t && Number(t[2]) > m[TRAPPE[t[1]]]) brud.push(`${g} kraever ${TRAPPE[t[1]]} ${t[2]}, mestret: ${m[TRAPPE[t[1]]]}`)
    if (kirkeMaal[g] && kirkeMaal[g][1] > m.stenbrud) brud.push(`${g} er maaletrappens trin ${kirkeMaal[g][1]}, Grusgraven mestret: ${m.stenbrud}`)
  }
  return { id: q.id, kraever: q.kraever, mestretVedAabning: m, trin, brud }
})

const ud = { antalSalte: 300, quests, gaet, kaeder }
writeFileSync(path.join(her, 'questene-416.json'), JSON.stringify(ud, null, 2) + '\n', 'utf8')
for (const q of quests) {
  const t = q.tekstModGrund
  console.log(`${q.id.padEnd(16)} passer ${Math.round(t.andelOpgaverDerPasser * 100)}% af opgaverne; alle passer i ${Math.round(t.andelQuestsHvorAllePasser * 100)}%, ingen i ${Math.round(t.andelQuestsHvorIngenPasser * 100)}% af questene; svarmuligheder ${q.svarmuligheder}`)
}
for (const k of kaeder) if (k.brud.length) console.log('trin-brud', k.id, k.brud.join('; '))
console.log('gaet', JSON.stringify(gaet))
