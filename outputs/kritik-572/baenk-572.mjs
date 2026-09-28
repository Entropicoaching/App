// Kritik 572, blok 1: baenk-artiklen efter Setus 566, klar naar Marc har svaret?
//   node outputs/kritik-572/baenk-572.mjs     -> baenk-572.json og B-*.png
// Grenen `artikel-baenk` hentes med `git archive` fra entropi-coaching-site-wt2 (ingen gren skiftes,
// intet trae roeres). Loeftmodellens main (dist, src, kroppe, docs) hentes med `git archive` fra
// entropi-loeftmodel-dhruva, og baenkmodellen koeres direkte (src/baenkStillinger.js, src/treLoeft.js).
// Marcs spoergsmaal laeses fra C:\Users\Entropi\Desktop\LAES-DOEDLOEFT-BAENK.html (kun laest).
// 1) Tallene i teksten mod modellen og dist. 2) Figurerne token for token mod dist.
// 3) [MARC]-stederne mod laesesiden. 4) Siden headless paa 390 (touch) og 1280 (mus) uden net.
// Atletnavne: fornavnene fra appens .gitignore, ikke skrevet ud.
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import path, { join } from 'node:path'
import { writeFileSync, readFileSync, mkdtempSync, existsSync, statSync, readdirSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = 'C:/Users/Entropi/Desktop/entropi-coaching-site-wt2'
const LM = 'C:/Users/Entropi/Desktop/entropi-loeftmodel-dhruva'
const LAES = 'C:/Users/Entropi/Desktop/LAES-DOEDLOEFT-BAENK.html'
const GREN = 'artikel-baenk'
const sh = (c) => execSync(c, { maxBuffer: 1 << 26 }).toString()
const top = sh(`git -C "${SITE}" rev-parse --short ${GREN}`).trim()
const lmTop = sh(`git -C "${LM}" rev-parse --short main`).trim()
const dir = mkdtempSync(join(tmpdir(), 'k572-'))
execSync(`git -C "${SITE}" archive -o "${join(dir, 'g.tar')}" ${GREN}`)
execSync('tar -xf g.tar', { cwd: dir })
const lm = join(dir, '_lm')
mkdirSync(lm)
execSync(`git -C "${LM}" archive -o "${join(lm, 'd.tar')}" main dist src kroppe docs package.json`)
execSync('tar -xf d.tar', { cwd: lm })
const D = (f) => readFileSync(join(lm, 'dist', f), 'utf8')
const imp = (f) => import(pathToFileURL(join(lm, 'src', f)).href)

const tjek = []
const paastaa = (hvad, ok, data) => { tjek.push({ hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 400) : ''}`) }
const navne = [...new Set([...readFileSync(join(HERE, '..', '..', '.gitignore'), 'utf8').matchAll(/^supabase\/([a-z]+)-\*/gm)].map((m) => m[1]).filter((n) => n !== 'marc'))]
const tekstAf = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
const taet = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
const komma = (x, d = 1) => x.toFixed(d).replace('.', ',').replace('-', '−')

const html = readFileSync(join(dir, 'artikel-baenk.html'), 'utf8')
const A = tekstAf(html)
const fejlIdx = taet(D('loeft-fejl/index.html'))
const figIdx = taet(D('baenk-figurer/index.html'))
const fejlDoc = readFileSync(join(lm, 'docs', 'FEJLGENKENDELSE.md'), 'utf8')
const lit = readFileSync(join(lm, 'docs', 'baenk-litteratur.md'), 'utf8').replace(/\s+/g, ' ')

// --- modellen paa main, koert direkte ---------------------------------------------------------
const { PRESETS } = await imp('presets.js')
const { laesKrop } = await imp('krop.js')
const { baenkStillinger, baenkKrop, BUER, GREB, OVERARM_UD_MAX_GRADER, ALBUE_UD_MIDT_CM } = await imp('baenkStillinger.js')
const { beregn, forudindstilling } = await imp('treLoeft.js')
const bal = PRESETS.find((p) => p.id === 'balanceret').values
const krop = laesKrop(join(lm, 'kroppe', 'marc.json'), bal)
const L = { ...bal, ...krop.lengths, heightCm: krop.hoejdeCm }
const MM = baenkStillinger(L, 'middel', 'middel')
const st = (id) => MM.stillinger.find((s) => s.id === id).tal
const [br, mi, lo] = [st('bryst'), st('midt'), st('lockout')]
const bryst = (b, g) => { const r = baenkStillinger(L, b, g); return { vej: r.romCm, t: r.stillinger.find((s) => s.id === 'bryst').tal } }
const kombi = {}
for (const b of BUER) for (const g of GREB) kombi[`${b.id}-${g.id}`] = bryst(b.id, g.id)
const top3 = Object.fromEntries(['lille', 'middel', 'stor'].map((b) => [b, baenkKrop(L, b).beroering]))
const kt = Object.fromEntries(['gennemsnit', 'lange-arme', 'lang-torso', 'lange-laar'].map((id) => { const r = beregn('baenk', forudindstilling('baenk', id)); return [id, { albue: r.stillinger.find((s) => s.id === 'bryst').tal.vinkler.albue, vej: r.ekstra.stangvejCm }] }))
const midtBred = baenkStillinger(L, 'middel', 'bred').stillinger.find((s) => s.id === 'midt').tal
const r1 = (x) => komma(x, 1), r0 = (x) => komma(x, 0)
const pct = (a, b) => Math.round((b / a - 1) * 100)
const km = kombi['middel-middel'], kl = kombi['lille-middel'], ks = kombi['stor-middel'], gs = kombi['middel-smal'], gb = kombi['middel-bred']

// [hvad, saetning i artiklen, regnet af modellen paa main]
const par = [
  ['bryst: 25,1 / 17,5 cm, albue 65, 28 ud 33 ned', `25,1 cm mod fødderne fra skulderleddet og 17,5 cm over det. Albue 65°, overarm 28° ud og 33° ned`, r1(br.stangMod.fodderCm) === '25,1' && r1(br.stangOverSkulderCm) === '17,5' && r0(br.albueGrader) === '65' && r0(br.overarmUdGrader) === '28' && r0(br.overarmUnderBrystGrader) === '33'],
  ['bryst: underarmen ca. 11 grader fra siden', 'Underarmen hælder ca. 11° fra lodret set fra siden', Math.round(Math.abs(br.underarmFraLodretSideGrader)) === 11],
  ['bryst: 13,3 forfra, 28,4 og 5,0 cm, 139 og 24 Nm', 'forfra står hænderne 13,3 cm uden for skuldrene. I alt er skulderens momentarm 28,4 cm og albuens 5,0 cm. Skulderen har derfor det meste at holde: i modellen 139 Nm pr. arm mod 24 Nm i albuen', r1(br.momentarmCm.skulderForfra) === '13,3' && r1(br.momentarmCm.skulder) === '28,4' && r1(br.momentarmCm.albue) === '5,0' && r0(br.momentNm.skulder) === '139' && r0(br.momentNm.albue) === '24'],
  ['midt: 38,4 cm, 0,8 cm, albue 83, 45 ud, 9 cm og 16,3 cm', 'Stangen 38,4 cm over skulderleddet og 0,8 cm fra dets lodlinje. Albue 83°, overarm 45° ud. Albuen står 9 cm uden for hånden set forfra og 16,3 cm mod fødderne set fra siden', r1(mi.stangOverSkulderCm) === '38,4' && r1(mi.stangMod.fodderCm) === '0,8' && r0(mi.albueGrader) === '83' && r0(mi.overarmUdGrader) === '45' && r0(mi.momentarmCm.albueForfra) === '9' && r1(mi.momentarmCm.albueSide) === '16,3'],
  ['midt: underarmen ca. 25 forfra og ca. 40 fra siden', 'underarmen hælder ca. 25° forfra og ca. 40° fra siden', Math.round(Math.abs(mi.underarmFraLodretForfraGrader)) === 25 && Math.round(Math.abs(mi.underarmFraLodretSideGrader)) === 40],
  ['midt: 13,4 / 18,6 cm, 66 / 91 Nm', 'skulderens momentarm er næsten kun afstanden ud til siden: 13,4 cm i alt. Albuens arm er 18,6 cm. I modellen er det 66 Nm i skulderen og 91 Nm i albuen pr. arm', r1(mi.momentarmCm.skulder) === '13,4' && r1(mi.momentarmCm.albue) === '18,6' && r0(mi.momentNm.skulder) === '66' && r0(mi.momentNm.albue) === '91'],
  ['lockout: 59,3 cm, vej 41,8, 13,3 cm, 65 og -29 Nm, albue -5,9', 'Stangen lodret over skulderleddet, 59,3 cm over det, og armen strakt. Set forfra står hænderne stadig uden for skuldrene. Vejen fra brystet er 41,8 cm', r1(lo.stangOverSkulderCm) === '59,3' && r1(MM.romCm) === '41,8' && r1(lo.momentarmCm.skulder) === '13,3' && r0(lo.momentNm.skulder) === '65' && r0(lo.momentNm.albue) === '−29' && r1(lo.momentarmCm.albue) === '−5,9' && Math.round(lo.albueGrader) === 180],
  ['albuens stilling: 21,3 -> 18,6 cm (RAPPORT-dag-60)', 'Albuens momentarm ændrer sig kun lidt af valget (21,3 til 18,6 cm)', /Albuens momentarm i alt \| 21,3 cm \| 18,6 cm/.test(readFileSync(join(lm, 'docs', 'RAPPORT-dag-60.md'), 'utf8')) && ALBUE_UD_MIDT_CM === 9],
  ['bredt greb: hoejst 60 grader, albuen 6-7 cm ud', 'Modellen holder den på højst 60° og lader albuen gå mindre ud (6-7 cm)', OVERARM_UD_MAX_GRADER === 60 && Math.round(midtBred.overarmUdGrader) === 60 && midtBred.momentarmCm.albueForfra >= 6 && midtBred.momentarmCm.albueForfra <= 7],
  ['kap. 4: albue 59,4 / 72,2 mod 66,4, vej +6,1 cm, laarben intet', 'Lange arme: albuen er 59,4° mod 66,4°, og stangens vej bliver 6,1 cm længere. Lang torso: albuen er 72,2° mod 66,4°. Lange lårben: næsten ingen forskel ved brystet', r1(kt['lange-arme'].albue) === '59,4' && r1(kt.gennemsnit.albue) === '66,4' && r1(kt['lang-torso'].albue) === '72,2' && r1(kt['lange-arme'].vej - kt.gennemsnit.vej) === '6,1' && Math.abs(kt['lange-laar'].albue - kt.gennemsnit.albue) < 0.5],
  ['buen: toppen 7,7 cm hoejere, vej -23 %, skulder +7 %, albue +11 %', 'Fra lille til stor bue kommer brystets top 7,7 cm højere op, og stangen rører længere mod fødderne. Vejen bliver 23 % kortere (46,2 til 35,8 cm), mens skulderens momentarm bliver 7 % længere og albuens 11 % længere', r1(top3.stor.y - top3.lille.y) === '7,7' && -pct(kl.vej, ks.vej) === 23 && pct(kl.t.momentarmCm.skulder, ks.t.momentarmCm.skulder) === 7 && pct(kl.t.momentarmCm.albue, ks.t.momentarmCm.albue) === 11 && ks.t.stangMod.fodderCm > kl.t.stangMod.fodderCm],
  ['grebet: vej -9 %, skulder +30 %, albue 7,6 -> -0,6, 10 -> 48 grader', 'Fra smalt til bredt greb bliver vejen 9 % kortere (43,0 til 39,2 cm), skulderens momentarm 30 % længere (25,6 til 33,2 cm), og albuens arm forsvinder næsten (7,6 til −0,6 cm)', -pct(gs.vej, gb.vej) === 9 && pct(gs.t.momentarmCm.skulder, gb.t.momentarmCm.skulder) === 30 && r1(gs.t.momentarmCm.albue) === '7,6' && r1(gb.t.momentarmCm.albue) === '−0,6' && r0(gs.t.overarmUdGrader) === '10' && r0(gb.t.overarmUdGrader) === '48'],
  ['de ni kombinationer (vej, arme, Nm, grader, albuevinkel)', 'Stor, bredt 33,2 32,5 1,9 159 / 9 51 / 34 82', Object.entries(kombi).every(([k, { vej, t }]) => {
    const [b, g] = k.split('-'); const nb = { lille: 'Lille', middel: 'Middel', stor: 'Stor' }[b]; const ng = { smal: 'smalt', middel: 'middel', bred: 'bredt' }[g]
    return A.includes(`${nb}, ${ng} ${r1(vej)} ${r1(t.momentarmCm.skulder)} ${r1(t.momentarmCm.albue)} ${r0(t.momentNm.skulder)} / ${r0(t.momentNm.albue)} ${r0(t.overarmUdGrader)} / ${r0(t.overarmUnderBrystGrader)} ${r0(t.albueGrader)}`)
  })],
  ['stor bue, smalt greb: albuens centrum 1,5 cm under skulderen', 'Med stor bue og smalt greb står albuens centrum 1,5 cm under skulderleddets ved brystet', r1(kombi['stor-smal'].t.albueUnderSkulderCm) === '1,5'],
  ['buen som vip (554, 183 cm og 120 kg): -1,1 / 1,7 / 6,2 cm', 'For referencekroppen flytter 2,5 cm ekstra bue stangen ca. 1 cm mod fødderne, 5 cm ekstra ca. 2 cm mod halsen og 7,5 cm ekstra ca. 6 cm mod halsen', /\| 183 cm, 120 kg \| 2,5 cm \| 6,6 \| −1,1 cm \|/.test(fejlDoc) && /\| 183 cm, 120 kg \| 5 cm \| 14,3 \| 1,7 cm \|/.test(fejlDoc) && /\| 183 cm, 120 kg \| 7,5 cm \| 24,9 \| 6,2 cm \|/.test(fejlDoc) && krop.hoejdeCm === 183],
  ['kap. 7 albuen ude: 80, 9,8, 54, 5,0 -> 22,4, x4,5, +1,0, 69 grader', 'Når albuen går 80° ud, kan underarmen ikke nå brystets top, så stangen lander 9,8 cm nærmere halsen, og underarmen hælder 54° ind set forfra', /Når albuen går 80° ud, kan underarmen ikke nå brystets top, så stangen lander 9,8 cm nærmere halsen; albuen står så langt uden for hånden, at underarmen hælder 54° ind set forfra, og albuens moment bliver ca\. 4,5 gange/.test(fejlIdx) && /Albuens arm i alt går fra 5,0 til 22,4 cm, mest set forfra/.test(fejlIdx) && /Stangen får 1,0 cm længere vej op/.test(fejlIdx) && /højst stå ca\. 69° ud/.test(fejlIdx) && A.includes('albuens momentarm vokser fra 5,0 til 22,4 cm') && A.includes('Stangen får 1,0 cm længere vej op')],
  ['kap. 7 stangen for hoejt: 15,0, 52, 21,2, x4,3, +2,6', 'Når stangen lander 15 cm nærmere halsen, og albuen bliver under stangen set forfra, hælder underarmen 52° mod fødderne set fra siden', /hælder underarmen 52° mod fødderne set fra siden; albuens moment bliver ca\. 4,3 gange så stort, og stangen får 2,6 cm længere vej/.test(fejlIdx) && /Albuens arm i alt går fra 5,0 til 21,2 cm, mest set fra siden/.test(fejlIdx) && A.includes('Albuens momentarm vokser fra 5,0 til 21,2 cm, mest set fra siden')],
  ['kap. 7 tabellerne = fejlsidens', '90° ud 16,2 cm 90° 44,9 cm ×4,5', null],
  ['kap. 7 fejlsidens to saetninger om grebet og det hoejere beroeringspunkt', 'Et højere berøringspunkt er ikke altid en fejl: tabellens 10 cm kan også komme af greb, albuer og bue, som modellen her holder fast', /Et højere berøringspunkt er ikke altid en fejl: tabellens 10 cm kan også komme af greb, albuer og bue, som modellen her holder fast/.test(fejlIdx) && /Grebet er holdt fast i modellen, så kun albuen flytter sig; en løfter flytter ofte grebet med albuen/.test(fejlIdx)],
  ['Maal dit billede: hoejst 5 cm hoejere over skulderen (main og grenen)', 'Mål dit billede tjekker derfor kun et billede med stangen på brystet, når stangen står højst 5 cm højere over skulderen end i modellen', [join(lm, 'dist', 'maal-billede', 'maal-billede.js'), join(dir, 'assets', 'vaerktoejer', 'maal-billede', 'maal-billede.js')].every((f) => { const s = readFileSync(f, 'utf8'); const m = s.match(/let l=\w+-\w+\(\w+\)\.stangOverSkulder,o=l>=-(\w+)&&l<=(\w+);/); return m && new RegExp(`[,; ]${m[2]}=5[,;]`).test(s) })],
  ['Bartolomei 2024, Larsen 2020, Mausehund 2022 i litteraturen', 'Mere bue giver kortere vej hos løftere, der bænker med og uden bue, som i modellen (Bartolomei m.fl. 2024). Bredere greb giver større vandret moment om skulderen, som i modellen (Larsen m.fl. 2020)', /stangens LODRETTE FORSKYDNING var STØRRE med flad ryg/.test(lit) && /The wide and medium grip widths produced greater horizontal shoulder moments than the narrow grip width/.test(lit) && /Mausehund L, Werkhausen A, Bartsch AK, Krosshaug T/.test(lit)],
]
// kap. 7-tabellerne: holdes op raekke for raekke
const tabRaekker = [['75° ud', '5,4', '75', '42,1', '4,5'], ['80° ud', '9,8', '80', '42,7', '4,5'], ['85° ud', '13,4', '85', '43,7', '4,5'], ['90° ud', '16,2', '90', '44,9', '4,5'], ['80° ud, 10° ned', '16,1', '80', '44,8', '4,0'], ['10 cm højere', '10,0', '26', '42,8', '3,2'], ['15 cm højere', '15,0', '25', '44,4', '4,3'], ['20 cm højere', '20,0', '23', '47,0', '5,2']]
const fejlTaet = fejlIdx.replace(/s/g, '')
const fejlRaekkeOk = tabRaekker.every(([n, a, b, c, d]) => A.includes(`${n} ${a} cm ${b}° ${c} cm ×${d}`) && fejlTaet.includes(`${a}${b}${c}×${d}`))
par.find((p) => p[2] === null)[2] = fejlRaekkeOk
const talAfvig = par.filter(([, a, ok]) => !A.includes(a) || !ok).map(([h, a, ok]) => ({ h, iArtikel: A.includes(a), modellen: !!ok }))
paastaa(`${par.length} tal-saetninger staar i artiklen og passer med loeftmodellens main (${lmTop})`, talAfvig.length === 0, talAfvig)

// 2) figurerne mod dist
const figAfvig = []
let figAntal = 0
for (const d of ['baenk-figurer', 'loeft-fejl']) {
  for (const b of readdirSync(join(dir, 'assets', d)).filter((x) => x.endsWith('.svg') && (d === 'baenk-figurer' || x.startsWith('bp-')))) {
    figAntal++
    const tok = (s) => s.replace(/\r/g, '').split(/(?=<)/)
    const a = tok(D(`${d}/${b}`)), c = tok(readFileSync(join(dir, 'assets', d, b), 'utf8'))
    if (a.length !== c.length) { figAfvig.push({ b, laengde: [a.length, c.length] }); continue }
    for (let i = 0; i < a.length; i++) {
      if (a[i] === c[i]) continue
      const lov = /^<(svg|title|desc)/.test(a[i]) && a[i].replace(/Marcs mål i modellen/g, '183 cm i modellen') === c[i]
      if (!lov || /Marc/.test(c[i])) figAfvig.push({ b, dist: a[i].slice(0, 120), artikel: c[i].slice(0, 120) })
    }
  }
}
const brugte = [...new Set([...html.matchAll(/src="assets\/(baenk-figurer|loeft-fejl)\/([^"]+\.svg)"/g)].map((m) => m[2]))]
paastaa(`${figAntal} figurer = dist paa main, kun "Marcs maal" -> "183 cm" i svg/title/desc; ${brugte.length} brugt`, figAntal === 12 && figAfvig.length === 0 && brugte.length === 12, figAfvig)

// vaerktoejerne
const samme = (a, b) => readFileSync(a).equals(readFileSync(b))
const vaerk = {}
for (const v of ['tre-loeft', 'min-krop', 'maal-billede']) {
  const filer = readdirSync(join(lm, 'dist', v)).filter((f) => statSync(join(lm, 'dist', v, f)).isFile())
  vaerk[v] = filer.filter((f) => !existsSync(join(dir, 'assets', 'vaerktoejer', v, f)) || !samme(join(lm, 'dist', v, f), join(dir, 'assets', 'vaerktoejer', v, f)))
}
paastaa('tre-loeft og min-krop paa grenen = dist paa main', !vaerk['tre-loeft'].length && !vaerk['min-krop'].length, vaerk)

// 3) [MARC]-stederne mod laesesiden
const marc = [...html.matchAll(/<p class="[^"]*marc[^"]*" data-marc="([^"]+)">([\s\S]*?)<\/p>/g)].map((m) => ({ id: m[1], tekst: tekstAf(m[2]).trim() }))
const laes = readFileSync(LAES, 'utf8')
const felterAlle = [...laes.matchAll(/Står i teksten<\/span><q class="felt">([\s\S]*?)<\/q>/g)].map((m) => tekstAf(m[1]).trim())
const felter = felterAlle.slice(10, 18)
const sporg = marc.filter((m) => /^bp-\d+$/.test(m.id))
const ordretAfvig = sporg.filter((m) => { const n = Number(m.id.slice(3)); return m.tekst.replace(/^\[MARC \d+:/, '[MARC:') !== felter[n - 1] }).map((m) => m.id)
paastaa('10 [MARC]-steder: bp-1 til bp-8 een gang hver og 2 afledte', marc.length === 10 && sporg.map((m) => m.id).sort().join() === Array.from({ length: 8 }, (_, i) => `bp-${i + 1}`).sort().join() && marc.filter((m) => /afledt/.test(m.id)).length === 2, marc.map((m) => m.id))
paastaa('de 8 spoergsmaal staar ordret som "Staar i teksten" paa laesesiden (felt 11-18)', felterAlle.length === 18 && ordretAfvig.length === 0, ordretAfvig)
const ved = (id) => { const i = html.indexOf(`data-marc="${id}"`); return (html.slice(0, i).match(/id="(fase-[a-z]+|buen|grebet|kap-[a-z]+|hvad-jeg-kigger-efter|teknikvalg)"/g) ?? []).pop()?.slice(4, -1) }
const steder = Object.fromEntries(sporg.map((m) => [m.id, ved(m.id)]))
paastaa('hvert spoergsmaal staar ved det, det spoerger om', steder['bp-4'] === 'fase-bryst' && steder['bp-7'] === 'fase-midt' && steder['bp-8'] === 'kap-segmentmodellen' && steder['bp-5'] === 'buen' && steder['bp-6'] === 'grebet' && steder['bp-3'] === 'kap-fejlbilleder' && steder['bp-2'] === 'hvad-jeg-kigger-efter', steder)

// fund (se BAENK.md)
const k5 = tekstAf(html.split('id="kap-variant"')[1].split('id="kap-virkeligheden"')[0])
const lesTekst = tekstAf(laes)
const fund = {
  BA1: {
    stangModFoedder: Object.fromEntries(['lille', 'middel', 'stor'].map((b) => [b, r1(kombi[`${b}-middel`].t.stangMod.fodderCm)])),
    skulderIAlt: Object.fromEntries(['lille', 'middel', 'stor'].map((b) => [b, r1(kombi[`${b}-middel`].t.momentarmCm.skulder)])),
    artikel: ['Med mere bue kommer brystets top højere op og længere mod fødderne', 'og stangen rører længere mod fødderne', 'fordi stangen rører længere mod fødderne'].filter((x) => k5.includes(x)),
    distSiger: /med mere bue ligger det punkt højere og længere mod fødderne/.test(figIdx),
  },
  BA2: { artikel: A.includes('8-10 cm ud er vurderet som tættere på, hvad man ser'), koden: /Tallet er Bhishaks \(457\), ikke en måling/.test(readFileSync(join(lm, 'src', 'baenkStillinger.js'), 'utf8')), laesesiden: /8-10 cm ud er vurderet som tættere på, hvad man ser\. Albuens momentarm ændrer sig kun lidt af valget \(21,3 til 18,6 cm\), så albuens større moment midt i opturen kommer af stangens plads over skulderen, ikke af valget\. Bhishak, kritik 457/.test(lesTekst), bp7: steder['bp-7'] === 'fase-midt' },
  BA3: { laesesidenErKladden: /Kladden på grenen baenk-kladde \(19e41ee\)/.test(lesTekst), gamleTal: /Når albuen går 90° ud, kan underarmen ikke nå brystets top, så stangen lander ca\. 16 cm nærmere halsen/.test(lesTekst) && /Skulderens arm falder fra 28,4 til 16,0 cm, ca\. 44 %/.test(lesTekst) && /opdigtet referencekrop/.test(lesTekst), artiklenNu: A.includes('Når albuen går 80° ud') },
  BA4: { overskrift: A.includes('I bænken lander stangen 10-15 cm nærmere halsen'), albueUd: '9,8', valgt: /Fejlens størrelse er valgt/.test(fejlIdx) },
  BA5: { titel: /<title>Bænkpressets biomekanik: bue, greb og individuel variation/.test(html), markeret: /data-marc="[^"]*"[^>]*>[^<]*individuel variation/.test(html) },
  BA6: { artikel: A.includes('IPF Technical Rulebook 2026, afsnit 4.2, punkt 8, og 4.2.1, punkt 3, 4, 6 og 11') && A.includes('4.2.1, punkt 2 og 9') && A.includes('fødderne må flytte sig, men skal blive flade, og de må ikke røre bænken'), udtraekHar: ['pkt. 3', 'pkt. 4', 'pkt. 5', 'pkt. 7', 'pkt. 11'].filter((p) => lit.includes(`${p} "`)), udtraekHarIkke: ['pkt. 2 "', 'pkt. 6 "', 'pkt. 9 "'].filter((p) => !lit.split('Underkendelse (4.2.1)')[1]?.split('Signaltabellen')[0].includes(p)), foedderFlytte: /feet may move|may move/.test(lit) },
  BA7: { kommentarNavne: [...new Set((html.match(/<!--[\s\S]*?-->/g) ?? []).join(' ').match(/Bhishak|Yantra|Setu|Dhruva|ORDRE \d+|Ordre \d+/g) ?? [])], jsKommentar: /\/\/ Ordre 405/.test(html) },
  BA8: { maalBilledeAfvigerFraMain: vaerk['maal-billede'] },
  BA9: { ofte: A.includes('en løfter flytter ofte grebet med albuen'), paaMain: /en løfter flytter ofte grebet med albuen/.test(fejlIdx) },
}
paastaa('BA1: mere bue -> "laengere mod foedderne", men middel -> stor er 1,0 cm mod halsen', fund.BA1.artikel.length === 3 && fund.BA1.stangModFoedder.middel === '25,1' && fund.BA1.stangModFoedder.stor === '24,1' && fund.BA1.skulderIAlt.middel === '28,4' && fund.BA1.skulderIAlt.stor === '27,6', fund.BA1)
paastaa('BA2: "8-10 cm ud er vurderet" er min dom fra 457, umaerket over bp-7', fund.BA2.artikel && fund.BA2.koden && fund.BA2.laesesiden && fund.BA2.bp7, fund.BA2)
paastaa('BA3: laesesiden viser baenk-kladden med tallene fra foer 493', fund.BA3.laesesidenErKladden && fund.BA3.gamleTal && fund.BA3.artiklenNu, fund.BA3)
paastaa('BA4: kap. 7 "I baenken lander stangen 10-15 cm" om en valgt stoerrelse', fund.BA4.overskrift && fund.BA4.valgt, fund.BA4)
paastaa('BA5: titlen "individuel variation" er umaerket', fund.BA5.titel && !fund.BA5.markeret, fund.BA5)
paastaa('BA6: IPF 4.2.1 pkt. 2, 6 og 9 og "foedderne maa flytte sig" staar ikke i uddraget', fund.BA6.artikel && fund.BA6.udtraekHarIkke.length === 3 && !fund.BA6.foedderFlytte, fund.BA6)
paastaa('BA7: interne navne i sidens kildekode (kommentarer)', fund.BA7.kommentarNavne.length > 0 && fund.BA7.jsKommentar, fund.BA7)
paastaa('BA8: Maal dit billede paa grenen er ikke main', fund.BA8.maalBilledeAfvigerFraMain.length > 0, fund.BA8)
paastaa('BA9: "en loefter flytter ofte grebet med albuen" (fejlsidens, paa main)', fund.BA9.ofte && fund.BA9.paaMain, fund.BA9)

// laesetid som squat-artiklen: brødtekst, figurtekster og forbehold uden folde og uden .marc, 130 ord/min
const uden = html.split('<main')[1].split('</main>')[0].replace(/<details[\s\S]*?<\/details>/g, '').replace(/<p class="[^"]*marc[^"]*"[\s\S]*?<\/p>/g, '').replace(/<div role="navigation"[^>]*>\s*<\/div>/, '').replace(/<div class="references"[\s\S]*?<\/div>\s*<\/div>/, '').replace(/<div class="author-strip"[\s\S]*$/, '')
const ord = tekstAf(uden).split(' ').filter((w) => /[\p{L}\d]/u.test(w)).length
paastaa(`laesetid: ${ord} ord / 130 = ${(ord / 130).toFixed(1)} min, siden siger 17`, Math.round(ord / 130) === 17 || Math.ceil(ord / 130) === 17, { ord })

// 4) siden i browseren
const TYPER = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml' }
const server = createServer((req, res) => {
  let fil = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (existsSync(fil) && statSync(fil).isDirectory()) fil = join(fil, 'index.html')
  if (!existsSync(fil)) { res.writeHead(404); return res.end('404') }
  res.writeHead(200, { 'content-type': TYPER[path.extname(fil).toLowerCase()] ?? 'application/octet-stream' })
  res.end(readFileSync(fil))
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const BASE = `http://127.0.0.1:${server.address().port}/`
const require = createRequire(import.meta.url)
const { chromium } = require(join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
const browser = await chromium.launch()
const sider = []
for (const w of [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, hasTouch: w === 390, isMobile: w === 390, deviceScaleFactor: w === 390 ? 2 : 1 })
  const page = await ctx.newPage()
  const r = { bredde: w, sidefejl: [], http404: [], eksterne: [] }
  page.on('pageerror', (e) => r.sidefejl.push(e.message))
  page.on('response', (s) => { if (s.status() >= 400 && s.url().startsWith(BASE)) r.http404.push(s.url().slice(BASE.length)) })
  await page.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : (r.eksterne.push(new URL(route.request().url()).host), route.abort())))
  await page.goto(BASE + 'artikel-baenk.html', { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelectorAll('iframe').forEach((f) => f.scrollIntoView()))
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
  await page.waitForTimeout(600)
  const t = await page.evaluate(() => document.body.innerText)
  Object.assign(r, {
    vandret: await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    skaerme: +(await page.evaluate(() => document.documentElement.scrollHeight / window.innerHeight)).toFixed(1),
    tankestreger: (t.match(/[–—]/g) ?? []).length,
    synligMarc: (t.match(/\[MARC|\[ \]/g) ?? []).length,
    marcSkjult: await page.evaluate(() => [...document.querySelectorAll('.marc')].every((e) => e.offsetParent === null)),
    atletnavne: navne.reduce((a, n) => a + (t.match(new RegExp(`\\b${n}\\b`, 'gi')) ?? []).length, 0),
    interneNavne: (t.match(/\b(Bhishak|Yantra|Setu|Dhruva|Chaturanga|Ordre \d+)\b/g) ?? []).length,
    manSkal: (t.match(/\bman skal\b/gi) ?? []).length,
    billeder: await page.evaluate(() => [...document.images].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, bred: Math.round(i.getBoundingClientRect().width), alt: (i.getAttribute('alt') ?? '').length }))),
    rammer: await page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => ({ id: f.id, h: Math.round(f.getBoundingClientRect().height), tekst: (f.contentDocument?.body?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 300) }))),
    tabeller: await page.evaluate(() => [...document.querySelectorAll('.article-body table')].map((tb) => { const box = tb.closest('.fact-box') || tb.parentElement; const cs = getComputedStyle(box); const kap = tb.closest('section')?.id; return { kap, kolonner: tb.rows[0].cells.length, bred: tb.scrollWidth, boks: box.clientWidth, overflowX: cs.overflowX, rullerSelv: box.scrollWidth > box.clientWidth && /auto|scroll/.test(cs.overflowX) } })),
    knapper: await page.evaluate(() => [...document.querySelectorAll('.article-body summary, .kapmenu-knap')].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height))),
  })
  // tre-loeft: kap. 4 (baenk, lange arme, lang torso, lange laarben mod gennemsnit), og tre-loefts egen linje
  r.treLoeft = {}
  for (const s of ['gennemsnit', 'lange-laar', 'lange-arme', 'lang-torso']) {
    const p2 = await ctx.newPage()
    await p2.goto(BASE + `assets/vaerktoejer/tre-loeft/index.html#loeft=baenk&start=${s}&stilling=bryst`, { waitUntil: 'load' })
    await p2.waitForTimeout(400)
    const tt = (await p2.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    const tal = (n) => tt.match(new RegExp(n + ' ([\\d,−-]+)'))?.[1]
    r.treLoeft[s] = { albue: tal('Albuevinkel \\(°\\)'), vej: tal('Stangens vej[^(]*\\(cm\\)'), linje: tt.match(/Længere [^.]*\./)?.[0] ?? '' }
    await p2.close()
  }
  const skud = async (sel, navn) => { const el = page.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await el.screenshot({ path: join(HERE, `B-${w}-${navn}.png`) }) }
  await skud('#buen ~ figure, #buen ~ .figur, #buen ~ div', 'buen-figurer')
  await skud('p:has-text("En bue, der er større end modellens egen")', 'buen-vip')
  await skud('#fase-midt', 'midt-opturen')
  await skud('#kap-fejlbilleder', 'kap7')
  await skud('#kap-variant .fact-box', 'bue-greb-tabel')
  await page.evaluate(() => document.body.classList.remove('skjul-marc'))
  await page.waitForTimeout(200)
  r.marcSynligeUdenKlasse = await page.evaluate(() => [...document.querySelectorAll('.marc')].filter((e) => e.offsetParent !== null).length)
  r.vandretMedMarc = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
  if (w === 390) await skud('[data-marc="bp-5"]', 'bp5-med-marc')
  sider.push(r)
  await ctx.close()
}
await browser.close()
server.close()
const tl = sider[0].treLoeft
paastaa('kap. 4 = tre-loeft paa grenen: albue 66,4 / 59,4 / 72,2 og vej +6,1 cm', tl.gennemsnit.albue === '66,4' && tl['lange-arme'].albue === '59,4' && tl['lang-torso'].albue === '72,2' && tl['lange-laar'].albue === '66,4' && tl.gennemsnit.vej && (Number(tl['lange-arme'].vej.replace(',', '.')) - Number(tl.gennemsnit.vej.replace(',', '.'))).toFixed(1) === '6.1', tl)
for (const r of sider) {
  paastaa(`${r.bredde}: ingen vandret rul, 0 JS-fejl, 0 404, 0 tankestreger, 0 synlige [MARC/[ ], 0 atletnavne, 0 interne navne, 0 "man skal"`,
    r.vandret && !r.sidefejl.length && !r.http404.length && !r.tankestreger && !r.synligMarc && r.marcSkjult && !r.atletnavne && !r.interneNavne && !r.manSkal, { e: r.eksterne, f: r.sidefejl, h: r.http404, t: r.tankestreger, m: r.synligMarc })
  paastaa(`${r.bredde}: kun skrifttypen forsoeger at gaa ud af huset`, r.eksterne.every((h) => /fonts\.(googleapis|gstatic)\.com/.test(h)), [...new Set(r.eksterne)])
  paastaa(`${r.bredde}: 13 billeder vist med alt-tekst, 0 brudte, ingen bredere end skaermen`, r.billeder.length === 13 && r.billeder.every((b) => b.ok && b.alt > 20 && b.bred <= r.bredde), r.billeder.filter((b) => !b.ok))
  paastaa(`${r.bredde}: begge rammer har indhold og hoejde`, r.rammer.length === 2 && r.rammer.every((f) => f.h > 150 && f.tekst.length > 20), r.rammer.map((f) => [f.id, f.h]))
  const smalle = r.tabeller.filter((x) => x.bred > x.boks)
  paastaa(`${r.bredde}: ${r.tabeller.length} tabeller; bredere end boksen: ${smalle.length}, og de ruller selv (ikke skaaret af)`, smalle.every((x) => x.rullerSelv), smalle)
  paastaa(`${r.bredde}: foldenes knapper mindst 44 px`, r.knapper.every((h) => h >= 44), [Math.min(...r.knapper), Math.max(...r.knapper)])
  paastaa(`${r.bredde}: uden skjul-marc ses alle 10, stadig uden vandret rul`, r.marcSynligeUdenKlasse === 10 && r.vandretMedMarc)
}
const ud = { gren: GREN, top, loeftmodelMain: lmTop, navneTjekket: navne.length, fund, tjek, sider }
writeFileSync(join(HERE, 'baenk-572.json'), JSON.stringify(ud, null, 1))
const roede = tjek.filter((x) => !x.ok).length
console.log(`baenk-572: ${tjek.length - roede}/${tjek.length} (${GREN} ${top}, loeftmodel main ${lmTop})`)
process.exit(roede ? 1 : 0)
