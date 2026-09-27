// ORDRE 461: elevens traek (min simulering, ikke appens motor). Bruges af
// elev-node-461.mjs og elev-browser-461.mjs. Kun chess.js-objekter ind; ingen DOM.
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export const V = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
const valg = (liste, rng) => liste[Math.floor(rng() * liste.length)]
export const modsat = (f) => (f === 'w' ? 'b' : 'w')

// Kan brikken paa `felt` (farve f) slaas uden at det koster modstanderen noget?
function iFare(chess, felt, f) {
  const b = chess.get(felt)
  if (!b) return false
  const angribere = chess.attackers(felt, modsat(f))
  if (angribere.length === 0) return false
  const forsvarere = chess.attackers(felt, f)
  if (forsvarere.length === 0) return true
  return angribere.some((a) => V[chess.get(a).type] < V[b.type])
}
export function erMatITraek(chess, m) {
  chess.move(m); const mat = chess.isCheckmate(); chess.undo(); return mat
}
function landerSikkert(chess, m) {
  chess.move(m); const fare = iFare(chess, m.to, m.color); chess.undo(); return !fare
}

export const PROFILER = {
  tilfaeldig: { serMat: 0, slaar: 0, redder: 0, skak: 0, forsigtig: 0, godeSlag: false },
  ny: { serMat: 0.35, slaar: 0.6, redder: 0.2, skak: 0.25, forsigtig: 0.25, godeSlag: false },
  oevet: { serMat: 0.75, slaar: 0.8, redder: 0.55, skak: 0.35, forsigtig: 0.6, godeSlag: true },
}

export function elevTraek(chess, profil, rng) {
  const p = PROFILER[profil]
  // En elev forvandler til dronning.
  const alle = chess.moves({ verbose: true }).filter((m) => !m.promotion || m.promotion === 'q')
  if (alle.length === 0) return null
  if (rng() < p.serMat) { const mat = alle.find((m) => erMatITraek(chess, m)); if (mat) return mat }
  const slag = alle.filter((m) => m.captured)
  if (slag.length && rng() < p.slaar) {
    const kandidater = p.godeSlag
      ? slag.filter((m) => V[m.captured] > V[m.piece] || landerSikkert(chess, m))
      : slag
    if (kandidater.length) {
      const hoejst = Math.max(...kandidater.map((m) => V[m.captured]))
      return valg(kandidater.filter((m) => V[m.captured] === hoejst), rng)
    }
  }
  const f = chess.turn()
  if (rng() < p.redder) {
    const truede = new Set()
    for (const r of chess.board()) for (const b of r) if (b && b.color === f && b.type !== 'p' && b.type !== 'k' && iFare(chess, b.square, f)) truede.add(b.square)
    if (truede.size) {
      const red = alle.filter((m) => truede.has(m.from) && landerSikkert(chess, m))
      if (red.length) return valg(red, rng)
    }
  }
  // Begyndere elsker at give skak; det er ogsaa sadan en vundet stilling bliver til mat.
  if (rng() < p.skak) {
    const skak = alle.filter((m) => m.san.includes('+') && landerSikkert(chess, m))
    if (skak.length) return valg(skak, rng)
  }
  if (rng() < p.forsigtig) {
    const sikre = alle.filter((m) => landerSikkert(chess, m))
    if (sikre.length) return valg(sikre, rng)
  }
  return valg(alle, rng)
}

