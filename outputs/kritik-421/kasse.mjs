// Ordre 409: en "10-aarig der har laert kassen" i taarn mod konge.
// Kasse-metoden (som den laeres i skoleskak): taarnet skaerer kongen af i et
// rektangel ("kassen"); man vaelger det traek der, efter modstanderens bedste
// svar, efterlader den mindste kasse, og ens egen konge gaar ind mod den anden
// konge. Taarnet maa aldrig haenge, og patt er forbudt. Eleven kigger kun eet
// svar frem (2 halvtraek) - IKKE optimalt, og det er pointen: saadan spiller
// en elev der kan metoden, men ikke regner langt.
const fx = (s) => s.charCodeAt(0) - 97;
const ry = (s) => Number(s[1]) - 1;
const afst = (a, b) => Math.max(Math.abs(fx(a) - fx(b)), Math.abs(ry(a) - ry(b)));

function kasseAreal(r, k) {
  if (!r) return 999;
  if (fx(k) === fx(r) || ry(k) === ry(r)) return 64;
  const w = fx(k) < fx(r) ? fx(r) : 7 - fx(r);
  const h = ry(k) < ry(r) ? ry(r) : 7 - ry(r);
  return w * h;
}

const felter = (c) => {
  const b = c.board().flat().filter(Boolean);
  return {
    wk: b.find((p) => p.type === 'k' && p.color === 'w').square,
    bk: b.find((p) => p.type === 'k' && p.color === 'b').square,
    r: b.find((p) => p.type === 'r')?.square,
  };
};

const noegle = (c) => c.fen().split(' ').slice(0, 2).join(' ');

// set = hvor tit eleven har set stillingen efter sit eget traek (saa den ikke
// gaar i ring - en elev ville ogsaa proeve noget andet).
export function kasseTraek(c, set = new Map()) {
  let bedst = null;
  let bedstScore = Infinity;
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    if (c.isCheckmate()) { c.undo(); return m.from + m.to; }
    let score;
    if (c.isStalemate()) score = 1e6;
    else {
      let vaerst = -Infinity;
      for (const s of c.moves({ verbose: true })) {
        c.move(s);
        const f = felter(c);
        const v = s.captured ? 1e5 : kasseAreal(f.r, f.bk) * 10 + afst(f.wk, f.bk) * 2;
        c.undo();
        if (v > vaerst) vaerst = v;
      }
      score = vaerst + (set.get(noegle(c)) ?? 0) * 25;
    }
    c.undo();
    if (score < bedstScore) { bedstScore = score; bedst = m.from + m.to; }
  }
  return bedst;
}

export function husk(c, set) {
  set.set(noegle(c), (set.get(noegle(c)) ?? 0) + 1);
}
