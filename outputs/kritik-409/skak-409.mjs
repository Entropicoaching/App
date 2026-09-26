// Ordre 409, blok 2: bibliotekets oevelser tjekket fagligt.
// For hver kompetence 3 tilfaeldige oevelser (fast froe 409): lovlig stilling,
// facit kan spilles, entydig loesning (en dybere soegning end generatoren
// brugte), rigtigt tema. Plus slutspillene mod appens forsvar.
//
// Brug: node outputs/kritik-409/skak-409.mjs <skak-kopi> [dybde=5]
// Skriver outputs/kritik-409/skak-409.json. Roerer intet i skak.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const skak = path.resolve(process.argv[2] ?? '');
const DYBDE = Number(process.argv[3] ?? 5);
const her = path.dirname(fileURLToPath(import.meta.url));
const kraev = createRequire(path.join(skak, 'package.json'));
const imp = (p) => import(pathToFileURL(path.join(skak, p)).href);
const { Chess } = await import(pathToFileURL(kraev.resolve('chess.js')).href);
const bib = await imp('src/bibliotek.js');
const { vaelgForsvarsTraek } = await imp('src/slutspilforsvar.js');
const { findMatgivendeTræk } = await imp('src/matsoegning.js');
const loeser = await imp('scripts/tremandsloeser.mjs');
const soeg = await imp('scripts/taktiksoegning.mjs');

// Fast froe, saa "tilfaeldig" er den samme hver gang.
let froe = 409;
const rnd = () => { froe = (froe * 1103515245 + 12345) % 2147483648; return froe / 2147483648; };
const udvaelg = (liste, n) => {
  const idx = liste.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, n).sort((a, b) => a - b).map((i) => liste[i]);
};
const uci = (m) => `${m.from}${m.to}${m.promotion ?? ''}`;
const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

function lovlig(fen) {
  const fejl = [];
  let c;
  try { c = new Chess(fen); } catch (e) { return { ok: false, fejl: [e.message] }; }
  const brikker = c.board().flat().filter(Boolean);
  for (const f of ['w', 'b']) if (brikker.filter((p) => p.type === 'k' && p.color === f).length !== 1) fejl.push(`${f}: ikke praecis een konge`);
  if (brikker.some((p) => p.type === 'p' && /[18]/.test(p.square))) fejl.push('bonde paa 1. eller 8. raekke');
  // Siden der IKKE er i traek maa ikke staa i skak.
  const ikkeTur = c.turn() === 'w' ? 'b' : 'w';
  const k = brikker.find((p) => p.type === 'k' && p.color === ikkeTur);
  if (k && c.isAttacked(k.square, c.turn())) fejl.push('siden der ikke er i traek staar i skak');
  return { ok: fejl.length === 0, fejl };
}

