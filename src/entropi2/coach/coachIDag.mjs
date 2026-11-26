// Ordre 2417 (Marc 26. nov.: "læg 2 og 1 i kø også"; Marc 23. nov.: flere klienter kræver færre minutter pr. klient;
// Marc 17. nov.: ingen mail, kun i appen). "Kræver dig i dag" er coachens forside-liste: højst 5 atleter, én række pr. atlet,
// sorteret efter hast. Rene funktioner over de grunde, coachHomeModel allerede har fundet; ingen nye læsninger.
// Hast: 0 smerte eller skade nævnt, 1 ingen log i 3 dage, 2 venter på svar (video, ulæst besked), 3 programuge slutter inden for 2 dage.
// Kostugens slutdato findes ikke som kolonne (kostplan_v1_plans har kun valid_from), så kostugen indgår ikke.
export const IDAG_MAX = 5
export const IDAG_RANK = Object.freeze({ smerte: 0, ingenLog: 1, venter: 2, ugeSlutter: 3 })
export const IDAG_INGEN_LOG_DAGE = 3
export const IDAG_UGE_DAGE = 2

const dagePlural = n => `${n} ${n === 1 ? 'dag' : 'dage'}`

// candidates: atletens grunde fra coachHomeModel (sorteret). noLogDays: dage siden seneste log, når mindst 3.
// daysLeft: dage til programmet slutter, eller null. Returnerer grunde med rank og vægt (lavest først inden for rank).
export function idagCandidates({ athlete, candidates = [], noLogDays = null, daysLeft = null }) {
  const out = []
  for (const c of candidates) {
    if (c.u3 === 'pain') out.push({ ...c, rank: IDAG_RANK.smerte, weight: 0 })
    else if (c.item) out.push({ ...c, rank: IDAG_RANK.venter, weight: 0 })
  }
  if (Number.isFinite(noLogDays) && noLogDays >= IDAG_INGEN_LOG_DAGE) {
    out.push({ key: `idag-log-${athlete.id}`, athlete, rank: IDAG_RANK.ingenLog, weight: -noLogDays, tab: 'log',
      reason: `Ingen log i ${dagePlural(noLogDays)}` })
  }
  if (Number.isFinite(daysLeft) && daysLeft >= 0 && daysLeft <= IDAG_UGE_DAGE) {
    out.push({ key: `idag-uge-${athlete.id}`, athlete, rank: IDAG_RANK.ugeSlutter, weight: daysLeft, tab: 'program',
      reason: daysLeft === 0 ? 'Programmet slutter i dag' : `Programmet slutter om ${dagePlural(daysLeft)}` })
  }
  return out
}

const stamp = row => { const n = Date.parse(row.item?.createdAt); return Number.isFinite(n) ? n : Infinity }
export function idagOrder(a, b) {
  return a.rank - b.rank || (a.weight ?? 0) - (b.weight ?? 0) || stamp(a) - stamp(b) ||
    a.athlete.name.localeCompare(b.athlete.name, 'da') || a.key.localeCompare(b.key)
}

// Én række pr. atlet: den hasteste grund, og alle atletens grunde til Også-linjen under rækken.
export function idagRow(list) {
  if (!list.length) return null
  const sorted = [...list].sort(idagOrder)
  const smerte = sorted.find(c => c.smerte)?.smerte
  return { ...sorted[0], reasons: sorted.map(c => c.reason), ...(smerte ? { smerte } : {}) }
}

export const idagVisible = rows => Array.isArray(rows) ? rows.slice(0, IDAG_MAX) : []
