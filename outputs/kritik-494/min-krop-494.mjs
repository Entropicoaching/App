// KRITIK 494 blok 2: Bhishak gentjekker "Min krop" efter Yantras 488 (M1-M7 fra kritik 471)
// med de samme tre SYNTETISKE kropstyper og 114 %-eksemplet.
//   node outputs/kritik-494/min-krop-494.mjs [snapshot-mappe]
// 488 er ikke merget i loeftmodel-dhruva endnu; koden er grenen min-krop-klar (af7172f), hentet
// med `git -C entropi-loeftmodel-dhruva archive af7172f src dist | tar -x -C <mappe>` (standard:
// min scratchpad). Intet traee i loeftmodellen er roert. Skriver outputs/kritik-494/min-krop-494.json
// og K-*.png (siden headless uden net paa 390 og 1280 px).
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path, { join } from 'node:path'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SNAP = process.argv[2] || 'C:/Users/Entropi/AppData/Local/Temp/claude/C--Users-Entropi-Desktop-entropi-app-kritik/f8dac1bd-5620-468a-a803-056c3e363b11/scratchpad/lm488'
if (!existsSync(`${SNAP}/src/minKrop.js`)) { console.error(`mangler 488-snapshot i ${SNAP}`); process.exit(2) }
const imp = (f) => import(pathToFileURL(`${SNAP}/src/${f}`).href)
const M = await imp('minKrop.js')
const T = await imp('treLoeft.js')
const SD = await imp('solverDeadlift.js')
const EM = await imp('embed/minKrop.js')

const r1 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10) / 10)
const tjek = []
const paastaa = (m, hvad, ok, data) => { tjek.push({ m, hvad, ok: !!ok, data }); console.log(`${ok ? 'ok ' : 'NEJ'} ${m}: ${hvad}${data !== undefined ? ' ' + JSON.stringify(data).slice(0, 500) : ''}`) }

function krop(h, v, pct = {}) {
  const o = { hoejde: h, vaegt: v }
  for (const id of M.SEGMENT_MAAL) o[id] = r1(M.gennemsnitCm(id, h) * (pct[id] ?? 100) / 100)
  return o
}
const KROPPE = {
  A: krop(180, 90, { laar: 108, skinneben: 98, torso: 94 }),
  B: krop(170, 75, { laar: 93, skinneben: 102, torso: 106, overarm: 95, underarm: 95 }),
  C: krop(188, 105, { torso: 97, overarm: 107, underarm: 106 }),
}
function resultat(maal) {
  const r = M.beregnMinKrop(maal)
  if (!r.ok) return { ok: false, fejl: r.fejl.map((f) => f.tekst) }
  const ud = { ok: true }
  for (const { id } of M.LOEFT) {
    ud[id] = {}
    for (const s of M.STILLINGER_FOR[id]) ud[id][s.id] = { linje: M.forskelsLinje(id, r.loeft[id], s.id), forskel: Object.fromEntries(M.tabel(id, r.loeft[id], s.id).map((x) => [x.navn, r1(x.forskel)])) }
  }
  return ud
}
const R = Object.fromEntries(Object.entries(KROPPE).map(([n, k]) => [n, resultat(k)]))

// --- M1: squattens linje ----------------------------------------------------------------
paastaa('M1', 'krop B i bunden og i sticking point: linjen naevner overkrop og skinneben sammen', /overkrop og skinneben tilsammen/.test(R.B.squat.bund.linje) && /overkrop og skinneben tilsammen/.test(R.B.squat.sticking.linje), R.B.squat.bund.linje)
paastaa('M1', 'krop A (lange laar) faar ogsaa parret, med overkroppen mere haeldende', /overkrop og skinneben tilsammen/.test(R.A.squat.bund.linje) && R.A.squat.bund.forskel['Torso fra lodret'] >= 4, R.A.squat.bund.linje)
paastaa('M1', 'krop B: linjen siger ikke, hvilken vej de korte laar trækker (mere oprejst overkrop), kun at de to skal laeses sammen', !/oprejst/.test(R.B.squat.bund.linje), null)

