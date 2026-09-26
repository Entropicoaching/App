// Ordre 421, blok 1: B1-B10 fra kritik 409 tjekket i skak-koden (uden browser).
// Laeser en KOPI af skak/main (git archive), aldrig skak-mappen selv.
//
// Brug: node outputs/kritik-421/bank-421.mjs <skak-kopi> [dybde=4]
// Skriver outputs/kritik-421/bank-421.json. Roerer intet i skak.
//   B1  alle Stop matten-oevelser: hvert svar der stopper mat i 1, dets
//       materiale efter <dybde> (samme soegning som 409), og hvad appen godtager.
//   B2  ALLE Laer skak-stillinger: staar siden der IKKE er i traek i skak?
//   B3  taarn mod konge: graense, vindue, og "kassen" foer partiet paa stien.
//   B4  oppositionen: forskellige manoevrer og hint2 pr. oevelse.
//   B6  stien: Naeste for dig, Red din brik efter Slaa den ubeskyttede.
//   B8  Rokér i tide: er begge veje fri for brikker?
//   B9  Dronningemat: patt-faelder og patt-hintet.
//   B10 afdaekket 03CF0: godtages f3 som andet traek? Kildetekst-tjek af resten.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skak = path.resolve(process.argv[2] ?? '');
const DYBDE = Number(process.argv[3] ?? 4);
const her = path.dirname(fileURLToPath(import.meta.url));
const kraev = createRequire(path.join(skak, 'package.json'));
const imp = (p) => import(pathToFileURL(path.join(skak, p)).href);
const { Chess } = await import(pathToFileURL(kraev.resolve('chess.js')).href);
const bib = await imp('src/bibliotek.js');
const { LAER_TRIN } = await imp('src/laerforloeb.js');
const soeg = await imp('scripts/taktiksoegning.mjs');
const kilde = (f) => readFileSync(path.join(skak, f), 'utf8');
const uci = (m) => `${m.from}${m.to}${m.promotion ?? ''}`;
const ud = { dybde: DYBDE };

// ---------- B1 Stop matten ----------
const t0 = Date.now();
ud.B1 = bib.bibOevelser('stop-matten').map((o) => {
  const c = new Chess(o.fen);
  const nu = soeg.materiale(c);
  const vurd = soeg.vurderFoersteTraek(o.fen, DYBDE);
  const stopper = [];
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    const matI1 = c.moves({ verbose: true }).some((mm) => { c.move(mm); const r = c.isCheckmate(); c.undo(); return r; });
    c.undo();
    if (!matI1) stopper.push({ uci: uci(m), san: m.san, materiale: vurd.find((x) => x.uci === uci(m)).score - nu });
  }
  const bedst = Math.max(...stopper.map((s) => s.materiale));
  return { id: o.id, fen: o.fen, godeFoerste: o.godeFoerste, dyre: o.dyre ?? [], bedst, stopper };
});
ud.B1sekunder = Math.round((Date.now() - t0) / 1000);

// ---------- B2 alle Laer skak-stillinger ----------
function iSkak(fen, farve) {
  // Kongen af <farve> angrebet? chess.js vil ikke laese en stilling hvor siden
  // der ikke er i traek staar i skak, saa vi saetter <farve> i traek og spoerger.
  const dele = fen.split(' ');
  dele[1] = farve; dele[3] = '-';
  if (!dele[0].includes(farve === 'w' ? 'K' : 'k')) return null; // ingen konge (stjerne-trin)
  try { return new Chess(dele.join(' ')).isCheck(); } catch (e) { return `fejl: ${e.message}`; }
}
ud.B2 = [];
for (const trin of LAER_TRIN) {
  for (const felt of ['fen', 'demoFen', 'spilFen']) {
    const fen = trin[felt];
    if (!fen) continue;
    const ikkeITraek = fen.split(' ')[1] === 'w' ? 'b' : 'w';
    ud.B2.push({ trin: trin.id, felt, fen, ikkeITraekISkak: iSkak(fen, ikkeITraek) });
  }
}

// ---------- B3 taarn mod konge ----------
const tmk = bib.bibKompetence('taarn-mod-konge');
ud.B3 = {
  traekGraense: tmk.traekGraense, sidderVindue: tmk.sidderVindue ?? null, maal: bib.bibMaal(tmk),
  kassenFoerPartiet: bib.BIB_STI.indexOf('kassen') >= 0 && bib.BIB_STI.indexOf('kassen') < bib.BIB_STI.indexOf('taarn-mod-konge'),
  kassenOevelser: bib.bibOevelser('kassen').length,
};