function spilLinje(fen, linje) {
  const c = new Chess(fen);
  for (const u of linje) {
    try { c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { return { ok: false, ved: u }; }
  }
  return { ok: true, slutFen: c.fen(), mat: c.isCheckmate() };
}

function matTraek(fen) {
  const c = new Chess(fen);
  return c.moves({ verbose: true }).filter((m) => { c.move(m); const r = c.isCheckmate(); c.undo(); return r; });
}
function pattTraek(fen) {
  const c = new Chess(fen);
  return c.moves({ verbose: true }).filter((m) => { c.move(m); const r = c.isStalemate(); c.undo(); return r; }).map(uci);
}

// Hvad angriber brikken paa "felt" efter traekket (til gaffel-temaet)?
function angrebneMaal(c, felt) {
  const brik = c.get(felt);
  const mod = brik.color === 'w' ? 'b' : 'w';
  const ud = [];
  for (const p of c.board().flat().filter((x) => x && x.color === mod)) {
    const angribere = c.attackers(p.square, brik.color);
    if (angribere.includes(felt)) ud.push(`${p.type}${p.square}`);
  }
  return ud;
}

function tema(k, o) {
  const c = new Chess(o.fen);
  const foerste = o.loesning[0] ?? o.godeFoerste?.[0];
  const m = c.move({ from: foerste.slice(0, 2), to: foerste.slice(2, 4), promotion: foerste[4] });
  const noter = [];
  let ok = true;
  switch (k.id) {
    case 'damemat': ok = m.piece === 'q' && c.isCheckmate(); break;
    case 'taarnmat': ok = m.piece === 'r' && c.isCheckmate(); break;
    case 'mat-i-1': ok = ['q', 'r'].includes(m.piece) && c.isCheckmate(); noter.push(`matbrik ${m.piece}`); break;
    case 'baglinjemat': {
      const kongeFelt = c.board().flat().find((p) => p && p.type === 'k' && p.color === c.turn()).square;
      const bag = c.turn() === 'w' ? '1' : '8';
      ok = c.isCheckmate() && kongeFelt[1] === bag && m.to[1] === bag;
      noter.push(`konge ${kongeFelt}, mat paa ${m.to}`);
      break;
    }
    case 'kvaelningsmat': {
      const kf = c.board().flat().find((p) => p && p.type === 'k' && p.color === c.turn()).square;
      const naboer = [];
      for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
        if (!df && !dr) continue;
        const f = kf.charCodeAt(0) - 97 + df; const r = Number(kf[1]) + dr;
        if (f < 0 || f > 7 || r < 1 || r > 8) continue;
        naboer.push(String.fromCharCode(97 + f) + r);
      }
      const egne = naboer.filter((n) => c.get(n)?.color === c.turn()).length;
      ok = m.piece === 'n' && c.isCheckmate();
      noter.push(`springer ${m.piece === 'n'}, ${egne} af ${naboer.length} nabofelter egne brikker`);
      break;
    }
    case 'gaffel-springer': case 'gaffel-andre': {
      const maal = angrebneMaal(c, m.to);
      const vaerdi = maal.filter((x) => V[x[0]] >= 3 || x[0] === 'k');
      ok = (k.id === 'gaffel-springer' ? m.piece === 'n' : m.piece !== 'n') && vaerdi.length >= 2;
      noter.push(`${m.san}: angriber ${maal.join(',')}`);
      break;
    }
    default: noter.push(`foerste traek ${m.san}`);
  }
  return { ok, noter };
}

const rapport = { dybde: DYBDE, kompetencer: {} };

