// ORDRE 416 blok 3: verify:kritik-416. Ingen matematik-mappe, intet netvaerk.
//   1. Q2 regnes efter uden spillet: med k svarmuligheder og MAKS_FORSOEG
//      forsoeg rammer en der proever knapperne i raekkefoelge altid rigtigt,
//      naar k <= forsoeg.
//   2. De gemte maalinger (elev-416.json, questene-416.json, browser-416.json)
//      siger det KRITIK siger: foerste "!" efter 3 opgaver, "Mel til bageren"
//      gav mark-opgaver, fire quests med 0 % tekst om grunden, "Et nyt bed"
//      bryder trin-reglen, gaette-eleven fik Aebleboden og Halstoerklaedet,
//      Aeboden er under 20 px, kun den nyeste titel vises.
//   3. Dokumenterne: KRITIK har Q1.. oeverst og "Levende for en 10-aarig:
//      ja/nej, fordi", RAPPORT-416 starter med "Ordre 416" og har de fem afsnit
//      og ordren til Ganita.
// Exit 1 ved fejl.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const ROOT = path.join(HERE, '..', '..')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}

// --- 1. Q2 uden spillet -------------------------------------------------------
function gaetter(k, maks) {
  // Alle placeringer af det rigtige svar; gaetteren proever 0, 1, 2, ...
  return Array.from({ length: k }, (_, rigtig) => (rigtig < maks ? 'rigtigt' : 'loesning'))
}
ok(gaetter(3, 3).every((x) => x === 'rigtigt'), 'Q2: 3 muligheder / 3 forsoeg skulle altid give "Rigtigt!"')
ok(gaetter(4, 3).includes('loesning'), 'Q2-kontrol: 4 muligheder / 3 forsoeg skulle kunne give "Loesningen"')

// --- 2. maalingerne -------------------------------------------------------------
const elev = json('elev-416.json')?.resultat
if (elev) {
  ok(elev.sidefejl.length === 0, `blok 1: sidefejl ${elev.sidefejl.join(' | ')}`)
  ok(elev.forloeb[0]?.opgaver === 3 && elev.foersteUdraab?.tryk <= 10 && elev.foersteUdraab?.uret <= 180, 'blok 1: foerste "!" skulle komme efter 3 opgaver og under 3 min elevtid')
  const u1 = elev.udraab[0]
  ok(u1?.foer.udraab.some((u) => u.quest === 'mel-til-bageren' && u.inde), 'blok 1: "!" over Ane skulle staa i skaermen efter forloeb 1')
  ok(u1?.foer.knap?.inde === false, 'Q3: "Questbogen 1 ny" skulle staa uden for skaermen efter forloeb 1')
  ok(!/Ane/.test(elev.forloeb[0]?.klaretTekst ?? '') && !/Ane/.test(elev.forloeb[0]?.byVaagner ?? ''), 'Q3: klaret-feltet naevner nu Ane - er Q3 rettet? Opdater KRITIK')
  const mel = elev.quests.find((q) => q.questId === 'mel-til-bageren')
  ok(mel?.opgaver.some((t) => /mark/.test(t)), 'Q1: "Mel til bageren" gav ingen mark-opgave i blok 1 - opdater ELEVEN/KRITIK')
  ok(mel?.hvorforIBog?.inde && mel?.panel?.hvorfor?.inde, 'blok 1: grunden skulle staa i skaermen i bogen og i panellet')
  const broed = elev.quests.find((q) => q.questId === 'broed-til-alle')
  ok(broed?.ny?.hueNed === 1 && broed?.lige?.kortTop < -100, 'Q4: huen skulle dale ned paa et portraet uden for skaermen')
  ok(elev.quests.length === 3, `blok 1: ${elev.quests.length} quests klaret, ventet 3`)
  const g = elev.genindlaest
  ok(g && ['melsaekke', 'aender'].every((b) => g.ting.includes(b)) && g.hue === 1 && g.hueKort === 1 && g.gemt.klaret.length === 3, 'blok 1: genindlaesningen beholdt ikke sække, aender og hue')
}
const qs = json('questene-416.json')
if (qs) {
  ok(qs.quests.length === 14, `blok 2: ${qs.quests.length} quests, ventet 14`)
  const pas = Object.fromEntries(qs.quests.map((q) => [q.id, q.tekstModGrund.andelOpgaverDerPasser]))
  ok(['nyt-bed', 'klokkerebet', 'stien', 'kassen'].every((id) => pas[id] === 0), 'Q1: en af de fire 0 %-quests har nu tekst om grunden - opdater KRITIK')
  ok(['lys-til-kirken', 'sten-til-diget', 'aeblerne'].every((id) => pas[id] > 0 && pas[id] < 0.3), 'Q1: Lys/Sten/Aebler ikke laengere 21-26 %')
  ok(pas.bedstemor === 1 && pas['sidste-vogn'] === 1, 'blok 2: Sporvognens quests skulle passe 100 %')
  ok(qs.gaet.maksForsoeg === 3 && qs.quests.every((q) => q.svarmuligheder.includes(3)), 'Q2: MAKS_FORSOEG eller antal svarmuligheder aendret')
  const brud = qs.kaeder.filter((k) => k.brud.length).map((k) => k.id)
  ok(brud.length === 1 && brud[0] === 'nyt-bed', `Q5: trin-brud ventet kun i nyt-bed, fundet: ${brud.join(', ') || 'ingen'}`)
}
const br = json('browser-416.json')
if (br) {
  const ting = Object.fromEntries(br.beloenninger.ting.map((t) => [t.id, t]))
  ok(Object.keys(ting).length === 9, `blok 2: ${Object.keys(ting).length} ting paa kortet, ventet 9 (8 kort + genvej)`)
  ok(ting.aeblebod?.bredde <= 20 && ting.melsaekke?.bredde <= 24, 'Q4: Aeboden/Melsaekkene er ikke laengere smaa')
  ok(br.beloenninger.hoved.titel === 'Sporvognens ven', 'Q4: hovedet viser nu mere end den nyeste titel - opdater KRITIK')
  ok(ting.stien?.daekket.some((d) => d.navn === 'Sporvognen'), 'Q9: stien ligger ikke laengere under Sporvognen-knappen')
  const gt = br.gaetter
  ok(gt.klaret.includes('aeblerne') && gt.klaret.includes('kassen') && gt.fremdrift.moellen === 0, 'Q2: gaette-eleven fik ikke Aebleboden og Halstoerklaedet uden mestring')
  ok(gt.loesningVist === 0 && gt.niveau >= 3, 'Q2: gaette-eleven saa "Loesningen" eller naaede ikke niveau 3')
  ok(br.beloenninger.sidefejl.length === 0 && gt.sidefejl.length === 0, 'blok 2: sidefejl i browseren')
}
const filer = readdirSync(HERE)
ok(filer.filter((f) => /^E-\d\d-.*\.png$/.test(f)).length >= 30, 'blok 1: faerre end 30 skaermbilleder')
ok(filer.filter((f) => /^Q-\d\d-.*\.png$/.test(f)).length >= 5, 'blok 2: faerre end 5 skaermbilleder')
for (const b of ['E-05-udraab-efter-moellen-1.png', 'E-07-panel-mel-til-bageren.png', 'E-10-tak-mel-til-bageren.png', 'Q-02-alle-klaret-kortet.png']) ok(filer.includes(b), `${b} mangler`)