// ---------- B4 oppositionen ----------
const vektor = (m) => `${m.charCodeAt(2) - m.charCodeAt(0)},${Number(m[3]) - Number(m[1])}`;
ud.B4 = bib.bibOevelser('opposition').map((o) => ({
  id: o.id, fen: o.fen, loesning: o.loesning, hint2: o.hint2 ?? bib.bibKompetence('opposition').hint2,
  manoevre: `${vektor(o.loesning[0])}|${o.loesning[2] ? vektor(o.loesning[2]) : '-'}`,
}));
ud.B4manoevrer = new Set(ud.B4.map((x) => x.manoevre)).size;
ud.B4udspilles = /bondeLinjeTilForvandling/.test(kilde('src/bibliotekui.js'));

// ---------- B6 stien ----------
ud.B6 = {
  sti: bib.BIB_STI,
  naesteForNyElev: bib.bibNaesteForDig({})?.id,
  forsvarEfterUbeskyttet: bib.BIB_STI.indexOf('forsvar') === bib.BIB_STI.indexOf('ubeskyttet') + 1,
  oppositionFoerTaarn: bib.BIB_STI.indexOf('opposition') < bib.BIB_STI.indexOf('taarn-mod-konge'),
  dronningFoerMatI2: bib.BIB_STI.indexOf('dronning-mod-konge') < bib.BIB_STI.indexOf('mat-i-2'),
};

// ---------- B8 rokade ----------
ud.B8 = bib.bibOevelser('rokade').map((o) => {
  const c = new Chess(o.fen);
  const tur = c.turn();
  const r = tur === 'w' ? '1' : '8';
  const fri = (felter) => felter.every((f) => !c.get(f + r));
  const lovlige = c.moves({ verbose: true }).filter((m) => /[kq]/.test(m.flags)).map((m) => m.san);
  return { id: o.id, kortFri: fri(['f', 'g']), langFri: fri(['b', 'c', 'd']), lovlige };
});

// ---------- B9 patt i dronningemat ----------
ud.B9 = {
  pattFaelder: bib.bibOevelser('damemat').map((o) => {
    const c = new Chess(o.fen);
    return { id: o.id, patt: c.moves({ verbose: true }).filter((m) => { c.move(m); const p = c.isStalemate(); c.undo(); return p; }).length };
  }),
  hint: bib.bibFejlHint(bib.bibKompetence('damemat'), { varPatt: true }),
  uiSenderPatt: /varPatt/.test(kilde('src/bibliotekui.js')),
};

// ---------- B10 smaating ----------
const af = bib.bibOevelser('afdaekket').find((o) => o.id === '03CF0');
let f3 = null;
if (af) {
  const c = new Chess(af.fen);
  c.move({ from: af.loesning[0].slice(0, 2), to: af.loesning[0].slice(2, 4) });
  c.move({ from: af.loesning[1].slice(0, 2), to: af.loesning[1].slice(2, 4) });
  const m = c.moves({ verbose: true }).find((x) => x.san.replace(/[+#x]/g, '').endsWith('f3') && x.piece === 'p') ?? c.moves({ verbose: true }).find((x) => x.to === 'f3');
  f3 = m ? { uci: uci(m), san: m.san, godtaget: bib.bibTraekErRigtigt(af, 2, uci(m)), facit: af.loesning[2] } : 'intet f3-traek';
}
const ui = kilde('src/bibliotekui.js');
const laer = kilde('src/laerskak.js');
ud.B10 = {
  afdaekket03CF0: af ? f3 : 'oevelsen findes ikke laengere',
  vundetTekst: /du vandt/i.test(ui) && /ramte|vandt dronningen|vandt \$\{/.test(ui),
  rokadeRingVedLanding: /felt: resultat\.to/.test(laer),
  stjerneUlovligBesked: /stjerneUlovligTekst/.test(laer),
};
const tmpl = kilde('src/skak.template.html');
const knapper = ['knap-bib-forfra', 'knap-laer-spring-over', 'braet'].map((id) => ({ id, pos: tmpl.indexOf(`id="${id}"`) }));
ud.B10.springOverUnderBraettet = knapper;

writeFileSync(path.join(her, 'bank-421.json'), JSON.stringify(ud, null, 1));
const kort = {
  B1: ud.B1.map((x) => `${x.id} gode=${x.godeFoerste.join(',')} dyre=${x.dyre.join(',')} bedst=${x.bedst}`),
  B2iSkak: ud.B2.filter((x) => x.ikkeITraekISkak === true).map((x) => x.trin),
  B3: ud.B3, B4manoevrer: ud.B4manoevrer, B6: { ...ud.B6, sti: undefined },
  B8: ud.B8.map((x) => `${x.id} kort=${x.kortFri} lang=${x.langFri} ${x.lovlige.join('/')}`),
  B9: ud.B9, B10: ud.B10,
};
console.log(JSON.stringify(kort, null, 1));
console.log(`B1-soegning dybde ${DYBDE}: ${ud.B1sekunder} s`);
