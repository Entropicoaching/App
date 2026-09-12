// Delt mellem Dashboard.jsx og dens lazy-loadede underfaner (src/dashboard/*).
// Udskilt i ordre 130 · commit 2, så underfanerne kan importere disse rene
// stilarter/hjælpefunktioner UDEN at trække resten af Dashboard.jsx (og dermed
// hele coach-monolitten) ind i deres egen chunk. Ren udflytning - ingen
// logikændring.
import { videoCoachVariationIdentity } from './videoCoachLabels'
import { kategoriFor } from './exerciseNames'

export const BLOCK_NAMES = ['Akkumulering', 'Intensificering', 'Peak', 'Deload', 'GPP', 'Hypertrofi', 'Styrke', 'Transition']

// Periodiserings-skabeloner: hurtig-start til blok-planlæggeren. Kun udgangspunkter
// Marc former videre — ikke faste programmer.
export const BLOCK_PRESETS = [
  { label: 'Peaking mod stævne', desc: '11 uger', blocks: [
    { name: 'Akkumulering', weeks: 4 }, { name: 'Intensificering', weeks: 4 }, { name: 'Peak', weeks: 2 }, { name: 'Deload', weeks: 1 },
  ] },
  { label: 'Grundstyrke', desc: '9 uger', blocks: [
    { name: 'Hypertrofi', weeks: 4 }, { name: 'Styrke', weeks: 4 }, { name: 'Deload', weeks: 1 },
  ] },
  { label: 'Off-season', desc: '11 uger', blocks: [
    { name: 'GPP', weeks: 3 }, { name: 'Hypertrofi', weeks: 4 }, { name: 'Styrke', weeks: 3 }, { name: 'Deload', weeks: 1 },
  ] },
  { label: 'Kort blok', desc: '6 uger', blocks: [
    { name: 'Akkumulering', weeks: 3 }, { name: 'Intensificering', weeks: 2 }, { name: 'Deload', weeks: 1 },
  ] },
]
const BLOCK_PALETTE = ['#4e8fcf','#c8923a','#6cba6c','#9b6bd4','#cf6b4e','#4ec8b4']
export function blockColor(name) {
  if (!name) return '#4a4844'
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return BLOCK_PALETTE[h % BLOCK_PALETTE.length]
}
export function computePhases(weeks) {
  if (!weeks.length) return []
  const phases = []
  let cur = { name: weeks[0].block_name || null, weeks: [weeks[0]] }
  for (let i = 1; i < weeks.length; i++) {
    const n = weeks[i].block_name || null
    if (n === cur.name) cur.weeks.push(weeks[i])
    else { phases.push(cur); cur = { name: n, weeks: [weeks[i]] } }
  }
  phases.push(cur)
  return phases
}

// Det nuværende ugenummer for en atlet: foretræk den uge hvis udledte datospænd
// (anker + 7 dage pr. uge) dækker i dag — ellers fald tilbage til seneste loggede
// uge. Holder coach-kalender, phase bar og atlet-view enige om "nu".
export function currentWeekNo(weeks, maxLoggedWk) {
  if (!weeks?.length) return maxLoggedWk ?? null
  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number)
  const anchor = sorted.find(w => w.start_date)
  if (anchor) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const anchorMs = new Date(anchor.start_date + 'T12:00:00').getTime()
    for (const w of sorted) {
      const d = new Date(anchorMs + (w.week_number - anchor.week_number) * 7 * 86400000)
      d.setHours(0, 0, 0, 0)
      if (d <= today && today < new Date(d.getTime() + 7 * 86400000)) return w.week_number
    }
  }
  return maxLoggedWk ?? null
}
export const WEEKDAYS_LONG = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

export const statusColors = { active: '#6cba6c', peaking: '#c8923a', offseason: '#7a7770', ferie: '#5b9bb5' }