// --- 3. dokumenterne -----------------------------------------------------------
const doc = (f) => path.join(ROOT, 'docs/kritik-416', f)
if (existsSync(doc('KRITIK-questbog.md'))) {
  const k = readFileSync(doc('KRITIK-questbog.md'), 'utf8')
  for (let i = 1; i <= 9; i++) ok(k.includes(`**Q${i}.`), `KRITIK mangler Q${i}`)
  ok(/\*\*Levende for en 10-(å|aa)rig: (ja|nej), fordi\*\*/i.test(k), 'KRITIK mangler linjen "Levende for en 10-aarig: ja/nej, fordi"')
  ok(k.indexOf('**Q1.') < k.indexOf('## Hvad der holder'), 'fundene skal staa oeverst i KRITIK')
} else fejl.push('docs/kritik-416/KRITIK-questbog.md mangler')
for (const f of ['ELEVEN.md', 'QUESTENE.md']) ok(existsSync(doc(f)), `docs/kritik-416/${f} mangler`)
if (existsSync(doc('RAPPORT-416.md'))) {
  const r = readFileSync(doc('RAPPORT-416.md'), 'utf8').replace(/\r/g, '')
  ok(r.split('\n')[0].trim() === 'Ordre 416', 'RAPPORT-416.md skal starte med "Ordre 416"')
  for (const a of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(r.includes(a), `RAPPORT-416.md mangler "${a}"`)
  ok(/Til Ganita/.test(r), 'RAPPORT-416.md: "Hvad er naeste" skal have ordren til Ganita')
} else fejl.push('docs/kritik-416/RAPPORT-416.md mangler')

if (fejl.length) {
  console.error(`verify:kritik-416 ROED (${fejl.length}):\n - ${fejl.join('\n - ')}`)
  process.exit(1)
}
console.log('verify:kritik-416 GROEN: Q1-Q5 genskabt fra maalingerne, gaet regnet efter, dokumenterne i orden.')
