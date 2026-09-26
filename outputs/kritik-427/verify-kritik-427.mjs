// ORDRE 427: verify:kritik-427. Ingen matematik-mappe, intet netvaerk; kun de
// gemte maalinger og dokumenterne.
//   node outputs/kritik-427/verify-kritik-427.mjs 1   blok 1
//   node outputs/kritik-427/verify-kritik-427.mjs 2   blok 1 + blok 2
//
// Blok 1: 416's fund Q1-Q5 kan IKKE genskabes paa matematik main (28ba81d):
//   Q1 alle 14 quests har tekst om grunden (de fire 0 %-quests med 416's
//      uaendrede ordliste), Q2 gaette-eleven faar ingen beloenning paa 150
//      opgaver, Q3 klaret-feltet siger "Hjaelp Ane", Q4 tingene er over 30 px,
//      Q5 intet trin-brud. Q6-Q9 har status i STATUS-427.md. Modellen med en
//      60 %- og en 80 %-elev findes og haenger sammen.
// Blok 2: Anes kaede med to fejl (ane-427.json) viser hvilen og huen, og
//   KRITIK-questbog-2 og RAPPORT-427 har det, ordren kraever.
// Exit 1 ved fejl.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const blok = Number(process.argv[2] ?? 2)
const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..', '..')
const DOCS = path.join(ROOT, 'docs', 'kritik-427')
const fejl = []
const ok = (b, t) => { if (!b) fejl.push(t) }
const json = (f) => {
  const p = path.join(HERE, f)
  if (!existsSync(p)) { fejl.push(`${f} mangler`); return null }
  return JSON.parse(readFileSync(p, 'utf8'))
}
const tekst = (f) => {
  const p = path.join(DOCS, f)
  if (!existsSync(p)) { fejl.push(`docs/kritik-427/${f} mangler`); return null }
  return readFileSync(p, 'utf8').replace(/\r/g, '')
}

// --- blok 1 -------------------------------------------------------------------
const qs = json('questene-427.json')
if (qs) {
  ok(qs.quests.length === 14, `Q1: ${qs.quests.length} quests, ventet 14`)
  const pas = Object.fromEntries(qs.quests.map((q) => [q.id, q.tekstModGrund.andelOpgaverDerPasser]))
  ok(['nyt-bed', 'klokkerebet', 'stien', 'kassen'].every((id) => pas[id] === 1), 'Q1 genskabt: en af 416\'s fire 0 %-quests har igen opgaver uden grunden')
  ok(Object.values(pas).every((x) => x === 1), `Q1: quests under 100 %: ${Object.entries(pas).filter(([, x]) => x < 1).map(([k, x]) => `${k} ${x}`).join(', ')}`)
  ok(qs.kaeder.every((k) => k.brud.length === 0), `Q5 genskabt: trin-brud i ${qs.kaeder.filter((k) => k.brud.length).map((k) => k.id).join(', ')}`)
}
const elev = json('elev-427.json')?.resultat
if (elev) {
  ok(elev.sidefejl.length === 0, `sidefejl i elev-427: ${elev.sidefejl.join(' | ')}`)
  ok(elev.foersteUdraab?.tryk <= 10 && elev.foersteUdraab?.uret <= 180, 'foerste "!" kommer ikke laengere efter 3 opgaver og under 3 min')
  ok(/Ane/.test(elev.forloeb[0]?.nyQuest ?? '') && /Hjælp Ane/.test(elev.forloeb[0]?.nyQuest ?? ''), 'Q3 genskabt: klaret-feltet efter Moellens forloeb 1 naevner ikke Ane / har ingen "Hjaelp Ane"')
  const mel = elev.quests.find((q) => q.questId === 'mel-til-bageren')
  ok(mel && mel.opgaver.every((t) => /mel|sæk|Ane|bager/i.test(t)), 'Q1 genskabt: "Mel til bageren" gav opgaver uden mel')
  ok(/Hvad nu\?/.test(mel?.tak?.tekst ?? ''), 'Q7: takkekortet efter "Mel til bageren" siger ikke "Hvad nu?"')
  ok(elev.quests.length === 3, `${elev.quests.length} quests klaret i elev-427, ventet 3`)
  const g = elev.genindlaest
  ok(g && ['melsaekke', 'aender'].every((b) => g.ting.includes(b)) && g.hue === 1 && g.gemt.klaret.length === 3, 'genindlaesningen beholdt ikke saekke, aender og hue')
  ok(!g?.bog.some((h) => /Låst/.test(h)), 'Q8 genskabt: questbogen har igen et "Laast"-afsnit')
}
const br = json('browser-427.json')
if (br) {
  const gt = br.gaetter
  ok(gt.opgaver === 150 && gt.klaret.length === 0 && gt.beloenninger.length === 0, `Q2 genskabt: gaette-eleven fik ${gt.beloenninger.join(', ')} paa ${gt.opgaver} opgaver`)
  ok(gt.sidefejl.length === 0 && br.beloenninger.sidefejl.length === 0, 'sidefejl i browser-427')
  const ting = br.beloenninger.ting
  ok(ting.length === 9 && ting.every((t) => Math.min(t.bredde, t.hoejde) >= 30), `Q4 genskabt: ting under 30 px: ${ting.filter((t) => Math.min(t.bredde, t.hoejde) < 30).map((t) => t.id).join(', ')}`)
  const sti = ting.find((t) => t.id === 'stien')
  ok(sti?.daekket.some((d) => d.navn === 'Sporvognen'), 'Q9: stien ligger ikke laengere under Sporvognen-knappen - opdater STATUS-427')
}
const sim = json('sim-427.json')
if (sim) {
  const r = Object.fromEntries(sim.resultater.map((x) => [x.p, x]))
  ok(r[0.6] && r[0.8] && r[0.333], 'sim-427: 60 %, 80 % eller gaetteren mangler')
  if (r[0.6] && r[0.8] && r[0.333]) {
    ok(r[0.333].beloenninger.gennemsnit < r[0.6].beloenninger.gennemsnit && r[0.6].beloenninger.gennemsnit < r[0.8].beloenninger.gennemsnit, 'sim-427: flere rigtige giver ikke flere beloenninger')
    ok(r[0.6].hvil.gennemsnit > 0 && r[0.8].hvil.gennemsnit > 0, 'sim-427: ingen hvil for 60/80 %')
    // En 3-opgavers quest kraever 3 af 3: foerste quest er hvil med 1 - p^3.
    ok(Math.abs(r[0.6].foersteQuestErHvil - (1 - 0.6 ** 3)) < 0.03, `sim-427: 60 %-elevens foerste quest er hvil i ${r[0.6].foersteQuestErHvil}, ventet ca. ${(1 - 0.6 ** 3).toFixed(3)}`)
  }
  ok(sim.krav.some((k) => k.opgaver === 3 && k.krav === 3), 'sim-427: 3-opgavers quests kraever ikke laengere 3 af 3 - opdater KRITIK')
}
const filer = readdirSync(HERE)
ok(filer.filter((f) => /^E-\d\d-.*\.png$/.test(f)).length >= 30, 'faerre end 30 E-skaermbilleder')
const status = tekst('STATUS-427.md')
if (status) {
  for (let i = 1; i <= 9; i++) ok(new RegExp(`\\|\\s*Q${i}\\s*\\|[^\\n]*\\|\\s*(lukket|åben|aaben|delvist)\\s*\\|`, 'i').test(status), `STATUS-427 mangler status for Q${i}`)
}