export const VIDEOCOACH_STATUS = {
  draft: { label: 'Kladde', color: '#c8923a' },
  coach_approved: { label: 'Godkendt', color: '#6cba6c' },
  shared: { label: 'Delt med atlet', color: '#67dff5' },
  invalid: { label: 'Ugyldig', color: '#cf6b4e' },
}
export const VIDEOCOACH_METRICS = [
  { key: 'rom_cm', label: 'ROM' },
  { key: 'bar_drift_cm', label: 'Vandret drift' },
  { key: 'velocity_loss_pct', label: 'Farttab' },
  { key: 'path_efficiency_pct', label: 'Baneeffektivitet' },
]

export function videoCoachMetric(analysis, key) {
  const metric = analysis?.metrics?.[key]
  const value = Number(metric?.value)
  return Number.isFinite(value) ? { ...metric, value } : null
}

export function videoCoachBaseline(baselines, analysis, key) {
  const metric = videoCoachMetric(analysis, key)
  if (!metric) return null
  return (baselines || []).find(item => item.lift === analysis.lift &&
    videoCoachVariationIdentity(item.lift, item.variation) ===
      videoCoachVariationIdentity(analysis.lift, analysis.variation) && item.metric_key === key &&
    item.metric_method === metric.method) || null
}

export function videoCoachMetricText(metric) {
  if (!metric) return '—'
  const digits = Math.abs(metric.value) >= 10 ? 0 : 1
  const value = metric.value.toLocaleString('da-DK', { maximumFractionDigits: digits })
  const unit = ({ cm: 'cm', pct: '%', m_s: 'm/s', deg: '°', s: 's' })[metric.unit] || metric.unit || ''
  return `${value}${unit ? ` ${unit}` : ''}`
}

export function videoCoachBaselineText(baseline, metric) {
  if (!baseline || !metric || baseline.n_analyses < 3) return null
  const delta = metric.value - Number(baseline.median)
  const sign = delta > 0 ? '+' : ''
  const unit = metric.unit === 'pct' ? '%' : metric.unit || ''
  return `${sign}${delta.toLocaleString('da-DK', { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ''} vs. personlig median · n=${baseline.n_analyses}`
}

