// ORDRE 409 blok 3: verify:kritik-409. Ingen skak-mappe, intet netvaerk.
//   1. Fund der kan regnes efter uden skak: S2 (Laer skak trin 3 og 23 er
//      ulovlige - siden der ikke er i traek staar i skak), med en lille egen
//      straale-regner.
//   2. De gemte maalinger (elev-409.json, skak-409.json, stopmatten-409.json,
//      stopmatten-dybde4.txt) siger det KRITIK siger: ingen sidefejl, dronningen
//      slaar kongen i trin 3, taarnmat-kassen bruger alle 35 traek i tk3 og tk4,
//      stop matten godtager Dg4+ og pilen peger paa den, alle stikproever lovlige.
//   3. Dokumenterne: KRITIK har B1.. oeverst og "klar til klassen: ja/nej, fordi",
//      RAPPORT-409 starter med "Ordre 409" og har de fem afsnit.
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

// --- 1. ulovlige stillinger (kun konger, dronning, taarn, bonde - nok til de to FEN'er) ---
function braet(fen) {
  const b = {}
  fen.split(' ')[0].split('/').forEach((r, i) => {
    let f = 0
    for (const ch of r) {
      if (/\d/.test(ch)) f += Number(ch)
      else { b[String.fromCharCode(97 + f) + (8 - i)] = ch; f += 1 }
    }
  })
  return b
}
function angrebet(fen, felt, af) {
  const b = braet(fen)
  const fx = felt.charCodeAt(0) - 97, ry = Number(felt[1])
  const egne = (ch) => (af === 'w' ? ch === ch.toUpperCase() : ch === ch.toLowerCase())
  for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    let f = fx + df, r = ry + dr
    while (f >= 0 && f < 8 && r >= 1 && r <= 8) {
      const ch = b[String.fromCharCode(97 + f) + r]
      if (ch) {
        const t = ch.toLowerCase()
        if (egne(ch) && (t === 'q' || (t === 'r' && (!df || !dr)) || (t === 'b' && df && dr))) return true
        break
      }
      f += df; r += dr
    }
  }
  return false
}
const kongeFelt = (fen, farve) => Object.entries(braet(fen)).find(([, ch]) => ch === (farve === 'w' ? 'K' : 'k'))[0]
for (const [trin, fen] of [['trin 3 Dronningen', '7k/8/8/8/3Q4/8/8/4K3 w - - 0 1'], ['trin 23 aabne linjer', 'k7/8/8/8/8/8/1P6/R3K3 w Q - 0 1']]) {
  ok(angrebet(fen, kongeFelt(fen, 'b'), 'w'), `S2: ${trin} regnes ikke som ulovlig`)
}
ok(!angrebet('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'e8', 'w'), 'S2-kontrol: rokade-trinnets stilling skulle vaere lovlig')

// --- 2. maalingerne ---
const elev = json('elev-409.json')?.resultat
if (elev) {
  ok(elev.sidefejl.length === 0, `blok 1: sidefejl ${elev.sidefejl.join(' | ')}`)
  const dronning = elev.laer.find((t) => t.navn === 'dronningen')
  ok(/Rigtigt/.test(dronning?.forsoeg?.[0]?.besked ?? ''), 'blok 1: Dd4-h8 (slaar kongen) blev ikke godtaget - er S2 rettet? Opdater KRITIK')
  const kasse = Object.fromEntries(elev.frit.taarnKasse.map((r) => [r.oevelse, r]))
  ok(kasse.tk3?.traek === 35 && !kasse.tk3.mat && kasse.tk4?.traek === 35 && !kasse.tk4.mat, 'blok 1: kasse-eleven skulle bruge alle 35 traek i tk3 og tk4')
  ok(['tk1', 'tk2', 'tk5', 'tk6'].every((id) => kasse[id]?.mat && kasse[id].traek <= 18), 'blok 1: kasse-eleven skulle vinde tk1, tk2, tk5, tk6')
  ok(/giver kun uafgjort/.test(elev.marc.opposition.b1.besked) && /frem ved siden af/.test(elev.marc.opposition.b2.besked), 'blok 1: oppositionens hint aendret - opdater S4')
  ok(elev.laer.some((t) => t.forsoeg.some((f) => /^Du er sort/.test(f.tekst ?? ''))), 'blok 1: "Du er sort" efter traekket genskabes ikke')
}
const skak = json('skak-409.json')
if (skak) {
  const alle = Object.values(skak.kompetencer).flatMap((k) => k.oevelser)
  ok(Object.keys(skak.kompetencer).length === 18, `blok 2: ${Object.keys(skak.kompetencer).length} kompetencer, ventet 18`)
  ok(alle.length === 54, `blok 2: ${alle.length} stikproever, ventet 54`)
  ok(alle.every((o) => o.lovlig.ok && (!o.linje || o.linje.ok)), 'blok 2: en stikproeve er ulovlig eller facit kan ikke spilles')
  ok(alle.filter((o) => o.tema).every((o) => o.tema.ok), 'blok 2: en stikproeve har forkert tema')
  ok(skak.helBank.rokade.filter((r) => !r.kanKongenOverhovedetTrykkesDerhen).length === 3, 'S3: ventet 3 rokade-oevelser uden valg')
  ok(['damemat', 'taarnmat', 'mat-i-1', 'baglinjemat', 'kvaelningsmat'].every((id) => skak.helBank[id].every((x) => x.mat.length === 1)), 'blok 2: en mat-i-1-oevelse har flere mattraek')
  ok(skak.helBank.damemat.find((x) => x.id === 'dm01')?.patt === 7, 'S5: dm01 skulle have 7 patt-faelder')
}
const sm = json('stopmatten-409.json')
if (sm) {
  const s7 = sm.find((x) => x.oevelse === 'sm07')
  ok(s7?.godeFoerste?.[0] === 'd1g4' && /Matten er stoppet/.test(s7.svar), 'S1: sm07 Dg4+ godtages ikke laengere / pilen peger ikke paa den - opdater KRITIK')
}
const d4 = path.join(HERE, 'stopmatten-dybde4.txt')
if (existsSync(d4)) {
  const t = readFileSync(d4, 'utf8')
  ok(/sm07 .*d1g4\(-12\)/.test(t) && /sm03 .*d2d3\(-6\)/.test(t) && /sm08 .*c7c6\(-6\)/.test(t), 'S1: dybde-4-tallene for sm03/sm07/sm08 mangler')
} else fejl.push('stopmatten-dybde4.txt mangler')
const billeder = readdirSync(HERE).filter((f) => /^[ES]-.*\.png$/.test(f))
ok(billeder.length >= 40, `kun ${billeder.length} skaermbilleder`)
for (const b of ['E-33-laer-dronningen.png', 'E-14-opposition-foerste-rigtigt.png', 'S-sm07-hint-pil.png', 'E-22-taarn-kasse-tk3.png']) ok(billeder.includes(b), `${b} mangler`)

// --- 3. dokumenterne ---
const kritikSti = path.join(ROOT, 'docs/kritik-409/KRITIK-bibliotek.md')
if (existsSync(kritikSti)) {
  const kritik = readFileSync(kritikSti, 'utf8')
  for (let i = 1; i <= 10; i++) ok(kritik.includes(`**B${i}`), `KRITIK mangler B${i}`)
  ok(/\*\*Klar til klassen: (ja|nej), fordi/.test(kritik), 'KRITIK mangler linjen "Klar til klassen: ja/nej, fordi"')
  ok(kritik.indexOf('**B1') < kritik.indexOf('## Hvad der holder'), 'fundene skal staa oeverst i KRITIK')
} else fejl.push('docs/kritik-409/KRITIK-bibliotek.md mangler')
for (const f of ['ELEVEN.md', 'SKAKKEN.md']) ok(existsSync(path.join(ROOT, 'docs/kritik-409', f)), `docs/kritik-409/${f} mangler`)
const rapportSti = path.join(ROOT, 'docs/kritik-409/RAPPORT-409.md')
if (existsSync(rapportSti)) {
  const rapport = readFileSync(rapportSti, 'utf8').replace(/\r/g, '')
  ok(rapport.split('\n')[0].trim() === 'Ordre 409', 'RAPPORT-409.md skal starte med "Ordre 409"')
  for (const a of ['## Gren', '## Hvad ændret', '## Testresultat', '## Hvad er næste', '## Ærlige grænser']) ok(rapport.includes(a), `RAPPORT-409.md mangler "${a}"`)
  ok(/Til Chaturanga/.test(rapport), 'RAPPORT-409.md: "Hvad er naeste" skal have ordren til Chaturanga')
} else fejl.push('docs/kritik-409/RAPPORT-409.md mangler')

if (fejl.length) {
  console.error(`verify:kritik-409 ROED (${fejl.length}):\n - ${fejl.join('\n - ')}`)
  process.exit(1)
}
console.log('verify:kritik-409 GROEN: S1-S5 genskabt fra maalingerne, 54 stikproever lovlige, dokumenterne i orden.')