for (const k of bib.BIB_KOMPETENCER) {
  if (k.form === 'laer') continue;
  const alle = bib.bibOevelser(k.id);
  const valgte = udvaelg(alle, 3);
  const r = { form: k.form, niveau: k.niveau, antal: alle.length, oevelser: [] };
  console.log(`\n== ${k.id} (${alle.length}) ==`);
  for (const o of valgte) {
    const t0 = Date.now();
    const u = { id: o.id, fen: o.fen, loesning: o.loesning, godeFoerste: o.godeFoerste, lovlig: lovlig(o.fen) };
    if (o.loesning.length) u.linje = spilLinje(o.fen, o.loesning);
    if (k.form === 'gaader' && k.id !== 'opposition' && k.id !== 'rokade') u.tema = tema(k, o);

    if (['damemat', 'taarnmat', 'mat-i-1', 'baglinjemat', 'kvaelningsmat'].includes(k.id)) {
      u.matTraek = matTraek(o.fen).map((m) => m.san);
      u.pattFaelder = pattTraek(o.fen);
      u.entydig = u.matTraek.length === 1;
    } else if (k.id === 'mat-i-2') {
      const c = new Chess(o.fen);
      u.matI1 = matTraek(o.fen).map((m) => m.san);
      u.matI2Foerste = findMatgivendeTræk(c, 2).map(uci);
      u.entydig = u.matI1.length === 0 && u.matI2Foerste.length === 1;
      u.appAfviser = u.matI2Foerste.filter((x) => x !== o.loesning[0]);
    } else if (['ubeskyttet', 'gaffel-springer', 'gaffel-andre', 'binding', 'spid', 'afdaekket'].includes(k.id)) {
      const c = new Chess(o.fen);
      const nu = soeg.materiale(c);
      const v = soeg.vurderFoersteTraek(o.fen, DYBDE);
      const facit = v.find((x) => x.uci === o.loesning[0]);
      u.gevinst = facit.score - nu;
      u.bedste = v.slice(0, 4).map((x) => ({ uci: x.uci, gevinst: x.score - nu }));
      u.lige_saa_gode = v.filter((x) => x.uci !== o.loesning[0] && x.score >= facit.score - 1).map((x) => ({ uci: x.uci, gevinst: x.score - nu }));
      u.entydig = u.lige_saa_gode.length === 0;
      // Elevens ANDET traek (efter modstanderens facit-svar): er det ogsaa entydigt?
      if (o.loesning.length >= 3) {
        const c2 = new Chess(o.fen);
        c2.move({ from: o.loesning[0].slice(0, 2), to: o.loesning[0].slice(2, 4), promotion: o.loesning[0][4] });
        c2.move({ from: o.loesning[1].slice(0, 2), to: o.loesning[1].slice(2, 4), promotion: o.loesning[1][4] });
        const nu2 = soeg.materiale(c2);
        const v2 = soeg.vurderFoersteTraek(c2.fen(), Math.max(3, DYBDE - 2));
        const f2 = v2.find((x) => x.uci === o.loesning[2]);
        u.andetTraek = {
          facit: o.loesning[2], gevinst: f2.score - nu2,
          lige_saa_gode: v2.filter((x) => x.uci !== o.loesning[2] && x.score >= f2.score - 1).map((x) => ({ uci: x.uci, gevinst: x.score - nu2 })),
        };
      }
    } else if (k.id === 'forsvar') {
      const sikre = soeg.sikreTraek(o.fen, { dybde: DYBDE });
      u.sikre = sikre;
      u.appGodtager = o.godeFoerste;
      u.afvistMenSikker = sikre.filter((x) => !o.godeFoerste.includes(x));
      u.godtagetMenUsikker = o.godeFoerste.filter((x) => !sikre.includes(x));
      u.entydig = u.afvistMenSikker.length === 0 && u.godtagetMenUsikker.length === 0;
    } else if (k.id === 'stop-matten') {
      const c = new Chess(o.fen);
      const stopper = [];
      const nu = soeg.materiale(c);
      const vurd3 = soeg.vurderFoersteTraek(o.fen, 3);
      for (const m of c.moves({ verbose: true })) {
        c.move(m);
        const matI1 = c.moves({ verbose: true }).some((mm) => { c.move(mm); const r = c.isCheckmate(); c.undo(); return r; });
        c.undo();
        if (!matI1) {
          const sc = vurd3.find((x) => x.uci === uci(m)).score - nu;
          stopper.push({ uci: uci(m), san: m.san, materialeEfter3: sc });
        }
      }
      u.stopper = stopper;
      u.appGodtager = o.godeFoerste;
      u.forskel = stopper.map((s) => s.uci).filter((x) => !o.godeFoerste.includes(x)).concat(o.godeFoerste.filter((x) => !stopper.some((s) => s.uci === x)));
      u.entydig = u.forskel.length === 0;
    } else if (k.id === 'rokade') {
      const c = new Chess(o.fen);
      const rokader = c.moves({ verbose: true }).filter((m) => /[kq]/.test(m.flags));
      u.lovligeRokader = rokader.map((m) => m.san);
      // Hvorfor ikke den anden vej? Brikker i vejen eller angrebne felter.
      const tur = c.turn();
      const r = tur === 'w' ? '1' : '8';
      const mod = tur === 'w' ? 'b' : 'w';
      const sider = { 'O-O': ['f', 'g'], 'O-O-O': ['d', 'c', 'b'] };
      u.andenSide = Object.entries(sider).filter(([s]) => !u.lovligeRokader.includes(s)).map(([s, filer]) => ({
        side: s,
        brikkerIVejen: filer.map((f) => f + r).filter((f) => c.get(f)),
        angrebne: ['e', ...filer.filter((f) => f !== 'b')].map((f) => f + r).filter((f) => c.isAttacked(f, mod)),
      }));
      u.entydig = rokader.length === 1;
      u.hvorfor = o.hvorfor;
      const nu = soeg.materiale(c);
      const v = soeg.vurderFoersteTraek(o.fen, 3);
      u.rokadeMateriale = v.find((x) => x.uci === o.loesning[0]).score - nu;
      u.bedsteMateriale = v[0].score - nu;
    } else if (k.id === 'opposition') {
      const c = new Chess(o.fen);
      const trin = [];
      for (let i = 0; i < o.loesning.length; i += 2) {
        const vurd = loeser.bondeTraekVurderet(c.fen());
        trin.push({ facit: o.loesning[i], vindere: vurd.filter((x) => x.vinder).map((x) => x.uci) });
        c.move({ from: o.loesning[i].slice(0, 2), to: o.loesning[i].slice(2, 4) });
        if (o.loesning[i + 1]) c.move({ from: o.loesning[i + 1].slice(0, 2), to: o.loesning[i + 1].slice(2, 4) });
      }
      u.trin = trin;
      u.entydig = trin.every((t) => t.vindere.length === 1 && t.vindere[0] === t.facit);
    } else if (k.form === 'slutspil') {
      u.afstandTilMatHalvtraek = loeser.afstandTilMat(o.fen);
      // Perfekt angriber mod appens forsvar.
      const c = new Chess(o.fen);
      let n = 0;
      while (!c.isGameOver() && n < 80) {
        const t = loeser.hurtigsteMatTraek(c.fen());
        c.move({ from: t.slice(0, 2), to: t.slice(2, 4) });
        n += 1;
        if (c.isGameOver()) break;
        c.move(vaelgForsvarsTraek(c));
      }
      u.perfektModApp = { traek: n, mat: c.isCheckmate() };
    }
    u.ms = Date.now() - t0;
    r.oevelser.push(u);
    console.log(o.id, JSON.stringify({ lovlig: u.lovlig.ok, entydig: u.entydig, tema: u.tema?.ok, ms: u.ms }));
  }
  rapport.kompetencer[k.id] = r;
}