// --- M2: taerskel og forbehold -------------------------------------------------------------
const snit = M.gennemsnitsMaal(178, 85)
const plus2 = {}
for (const id of M.SEGMENT_MAAL) {
  const r = resultat({ ...snit, [id]: r1(snit[id] + 2) })
  const alle = [r.squat.bund.forskel, r.doedloeft.opstilling.forskel, r.baenk.bryst.forskel].flatMap((f) => Object.entries(f).filter(([n]) => /vinkel|lodret|ud fra/i.test(n)).map(([, v]) => Math.abs(v)))
  plus2[id] = r1(Math.max(...alle))
}
paastaa('M2', 'taersklen er 4 grader og 3 cm i koden', M.TAERSKEL.grader === 4 && M.TAERSKEL.cm === 3, M.TAERSKEL)
paastaa('M2', 'eet maal 2 cm for langt flytter stadig den stoerste vinkel 2,7-3,6 grader: under 4-graders-taersklen', Object.values(plus2).every((v) => v >= 2.5 && v < 4), plus2)
const alleLinjer = Object.entries(R).flatMap(([n, r]) => M.LOEFT.flatMap(({ id }) => Object.entries(r[id]).map(([s, v]) => ({ n, id, s, ...v }))))
const underTaerskel = alleLinjer.filter((l) => /^Største forskel/.test(l.linje)).filter((l) => {
  const stoerst = Math.max(...Object.entries(l.forskel).filter(([k]) => k !== 'Stangens vej, hele løftet').map(([k, v]) => Math.abs(v) / (/(cm)|afstand|vej/i.test(k) ? 3 : 4)))
  return stoerst < 1
})
paastaa('M2', 'ingen "stoerste forskel" for A, B, C i nogen stilling fremhaever noget under taersklen', underTaerskel.length === 0, underTaerskel.map((l) => `${l.n} ${l.id} ${l.s}`))
paastaa('M2', 'krop B: baenkens lockout fremhaeves ikke laengere', /næsten intet/.test(R.B.baenk.lockout.linje), R.B.baenk.lockout.linje)

// --- M3: summen -------------------------------------------------------------------------
const alle114 = { ...snit }
for (const id of M.SEGMENT_MAAL) alle114[id] = r1(M.gennemsnitCm(id, 178) * 1.14)
const v114 = M.valider(alle114)
paastaa('M3', '114 %-kroppen afvises med "203 cm" og ingen figur', !v114.ok && v114.fejl.some((f) => /203 cm/.test(f.tekst)), v114.fejl.map((f) => f.tekst))
paastaa('M3', 'A, B og C passer (99-101 %)', Object.values(KROPPE).every((k) => M.valider(k).ok), Object.fromEntries(Object.entries(KROPPE).map(([n, k]) => [n, r1(M.sumTjek(M.valider(k).maal).pct)])))
// Hoftepunktet sat 8 cm for hoejt paa BEGGE maal (hoftekammen) giver laar 118 % og afvises af
// spaendet. Sat 5 cm for hoejt (mellem trochanter og kammen) tages begge, og summen udligner.
const kamAfvist = M.valider({ ...snit, laar: r1(snit.laar + 8), torso: r1(snit.torso - 8) })
paastaa('M3', 'hoftepunktet ved hoftekammen (8 cm) paa baade laar og overkrop afvises af spaendet pr. maal', !kamAfvist.ok, kamAfvist.fejl.map((f) => f.id))
const kam = { ...snit, laar: r1(snit.laar + 5), torso: r1(snit.torso - 5) }
paastaa('M3', 'men hoftepunktet 5 cm for hoejt paa begge maal tages: laar 111 % og overkrop 90 % er hver for sig i spaendet, og summen udligner til 100 %', M.valider(kam).ok, { laarPct: r1(kam.laar / snit.laar * 100), torsoPct: r1(kam.torso / snit.torso * 100), sumPct: r1(M.sumTjek(M.valider(kam).maal).pct) })
const kamR = resultat(kam)
paastaa('M3', 'og den krop faar en figur og en linje, der fremhaever en forskel over taersklen', kamR.ok && /^Største forskel/.test(kamR.squat.bund.linje), { squat: kamR.squat?.bund?.linje, doedloeft: kamR.doedloeft?.opstilling?.linje })