export function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export const s = {
  wrap: { minHeight: '100vh', background: '#141410', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, display: 'flex', overflowX: 'hidden' },
  sidebar: { width: '220px', minHeight: '100vh', background: '#1c1c18', borderRight: '1px solid rgba(237,234,226,0.07)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0 },
  sidebarLogo: { padding: '1.5rem 1.25rem 1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' },
  wordmark: { fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#edeae2' },
  sub: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.2rem' },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1.25rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: active ? '#c8923a' : '#7a7770', cursor: 'pointer', borderLeft: active ? '2px solid #c8923a' : '2px solid transparent', background: active ? 'rgba(200,146,58,0.08)' : 'transparent' }),
  sidebarFooter: { padding: '1rem 1.25rem', borderTop: '1px solid rgba(237,234,226,0.07)', marginTop: 'auto', fontSize: '0.78rem', color: '#4a4844' },
  main: { marginLeft: '220px', flex: 1, minWidth: 0, width: 'calc(100% - 220px)' },
  topbar: { height: '52px', borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', background: 'rgba(20,20,16,0.95)', position: 'sticky', top: 0, zIndex: 50 },
  topbarTitle: { fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 400, color: '#edeae2' },
  page: { padding: '2rem' },
  btnPrimary: { background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' },
  btnGhost: { background: 'transparent', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(237,234,226,0.13)', padding: '0.5rem 1rem', cursor: 'pointer' },
  btnDanger: { background: 'transparent', color: '#e05555', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(224,85,85,0.3)', padding: '0.4rem 0.85rem', cursor: 'pointer' },
  btnEdit: { background: 'transparent', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(237,234,226,0.1)', padding: '0.2rem 0.55rem', minHeight: '44px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' },
  btnSm: { background: 'transparent', color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(200,146,58,0.3)', padding: '0.2rem 0.5rem', cursor: 'pointer' },
  card: { background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.5rem', marginBottom: '1.5rem' },
  cardLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.35rem' },
  fieldInput: { width: '100%', background: '#141410', border: '1px solid rgba(237,234,226,0.13)', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.88rem', fontWeight: 300, padding: '0.55rem 0.75rem', outline: 'none' },
  fieldSelect: { width: '100%', background: '#141410', border: '1px solid rgba(237,234,226,0.13)', color: '#edeae2', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', padding: '0.55rem 0.75rem', outline: 'none', appearance: 'none', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: 'rgba(237,234,226,0.07)', border: '1px solid rgba(237,234,226,0.07)' },
  athleteCard: { background: '#141410', padding: '1.25rem 1.5rem', cursor: 'pointer', borderTop: '2px solid transparent', display: 'flex', alignItems: 'center', gap: '1rem' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%', background: '#242420', border: '1px solid rgba(237,234,226,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', serif", fontSize: '0.9rem', color: '#c8923a', flexShrink: 0 },
  badge: (status) => ({ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.5rem', background: statusColors[status] + '22', color: statusColors[status] }),
  tabs: { display: 'flex', borderBottom: '1px solid rgba(237,234,226,0.07)', marginBottom: '1.5rem' },
  tab: (active) => ({ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.65rem 1.25rem', cursor: 'pointer', color: active ? '#c8923a' : '#7a7770', background: 'none', border: 'none', borderBottom: active ? '2px solid #c8923a' : '2px solid transparent', marginBottom: '-1px' }),
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'rgba(237,234,226,0.07)', marginTop: '0.75rem' },
  statCell: { background: '#1c1c18', padding: '1rem 0.75rem' },
  statNum: { fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: '#edeae2', lineHeight: 1 },
  statLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.3rem' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(14,14,10,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', width: '100%', maxWidth: '440px', padding: '2rem' },
  modalTitle: { fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', fontWeight: 400, color: '#edeae2', marginBottom: '1.5rem' },
}

export function readinessSignal(score) {
  if (score >= 75) return { color: '#6cba6c', text: 'Kroppen er klar 💪', bg: 'rgba(108,186,108,0.07)' }
  if (score >= 50) return { color: '#c8923a', text: 'Tag det lidt roligt i dag', bg: 'rgba(200,146,58,0.07)' }
  return { color: '#e05555', text: 'Overvej en let session i dag', bg: 'rgba(224,85,85,0.07)' }
}

export function formatLastSeen(ts) {
  if (!ts) return null
  const diffDays = Math.floor((Date.now() - new Date(ts)) / 86400000)
  const dotColor = diffDays <= 2 ? '#6cba6c' : diffDays <= 7 ? '#c8923a' : '#4a4844'
  const text = diffDays === 0 ? 'Aktiv i dag' : diffDays <= 7 ? 'Aktiv denne uge' : `Sidst aktiv: ${diffDays} dage siden`
  return { text, dotColor }
}

export function parsePlannedRpe(intensity) {
  if (!intensity) return null
  const m = intensity.match(/RPE\s*(\d+(?:[.,]\d+)?)/i)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

export function buildLiftSeries(logs, keyword, nameToCat, category) {
  const useCategory = nameToCat && category && Object.keys(nameToCat).length > 0
  const matched = logs.filter(l => {
    const name = l.exercises?.name || ''
    if (useCategory) return kategoriFor(name, nameToCat) === category && l.weight > 0
    return name.toLowerCase().includes(keyword) && l.weight > 0
  })
  if (!matched.length) return { hasData: false, actualData: [], plannedData: [] }
  const byDate = {}
  for (const log of matched) {
    const date = log.logged_at.slice(0, 10)
    if (!byDate[date]) byDate[date] = { max: 0, planned: null }
    if (log.weight > byDate[date].max) byDate[date].max = log.weight
    const rw = log.exercises?.recommended_weight
    if (rw != null && byDate[date].planned === null) byDate[date].planned = rw
  }
  const sorted = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
  const lbl = date => { const d = new Date(date + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }
  return {
    hasData: true,
    actualData: sorted.map(([date, d]) => ({ y: d.max, label: lbl(date) })),
    plannedData: sorted.filter(([, d]) => d.planned != null).map(([date, d]) => ({ y: d.planned, label: lbl(date) })),
  }
}