// Hele banken for de billige tjek (flere mat-traek, patt-faelder, rokade-grund).
rapport.helBank = {};
for (const id of ['damemat', 'taarnmat', 'mat-i-1', 'baglinjemat', 'kvaelningsmat']) {
  rapport.helBank[id] = bib.bibOevelser(id).map((o) => ({ id: o.id, mat: matTraek(o.fen).map((m) => m.san), patt: pattTraek(o.fen).length }));
}
rapport.helBank.rokade = bib.bibOevelser('rokade').map((o) => {
  const c = new Chess(o.fen);
  const lov = c.moves({ verbose: true }).filter((m) => /[kq]/.test(m.flags)).map((m) => m.san);
  const tur = c.turn(); const r = tur === 'w' ? '1' : '8';
  const andenKongeFelt = lov.includes('O-O') ? 'c' + r : 'g' + r;
  const iVej = (lov.includes('O-O') ? ['b', 'c', 'd'] : ['f', 'g']).map((f) => f + r).filter((f) => c.get(f));
  return { id: o.id, lovlige: lov, andenSideBlokeretAfBrikker: iVej, kanKongenOverhovedetTrykkesDerhen: iVej.length === 0, andenKongeFelt };
});
rapport.helBank.opposition = bib.bibOevelser('opposition').map((o) => ({ id: o.id, fen: o.fen, loesning: o.loesning.join(' ') }));

writeFileSync(path.join(her, 'skak-409.json'), JSON.stringify(rapport, null, 1));
console.log('\nskrevet skak-409.json');