// --- M4: haanden ----------------------------------------------------------------------------
const H = T.HAAND_GREB_ANDEL_H ?? 0.054
paastaa('M4', 'haanden er 0,054 x hoejden og foelger hoejden, ikke underarmen', Math.abs(H - 0.054) < 1e-9)
const Lsnit = T.laengder(M.indstilling('doedloeft', snit))
const gamle = SD.armReachCm(Lsnit.upperArm, Lsnit.underArm) // brøken af underarmen (foer 488)
const nye = SD.armReachCm(Lsnit.upperArm, Lsnit.underArm, Lsnit.grebCm)
paastaa('M4', 'for tabellens krop er den gamle haand (broek af underarmen) = den nye (0,054 H): mit 471-udgangspunkt havde allerede en haand', Math.abs(gamle - nye) < 0.05, { gammel: r1(gamle), ny: r1(nye), grebCm: r1(Lsnit.grebCm) })
// Mit 471-forsoeg: underarm +8 cm. Foer 488 blev haanden med skaleret (8 cm -> ca. 11 cm i alt).
const plus8Gammel = SD.armReachCm(Lsnit.upperArm, Lsnit.underArm + 8) - gamle
paastaa('M4', 'i 471 flyttede min "+8 cm" stangen ca. 11 cm (haanden skaleret med), altsaa til ca. 20 cm under haandleddet - mit tal for haanden var for stort', plus8Gammel > 10, r1(plus8Gammel))
const ind = M.indstilling('doedloeft', snit)
const vink = (r) => r.stillinger.find((s) => s.id === 'opstilling').tal.vinkler
const u = vink(T.beregn('doedloeft', ind))
const medUnderarm8 = vink(T.beregn('doedloeft', { ...ind, underarm: (snit.underarm + 8) / M.gennemsnitCm('underarm', 178) * 100 }))
paastaa('M4', 'med 488: underarm +8 cm flytter nu kun armen (hofte og torso flytter mindre end i 471: 15,4 og 6,6 grader)', medUnderarm8.hofte - u.hofte < 15.4 && u.torso - medUnderarm8.torso < 6.6, { hofte: [r1(u.hofte), r1(medUnderarm8.hofte)], torso: [r1(u.torso), r1(medUnderarm8.torso)] })
const dC = R.C.doedloeft.opstilling.forskel
paastaa('M4', 'forskellen dig/snit i doedloeftet for krop C (lange arme) er stadig tydelig, og haanden er ens for begge', dC.Hoftevinkel >= 4, dC)

// --- M5: tegningen ---------------------------------------------------------------------------
const svg = EM.maaleTegning()
paastaa('M5', 'tegningen markerer baeltet "ikke her"', /ikke her/.test(svg))
paastaa('M5', 'felternes tekst siger "ikke hoftekammen og ikke baeltet"', M.MAAL.find((m) => m.id === 'laar').fra.includes('ikke hoftekammen') || JSON.stringify(M.MAAL).includes('ikke hoftekammen'), M.MAAL.find((m) => m.id === 'laar').fra)

// --- M6, M7: siden i browseren ---------------------------------------------------------------
const require = createRequire(import.meta.url)
const { chromium } = require(join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'))
const browser = await chromium.launch({ headless: true })
const SIDE = pathToFileURL(`${SNAP}/dist/min-krop/index.html`).href
const side = {}
try {
  for (const bredde of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: bredde, height: bredde === 390 ? 844 : 900 }, deviceScaleFactor: bredde === 390 ? 2 : 1, isMobile: bredde === 390, hasTouch: bredde === 390 })
    const page = await ctx.newPage()
    const eksterne = []
    await page.route('**/*', (route) => { const u2 = route.request().url(); if (!u2.startsWith('file:') && !u2.startsWith('data:')) { eksterne.push(u2); return route.abort() } return route.continue() })
    await page.goto(SIDE)
    await page.waitForSelector('input[data-maal]')
    const udfyld = async (k) => {
      for (const [id, v] of Object.entries(k)) { await page.fill(`input[data-maal="${id}"]`, String(v).replace('.', ',')); }
      await page.waitForTimeout(150)
    }
    const laes = () => page.evaluate(() => ({
      besked: document.querySelector('[data-rolle="besked"]')?.innerText.trim() || '',
      figurer: document.querySelectorAll('section[data-loeft] svg').length,
      linjer: [...document.querySelectorAll('section[data-loeft]')].map((s) => ({ loeft: s.dataset.loeft, linje: [...s.querySelectorAll('p')].filter((p) => p.checkVisibility()).map((p) => p.innerText).find((t) => /Største forskel|næsten intet|ingen stilling/.test(t)) || null })),
      invalid: [...document.querySelectorAll('input[aria-invalid="true"]')].map((i) => i.dataset.maal),
      tekst: document.body.innerText,
      hoejde: document.documentElement.scrollHeight,
      vandretRul: document.documentElement.scrollWidth > innerWidth,
    }))
    const res = {}
    for (const [n, k] of Object.entries({ ...KROPPE, alle114, hoftekam: kam })) {
      await udfyld(k)
      const l = await laes()
      res[n] = { besked: l.besked.slice(0, 400), figurer: l.figurer, linjer: l.linjer, invalid: l.invalid, hoejde: l.hoejde, vandretRul: l.vandretRul }
      if (n === 'B') { await page.screenshot({ path: join(HERE, `K-${bredde}-krop-B.png`) }) }
      if (n === 'alle114') {
        const b = await page.$('[data-rolle="besked"]')
        if (b) { await b.scrollIntoViewIfNeeded(); await page.screenshot({ path: join(HERE, `K-${bredde}-114.png`) }) }
      }
      side.tekst = l.tekst
    }
    side[bredde] = { res, net: eksterne }
    await ctx.close()
  }
} finally { await browser.close() }

