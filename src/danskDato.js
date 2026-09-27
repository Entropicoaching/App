// ORDRE 456 (A8 i docs/kritik-446): coachens Log og PR-tidslinje brugte
// logged_at.slice(0, 10), altså datoen i UTC. Et sæt logget mellem 00 og 02
// dansk sommertid stod derfor på dagen før, mens atleten så den rigtige dag i
// Fremgang. Her er datoen dansk tid (Europe/Copenhagen), og visningen dansk.
// Rene funktioner.
const MDR = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

let fmt = null
try {
  fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
} catch { fmt = null }

const pad = (n) => String(n).padStart(2, '0')

// ISO-tidsstempel → 'YYYY-MM-DD' i dansk tid (enhedens egen tid, hvis
// browseren ikke kender tidszonen). En ren dato ('YYYY-MM-DD') gives uændret.
export function danskDag(iso) {
  if (!iso) return ''
  const s = String(iso)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s.slice(0, 10)
  if (fmt) {
    const dele = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]))
    if (dele.year && dele.month && dele.day) return `${dele.year}-${dele.month}-${dele.day}`
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Hele kalenderdage fra 'YYYY-MM-DD' til i dag (dansk tid). 0 = i dag.
export function dageSiden(dag, nu = new Date()) {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dag || ''))
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(danskDag(nu.toISOString()))
  if (!a || !b) return null
  return Math.round((Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86400000)
}

// 'YYYY-MM-DD' → '27. sep 2026'.
export function danskDatoTekst(dag) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dag || ''))
  if (!m) return String(dag || '')
  return `${Number(m[3])}. ${MDR[Number(m[2]) - 1]} ${m[1]}`
}