// --- blok 2 -------------------------------------------------------------------
if (blok >= 2) {
  const ane = json('ane-427.json')
  if (ane) {
    ok(ane.sidefejl.length === 0, `sidefejl i ane-427: ${ane.sidefejl.join(' | ')}`)
    ok(ane.fejl === 2, `ane-427: ${ane.fejl} fejl, ordren siger to`)
    ok(ane.hvil.length >= 1, 'ane-427: eleven moedte aldrig hvilen')
    ok(ane.huen === true, 'ane-427: eleven naaede ikke huen')
    ok(ane.tekster.length >= 3 && ane.tekster.every((t) => t.tekst && t.dom), 'ane-427: teksterne eleven moeder er ikke alle laest og dømt')
  }
  const k = tekst('KRITIK-questbog-2.md')
  if (k) {
    ok(/\*\*Levende for en 10-(å|aa)rig: (ja|nej), fordi/i.test(k), 'KRITIK-questbog-2 mangler linjen "Levende for en 10-aarig: ja/nej, fordi"')
    ok(/\*\*N1\./.test(k) && k.indexOf('**N1.') < k.indexOf('## Hvad der holder'), 'KRITIK-questbog-2: fundene skal staa oeverst')
  }
  const r = tekst('RAPPORT-427.md')
  if (r) {
    ok(r.split('\n')[0].trim() === 'Ordre 427', 'RAPPORT-427.md skal starte med "Ordre 427"')
    for (const a of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(r.includes(a), `RAPPORT-427.md mangler "${a}"`)
  }
}

if (fejl.length) {
  console.error(`verify:kritik-427 blok ${blok} ROED (${fejl.length}):\n - ${fejl.join('\n - ')}`)
  process.exit(1)
}
console.log(`verify:kritik-427 blok ${blok} GROEN: Q1-Q5 kan ikke genskabes, Q6-Q9 har status, 60/80 %-modellen haenger sammen${blok >= 2 ? ', Anes kaede og dokumenterne i orden' : ''}.`)