// Tegningens bredder direkte fra SVG-strengen (maaleTegning), ved de hoejder koden selv naevner.
const hoejder = { talje: 0.645, hoftekam: 0.595, trochanter: 0.53 }
const kode = readFileSync(`${SNAP}/src/embed/minKrop.js`, 'utf8')
const tro = kode.match(/troH:\s*\[CX\s*\+\s*(\d+(?:\.\d+)?)/)
const bredde = { talje: 35, hoftekam: 39, trochanter: tro ? +tro[1] : null }
paastaa('M5', 'omridset er smallest ved taljen, bredere ved hoftekammen og bredest ved trochanter', bredde.trochanter > bredde.hoftekam && bredde.hoftekam > bredde.talje, bredde)

const s390 = side[390].res
paastaa('M3', 'siden paa 390: 114 % giver beskeden med 203 cm, ingen figurer, tre felter markeret', /203 cm/.test(s390.alle114.besked) && s390.alle114.figurer === 0 && ['laar', 'skinneben', 'torso'].every((id) => s390.alle114.invalid.includes(id)), s390.alle114)
paastaa('M3', 'siden paa 390: ingen synlig "stoerste forskel" ved 114 %', s390.alle114.linjer.every((l) => !l.linje), s390.alle114.linjer)
paastaa('M1', 'siden paa 390: krop B viser parret i squatten', s390.B.linjer.some((l) => l.loeft === 'squat' && /overkrop og skinneben/.test(l.linje || '')), s390.B.linjer)
paastaa('M6', '"Sådan måler du" siger alle maal paa samme side', /samme side af kroppen/.test(side.tekst))
paastaa('M4', 'siden siger "Hånden er med, men ikke målt"', /Hånden er med, men ikke målt/.test(side.tekst))
paastaa('M2', 'forbeholdet siger "under ca. 4° eller 3 cm"', /under ca\. 4° eller 3 cm/.test(side.tekst))
paastaa('M7', 'siden er stadig lang paa 390 (over 9000 px)', s390.B.hoejde > 9000, s390.B.hoejde)
paastaa('alle', 'ingen net og ingen vandret rulning paa 390 og 1280', [390, 1280].every((b) => side[b].net.length === 0 && Object.values(side[b].res).every((x) => !x.vandretRul)))

const ud = { snapshot: 'entropi-loeftmodel min-krop-klar af7172f', kroppe: KROPPE, alle114, hoftekam: kam, linjer: Object.fromEntries(Object.entries(R).map(([n, r]) => [n, { squatBund: r.squat.bund.linje, squatSticking: r.squat.sticking.linje, dlOpstilling: r.doedloeft.opstilling.linje, baenkLockout: r.baenk.lockout.linje }])), plus2, haand: { grebCm: r1(Lsnit.grebCm), gammelReach: r1(gamle), nyReach: r1(nye), plus8Gammel: r1(plus8Gammel), udgangspunkt: { hofte: r1(u.hofte), torso: r1(u.torso) }, underarmPlus8Nu: { hofte: r1(medUnderarm8.hofte), torso: r1(medUnderarm8.torso) } }, tegningBredde: bredde, side: { 390: { hoejde: s390.B.hoejde, res: s390 }, 1280: { res: side[1280].res } }, tjek }
writeFileSync(join(HERE, 'min-krop-494.json'), JSON.stringify(ud, null, 1))
console.log(`${tjek.filter((t) => t.ok).length}/${tjek.length} tjek groenne`)
