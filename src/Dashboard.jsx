import { useState, useEffect, useRef } from 'react'
import { supabase, withRetry } from './supabase'

const BLOCK_NAMES = ['Akkumulering', 'Intensificering', 'Peak', 'Deload', 'GPP', 'Hypertrofi', 'Styrke', 'Transition']
const BLOCK_PALETTE = ['#4e8fcf','#c8923a','#6cba6c','#9b6bd4','#cf6b4e','#4ec8b4']
function blockColor(name) {
  if (!name) return '#4a4844'
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return BLOCK_PALETTE[h % BLOCK_PALETTE.length]
}
function computePhases(weeks) {
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
function currentWeekNo(weeks, maxLoggedWk) {
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
// Valgfri fast ugedag pr. session (0=mandag .. 6=søndag). null = fleksibel (Træning 1/2/3).
const WEEKDAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const WEEKDAYS_LONG = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

const statusLabels = { active: 'Aktiv', peaking: 'Peaking', offseason: 'Off-season', ferie: 'Ferie' }
const statusColors = { active: '#6cba6c', peaking: '#c8923a', offseason: '#7a7770', ferie: '#5b9bb5' }

// Sektioner vist som kort på atlet-hubben (coach-landingsside). Rækkefølgen
// matcher fane-bar'en; ikonet er en kompakt 24×24 stroke-SVG.
const ic = (d) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
const HUB_SECTIONS = [
  { key: 'oversigt', label: 'Oversigt', desc: 'Maks, kropsvægt & status', icon: ic(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>) },
  { key: 'kost', label: 'Kost & mål', desc: 'Kcal- og proteinmål', icon: ic(<><path d="M3 2v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2" /><line x1="5" y1="11" x2="5" y2="22" /><path d="M17 2c-1.5 1-2 3-2 5v6h4V2" /><line x1="17" y1="13" x2="17" y2="22" /></>) },
  { key: 'program', label: 'Program', desc: 'Ugeplan & sessioner', icon: ic(<><line x1="6" y1="12" x2="18" y2="12" /><rect x="2.5" y="9" width="3.5" height="6" rx="1" /><rect x="18" y="9" width="3.5" height="6" rx="1" /></>) },
  { key: 'log', label: 'Log', desc: 'Træningslog & historik', icon: ic(<><path d="M4 4h16v16H4z" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="12" y2="17" /></>) },
  { key: 'analyse', label: 'Analyse', desc: 'Grafer & belastning', icon: ic(<><line x1="3" y1="21" x2="21" y2="21" /><polyline points="4 15 9 10 13 14 20 6" /></>) },
  { key: 'opvarmning', label: 'Opvarmning', desc: 'Mobilitet & rutiner', icon: ic(<><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></>) },
  { key: 'stævne', label: 'Stævne', desc: 'Plan, historik & rekorder', icon: ic(<><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>) },
  { key: 'noter', label: 'Noter', desc: 'Coach-noter', icon: ic(<><path d="M4 3h12l4 4v14H4z" /><polyline points="16 3 16 7 20 7" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" /></>) },
  { key: 'beskeder', label: 'Beskeder', desc: 'Chat med atleten', icon: ic(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />) },
]

// Ferie-status: returnerer { onHoliday, until } eller null hvis ikke på ferie.
// onHoliday = ingen slutdato eller slutdato >= i dag. Ellers er ferien slut (tilbage).
function holidayInfo(a) {
  if (a?.status !== 'ferie') return null
  const until = a.vacation_until || null
  const onHoliday = !until || until >= new Date().toISOString().slice(0, 10)
  return { onHoliday, until }
}
function ferieBadgeLabel(info) {
  if (info?.until) {
    const d = new Date(info.until + 'T12:00:00')
    return `Ferie til ${d.getDate()}/${d.getMonth() + 1}`
  }
  return 'Ferie'
}

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const s = {
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
  btnEdit: { background: 'transparent', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(237,234,226,0.1)', padding: '0.2rem 0.55rem', cursor: 'pointer' },
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

function LineChart({ series, height = 130 }) {
  const allPts = series.flatMap(s => s.data)
  if (!allPts.length) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em' }}>
      Ingen data endnu
    </div>
  )
  const ys = allPts.map(p => p.y)
  const rawMin = Math.min(...ys), rawMax = Math.max(...ys)
  const pad = (rawMax - rawMin) * 0.1 || 5
  const minY = rawMin - pad, maxY = rawMax + pad
  const rangeY = maxY - minY
  const W = 500, H = height, pL = 44, pR = 10, pT = 14, pB = 26
  const cW = W - pL - pR, cH = H - pT - pB
  const tx = (i, n) => pL + (n > 1 ? i / (n - 1) : 0.5) * cW
  const ty = v => pT + cH - ((v - minY) / rangeY) * cH
  const yTicks = [Math.round(rawMin), Math.round((rawMin + rawMax) / 2), Math.round(rawMax)]
  const xRef = series.find(s => s.data.length > 0)?.data || []
  const xIdxs = xRef.length <= 4 ? xRef.map((_, i) => i)
    : [0, Math.round((xRef.length - 1) / 3), Math.round((xRef.length - 1) * 2 / 3), xRef.length - 1]
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pL} y1={ty(v)} x2={W - pR} y2={ty(v)} stroke="rgba(237,234,226,0.07)" strokeWidth="1" />
          <text x={pL - 5} y={ty(v) + 3.5} textAnchor="end" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{v}</text>
        </g>
      ))}
      {series.map((s, si) => {
        if (!s.data.length) return null
        const n = s.data.length
        const path = s.data.map((p, i) => `${i ? 'L' : 'M'}${tx(i, n).toFixed(1)},${ty(p.y).toFixed(1)}`).join('')
        return (
          <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5,3' : undefined} />
            {s.data.map((p, i) => <circle key={i} cx={tx(i, n)} cy={ty(p.y)} r="2.5" fill={s.color} />)}
          </g>
        )
      })}
      {xIdxs.filter((v, i, a) => a.indexOf(v) === i).map(i => (
        <text key={i} x={tx(i, xRef.length)} y={H - 4} textAnchor="middle" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">
          {xRef[i]?.label}
        </text>
      ))}
    </svg>
  )
}

function BarChart({ bars, height = 110 }) {
  if (!bars.length) return null
  const maxVal = Math.max(...bars.map(b => b.value), 1)
  const W = 500, H = height, pL = 32, pR = 10, pT = 20, pB = 26
  const cW = W - pL - pR, cH = H - pT - pB
  const step = cW / bars.length
  const bw = Math.floor(step * 0.65)
  const yAt = v => pT + cH - (v / maxVal) * cH
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {[0, Math.round(maxVal / 2), maxVal].map((v, i) => (
        <g key={i}>
          <line x1={pL} y1={yAt(v)} x2={W - pR} y2={yAt(v)} stroke="rgba(237,234,226,0.05)" strokeWidth="1" />
          <text x={pL - 4} y={yAt(v) + 3.5} textAnchor="end" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{v}</text>
        </g>
      ))}
      {bars.map((bar, i) => {
        const x = pL + step * i + (step - bw) / 2
        const bh = Math.max(1, (bar.value / maxVal) * cH)
        const y = pT + cH - bh
        const fill = bar.highlight ? '#e05555' : '#c8923a'
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} fill={fill} opacity="0.75" />
            {bar.value > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fill={bar.highlight ? '#e05555' : '#7a7770'} fontSize="8" fontFamily="IBM Plex Mono">{bar.value}</text>}
            <text x={x + bw / 2} y={H - 4} textAnchor="middle" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{bar.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function ScatterPlot({ points, height = 130 }) {
  if (points.length < 3) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em' }}>
      Ikke nok data endnu
    </div>
  )
  const W = 500, H = height, pL = 44, pR = 16, pT = 16, pB = 30
  const cW = W - pL - pR, cH = H - pT - pB
  const ys = points.map(p => p.y)
  const minY = Math.min(...ys, -1), maxY = Math.max(...ys, 1)
  const rangeY = maxY - minY || 1
  const tx = v => pL + ((v - 20) / 80) * cW
  const ty = v => pT + cH - ((v - minY) / rangeY) * cH
  const yTicks = [-2, -1, 0, 1, 2].filter(v => v >= minY - 0.5 && v <= maxY + 0.5)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <line x1={pL} y1={ty(0)} x2={W - pR} y2={ty(0)} stroke="rgba(237,234,226,0.13)" strokeWidth="1" strokeDasharray="4,3" />
      {yTicks.map(v => (
        <g key={v}>
          <line x1={pL} y1={ty(v)} x2={W - pR} y2={ty(v)} stroke="rgba(237,234,226,0.04)" strokeWidth="1" />
          <text x={pL - 4} y={ty(v) + 3.5} textAnchor="end" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{v > 0 ? '+' : ''}{v}</text>
        </g>
      ))}
      {[25, 50, 60, 75].map(v => (
        <g key={v}>
          <line x1={tx(v)} y1={pT} x2={tx(v)} y2={pT + cH} stroke={v === 60 ? 'rgba(224,85,85,0.2)' : 'rgba(237,234,226,0.04)'} strokeWidth="1" />
          <text x={tx(v)} y={H - 4} textAnchor="middle" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{v}</text>
        </g>
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={tx(p.x)} cy={ty(p.y)} r="4.5" fill={p.x < 60 ? '#e05555' : '#6cba6c'} opacity="0.7" />
      ))}
    </svg>
  )
}

function readinessSignal(score) {
  if (score >= 75) return { color: '#6cba6c', text: 'Kroppen er klar 💪', bg: 'rgba(108,186,108,0.07)' }
  if (score >= 50) return { color: '#c8923a', text: 'Tag det lidt roligt i dag', bg: 'rgba(200,146,58,0.07)' }
  return { color: '#e05555', text: 'Overvej en let session i dag', bg: 'rgba(224,85,85,0.07)' }
}

function formatLastSeen(ts) {
  if (!ts) return null
  const diffDays = Math.floor((Date.now() - new Date(ts)) / 86400000)
  const dotColor = diffDays <= 2 ? '#6cba6c' : diffDays <= 7 ? '#c8923a' : '#4a4844'
  const text = diffDays === 0 ? 'Aktiv i dag' : diffDays <= 7 ? 'Aktiv denne uge' : `Sidst aktiv: ${diffDays} dage siden`
  return { text, dotColor }
}

// Maks. antal sæt-rækker hentet pr. atlet (Log-fane + AI-rapport). Hævet fra 500 så
// lange perioder ikke afkortes lydløst i rapporten; bruges også til afkortnings-advarsel.
const ATHLETE_LOGS_LIMIT = 2000

function parsePlannedRpe(intensity) {
  if (!intensity) return null
  const m = intensity.match(/RPE\s*(\d+(?:[.,]\d+)?)/i)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

function buildLiftSeries(logs, keyword, nameToCat, category) {
  const useCategory = nameToCat && category && Object.keys(nameToCat).length > 0
  const matched = logs.filter(l => {
    const name = l.exercises?.name || ''
    if (useCategory) return nameToCat[name.toLowerCase()] === category && l.weight > 0
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

export default function Dashboard({ session, onPreviewAthlete }) {
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [view, setView] = useState('list')
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [activeTab, setActiveTab] = useState('hub')
  const [editing, setEditing] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [newAthlete, setNewAthlete] = useState({ name: '', email: '', age: '', weightClass: '', status: 'active' })
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)

  // Messages state
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [latestMessages, setLatestMessages] = useState({})
  const [unreadCounts, setUnreadCounts] = useState({})
  const [profilesLastSeen, setProfilesLastSeen] = useState({})

  // Export state
  const [exportingTraening, setExportingTraening] = useState(false)
  const [exportingBackup, setExportingBackup] = useState(false)
  // In-app toast + bekræftelses-modal (erstatter native alert/confirm)
  const [flash, setFlash] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const flashTimerRef = useRef(null)
  const snoozeMigratedRef = useRef(false) // engangs-flyt af localStorage-snoozes til DB
  const [lastBackup, setLastBackup] = useState(null) // synces via profiles.last_backup_at

  // Program state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // "Min profil"-genvej: hvilken atlet er coachen selv (gemt i localStorage).
  const [myAthleteId, setMyAthleteId] = useState(() => localStorage.getItem('entropi_my_athlete_id') || null)
  const [pickingMine, setPickingMine] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

  const [weeks, setWeeks] = useState([])
  const [openWeekId, setOpenWeekId] = useState(null)
  const [programBlockStart, setProgramBlockStart] = useState(null) // hvilken blok vises i program-listen (week_number for 1. uge, eller 'all')
  const [openSessionId, setOpenSessionId] = useState(null)
  const [addingWeek, setAddingWeek] = useState(false)
  const [addingSession, setAddingSession] = useState(null)
  const [addingExercise, setAddingExercise] = useState(null)
  const [editingWeek, setEditingWeek] = useState(null)
  const [editingSession, setEditingSession] = useState(null)
  const [editingExercise, setEditingExercise] = useState(null)
  const [weekForm, setWeekForm] = useState({ week_number: '', block_name: '', coach_note: '', block_description: '', start_date: '' })
  // Inline omdøbning af en blok i periodiserings-tidslinjen (id på blokkens første uge)
  const [renamingBlock, setRenamingBlock] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [showBlockPlanner, setShowBlockPlanner] = useState(false)
  const [calBlockAthlete, setCalBlockAthlete] = useState(null) // {id, name} når kalender-blok-byggeren er åben
  const [hoverCell, setHoverCell] = useState(null) // {aid, col} = tom kalender-celle der hoveres (klik = opret uge)
  const [blockPlan, setBlockPlan] = useState([{ id: 1, name: 'Akkumulering', weeks: 4 }, { id: 2, name: 'Intensificering', weeks: 3 }, { id: 3, name: 'Peak', weeks: 2 }, { id: 4, name: 'Deload', weeks: 1 }])
  const [planStartDate, setPlanStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [assignEdits, setAssignEdits] = useState({})
  const [sessionForm, setSessionForm] = useState({ title: '', weekday: null })
  const [exerciseForm, setExerciseForm] = useState({ name: '', sets: '', reps: '', intensity: '', intensityPrefix: 'RPE', note: '' })
  const [athleteLogs, setAthleteLogs] = useState([])
  const [openLogWeeks, setOpenLogWeeks] = useState(null) // null = standard (seneste uge åben); ellers Set af åbne ugenumre
  const [logExerciseFilter, setLogExerciseFilter] = useState(null) // Log-fane: null = alle øvelser; ellers øvelsesnavn
  const [weeklyActivity, setWeeklyActivity] = useState({}) // athlete_id → { sessions, sets } for indeværende uge
  const [athleteWeightLogs, setAthleteWeightLogs] = useState([])
  const [athleteReadiness, setAthleteReadiness] = useState([])
  const [athletePRs, setAthletePRs] = useState([])
  const [athletePRHistory, setAthletePRHistory] = useState([])
  const [warmupTemplates, setWarmupTemplates] = useState([])
  const [editingWarmup, setEditingWarmup] = useState(null)
  const [warmupDraftSteps, setWarmupDraftSteps] = useState([])
  const [warmupNewStep, setWarmupNewStep] = useState('')
  const [editingRecommended, setEditingRecommended] = useState(null)
  const [recommendedInput, setRecommendedInput] = useState('')
  const [copyingExercise, setCopyingExercise] = useState(null)
  const [copyingSession, setCopyingSession] = useState(null)

  // Meet plan state
  const [meetPlan, setMeetPlan] = useState(null)
  const [meetPlanForm, setMeetPlanForm] = useState({ meet_type: 'sbd', squat1: '', squat2: '', squat3: '', bench1: '', bench2: '', bench3: '', dead1: '', dead2: '', dead3: '', notes: '' })
  const [savingMeetPlan, setSavingMeetPlan] = useState(false)

  // Meet results (historik)
  const [meetResults, setMeetResults] = useState([])
  const [meetResultForm, setMeetResultForm] = useState(null) // null = lukket

  const [previewPickerOpen, setPreviewPickerOpen] = useState(false)
  const [exerciseLibrary, setExerciseLibrary] = useState([])
  const [exerciseSearchOpen, setExerciseSearchOpen] = useState(false)
  const [editingLibraryEx, setEditingLibraryEx] = useState(null)
  const [libraryEditForm, setLibraryEditForm] = useState({ name: '', category: '' })
  const [addingLibraryEx, setAddingLibraryEx] = useState(false)
  const [libraryAddForm, setLibraryAddForm] = useState({ name: '', category: 'Accessory' })
  const [librarySearch, setLibrarySearch] = useState('')
  const [athleteWeekSummary, setAthleteWeekSummary] = useState({})
  const [athleteLastLogs, setAthleteLastLogs] = useState({})
  const [calendarWeeks, setCalendarWeeks] = useState({}) // athlete_id -> [{week_number, block_name, start_date, session_count, exercise_count}]
  const [athleteCurrentWeek, setAthleteCurrentWeek] = useState({}) // athlete_id -> ugenummer for seneste logg. træning
  const [timelineEdit, setTimelineEdit] = useState(null) // { athleteId, weeks, name, block, firstStartIso } — åbent dato-panel i kalender-tidslinjen
  // Kilde = athletes.snooze_until (DB). localStorage bruges kun som midlertidig seed for
  // straks-visning + migreres væk ved første load (se snoozeMigratedRef-effekt).
  const [snoozedAthletes, setSnoozedAthletes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('entropi_calendar_snooze') || '{}') } catch { return {} }
  })
  // Skjulte atleter synces nu via athletes.hidden i DB (på tværs af enheder),
  // ikke localStorage. Sættet fyldes fra fetchAthletes.
  const [hiddenAthleteIds, setHiddenAthleteIds] = useState(new Set())
  const [showHiddenAthletes, setShowHiddenAthletes] = useState(false)
  const [showAiExport, setShowAiExport] = useState(false)
  const [aiExportWeeks, setAiExportWeeks] = useState(8)
  const [aiExportText, setAiExportText] = useState('')
  const [aiExportCopied, setAiExportCopied] = useState(false)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => { fetchAthletes(); fetchExerciseLibrary(); fetchLastBackup() }, [])
  // Engangs-migrering: flyt evt. gamle localStorage-snoozes ind i DB, så de ikke tabes
  // når snooze nu synces via athletes.snooze_until. Kører én gang når atleter er hentet.
  useEffect(() => {
    if (snoozeMigratedRef.current || !athletes.length) return
    snoozeMigratedRef.current = true
    let local
    try { local = JSON.parse(localStorage.getItem('entropi_calendar_snooze') || '{}') } catch { local = {} }
    const entries = Object.entries(local).filter(([id, until]) => until && athletes.some(a => a.id === id))
    if (entries.length) {
      Promise.all(entries.map(([id, until]) => supabase.from('athletes').update({ snooze_until: until }).eq('id', id)))
        .then(() => { localStorage.removeItem('entropi_calendar_snooze'); fetchAthletes() })
    } else {
      localStorage.removeItem('entropi_calendar_snooze')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletes])
  useEffect(() => {
    if ((view === 'calendar' || view === 'list') && athletes.length) {
      const ids = athletes.map(a => a.id)
      fetchCalendarWeeks(ids)
      fetchCalendarProgress(ids)
    }
  }, [view, athletes])
  useEffect(() => {
    if ((activeTab === 'program' || activeTab === 'analyse' || activeTab === 'log') && selectedAthlete) {
      fetchWeeks(selectedAthlete.id)
      fetchAthleteLogs(selectedAthlete.id)
    }
  }, [activeTab, selectedAthlete?.id])

  useEffect(() => {
    if (activeTab === 'beskeder' && selectedAthlete) {
      fetchMessages(selectedAthlete.id)
      markMessagesRead(selectedAthlete.id)
    }
  }, [activeTab, selectedAthlete?.id])

  useEffect(() => {
    if ((activeTab === 'oversigt' || activeTab === 'analyse') && selectedAthlete) {
      fetchAthleteWeightLogs(selectedAthlete.id)
      fetchAthleteReadiness(selectedAthlete.id)
      fetchAthletePRs(selectedAthlete.id)
      fetchMeetResults(selectedAthlete.id)
    }
    // Hubben viser dagens parathed i statuslinjen.
    if (activeTab === 'hub' && selectedAthlete) fetchAthleteReadiness(selectedAthlete.id)
  }, [activeTab, selectedAthlete?.id])

  useEffect(() => {
    if (activeTab === 'opvarmning' && selectedAthlete) {
      fetchWarmupTemplates(selectedAthlete.id)
    }
  }, [activeTab, selectedAthlete?.id])

  useEffect(() => {
    if (activeTab === 'stævne' && selectedAthlete) {
      fetchMeetPlan(selectedAthlete.id)
      fetchMeetResults(selectedAthlete.id)
      fetchAthletePRs(selectedAthlete.id)
    }
  }, [activeTab, selectedAthlete?.id])

  async function fetchLastBackup() {
    const { data } = await supabase.from('profiles').select('last_backup_at').eq('id', session.user.id).maybeSingle()
    if (data?.last_backup_at) setLastBackup(data.last_backup_at)
  }

  function showFlash(message, kind = 'info') {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash({ message, kind })
    flashTimerRef.current = setTimeout(() => setFlash(null), 3000)
  }

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm })
  }

  // --- Program-fane: blok-accordion (vis én blok ad gangen) ---
  function programActiveStart() {
    if (programBlockStart === 'all') return 'all'
    const phases = computePhases(weeks)
    if (programBlockStart != null && phases.some(p => p.weeks[0].week_number === programBlockStart)) return programBlockStart
    const openPhase = openWeekId ? phases.find(p => p.weeks.some(w => w.id === openWeekId)) : null
    return (openPhase || phases[phases.length - 1])?.weeks[0]?.week_number ?? null
  }
  function programShownWeeks() {
    if (programBlockStart === 'all') return weeks
    const phases = computePhases(weeks)
    const start = programActiveStart()
    const ph = phases.find(p => p.weeks[0].week_number === start)
    return ph ? ph.weeks : weeks
  }
  function gotoWeek(week) {
    const ph = computePhases(weeks).find(p => p.weeks.some(w => w.id === week.id))
    if (ph) setProgramBlockStart(ph.weeks[0].week_number)
    setOpenWeekId(week.id)
    setTimeout(() => document.getElementById(`week-row-${week.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
  }
  // Hvor meget har atleten logget i en session: grøn=fuldt, amber=i gang, grå=intet.
  function sessionLogStatus(session) {
    const total = (session.exercises || []).reduce((a, e) => a + (e.sets || 0), 0)
    let logged = 0
    for (const log of athleteLogs) {
      if (!log.skipped && log.exercises?.session_id === session.id) logged++
    }
    let kind
    if (total > 0) {
      logged = Math.min(logged, total)
      kind = logged === 0 ? 'none' : logged >= total ? 'done' : 'partial'
    } else {
      kind = logged > 0 ? 'done' : 'none' // øvelser uden sæt-mål: vis blot om der er logget
    }
    const color = kind === 'done' ? '#6cba6c' : kind === 'partial' ? '#c8923a' : '#3a3a36'
    return { kind, logged, total, color }
  }

  async function fetchAthletes() {
    setLoadError(false)
    const { data, error } = await withRetry(() => supabase.from('athletes').select('*').order('name'))
    // Reel fejl efter retries: vis fejl/retry i stedet for misvisende "ingen atleter".
    if (error) { setLoadError(true); setLoading(false); return }
    setAthletes(data || [])
    setHiddenAthleteIds(new Set((data || []).filter(a => a.hidden).map(a => a.id)))
    // Snooze synces nu via athletes.snooze_until i DB (cross-device), ikke localStorage.
    setSnoozedAthletes(Object.fromEntries((data || []).filter(a => a.snooze_until).map(a => [a.id, a.snooze_until])))
    if (data?.length) {
      fetchLatestMessages(data.map(a => a.id))
      fetchProfilesLastSeen(data)
      fetchAthleteWeekSummaries(data.map(a => a.id))
      fetchAthleteLastLogs(data.map(a => a.id))
      fetchWeeklyActivity(data.map(a => a.id))
    }
    setLoading(false)
  }

  // Mandag i indeværende ISO-uge (lokal tid), som Date kl. 00:00.
  function isoMonday(d = new Date()) {
    const x = new Date(d)
    const day = (x.getDay() + 6) % 7 // 0=mandag
    x.setDate(x.getDate() - day)
    x.setHours(0, 0, 0, 0)
    return x
  }

  // Pr. atlet: antal loggede træninger (unikke datoer) + antal sæt i indeværende uge.
  async function fetchWeeklyActivity(athleteIds) {
    if (!athleteIds.length) return
    const { data } = await supabase
      .from('exercise_logs')
      .select('athlete_id, logged_at')
      .in('athlete_id', athleteIds)
      .eq('skipped', false)
      .gte('logged_at', isoMonday().toISOString())
    if (!data) return
    const map = {}
    for (const log of data) {
      const aid = log.athlete_id
      if (!map[aid]) map[aid] = { dates: new Set(), sets: 0 }
      map[aid].dates.add(log.logged_at.slice(0, 10))
      map[aid].sets++
    }
    const summary = {}
    for (const aid in map) summary[aid] = { sessions: map[aid].dates.size, sets: map[aid].sets }
    setWeeklyActivity(summary)
  }

  async function fetchAthleteLastLogs(athleteIds) {
    if (!athleteIds.length) return
    const { data } = await supabase
      .from('exercise_logs')
      .select('athlete_id, logged_at')
      .in('athlete_id', athleteIds)
      .eq('skipped', false)
      .order('logged_at', { ascending: false })
    if (!data) return
    const map = {}
    for (const log of data) {
      if (!map[log.athlete_id]) map[log.athlete_id] = log.logged_at.slice(0, 10)
    }
    setAthleteLastLogs(map)
  }

  async function fetchAthleteWeekSummaries(athleteIds) {
    if (!athleteIds.length) return
    const { data } = await supabase
      .from('weeks')
      .select('athlete_id, week_number, block_name, start_date, sessions(id)')
      .in('athlete_id', athleteIds)
    if (!data) return
    const summary = {}
    for (const w of data) {
      const aid = w.athlete_id
      const sessionCount = (w.sessions || []).length
      if (!summary[aid]) {
        summary[aid] = { week_number: w.week_number, block_name: w.block_name, start_date: w.start_date, session_count: sessionCount }
      } else {
        // Prefer latest week with sessions; if tie or no sessions anywhere, prefer highest week_number
        const cur = summary[aid]
        const curHasSess = cur.session_count > 0
        const newHasSess = sessionCount > 0
        if (newHasSess && (!curHasSess || w.week_number > cur.week_number)) {
          summary[aid] = { week_number: w.week_number, block_name: w.block_name, start_date: w.start_date, session_count: sessionCount }
        } else if (!newHasSess && !curHasSess && w.week_number > cur.week_number) {
          summary[aid] = { week_number: w.week_number, block_name: w.block_name, start_date: w.start_date, session_count: sessionCount }
        }
      }
    }
    setAthleteWeekSummary(summary)
  }

  async function fetchCalendarWeeks(athleteIds) {
    if (!athleteIds.length) return
    const { data } = await supabase
      .from('weeks')
      .select('id, athlete_id, week_number, block_name, start_date, sessions(id, exercises(id))')
      .in('athlete_id', athleteIds)
    if (!data) return
    const map = {}
    for (const w of data) {
      if (!map[w.athlete_id]) map[w.athlete_id] = []
      const sessions = w.sessions || []
      map[w.athlete_id].push({
        id: w.id,
        week_number: w.week_number,
        block_name: w.block_name,
        start_date: w.start_date,
        session_count: sessions.length,
        exercise_count: sessions.reduce((a, sess) => a + (sess.exercises || []).length, 0),
      })
    }
    // Sortér uger pr. atlet efter ugenummer (stigende)
    for (const aid in map) map[aid].sort((a, b) => a.week_number - b.week_number)
    setCalendarWeeks(map)
  }

  // Find hvilket ugenummer hver atlet sidst loggede træning i (= hvor de er nu).
  // Sætter en bloks startdato fra kalender-tidslinjen og cascader fortløbende
  // datoer ud på hver uge i blokken (uge N = startdato + 7×(N − førsteUgeNr)).
  // Giver hver uge en eksplicit start_date → tidslinje + phase bar/board firmer op.
  async function setBlockStartDate(athleteId, blockWeeks, isoDate) {
    if (!isoDate || !blockWeeks?.length) return
    const sorted = [...blockWeeks].sort((a, b) => a.week_number - b.week_number)
    const base = new Date(isoDate + 'T12:00:00')
    const firstNo = sorted[0].week_number
    await Promise.all(sorted.map(w => {
      const d = new Date(base.getTime() + (w.week_number - firstNo) * 7 * 86400000)
      const ds = d.toISOString().slice(0, 10)
      return w.start_date === ds ? null : supabase.from('weeks').update({ start_date: ds }).eq('id', w.id)
    }))
    await fetchCalendarWeeks(athletes.map(a => a.id))
    if (selectedAthlete?.id === athleteId) fetchWeeks(athleteId)
  }

  async function fetchCalendarProgress(athleteIds) {
    if (!athleteIds.length) return
    const since = new Date(); since.setDate(since.getDate() - 180)
    const { data } = await supabase
      .from('exercise_logs')
      .select('athlete_id, logged_at, exercises(sessions(weeks(week_number)))')
      .in('athlete_id', athleteIds)
      .gte('logged_at', since.toISOString())
      .order('logged_at', { ascending: false })
    if (!data) return
    const map = {}
    for (const log of data) {
      if (map[log.athlete_id] != null) continue // har allerede den seneste for denne atlet
      const wn = log.exercises?.sessions?.weeks?.week_number
      if (wn != null) map[log.athlete_id] = wn
    }
    setAthleteCurrentWeek(map)
  }

  // Udsæt opmærksomhed på en atlet til en dato (ISO yyyy-mm-dd). null = fjern udsættelse.
  // Persisteres i athletes.snooze_until så det følger med på tværs af enheder.
  async function snoozeAthlete(athId, untilDate) {
    setSnoozedAthletes(prev => {
      const next = { ...prev }
      if (untilDate) next[athId] = untilDate; else delete next[athId]
      return next
    })
    await supabase.from('athletes').update({ snooze_until: untilDate || null }).eq('id', athId)
  }

  async function fetchProfilesLastSeen(athletesList) {
    const userIds = athletesList.map(a => a.user_id).filter(Boolean)
    if (!userIds.length) return
    const { data } = await supabase.from('profiles').select('id, last_seen').in('id', userIds)
    if (data) {
      const map = {}
      for (const p of data) map[p.id] = p.last_seen
      setProfilesLastSeen(map)
    }
  }

  async function fetchWeeks(athleteId) {
    const { data } = await supabase
      .from('weeks')
      .select('*, sessions(*, exercises(*))')
      .eq('athlete_id', athleteId)
      .order('week_number')
    setWeeks((data || []).map(w => ({
      ...w,
      sessions: (w.sessions || [])
        // Sekundær sortering på id giver dage med ens session_order en STABIL,
        // deterministisk rækkefølge — samme som reorderSession bruger, så ↑↓
        // altid flytter den dag man tror.
        .sort((a, b) => (a.session_order - b.session_order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map(s => ({ ...s, exercises: (s.exercises || []).sort((a, b) => (a.exercise_order - b.exercise_order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) }))
    })))
  }

  async function addWeek() {
    const nextNum = weeks.length > 0 ? Math.max(...weeks.map(w => w.week_number)) + 1 : 1
    await supabase.from('weeks').insert({
      athlete_id: selectedAthlete.id,
      week_number: weekForm.week_number ? parseInt(weekForm.week_number) : nextNum,
      block_name: weekForm.block_name || null,
      coach_note: weekForm.coach_note || null,
      block_description: weekForm.block_description || null,
      start_date: weekForm.start_date || null,
    })
    setAddingWeek(false)
    setWeekForm({ week_number: '', block_name: '', coach_note: '', block_description: '', start_date: '' })
    fetchWeeks(selectedAthlete.id)
  }

  async function updateWeek(weekId) {
    await supabase.from('weeks').update({
      week_number: parseInt(weekForm.week_number),
      block_name: weekForm.block_name || null,
      coach_note: weekForm.coach_note || null,
      block_description: weekForm.block_description || null,
      start_date: weekForm.start_date || null,
    }).eq('id', weekId)
    setEditingWeek(null)
    fetchWeeks(selectedAthlete.id)
  }

  // Genererer tomme uger ud fra blockPlan for en atlet. Default = den valgte atlet
  // (Program-fanen), men kan kaldes med en athleteId fra kalenderen.
  async function generateWeeksFromPlan(athleteId = selectedAthlete?.id) {
    if (!athleteId || !planStartDate || !blockPlan.length) return
    // Find atletens eksisterende uger fra den rigtige kilde (Program-fane vs kalender).
    const existing = athleteId === selectedAthlete?.id ? weeks : (calendarWeeks[athleteId] || [])
    const nextNum = existing.length > 0 ? Math.max(...existing.map(w => w.week_number)) + 1 : 1
    const rows = []
    let weekNum = nextNum
    let currentDate = new Date(planStartDate + 'T12:00:00')
    for (const block of blockPlan) {
      for (let i = 0; i < (block.weeks || 1); i++) {
        rows.push({
          athlete_id: athleteId,
          week_number: weekNum++,
          block_name: block.name || null,
          start_date: currentDate.toISOString().slice(0, 10),
          coach_note: null,
          block_description: null,
        })
        currentDate = new Date(currentDate.getTime() + 7 * 24 * 3600 * 1000)
      }
    }
    await supabase.from('weeks').insert(rows)
    setShowBlockPlanner(false)
    setCalBlockAthlete(null)
    if (athleteId === selectedAthlete?.id) fetchWeeks(athleteId)
    await fetchCalendarWeeks(athletes.map(a => a.id))
    fetchAthleteWeekSummaries(athletes.map(a => a.id))
  }

  // Opretter ÉN tom uge (ingen sessioner/øvelser) for en atlet med en eksplicit
  // startdato — bruges når coachen klikker på en tom celle i kalender-tidslinjen.
  // week_number udledes af kalderen (se onEmptyCellClick) så ugen lægger sig præcis
  // hvor der blev klikket og holder anker-modellen konsistent. Samme insert-form
  // som addWeek/generateWeeksFromPlan.
  async function createCalendarWeek(athleteId, weekNumber, isoDate) {
    await supabase.from('weeks').insert({
      athlete_id: athleteId,
      week_number: weekNumber,
      block_name: null,
      coach_note: null,
      block_description: null,
      start_date: isoDate,
    })
    await fetchCalendarWeeks(athletes.map(a => a.id))
    fetchAthleteWeekSummaries(athletes.map(a => a.id))
    if (selectedAthlete?.id === athleteId) fetchWeeks(athleteId)
    showFlash('Uge oprettet — åbn atleten for at lægge øvelser ind.')
  }

  // Bygger til kalender-blok-opstilling: returnerer blok-sekvens-editoren (delt UI).
  function blockSequenceRows() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {blockPlan.map((block, i) => (
          <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: blockColor(block.name), flexShrink: 0 }} />
            <select
              value={block.name}
              onChange={e => setBlockPlan(p => p.map((b, j) => j === i ? { ...b, name: e.target.value } : b))}
              style={{ ...s.fieldSelect, width: '160px', padding: '0.35rem 0.6rem', fontSize: '0.72rem' }}
            >
              {BLOCK_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="number" min="1" max="20"
                value={block.weeks}
                onChange={e => setBlockPlan(p => p.map((b, j) => j === i ? { ...b, weeks: Math.max(1, parseInt(e.target.value) || 1) } : b))}
                style={{ ...s.fieldInput, width: '52px', padding: '0.35rem 0.5rem', fontSize: '0.72rem', textAlign: 'center' }}
              />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>uge{block.weeks !== 1 ? 'r' : ''}</span>
            </div>
            <button onClick={() => setBlockPlan(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>✕</button>
          </div>
        ))}
        <button
          onClick={() => setBlockPlan(p => [...p, { id: Date.now(), name: BLOCK_NAMES[0], weeks: 2 }])}
          style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.3rem 0.7rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}
        >+ Tilføj blok</button>
      </div>
    )
  }

  // Åbn kalender-blok-byggeren for en atlet; seed startdato efter deres sidste daterede uge (ellers i dag).
  function openCalBlockBuilder(a) {
    const wks = calendarWeeks[a.id] || []
    const dated = wks.filter(w => w.start_date).sort((x, y) => y.week_number - x.week_number)
    const seed = dated.length
      ? new Date(new Date(dated[0].start_date + 'T12:00:00').getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
    setPlanStartDate(seed)
    setCalBlockAthlete({ id: a.id, name: a.name })
  }

  // Beregner programmerings-status pr. atlet (samme logik som kalender-boardet):
  // none = intet program, empty = uger men ingen øvelser, low = sidste fyldte uge nu, ready = ok.
  function computeBoard(list) {
    const today0 = new Date(); today0.setHours(0, 0, 0, 0)
    return list.map(a => {
      const weeks = calendarWeeks[a.id] || []
      const planned = weeks.filter(w => w.exercise_count > 0)
      const minPlannedWeekNo = planned.length ? Math.min(...planned.map(w => w.week_number)) : null
      const loggedWeek = athleteCurrentWeek[a.id] ?? null
      // Dato-bevidst "nu" (samme som tidslinjen): ugen hvis datospænd dækker i dag,
      // ellers seneste loggede uge, ellers første planlagte uge.
      const ref = currentWeekNo(weeks, loggedWeek) ?? minPlannedWeekNo
      const runway = ref != null ? planned.filter(w => w.week_number >= ref).length : planned.length
      const holiday = holidayInfo(a)
      const returned = holiday && !holiday.onHoliday // ferie slut → skal genaktiveres/planlægges
      let status
      if (holiday?.onHoliday) status = 'ferie'      // på ferie → uden for Prioritet
      else if (weeks.length === 0) status = 'none'
      else if (planned.length === 0) status = 'empty'
      else if (runway <= 0) status = 'out'         // forbi sidste planlagte uge = løbet tør
      else if (runway === 1) status = 'lastweek'   // i sidste planlagte uge, dækket ugen ud
      else status = 'ready'
      const snoozedUntil = snoozedAthletes[a.id] || null
      const isSnoozed = snoozedUntil && new Date(snoozedUntil) > today0
      return { a, status, runway, isSnoozed, returned }
    })
  }

  // Hop direkte ind i coachens egen atlet-profil (preview) for hurtig logging.
  // Første gang (eller hvis den gemte ikke findes): åbn picker i "vælg din egen"-mode.
  function goToMyProfile() {
    if (!onPreviewAthlete) return
    if (myAthleteId && athletes.some(a => a.id === myAthleteId)) {
      onPreviewAthlete(myAthleteId)
    } else {
      setPickingMine(true)
      setPreviewPickerOpen(true)
      setSidebarOpen(true)
    }
  }

  // Tastaturgenvej: tast "M" (uden for input-felter) → min profil.
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); goToMyProfile() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAthleteId, athletes])

  function deleteWeek(weekId) {
    askConfirm('Slet denne uge og alle dens træninger?', async () => {
      await supabase.from('weeks').delete().eq('id', weekId)
      if (openWeekId === weekId) setOpenWeekId(null)
      fetchWeeks(selectedAthlete.id)
    })
  }

  async function addSession(weekId) {
    const week = weeks.find(w => w.id === weekId)
    const nextOrder = week?.sessions?.length || 0
    await supabase.from('sessions').insert({
      week_id: weekId,
      title: sessionForm.title || 'Træning',
      session_order: nextOrder,
      weekday: sessionForm.weekday ?? null,
    })
    setAddingSession(null)
    setSessionForm({ title: '', weekday: null })
    fetchWeeks(selectedAthlete.id)
  }

  async function updateSession(sessionId) {
    await supabase.from('sessions').update({ title: sessionForm.title, weekday: sessionForm.weekday ?? null }).eq('id', sessionId)
    setEditingSession(null)
    fetchWeeks(selectedAthlete.id)
  }

  function deleteSession(sessionId) {
    askConfirm('Slet denne træning?', async () => {
      await supabase.from('sessions').delete().eq('id', sessionId)
      if (openSessionId === sessionId) setOpenSessionId(null)
      fetchWeeks(selectedAthlete.id)
    })
  }

  async function reorderSession(weekId, sessionId, direction) {
    const week = weeks.find(w => w.id === weekId)
    const sorted = [...(week?.sessions || [])].sort((a, b) => (a.session_order - b.session_order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const idx = sorted.findIndex(s => s.id === sessionId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return
    ;[sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]]
    // Renummerér HELE ugen fortløbende (0,1,2,...). Robust selv når flere dage
    // delte samme session_order — en simpel ombytning af to ens værdier ville
    // ellers ikke ændre noget (årsag til at logget-importerede uger sad fast).
    await Promise.all(sorted.map((sn, i) =>
      sn.session_order === i ? null : supabase.from('sessions').update({ session_order: i }).eq('id', sn.id)))
    fetchWeeks(selectedAthlete.id)
  }

  async function reorderExercise(sessionId, exerciseId, direction) {
    const session = weeks.flatMap(w => w.sessions || []).find(s => s.id === sessionId)
    const sorted = [...(session?.exercises || [])].sort((a, b) => (a.exercise_order - b.exercise_order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const idx = sorted.findIndex(e => e.id === exerciseId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return
    ;[sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]]
    // Samme robuste renummerering som for dage (mod dublerede exercise_order).
    await Promise.all(sorted.map((ex, i) =>
      ex.exercise_order === i ? null : supabase.from('exercises').update({ exercise_order: i }).eq('id', ex.id)))
    fetchWeeks(selectedAthlete.id)
  }

  async function copySessionToWeek(session, targetWeekId) {
    const targetWeek = weeks.find(w => w.id === targetWeekId)
    const nextOrder = targetWeek?.sessions?.length || 0
    const { data: newSession } = await supabase.from('sessions').insert({
      week_id: targetWeekId,
      title: session.title,
      session_order: nextOrder,
    }).select().single()
    if (!newSession) return
    for (const ex of (session.exercises || [])) {
      await supabase.from('exercises').insert({
        session_id: newSession.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        intensity: ex.intensity,
        note: ex.note,
        recommended_weight: ex.recommended_weight ?? null,
        exercise_order: ex.exercise_order,
      })
    }
    setCopyingSession(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function copyExerciseToSession(ex, targetSessionId) {
    const targetSession = weeks.flatMap(w => w.sessions || []).find(s => s.id === targetSessionId)
    const nextOrder = targetSession?.exercises?.length || 0
    await supabase.from('exercises').insert({
      session_id: targetSessionId,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      intensity: ex.intensity,
      note: ex.note,
      recommended_weight: ex.recommended_weight ?? null,
      exercise_order: nextOrder,
    })
    setCopyingExercise(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function fetchExerciseLibrary() {
    const { data } = await supabase.from('exercise_library').select('*').order('category').order('name')
    setExerciseLibrary(data || [])
  }

  async function addLibraryExercise() {
    if (!libraryAddForm.name.trim()) return
    await supabase.from('exercise_library').insert({
      coach_id: session.user.id,
      name: libraryAddForm.name.trim(),
      category: libraryAddForm.category || 'Accessory',
    })
    setAddingLibraryEx(false)
    setLibraryAddForm({ name: '', category: 'Accessory' })
    fetchExerciseLibrary()
  }

  async function updateLibraryExercise(id) {
    if (!libraryEditForm.name.trim()) return
    const oldName = exerciseLibrary.find(e => e.id === id)?.name
    const newName = libraryEditForm.name.trim()
    await supabase.from('exercise_library').update({ name: newName, category: libraryEditForm.category }).eq('id', id)
    if (oldName && oldName !== newName) {
      await supabase.from('exercises').update({ name: newName }).eq('name', oldName)
      await supabase.from('personal_records').update({ exercise_name: newName }).eq('exercise_name', oldName)
    }
    setEditingLibraryEx(null)
    fetchExerciseLibrary()
  }

  function deleteLibraryExercise(id) {
    askConfirm('Slet øvelse fra biblioteket?', async () => {
      await supabase.from('exercise_library').delete().eq('id', id)
      fetchExerciseLibrary()
    })
  }

  async function addToLibraryQuick(name) {
    await supabase.from('exercise_library').insert({
      coach_id: session.user.id,
      name,
      category: 'Accessory',
    })
    fetchExerciseLibrary()
  }

  function canonicalName(typed) {
    if (!typed.trim()) return typed
    const lower = typed.trim().toLowerCase()
    const match = exerciseLibrary.find(e => e.name.toLowerCase() === lower)
    return match ? match.name : typed.trim()
  }

  function buildIntensity() {
    const v = exerciseForm.intensity.trim()
    if (!v) return null
    if (exerciseForm.intensityPrefix === 'RPE') return `RPE ${v}`
    if (exerciseForm.intensityPrefix === '%') return `${v}%`
    // "Tid": coachen skriver bare et tal → gem som "N sek" (atlet-appens stopur
    // forstår det via parseDuration). Hvis coachen selv tilføjer enhed/tekst
    // (fx "30 pr side"), bevares det.
    if (exerciseForm.intensityPrefix === 'Tid') return /\d\s*(sek|sec|min|s)\b/i.test(v) ? v : `${v} sek`
    return v
  }

  function parseIntensity(stored) {
    if (!stored) return { intensityPrefix: 'RPE', intensity: '' }
    if (stored.startsWith('RPE ')) return { intensityPrefix: 'RPE', intensity: stored.slice(4) }
    if (stored.endsWith('%')) return { intensityPrefix: '%', intensity: stored.slice(0, -1) }
    // Ren "N sek" → vis igen som Tid med bare tallet
    const m = stored.match(/^(\d+)\s*sek$/i)
    if (m) return { intensityPrefix: 'Tid', intensity: m[1] }
    return { intensityPrefix: 'Fri tekst', intensity: stored }
  }

  async function addExercise(sessionId) {
    const week = weeks.find(w => w.sessions?.some(s => s.id === sessionId))
    const session = week?.sessions?.find(s => s.id === sessionId)
    const nextOrder = session?.exercises?.length || 0
    await supabase.from('exercises').insert({
      session_id: sessionId,
      name: canonicalName(exerciseForm.name) || 'Øvelse',
      sets: parseInt(exerciseForm.sets) || null,
      reps: exerciseForm.reps || null,
      intensity: buildIntensity(),
      note: exerciseForm.note || null,
      exercise_order: nextOrder,
    })
    setAddingExercise(null)
    setExerciseForm({ name: '', sets: '', reps: '', intensity: '', intensityPrefix: 'RPE', note: '' })
    fetchWeeks(selectedAthlete.id)
  }

  async function updateExercise(exerciseId) {
    await supabase.from('exercises').update({
      name: canonicalName(exerciseForm.name),
      sets: parseInt(exerciseForm.sets) || null,
      reps: exerciseForm.reps || null,
      intensity: buildIntensity(),
      note: exerciseForm.note || null,
    }).eq('id', exerciseId)
    setEditingExercise(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function deleteExercise(exerciseId) {
    await supabase.from('exercises').delete().eq('id', exerciseId)
    fetchWeeks(selectedAthlete.id)
  }

  async function saveRecommendedWeight(exerciseId) {
    const val = recommendedInput.trim() ? parseFloat(recommendedInput) : null
    const { error } = await supabase.from('exercises').update({ recommended_weight: val }).eq('id', exerciseId)
    if (error) { showFlash(`Kunne ikke gemme: ${error.message}`, 'error'); return }
    setEditingRecommended(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function copyWeek(weekId) {
    const week = weeks.find(w => w.id === weekId)
    if (!week) return
    const nextNum = Math.max(...weeks.map(w => w.week_number)) + 1
    const { data: newWeek } = await supabase.from('weeks').insert({
      athlete_id: selectedAthlete.id,
      week_number: nextNum,
      block_name: week.block_name,
      coach_note: week.coach_note,
      block_description: week.block_description,
    }).select().single()
    if (!newWeek) return
    for (const session of (week.sessions || [])) {
      const { data: newSession } = await supabase.from('sessions').insert({
        week_id: newWeek.id,
        title: session.title,
        session_order: session.session_order,
      }).select().single()
      if (newSession) {
        for (const ex of (session.exercises || [])) {
          await supabase.from('exercises').insert({
            session_id: newSession.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            intensity: ex.intensity,
            note: ex.note,
            exercise_order: ex.exercise_order,
          })
        }
      }
    }
    fetchWeeks(selectedAthlete.id)
    setOpenWeekId(newWeek.id)
  }

  async function fetchLatestMessages(athleteIds) {
    const { data } = await supabase.from('messages').select('*').in('athlete_id', athleteIds).order('created_at', { ascending: false })
    const latest = {}
    const unread = {}
    for (const msg of (data || [])) {
      if (!latest[msg.athlete_id]) latest[msg.athlete_id] = msg
      if (msg.sender_role === 'athlete' && !msg.read_by_coach) {
        unread[msg.athlete_id] = (unread[msg.athlete_id] || 0) + 1
      }
    }
    setLatestMessages(latest)
    setUnreadCounts(unread)
  }

  async function markMessagesRead(athleteId) {
    if (!unreadCounts[athleteId]) return
    await supabase.from('messages').update({ read_by_coach: true }).eq('athlete_id', athleteId).eq('sender_role', 'athlete').eq('read_by_coach', false)
    setUnreadCounts(prev => { const n = { ...prev }; delete n[athleteId]; return n })
  }

  async function fetchMessages(athleteId) {
    const { data } = await supabase.from('messages').select('*').eq('athlete_id', athleteId).order('created_at')
    setMessages(data || [])
  }

  async function sendCoachMessage() {
    if (!messageInput.trim() || !selectedAthlete) return
    await supabase.from('messages').insert({ athlete_id: selectedAthlete.id, sender_role: 'coach', content: messageInput.trim() })
    setMessageInput('')
    fetchMessages(selectedAthlete.id)
    fetchLatestMessages(athletes.map(a => a.id))
  }

  async function togglePin(messageId, currentPinned) {
    await supabase.from('messages').update({ pinned: !currentPinned }).eq('id', messageId)
    fetchMessages(selectedAthlete.id)
  }

  function formatMsgTime(ts) {
    const d = new Date(ts)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayDiff = Math.floor((today - msgDay) / 86400000)
    const time = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
    if (dayDiff === 0) return time
    if (dayDiff === 1) return `I går ${time}`
    if (dayDiff < 7) return d.toLocaleDateString('da-DK', { weekday: 'long' }) + ' ' + time
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) + ' ' + time
  }

  async function fetchAthleteLogs(athleteId) {
    const { data } = await supabase
      .from('exercise_logs')
      .select('id, set_number, weight, reps_completed, note, logged_at, rpe_actual, rpe_planned, skipped, exercise_id, exercises(id, name, sets, reps, intensity, recommended_weight, session_id, sessions(id, title, athlete_rating, athlete_comment, weeks(week_number, block_name)))')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .limit(ATHLETE_LOGS_LIMIT)
    setAthleteLogs(data || [])
  }

  async function fetchAthleteWeightLogs(athleteId) {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .limit(90)
    setAthleteWeightLogs(data || [])
  }

  async function fetchAthleteReadiness(athleteId) {
    const { data } = await supabase
      .from('readiness_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('logged_date', { ascending: false })
      .limit(90)
    setAthleteReadiness(data || [])
  }

  async function fetchAthletePRs(athleteId) {
    const { data } = await supabase
      .from('personal_records')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
    if (!data) { setAthletePRs([]); setAthletePRHistory([]); return }
    setAthletePRHistory(data)
    // Vis den tungeste registrering pr. øvelse som rekord — ikke blot den seneste —
    // så et lavere (fx stævne-)løft aldrig vises som aktuel rekord.
    const bestByName = {}
    for (const pr of data) {
      const cur = bestByName[pr.exercise_name]
      if (!cur || (pr.weight || 0) > (cur.weight || 0)) bestByName[pr.exercise_name] = pr
    }
    setAthletePRs(Object.values(bestByName))
  }

  async function fetchMeetResults(athleteId) {
    const { data } = await supabase
      .from('meet_results')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('meet_date', { ascending: false })
    setMeetResults(data || [])
  }

  async function fetchMeetPlan(athleteId) {
    const { data } = await supabase.from('meet_plans').select('*').eq('athlete_id', athleteId).maybeSingle()
    setMeetPlan(data || null)
    setMeetPlanForm({
      meet_type: data?.meet_type || 'sbd',
      squat1: data?.squat1 ?? '', squat2: data?.squat2 ?? '', squat3: data?.squat3 ?? '',
      bench1: data?.bench1 ?? '', bench2: data?.bench2 ?? '', bench3: data?.bench3 ?? '',
      dead1: data?.dead1 ?? '', dead2: data?.dead2 ?? '', dead3: data?.dead3 ?? '',
      notes: data?.notes || '',
    })
  }

  async function saveMeetPlan(athleteId) {
    setSavingMeetPlan(true)
    const payload = {
      athlete_id: athleteId,
      meet_type: meetPlanForm.meet_type,
      squat1: meetPlanForm.squat1 || null, squat2: meetPlanForm.squat2 || null, squat3: meetPlanForm.squat3 || null,
      bench1: meetPlanForm.bench1 || null, bench2: meetPlanForm.bench2 || null, bench3: meetPlanForm.bench3 || null,
      dead1: meetPlanForm.dead1 || null, dead2: meetPlanForm.dead2 || null, dead3: meetPlanForm.dead3 || null,
      notes: meetPlanForm.notes || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('meet_plans').upsert(payload, { onConflict: 'athlete_id' })
    await fetchMeetPlan(athleteId)
    setSavingMeetPlan(false)
  }

  async function fetchWarmupTemplates(athleteId) {
    const { data } = await supabase
      .from('warmup_templates')
      .select('*')
      .or(`athlete_id.eq.${athleteId},athlete_id.is.null`)
    setWarmupTemplates(data || [])
  }

  async function saveWarmupTemplate(category, steps, athleteId) {
    const existing = warmupTemplates.find(t => t.exercise_category === category && t.athlete_id === athleteId)
    if (existing) {
      await supabase.from('warmup_templates').update({ steps }).eq('id', existing.id)
    } else {
      await supabase.from('warmup_templates').insert({
        coach_id: session.user.id,
        athlete_id: athleteId,
        exercise_category: category,
        steps,
      })
    }
    fetchWarmupTemplates(selectedAthlete.id)
    setEditingWarmup(null)
    setWarmupNewStep('')
  }

  async function deleteWarmupTemplate(templateId) {
    await supabase.from('warmup_templates').delete().eq('id', templateId)
    fetchWarmupTemplates(selectedAthlete.id)
  }

  async function addAthlete() {
    if (!newAthlete.name.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('athletes').insert({
      coach_id: session.user.id,
      name: newAthlete.name,
      email: newAthlete.email,
      age: newAthlete.age ? parseInt(newAthlete.age) : null,
      weight_class: newAthlete.weightClass ? parseFloat(newAthlete.weightClass) : null,
      status: newAthlete.status,
    }).select().single()
    if (!error) {
      setAthletes(prev => [...prev, data])
      setShowAddModal(false)
      setNewAthlete({ name: '', email: '', age: '', weightClass: '', status: 'active' })
    }
    setSaving(false)
  }

  async function saveEdit() {
    setSaving(true)
    const payload = { ...editData }
    // Tomme dato-felter må ikke sendes som '' til date-kolonner (Postgres-fejl).
    for (const k of ['competition_date', 'vacation_until']) {
      if (payload[k] === '') payload[k] = null
    }
    // Rydder man feriedatoen mens status ikke er ferie, så nulstil den helt.
    if (payload.status && payload.status !== 'ferie') payload.vacation_until = null
    const { data, error } = await supabase.from('athletes').update(payload).eq('id', selectedAthlete.id).select().single()
    if (!error) {
      setSelectedAthlete(data)
      setAthletes(prev => prev.map(a => a.id === data.id ? data : a))
    }
    setEditing(null)
    setSaving(false)
  }

  // Åbn "Registrér stævneresultat"-modal; forudfyld fra atletens stævneplan hvis den findes.
  async function openMeetResult() {
    if (!selectedAthlete) return
    const { data: mp } = await supabase.from('meet_plans').select('*').eq('athlete_id', selectedAthlete.id).maybeSingle()
    const type = mp?.meet_type || 'sbd'
    const sbd = type === 'sbd'
    setMeetResultForm({
      meet_date: selectedAthlete.competition_date || new Date().toISOString().slice(0, 10),
      meet_name: '',
      contest: { squat: sbd, bench: true, deadlift: sbd },
      squat: mp?.squat3 ?? selectedAthlete.squat ?? '',
      bench: mp?.bench3 ?? selectedAthlete.bench ?? '',
      deadlift: mp?.dead3 ?? selectedAthlete.deadlift ?? '',
      bodyweight: '',
      notes: '',
      setOffseason: true,
      clearDate: true,
      newDate: '',
      savePR: true,
    })
  }

  async function saveMeetResult() {
    const f = meetResultForm
    if (!f || !selectedAthlete) return
    const picked = ['squat', 'bench', 'deadlift'].filter(k => f.contest[k])
    if (!picked.length) { showFlash('Vælg mindst ét løft', 'error'); return }
    setSaving(true)
    const vals = {}
    picked.forEach(k => { vals[k] = (f[k] === '' || f[k] == null) ? null : parseFloat(f[k]) })
    const total = picked.reduce((sum, k) => sum + (vals[k] || 0), 0)
    const meet_type = picked.length === 3 ? 'sbd' : picked.length === 1 ? picked[0] : 'custom'
    const { error: insErr } = await supabase.from('meet_results').insert({
      athlete_id: selectedAthlete.id,
      meet_date: f.meet_date,
      meet_name: f.meet_name.trim() || null,
      meet_type,
      squat: vals.squat ?? null, bench: vals.bench ?? null, deadlift: vals.deadlift ?? null,
      total: total || null,
      bodyweight: f.bodyweight ? parseFloat(f.bodyweight) : null,
      notes: f.notes.trim() || null,
    })
    if (insErr) { showFlash('Kunne ikke gemme resultat', 'error'); setSaving(false); return }
    // Opdater kun de konkurrerede løfts maks (+ status/dato) — og kun hvis det nye
    // resultat faktisk er tungere end atletens nuværende maks. Et lavere stævneløft
    // må ikke trumfe en eksisterende rekord.
    const upd = {}
    picked.forEach(k => { if (vals[k] != null && vals[k] > (parseFloat(selectedAthlete[k]) || 0)) upd[k] = vals[k] })
    if (f.setOffseason) upd.status = 'offseason'
    if (f.clearDate) upd.competition_date = null
    else if (f.newDate) upd.competition_date = f.newDate
    if (Object.keys(upd).length) {
      const { data: updated } = await supabase.from('athletes').update(upd).eq('id', selectedAthlete.id).select().single()
      if (updated) { setSelectedAthlete(updated); setAthletes(prev => prev.map(x => x.id === updated.id ? updated : x)) }
    }
    if (f.savePR) {
      const labelMap = { squat: 'Squat', bench: 'Bænkpres', deadlift: 'Dødløft' }
      const candidates = picked.filter(k => vals[k] != null)
      // Hent nuværende bedste pr. løft, så vi kun gemmer en PR hvis stævnet slår den.
      const { data: existingPRs } = await supabase
        .from('personal_records')
        .select('exercise_name, weight')
        .eq('athlete_id', selectedAthlete.id)
        .in('exercise_name', candidates.map(k => labelMap[k]))
      const bestByName = {}
      for (const pr of (existingPRs || [])) {
        bestByName[pr.exercise_name] = Math.max(bestByName[pr.exercise_name] || 0, pr.weight || 0)
      }
      const prRows = candidates
        .filter(k => vals[k] > (bestByName[labelMap[k]] || 0))
        .map(k => ({ athlete_id: selectedAthlete.id, exercise_name: labelMap[k], weight: vals[k], reps: 1, logged_at: f.meet_date }))
      if (prRows.length) await supabase.from('personal_records').insert(prRows)
    }
    await fetchMeetResults(selectedAthlete.id)
    await fetchAthletePRs(selectedAthlete.id)
    setMeetResultForm(null)
    setSaving(false)
    showFlash('Stævneresultat registreret', 'success')
  }

  function deleteMeetResult(id) {
    askConfirm('Slet dette stævneresultat?', async () => {
      await supabase.from('meet_results').delete().eq('id', id)
      setMeetResults(prev => prev.filter(m => m.id !== id))
      showFlash('Resultat slettet', 'success')
    })
  }

  async function deleteAthlete() {
    await supabase.from('athletes').delete().eq('id', selectedAthlete.id)
    setAthletes(prev => prev.filter(a => a.id !== selectedAthlete.id))
    setShowDeleteModal(false)
    setView('list')
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function generateAIReport(weeksBack) {
    const ath = selectedAthlete
    if (!ath) return

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - weeksBack * 7)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const fmtDato = str => new Date(str + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
    const fmtDatoShort = str => new Date(str + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
    const pad = (str, len) => String(str).padEnd(len)

    // Byg sessions fra athleteLogs
    const sessionMap = {}
    for (const log of athleteLogs) {
      const ex = log.exercises
      const sess = ex?.sessions
      const week = sess?.weeks
      const date = log.logged_at.slice(0, 10)
      if (date < cutoffStr) continue
      const key = `${ex?.session_id}_${date}`
      if (!sessionMap[key]) {
        sessionMap[key] = {
          date,
          title: sess?.title || 'Ukendt session',
          week_number: week?.week_number ?? null,
          block_name: week?.block_name ?? null,
          athlete_rating: sess?.athlete_rating ?? null,
          athlete_comment: sess?.athlete_comment ?? null,
          exercises: {},
        }
      }
      const exId = log.exercise_id
      if (!sessionMap[key].exercises[exId]) {
        sessionMap[key].exercises[exId] = {
          name: ex?.name ?? 'Ukendt øvelse',
          planned_sets: ex?.sets ?? null,
          planned_reps: ex?.reps ?? null,
          planned_intensity: ex?.intensity ?? null,
          planned_rpe_int: parsePlannedRpe(ex?.intensity), // fallback når sæt ikke har eget rpe_planned
          sets: [],
        }
      }
      sessionMap[key].exercises[exId].sets.push({
        set_number: log.set_number,
        weight: log.weight,
        reps: log.reps_completed,
        rpe_planned: log.rpe_planned,
        rpe_actual: log.rpe_actual,
        skipped: log.skipped,
      })
    }

    const sessions = Object.values(sessionMap).sort((a, b) => a.date.localeCompare(b.date))

    // Grupper sessions per uge
    const weekGroups = {}
    for (const sess of sessions) {
      const wk = sess.week_number ?? 'Ukendt'
      const wkKey = `${String(wk).padStart(3, '0')}_${sess.block_name || ''}`
      if (!weekGroups[wkKey]) weekGroups[wkKey] = { week_number: wk, block_name: sess.block_name, sessions: [] }
      weekGroups[wkKey].sessions.push(sess)
    }

    const periodStart = sessions.length ? fmtDatoShort(sessions[0].date) : '—'
    const periodEnd = sessions.length ? fmtDatoShort(sessions[sessions.length - 1].date) : '—'

    const filteredWeight = athleteWeightLogs.filter(l => l.logged_at >= cutoffStr).sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    const filteredReadiness = athleteReadiness.filter(l => l.logged_date >= cutoffStr).sort((a, b) => a.logged_date.localeCompare(b.logged_date))
    const filteredPRs = athletePRs.filter(l => (l.logged_at || '').slice(0, 10) >= cutoffStr).sort((a, b) => (a.logged_at || '').localeCompare(b.logged_at || ''))

    const avgWeight = filteredWeight.length ? (filteredWeight.reduce((s, l) => s + l.weight, 0) / filteredWeight.length).toFixed(1) : null

    // Nøgletal til AI-resumé
    let loggedSets = 0, skippedSets = 0, rpeSum = 0, rpeCount = 0, rpeDevSum = 0, rpeDevCount = 0
    for (const sess of sessions) {
      for (const ex of Object.values(sess.exercises)) {
        for (const set of ex.sets) {
          if (set.skipped) { skippedSets++; continue }
          loggedSets++
          if (set.rpe_actual != null) {
            rpeSum += Number(set.rpe_actual); rpeCount++
            const planRpe = set.rpe_planned ?? ex.planned_rpe_int
            if (planRpe != null) { rpeDevSum += Number(set.rpe_actual) - planRpe; rpeDevCount++ }
          }
        }
      }
    }
    const avgRpe = rpeCount ? (rpeSum / rpeCount).toFixed(1) : null
    const avgRpeDev = rpeDevCount ? (rpeDevSum / rpeDevCount) : null
    const weightsAsc = filteredWeight
    const weightStart = weightsAsc.length ? weightsAsc[0].weight : null
    const weightEnd = weightsAsc.length ? weightsAsc[weightsAsc.length - 1].weight : null
    const weightDelta = (weightStart != null && weightEnd != null) ? (weightEnd - weightStart).toFixed(1) : null
    const avgReadiness = filteredReadiness.length ? Math.round(filteredReadiness.reduce((s, r) => s + (r.readiness_score || 0), 0) / filteredReadiness.length) : null

    let lines = []

    // Instruktion til AI (så coachen bare kan paste og få en analyse)
    lines.push('INSTRUKTION TIL AI')
    lines.push('Du er en erfaren styrkeløftcoach (squat/bænk/dødløft). Nedenfor er rådata')
    lines.push('for én atlet over en periode. Svar på dansk, kortfattet og handlingsorienteret:')
    lines.push('  1) Fremgang & tendenser — vægt på stængerne, RPE vs. plan, est. 1RM-udvikling.')
    lines.push('  2) Restitution — mønstre i søvn/energi/motivation/stress/ømhed vs. præstation.')
    lines.push('  3) Røde flag — stagnation, høj RPE ved let vægt, lav konsistens, uønsket vægtændring.')
    lines.push('  4) Konkrete forslag til næste blok — volumen, intensitet, øvelsesvalg, evt. deload.')
    lines.push('Skalaer: energi/motivation/stress/ømhed = 1–5 · readiness-score = 0–100 · RPE = 6–10.')
    lines.push('Brug digest-tabellerne EST. 1RM-UDVIKLING og UGENTLIGT TONNAGE til fremgang/volumen;')
    lines.push('i træningsloggen betyder "RPE 8 (plan 7)" faktisk vs. planlagt RPE for sættet.')
    lines.push('Antag intet om data der ikke findes; nævn det hvis noget mangler.')
    lines.push('')

    lines.push('═══════════════════════════════════════════════════════')
    lines.push(`ATLET:    ${ath.name}`)
    lines.push(`PERIODE:  Seneste ${weeksBack} uger (${periodStart} – ${periodEnd})`)
    lines.push(``)
    const maxes = [
      ath.squat ? `Squat ${ath.squat}kg` : null,
      ath.bench ? `Bænk ${ath.bench}kg` : null,
      ath.deadlift ? `Dødløft ${ath.deadlift}kg` : null,
    ].filter(Boolean)
    if (maxes.length) lines.push(`KONKURRENCEMAXES: ${maxes.join(' | ')}`)
    const trainMaxes = [
      ath.training_squat ? `Squat ${ath.training_squat}kg` : null,
      ath.training_bench ? `Bænk ${ath.training_bench}kg` : null,
      ath.training_deadlift ? `Dødløft ${ath.training_deadlift}kg` : null,
    ].filter(Boolean)
    if (trainMaxes.length) lines.push(`TRÆNINGSMAXES:    ${trainMaxes.join(' | ')}`)
    if (ath.competition_date) lines.push(`STÆVNE:           ${fmtDato(ath.competition_date)}`)
    if (avgWeight) lines.push(`KROPSVÆGT:        ${avgWeight}kg gns (${filteredWeight.length} målinger)`)
    lines.push('═══════════════════════════════════════════════════════')
    lines.push('')

    // Nøgletal
    lines.push('── NØGLETAL (perioden) ─────────────────────────────────')
    lines.push('')
    lines.push(`  Træningspas:     ${sessions.length} over ${Object.keys(weekGroups).length} uger`)
    lines.push(`  Loggede sæt:     ${loggedSets}${skippedSets ? ` (+ ${skippedSets} skippet)` : ''}`)
    if (avgRpe) lines.push(`  Gns. RPE:        ${avgRpe}`)
    if (avgRpeDev != null) {
      const sign = avgRpeDev > 0 ? '+' : ''
      const tolk = avgRpeDev >= 0.5 ? ' (tungere end planlagt)' : avgRpeDev <= -0.5 ? ' (lettere end planlagt)' : ' (på plan)'
      lines.push(`  RPE vs. plan:    ${sign}${avgRpeDev.toFixed(1)}${tolk} · ${rpeDevCount} sæt m. plan`)
    }
    if (avgReadiness != null) lines.push(`  Gns. readiness:  ${avgReadiness}/100 (${filteredReadiness.length} check-ins)`)
    if (weightDelta != null) lines.push(`  Vægtudvikling:   ${weightStart}kg → ${weightEnd}kg (${weightDelta > 0 ? '+' : ''}${weightDelta}kg)`)
    lines.push('')

    // Afkortnings-advarsel: ramte vi fetch-grænsen, og er ældste hentede sæt nyere end
    // periodens start, så mangler de ældste uger i rapporten (lydløst datatab uden dette).
    const oldestLogged = athleteLogs.length ? athleteLogs[athleteLogs.length - 1].logged_at.slice(0, 10) : null
    if (athleteLogs.length >= ATHLETE_LOGS_LIMIT && oldestLogged && oldestLogged > cutoffStr) {
      lines.push(`⚠ BEMÆRK: træningsdata er afkortet ved ${ATHLETE_LOGS_LIMIT} sæt — log før ${fmtDatoShort(oldestLogged)} mangler. Vælg færre uger for fuld dækning.`)
      lines.push('')
    }

    // Est. 1RM-udvikling + ugentligt tonnage pr. hovedløft (digest før den rå log)
    const nameToCat = {}
    for (const ex of exerciseLibrary) { if (ex.name && ex.category) nameToCat[ex.name.toLowerCase()] = ex.category }
    const mainCats = [['Squat', 'Squat'], ['Bænk', 'Bænkpres'], ['Dødløft', 'Dødløft']]
    const epley = (w, r) => w * (1 + r / 30)
    const wkLbl = w => { const d = new Date(w + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }
    const isoMon = dateStr => {
      const d = new Date(dateStr + 'T12:00:00'); const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10)
    }
    const e1rmByCat = {}     // cat -> { date -> bedste e1RM }
    const tonByCatWeek = {}  // cat -> { mandagsnøgle -> kg-volumen }
    const weekKeysSet = new Set()
    for (const sess of sessions) {
      for (const ex of Object.values(sess.exercises)) {
        const cat = nameToCat[ex.name.toLowerCase()]
        if (!cat) continue
        for (const set of ex.sets) {
          if (set.skipped || !set.weight || !set.reps) continue
          const e = epley(Number(set.weight), Number(set.reps))
          if (!e1rmByCat[cat]) e1rmByCat[cat] = {}
          if (!(sess.date in e1rmByCat[cat]) || e > e1rmByCat[cat][sess.date]) e1rmByCat[cat][sess.date] = e
          const wk = isoMon(sess.date)
          weekKeysSet.add(wk)
          if (!tonByCatWeek[cat]) tonByCatWeek[cat] = {}
          tonByCatWeek[cat][wk] = (tonByCatWeek[cat][wk] || 0) + Number(set.weight) * Number(set.reps)
        }
      }
    }

    const e1rmLines = []
    for (const [lbl, cat] of mainCats) {
      const m = e1rmByCat[cat]
      if (!m) continue
      const dates = Object.keys(m).sort()
      const pts = dates.map(d => `${Math.round(m[d])} (${fmtDatoShort(d)})`)
      const first = Math.round(m[dates[0]]), last = Math.round(m[dates[dates.length - 1]])
      const delta = last - first, pct = first ? Math.round((delta / first) * 100) : 0
      const trend = dates.length > 1 ? `   Δ ${delta > 0 ? '+' : ''}${delta}kg (${pct > 0 ? '+' : ''}${pct}%)` : ''
      e1rmLines.push(`  ${pad(lbl, 10)}${pts.join(' · ')}${trend}`)
    }
    if (e1rmLines.length) {
      lines.push('── EST. 1RM-UDVIKLING (Epley, bedste sæt pr. dag) ──────')
      lines.push('')
      lines.push(...e1rmLines)
      lines.push('')
    }

    const weekKeys = [...weekKeysSet].sort()
    if (weekKeys.length && Object.keys(tonByCatWeek).length) {
      lines.push('── UGENTLIGT TONNAGE (tons = vægt × reps / 1000) ───────')
      lines.push('')
      lines.push(`  ${pad('', 10)}${weekKeys.map(w => pad(wkLbl(w), 7)).join('')}`)
      for (const [lbl, cat] of mainCats) {
        const m = tonByCatWeek[cat]
        if (!m) continue
        lines.push(`  ${pad(lbl, 10)}${weekKeys.map(w => pad(m[w] != null ? (Math.round(m[w] / 100) / 10).toFixed(1) : '—', 7)).join('')}`)
      }
      lines.push('')
    }

    // Træningslog
    lines.push('── TRÆNINGSLOG ─────────────────────────────────────────')
    lines.push('')

    if (Object.keys(weekGroups).length === 0) {
      lines.push('Ingen træningslog i perioden.')
    } else {
      for (const wkKey of Object.keys(weekGroups).sort()) {
        const wg = weekGroups[wkKey]
        lines.push(`Uge ${wg.week_number}${wg.block_name ? ` — ${wg.block_name}` : ''}`)
        for (const sess of wg.sessions) {
          const ratingStr = sess.athlete_rating ? ` [Rating: ${sess.athlete_rating}/5]` : ' [Ikke rated]'
          lines.push(`  ▸ ${sess.title} [${fmtDatoShort(sess.date)}]${ratingStr}`)
          if (sess.athlete_comment) lines.push(`    Kommentar: "${sess.athlete_comment}"`)
          for (const ex of Object.values(sess.exercises)) {
            const planStr = [
              ex.planned_sets && ex.planned_reps ? `${ex.planned_sets}×${ex.planned_reps}` : null,
              ex.planned_intensity ? `@${ex.planned_intensity}` : null,
            ].filter(Boolean).join(' ')
            lines.push(`    ${pad(ex.name, 24)}${planStr ? `Plan: ${planStr}` : ''}`)
            const sortedSets = ex.sets.sort((a, b) => a.set_number - b.set_number)
            for (const set of sortedSets) {
              if (set.skipped) {
                lines.push(`      Sæt ${set.set_number}: [skippet]`)
              } else {
                const planRpe = set.rpe_planned ?? ex.planned_rpe_int
                const rpeStr = set.rpe_actual != null
                  ? `  RPE ${set.rpe_actual}${planRpe != null ? ` (plan ${planRpe})` : ''}`
                  : (planRpe != null ? `  RPE plan ${planRpe}` : '')
                lines.push(`      Sæt ${set.set_number}: ${set.weight}kg × ${set.reps}${rpeStr}`)
              }
            }
          }
        }
        lines.push('')
      }
    }

    // PRs i perioden
    if (filteredPRs.length > 0) {
      lines.push('── PERSONLIGE REKORDER (i perioden) ────────────────────')
      lines.push('')
      for (const pr of filteredPRs) {
        lines.push(`  ${pad(pr.exercise_name, 20)} ${pr.weight}kg × ${pr.reps}  (${fmtDatoShort(pr.logged_at.slice(0, 10))})`)
      }
      lines.push('')
    }

    // Readiness
    if (filteredReadiness.length > 0) {
      lines.push('── READINESS (energi/motiv./stress/ømhed = 1–5) ────────')
      lines.push('')
      lines.push(`  ${pad('Dato', 10)}${pad('Søvn', 7)}${pad('Energi', 8)}${pad('Motiv.', 8)}${pad('Stress', 8)}${pad('Ømhed', 8)}Score`)
      for (const r of filteredReadiness) {
        lines.push(`  ${pad(fmtDatoShort(r.logged_date), 10)}${pad(r.sleep_hours != null ? r.sleep_hours + 't' : '—', 7)}${pad(r.energy != null ? r.energy + '/5' : '—', 8)}${pad(r.motivation != null ? r.motivation + '/5' : '—', 8)}${pad(r.stress != null ? r.stress + '/5' : '—', 8)}${pad(r.soreness_level != null ? r.soreness_level + '/5' : '—', 8)}${r.readiness_score != null ? r.readiness_score + '/100' : '—'}`)
      }
      const zoneCounts = {}
      for (const r of filteredReadiness) for (const z of (r.sore_zones || [])) zoneCounts[z] = (zoneCounts[z] || 0) + 1
      const zones = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])
      if (zones.length) {
        lines.push('')
        lines.push(`  Hyppigste ømme zoner: ${zones.map(([z, n]) => `${z} (${n}x)`).join(', ')}`)
      }
      // Korrelations-hint: gns. RPE på lav-readiness-dage (<50) vs. gode dage (≥75).
      // Samme dato-tærskler som atlet-appens readinessSignal. Viser om træning føles
      // tungere når atleten er upklar → input til restitutions-vurdering (pkt. 2).
      const readinessByDate = {}
      for (const r of filteredReadiness) if (r.readiness_score != null) readinessByDate[r.logged_date] = r.readiness_score
      let lowRpeSum = 0, lowRpeN = 0, hiRpeSum = 0, hiRpeN = 0
      for (const sess of sessions) {
        const score = readinessByDate[sess.date]
        if (score == null) continue
        for (const ex of Object.values(sess.exercises)) {
          for (const set of ex.sets) {
            if (set.skipped || set.rpe_actual == null) continue
            if (score < 50) { lowRpeSum += Number(set.rpe_actual); lowRpeN++ }
            else if (score >= 75) { hiRpeSum += Number(set.rpe_actual); hiRpeN++ }
          }
        }
      }
      if (lowRpeN >= 2 && hiRpeN >= 2) {
        const lowAvg = (lowRpeSum / lowRpeN).toFixed(1), hiAvg = (hiRpeSum / hiRpeN).toFixed(1)
        const diff = (lowRpeSum / lowRpeN) - (hiRpeSum / hiRpeN)
        const tolk = diff >= 0.5 ? ' → træning føles tungere på upklare dage' : diff <= -0.5 ? ' → træning føles lettere på upklare dage (uventet)' : ' → ingen tydelig forskel'
        lines.push('')
        lines.push(`  RPE vs. readiness: ${lowAvg} på lav-readiness-dage (<50, ${lowRpeN} sæt) vs. ${hiAvg} på gode dage (≥75, ${hiRpeN} sæt)${tolk}`)
      }
      lines.push('')
    }

    // Vægt
    if (filteredWeight.length > 0) {
      lines.push('── KROPSVÆGT ───────────────────────────────────────────')
      lines.push('')
      for (const w of filteredWeight) {
        lines.push(`  ${fmtDatoShort(w.logged_at)}   ${w.weight}kg`)
      }
      lines.push('')
    }

    // Stævnehistorik
    if (meetResults.length > 0) {
      lines.push('── STÆVNEHISTORIK ──────────────────────────────────────')
      lines.push('')
      for (const m of [...meetResults].reverse()) {
        const parts = [
          m.squat != null ? `S ${m.squat}` : null,
          m.bench != null ? `B ${m.bench}` : null,
          m.deadlift != null ? `D ${m.deadlift}` : null,
        ].filter(Boolean).join(' / ')
        lines.push(`  ${pad(fmtDatoShort(m.meet_date), 12)}${pad(m.meet_name || '—', 22)}${parts}${m.total != null ? `  = ${m.total}kg` : ''}`)
      }
      lines.push('')
    }

    lines.push('═══════════════════════════════════════════════════════')

    setAiExportText(lines.join('\n'))
  }

  async function exportTraeningsdata() {
    setExportingTraening(true)
    const dateStr = new Date().toISOString().slice(0, 10)
    const { data: allAthletes } = await supabase.from('athletes').select('*').order('name')
    const result = { exported_at: new Date().toISOString(), athletes: [] }

    for (const ath of (allAthletes || [])) {
      const [prsRes, readRes, wgtRes, logsRes] = await Promise.all([
        supabase.from('personal_records').select('*').eq('athlete_id', ath.id).order('logged_at'),
        supabase.from('readiness_logs').select('*').eq('athlete_id', ath.id).order('logged_date'),
        supabase.from('weight_logs').select('*').eq('athlete_id', ath.id).order('logged_at'),
        supabase.from('exercise_logs')
          .select('*, exercises(id, name, sets, reps, intensity, session_id, sessions(id, title, athlete_rating, athlete_comment, weeks(week_number, block_name)))')
          .eq('athlete_id', ath.id)
          .order('logged_at'),
      ])

      const sessionDays = {}
      for (const log of (logsRes.data || [])) {
        const ex = log.exercises
        const sess = ex?.sessions
        const date = log.logged_at.slice(0, 10)
        const key = `${ex?.session_id}_${date}`
        if (!sessionDays[key]) {
          sessionDays[key] = {
            date,
            title: sess?.title || '',
            week_number: sess?.weeks?.week_number ?? null,
            block_name: sess?.weeks?.block_name ?? null,
            athlete_rating: sess?.athlete_rating ?? null,
            athlete_comment: sess?.athlete_comment ?? null,
            exerciseMap: {},
          }
        }
        const exId = log.exercise_id
        if (!sessionDays[key].exerciseMap[exId]) {
          sessionDays[key].exerciseMap[exId] = {
            name: ex?.name ?? null,
            category: exerciseLibrary.find(e => e.name.toLowerCase() === (ex?.name || '').toLowerCase())?.category ?? null,
            planned_sets: ex?.sets ?? null,
            planned_reps: ex?.reps ?? null,
            planned_intensity: ex?.intensity ?? null,
            logs: [],
          }
        }
        sessionDays[key].exerciseMap[exId].logs.push({
          set_number: log.set_number,
          weight: log.weight,
          reps_completed: log.reps_completed,
          rpe_planned: log.rpe_planned,
          rpe_actual: log.rpe_actual,
          skipped: log.skipped,
          note: log.note,
        })
      }

      const sessions = Object.values(sessionDays)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(({ exerciseMap, ...rest }) => ({
          ...rest,
          exercises: Object.values(exerciseMap).map(ex => ({
            ...ex,
            logs: ex.logs.sort((a, b) => a.set_number - b.set_number),
          })),
        }))

      result.athletes.push({
        name: ath.name,
        email: ath.email,
        weight_class: ath.weight_class,
        age: ath.age,
        personal_records: (prsRes.data || []).map(pr => ({ exercise_name: pr.exercise_name, weight: pr.weight, reps: pr.reps, logged_at: pr.logged_at })),
        readiness_logs: (readRes.data || []).map(r => ({ logged_date: r.logged_date, sleep_hours: r.sleep_hours, energy: r.energy, motivation: r.motivation, stress: r.stress, soreness_level: r.soreness_level, sore_zones: r.sore_zones, readiness_score: r.readiness_score })),
        weight_logs: (wgtRes.data || []).map(w => ({ weight: w.weight, logged_at: w.logged_at })),
        sessions,
      })
    }

    downloadJSON(result, `entropi-traening-${dateStr}`)
    setExportingTraening(false)
  }

  async function exportBackup() {
    setExportingBackup(true)
    const dateStr = new Date().toISOString().slice(0, 10)
    const tables = ['athletes', 'weeks', 'sessions', 'exercises', 'exercise_logs', 'meal_logs', 'weight_logs', 'readiness_logs', 'personal_records', 'messages', 'meet_plans', 'warmup_templates', 'exercise_library', 'custom_foods', 'meal_templates']
    const backup = { exported_at: new Date().toISOString(), tables: {} }
    for (const table of tables) {
      const { data } = await supabase.from(table).select('*')
      backup.tables[table] = data || []
    }
    downloadJSON(backup, `entropi-backup-${dateStr}`)
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ last_backup_at: now }).eq('id', session.user.id)
    setLastBackup(now)
    setExportingBackup(false)
  }

  // Man lander altid på Home/hub når en atlet åbnes — uanset hvor man klikker
  // fra (sidebar, prioritets-liste, beskeder osv.). Hubben er den faste indgang.
  function openProfile(athlete) {
    setSelectedAthlete(athlete)
    setActiveTab('hub')
    setEditing(null)
    setView('profile')
    setMessages([])
    setMessageInput('')
    setWeeks([])
    setAthleteWeightLogs([])
    setOpenWeekId(null)
    setProgramBlockStart(null)
    setOpenSessionId(null)
    setAddingWeek(false)
    setAddingSession(null)
    setAddingExercise(null)
    setEditingWeek(null)
    setEditingSession(null)
    setEditingExercise(null)
  }

  function startEdit(section, data) {
    setEditing(section)
    setEditData(data)
  }

  const a = selectedAthlete
  const total = a ? (a.squat || 0) + (a.bench || 0) + (a.deadlift || 0) : 0
  const trainingTotal = a ? (a.training_squat || 0) + (a.training_bench || 0) + (a.training_deadlift || 0) : 0

  const currentWeight = (() => {
    if (!athleteWeightLogs.length) return null
    const recent = athleteWeightLogs.slice(0, 5).map(l => l.weight)
    if (recent.length >= 5) {
      const sorted = [...recent].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    return Math.round((recent.reduce((s, v) => s + v, 0) / recent.length) * 10) / 10
  })()

  const weightTrend = (() => {
    if (athleteWeightLogs.length < 2) return null
    const now = new Date()
    const d7 = new Date(now); d7.setDate(now.getDate() - 7)
    const d14 = new Date(now); d14.setDate(now.getDate() - 14)
    const thisWeek = athleteWeightLogs.filter(l => new Date(l.logged_at) >= d7).map(l => l.weight)
    const prevWeek = athleteWeightLogs.filter(l => { const d = new Date(l.logged_at); return d >= d14 && d < d7 }).map(l => l.weight)
    if (!thisWeek.length || !prevWeek.length) return null
    const thisAvg = thisWeek.reduce((s, v) => s + v, 0) / thisWeek.length
    const prevAvg = prevWeek.reduce((s, v) => s + v, 0) / prevWeek.length
    return Math.round((thisAvg - prevAvg) * 10) / 10
  })()

  const lastLogPerExercise = {}
  for (const log of athleteLogs) {
    const name = log.exercises?.name
    if (name && (log.weight > 0 || log.reps_completed > 0)) {
      if (!lastLogPerExercise[name]) lastLogPerExercise[name] = []
      lastLogPerExercise[name].push({ weight: log.weight, reps_completed: log.reps_completed, logged_at: log.logged_at })
    }
  }

  function repZone(r) {
    const n = parseInt(r) || 0
    if (n <= 3) return 0
    if (n <= 6) return 1
    if (n <= 10) return 2
    return 3
  }

  function bestLog(name, plannedReps) {
    const logs = lastLogPerExercise[name]
    if (!logs?.length) return null
    const planned = parseInt(plannedReps) || 0
    if (planned > 0) {
      const zone = repZone(planned)
      const sameZone = logs.filter(l => repZone(l.reps_completed) === zone)
      if (sameZone.length > 0) return sameZone[0]
    }
    return logs[0]
  }

  // Delt ugedags-vælger (bruges i både rediger- og tilføj-session-formen).
  const weekdayPicker = (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={s.fieldLabel}>Fast ugedag (valgfri)</div>
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
        {WEEKDAYS_SHORT.map((d, i) => {
          const active = sessionForm.weekday === i
          return (
            <button key={i} onClick={() => setSessionForm(p => ({ ...p, weekday: active ? null : i }))}
              style={{ ...s.btnSm, fontSize: '0.55rem', padding: '0.25rem 0.5rem', background: active ? 'rgba(200,146,58,0.18)' : 'transparent', borderColor: active ? '#c8923a' : 'rgba(237,234,226,0.12)', color: active ? '#c8923a' : '#7a7770' }}>{d}</button>
          )
        })}
        <button onClick={() => setSessionForm(p => ({ ...p, weekday: null }))}
          style={{ ...s.btnSm, fontSize: '0.55rem', padding: '0.25rem 0.5rem', background: 'transparent', borderColor: sessionForm.weekday == null ? '#c8923a' : 'rgba(237,234,226,0.12)', color: sessionForm.weekday == null ? '#c8923a' : '#7a7770' }}>Ingen</button>
      </div>
    </div>
  )

  const exFormRow = (() => {
    const searchLower = (exerciseForm.name || '').toLowerCase()
    const grouped = {}
    for (const ex of exerciseLibrary) {
      const cat = ex.category || 'Andet'
      if (!grouped[cat]) grouped[cat] = []
      if (ex.name.toLowerCase().includes(searchLower)) grouped[cat].push(ex)
    }
    const competitionOrder = ['Squat', 'Bænkpres', 'Dødløft']
    const filteredCategories = Object.entries(grouped)
      .filter(([, exs]) => exs.length > 0)
      .sort(([a], [b]) => {
        const ai = competitionOrder.indexOf(a)
        const bi = competitionOrder.indexOf(b)
        if (ai !== -1 && bi !== -1) return ai - bi
        if (ai !== -1) return -1
        if (bi !== -1) return 1
        return a.localeCompare(b)
      })
    const exactMatch = exerciseLibrary.some(e => e.name.toLowerCase() === searchLower && searchLower !== '')
    const showDropdown = exerciseSearchOpen && (filteredCategories.length > 0 || (exerciseForm.name.trim() && !exactMatch))

    return (
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 0.5fr 0.7fr minmax(200px, 2fr) 1.5fr', gap: '0.5rem', alignItems: 'end' }}>
        <div style={{ position: 'relative' }}>
          <div style={s.fieldLabel}>Navn</div>
          <input
            style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
            type="text"
            placeholder="Søg øvelse..."
            value={exerciseForm.name}
            autoComplete="off"
            onChange={e => { setExerciseForm(p => ({ ...p, name: e.target.value })); setExerciseSearchOpen(true) }}
            onFocus={() => setExerciseSearchOpen(true)}
            onBlur={() => setTimeout(() => setExerciseSearchOpen(false), 180)}
          />
          {exerciseForm.name.trim() && !exactMatch && !exerciseSearchOpen && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#c8923a', marginTop: '0.2rem', letterSpacing: '0.06em' }}>
              Ikke i bibliotek — tilføj via dropdown
            </div>
          )}
          {showDropdown && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', borderTop: 'none', zIndex: 100, maxHeight: '240px', overflowY: 'auto' }}>
              {filteredCategories.map(([cat, exs]) => (
                <div key={cat}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a', padding: '0.3rem 0.6rem 0.15rem', background: 'rgba(14,14,10,0.7)', position: 'sticky', top: 0 }}>{cat}</div>
                  {exs.map(ex => (
                    <div
                      key={ex.id}
                      onMouseDown={e => { e.preventDefault(); setExerciseForm(p => ({ ...p, name: ex.name })); setExerciseSearchOpen(false) }}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: '#b8b4a8', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(237,234,226,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >{ex.name}</div>
                  ))}
                </div>
              ))}
              {exerciseForm.name.trim() && !exactMatch && (
                <div
                  onMouseDown={e => { e.preventDefault(); addToLibraryQuick(exerciseForm.name.trim()); setExerciseSearchOpen(false) }}
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.68rem', color: '#c8923a', cursor: 'pointer', borderTop: '1px solid rgba(237,234,226,0.07)', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.06em' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,146,58,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >+ Tilføj "{exerciseForm.name.trim()}" til bibliotek</div>
              )}
            </div>
          )}
        </div>
        {[['Sæt', 'sets', 'number'], ['Reps', 'reps', 'text']].map(([label, key, type]) => (
          <div key={key}>
            <div style={s.fieldLabel}>{label}</div>
            <input
              style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
              type={type}
              placeholder={label}
              value={exerciseForm[key]}
              onChange={e => setExerciseForm(p => ({ ...p, [key]: e.target.value }))}
            />
          </div>
        ))}
        <div>
          <div style={s.fieldLabel}>Intensitet</div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <select
              style={{ ...s.fieldInput, fontSize: '0.72rem', padding: '0.4rem 0.3rem', width: 'auto', flexShrink: 0, cursor: 'pointer' }}
              value={exerciseForm.intensityPrefix}
              onChange={e => setExerciseForm(p => ({ ...p, intensityPrefix: e.target.value }))}
            >
              <option value="RPE">RPE</option>
              <option value="%">%</option>
              <option value="Tid">Tid</option>
              <option value="Fri tekst">Fri</option>
            </select>
            <input
              style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem', flex: 1, minWidth: 0 }}
              type={exerciseForm.intensityPrefix === 'Fri tekst' ? 'text' : 'number'}
              placeholder={exerciseForm.intensityPrefix === 'RPE' ? 'f.eks. 8' : exerciseForm.intensityPrefix === '%' ? 'f.eks. 80' : exerciseForm.intensityPrefix === 'Tid' ? 'sek, f.eks. 20' : 'tekst...'}
              value={exerciseForm.intensity}
              onChange={e => setExerciseForm(p => ({ ...p, intensity: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <div style={s.fieldLabel}>Note</div>
          <input
            style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
            type="text"
            placeholder="Note"
            value={exerciseForm.note}
            onChange={e => setExerciseForm(p => ({ ...p, note: e.target.value }))}
          />
        </div>
      </div>
    )
  })()

  return (
    <div style={s.wrap}>
      {/* Toast */}
      {flash && (
        <div style={{
          position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c18', border: `1px solid ${flash.kind === 'error' ? 'rgba(224,85,85,0.55)' : 'rgba(200,146,58,0.55)'}`,
          padding: '0.65rem 1.4rem', zIndex: 10000, maxWidth: '90vw',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.06em',
          color: flash.kind === 'error' ? '#e05555' : '#c8923a', boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>{flash.message}</div>
      )}
      {/* Bekræftelses-modal */}
      {confirmDialog && (
        <div onClick={() => setConfirmDialog(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,8,0.6)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', padding: '1.5rem', maxWidth: '360px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: '0.95rem', color: '#edeae2', lineHeight: 1.5, marginBottom: '1.25rem' }}>{confirmDialog.message}</div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setConfirmDialog(null)}>Annuller</button>
              <button style={{ ...s.btnPrimary, background: '#e05555', borderColor: '#e05555', color: '#141410' }} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn && fn() }}>Bekræft</button>
            </div>
          </div>
        </div>
      )}
      {isMobile && (
        <style>{`
          button { min-height: 44px !important; }
          input, select, textarea { font-size: 16px !important; }
        `}</style>
      )}
      {isMobile && sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 199 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside style={{
        ...s.sidebar,
        ...(isMobile ? {
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          zIndex: 200,
        } : {}),
      }}>
        <div style={{ ...s.sidebarLogo, cursor: 'pointer' }} onClick={() => { setView('list'); setSelectedAthlete(null); setSidebarOpen(false) }}>
          <div style={s.wordmark}>Entropi<span style={{ color: '#c8923a' }}>.</span></div>
          <div style={s.sub}>Coach Portal</div>
        </div>
        <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {[
            { icon: '⌂', label: 'Forside', active: view === 'list', onClick: () => { setView('list'); setSelectedAthlete(null); setSidebarOpen(false) } },
            { icon: '⚡', label: 'Min træning', active: false, onClick: () => { setSidebarOpen(false); goToMyProfile() } },
            { icon: '📅', label: 'Kalender', active: view === 'calendar', onClick: () => { setView('calendar'); setSelectedAthlete(null); setSidebarOpen(false) } },
            { icon: '📚', label: 'Bibliotek', active: view === 'library', onClick: () => { setView('library'); setSelectedAthlete(null); setSidebarOpen(false) } },
          ].map(item => (
            <div
              key={item.label}
              onClick={item.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 1.25rem', cursor: 'pointer', borderLeft: item.active ? '2px solid #c8923a' : '2px solid transparent', background: item.active ? 'rgba(200,146,58,0.08)' : 'transparent', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: item.active ? '#c8923a' : '#b8b4a8' }}
              onMouseEnter={e => { if (!item.active) e.currentTarget.style.background = 'rgba(237,234,226,0.03)' }}
              onMouseLeave={e => { if (!item.active) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: '0.85rem', width: '1rem', textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>{item.label}
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(237,234,226,0.06)', margin: '0.6rem 1.25rem' }} />
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', padding: '0 1.25rem', marginBottom: '0.35rem' }}>Atleter</div>
          {athletes.filter(a => !hiddenAthleteIds.has(a.id)).map(ath => {
            const isActive = (view === 'profile' || view === 'list') && selectedAthlete?.id === ath.id
            const unread = unreadCounts[ath.id] || 0
            const ws = athleteWeekSummary[ath.id]
            return (
              <div
                key={ath.id}
                onClick={() => { openProfile(ath); setSidebarOpen(false) }}
                style={{ padding: '0.55rem 1.25rem', cursor: 'pointer', borderLeft: isActive ? '2px solid #c8923a' : '2px solid transparent', background: isActive ? 'rgba(200,146,58,0.08)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(237,234,226,0.03)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: isActive ? '#c8923a' : '#b8b4a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ath.name.split(' ')[0]}</div>
                  {ws ? (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: ws.session_count > 0 ? '#6cba6c' : '#7a7770', marginTop: '0.1rem', letterSpacing: '0.04em' }}>
                      {ws.session_count > 0 ? `uge ${ws.week_number} · ${ws.session_count} sess` : `uge ${ws.week_number} · ingen sess`}
                    </div>
                  ) : (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', marginTop: '0.1rem' }}>ingen program</div>
                  )}
                </div>
                {unread > 0 && (
                  <span style={{ background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', fontWeight: 700, borderRadius: '999px', padding: '0.1rem 0.35rem', flexShrink: 0 }}>{unread}</span>
                )}
              </div>
            )
          })}
          {athletes.length === 0 && (
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', padding: '0.5rem 1.25rem' }}>Ingen atleter</div>
          )}
        </nav>
        <div style={s.sidebarFooter}>
          <div style={{ color: '#7a7770', marginBottom: '0.3rem' }}>Marc Schlichting</div>
          <div style={{ fontSize: '0.7rem' }}>{session.user.email}</div>
          {onPreviewAthlete && !previewPickerOpen && (
            <button
              onClick={() => { setPickingMine(false); setPreviewPickerOpen(true) }}
              style={{ ...s.btnPrimary, marginTop: '0.75rem', width: '100%' }}
            >Se som atlet</button>
          )}
          {onPreviewAthlete && previewPickerOpen && (
            <div style={{ marginTop: '0.75rem', background: '#141410', border: '1px solid rgba(200,146,58,0.3)', padding: '0.5rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.4rem' }}>{pickingMine ? 'Vælg din egen profil (huskes)' : 'Vælg profil'}</div>
              {athletes.map(a => (
                <div
                  key={a.id}
                  onClick={() => { setPreviewPickerOpen(false); if (pickingMine) { localStorage.setItem('entropi_my_athlete_id', a.id); setMyAthleteId(a.id); setPickingMine(false) } onPreviewAthlete(a.id) }}
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', color: '#b8b4a8', cursor: 'pointer', borderRadius: '1px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(237,234,226,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{a.name}</div>
              ))}
              <button onClick={() => { setPreviewPickerOpen(false); setPickingMine(false) }} style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', width: '100%' }}>Annuller</button>
            </div>
          )}
          <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <button
              onClick={exportTraeningsdata}
              disabled={exportingTraening}
              style={{ background: 'transparent', color: exportingTraening ? '#4a4844' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(237,234,226,0.08)', padding: '0.35rem 0.6rem', cursor: exportingTraening ? 'default' : 'pointer', width: '100%', textAlign: 'left' }}
            >{exportingTraening ? '...' : '↓ Træningsdata'}</button>
            <button
              onClick={exportBackup}
              disabled={exportingBackup}
              style={{ background: 'transparent', color: exportingBackup ? '#4a4844' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(237,234,226,0.08)', padding: '0.35rem 0.6rem', cursor: exportingBackup ? 'default' : 'pointer', width: '100%', textAlign: 'left' }}
            >{exportingBackup ? '...' : '↓ Sikkerhedskopi'}</button>
            {(() => {
              const days = lastBackup ? Math.floor((Date.now() - new Date(lastBackup)) / 86400000) : null
              const stale = days == null || days >= 7
              return (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.04em', color: stale ? '#c8923a' : '#4a4844', paddingLeft: '0.1rem' }}>
                  {days == null ? '⚠ aldrig taget — husk at gemme i din Drive'
                    : days === 0 ? '✓ taget i dag'
                    : stale ? `⚠ ${days} dage siden — tag en ny`
                    : `✓ ${days} dage siden`}
                </div>
              )
            })()}
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ ...s.btnGhost, marginTop: '0.5rem', width: '100%' }}>Log ud</button>
        </div>
      </aside>

      <main style={{ ...s.main, ...(isMobile ? { marginLeft: 0, overflowX: 'hidden' } : {}) }}>
        <div style={s.topbar}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a7770', padding: '0.25rem', display: 'flex', alignItems: 'center', marginRight: '0.75rem' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </svg>
            </button>
          )}
          <div style={{ ...s.topbarTitle, flex: 1 }}>{view === 'library' ? 'Øvelsesbibliotek' : view === 'calendar' ? 'Kalender' : view === 'list' ? 'Atleter' : a?.name}</div>
          {onPreviewAthlete && (
            <button
              onClick={goToMyProfile}
              title="Min træning — hop til din egen profil (tast M)"
              style={{ ...s.btnPrimary, fontSize: '0.55rem', padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}
            >⚡ Min træning</button>
          )}
        </div>

        {/* LIBRARY VIEW */}
        {view === 'library' && (() => {
          const searchLower = librarySearch.toLowerCase()
          const filteredLib = exerciseLibrary.filter(e =>
            e.name.toLowerCase().includes(searchLower) || (e.category || '').toLowerCase().includes(searchLower)
          )
          const libCategories = [...new Set(filteredLib.map(e => e.category || 'Andet'))].sort()
          const knownCats = [...new Set(['Squat', 'Bænkpres', 'Dødløft', 'Rygøvelser', 'Skuldre', 'Triceps', 'Biceps', 'Ben', 'Core', 'Greb og carry', 'Accessory', ...exerciseLibrary.map(e => e.category).filter(Boolean)])].sort()

          return (
            <div style={{ ...s.page, ...(isMobile ? { padding: '1rem' } : {}) }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.75rem' }}>
                <div>
                  <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2' }}>
                    Øvelses<em style={{ fontStyle: 'italic', color: '#7a7770' }}>bibliotek.</em>
                  </h1>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.25rem' }}>
                    {exerciseLibrary.length} øvelser · {[...new Set(exerciseLibrary.map(e => e.category).filter(Boolean))].length} kategorier
                  </div>
                </div>
                <button style={s.btnPrimary} onClick={() => { setAddingLibraryEx(true); setLibraryAddForm({ name: '', category: 'Accessory' }) }}>+ Tilføj øvelse</button>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <input
                  style={{ ...s.fieldInput, maxWidth: '360px' }}
                  type="text"
                  placeholder="Søg på navn eller kategori..."
                  value={librarySearch}
                  onChange={e => setLibrarySearch(e.target.value)}
                />
              </div>

              {addingLibraryEx && (
                <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' }}>Ny øvelse</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={s.fieldLabel}>Navn</div>
                      <input style={s.fieldInput} type="text" placeholder="Øvelsesnavn" value={libraryAddForm.name} onChange={e => setLibraryAddForm(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addLibraryExercise()} autoFocus />
                    </div>
                    <div>
                      <div style={s.fieldLabel}>Kategori</div>
                      <input style={s.fieldInput} type="text" list="lib-cats-add" placeholder="kategori..." value={libraryAddForm.category} onChange={e => setLibraryAddForm(p => ({ ...p, category: e.target.value }))} />
                      <datalist id="lib-cats-add">{knownCats.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={s.btnGhost} onClick={() => setAddingLibraryEx(false)}>Annuller</button>
                    <button style={s.btnPrimary} onClick={addLibraryExercise}>Tilføj</button>
                  </div>
                </div>
              )}

              {libCategories.length === 0 ? (
                <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3rem 0' }}>Ingen øvelser matcher søgningen</div>
              ) : libCategories.map(cat => (
                <div key={cat} style={{ ...s.card, marginBottom: '1rem' }}>
                  <div style={s.cardLabel}>{cat} <span style={{ color: '#4a4844', fontWeight: 400 }}>{filteredLib.filter(e => (e.category || 'Andet') === cat).length}</span></div>
                  {filteredLib.filter(e => (e.category || 'Andet') === cat).map((ex, i, arr) => (
                    <div key={ex.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none' }}>
                      {editingLibraryEx === ex.id ? (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr auto', gap: '0.5rem', alignItems: 'end', padding: '0.5rem 0' }}>
                          <div>
                            <div style={s.fieldLabel}>Navn</div>
                            <input style={{ ...s.fieldInput, fontSize: '0.85rem', padding: '0.35rem 0.6rem' }} value={libraryEditForm.name} onChange={e => setLibraryEditForm(p => ({ ...p, name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') updateLibraryExercise(ex.id); if (e.key === 'Escape') setEditingLibraryEx(null) }} autoFocus />
                          </div>
                          <div>
                            <div style={s.fieldLabel}>Kategori</div>
                            <input style={{ ...s.fieldInput, fontSize: '0.85rem', padding: '0.35rem 0.6rem' }} type="text" list="lib-cats-edit" value={libraryEditForm.category} onChange={e => setLibraryEditForm(p => ({ ...p, category: e.target.value }))} />
                            <datalist id="lib-cats-edit">{knownCats.map(c => <option key={c} value={c} />)}</datalist>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', paddingBottom: isMobile ? 0 : '0.05rem' }}>
                            <button style={s.btnPrimary} onClick={() => updateLibraryExercise(ex.id)}>Gem</button>
                            <button style={s.btnGhost} onClick={() => setEditingLibraryEx(null)}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', gap: '0.5rem' }}>
                          <div style={{ fontSize: '0.88rem', color: '#b8b4a8' }}>{ex.name}</div>
                          <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                            <button style={s.btnEdit} onClick={() => { setEditingLibraryEx(ex.id); setLibraryEditForm({ name: ex.name, category: ex.category || '' }) }}>✎</button>
                            <button style={s.btnDanger} onClick={() => deleteLibraryExercise(ex.id)}>✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        })()}

        {/* LIST VIEW */}
        {/* CALENDAR VIEW */}
        {view === 'calendar' && (() => {
          const today0 = new Date(); today0.setHours(0, 0, 0, 0)
          const dayMs = 86400000
          const visibleAthletes = athletes.filter(a => !hiddenAthleteIds.has(a.id))

          // Udled status pr. atlet ud fra HVOR DE ER NU (seneste loggede uge) og
          // hvor mange FYLDTE uger (med øvelser) der er tilbage fra og med den uge.
          // "Runway" tæller den nuværende uge MED — så en atlet hvis næste uge er
          // fyldt har runway >= 2 = Klar (i stedet for falsk "planlæg næste").
          const board = visibleAthletes.map(a => {
            const weeks = calendarWeeks[a.id] || []
            const planned = weeks.filter(w => w.exercise_count > 0)            // uger du har lagt øvelser i
            const maxPlannedWeekNo = planned.length ? Math.max(...planned.map(w => w.week_number)) : null
            const minPlannedWeekNo = planned.length ? Math.min(...planned.map(w => w.week_number)) : null
            const loggedWeek = athleteCurrentWeek[a.id] ?? null
            // Dato-bevidst "nu" (samme som tidslinjen): ugen hvis datospænd dækker i dag,
            // ellers seneste loggede uge, ellers første planlagte uge.
            const ref = currentWeekNo(weeks, loggedWeek) ?? minPlannedWeekNo   // hvor de er nu
            const runway = ref != null ? planned.filter(w => w.week_number >= ref).length : planned.length
            const lastLog = athleteLastLogs[a.id]
            const daysSince = lastLog ? Math.floor((today0 - new Date(lastLog + 'T12:00:00')) / dayMs) : null
            const holiday = holidayInfo(a)
            const returned = holiday && !holiday.onHoliday           // ferie slut → skal genaktiveres/planlægges
            let status // ready | lastweek | out | empty | none | ferie (samme rangering som forsidens computeBoard)
            if (holiday?.onHoliday) status = 'ferie'                 // på ferie → ingen handling
            else if (weeks.length === 0) status = 'none'
            else if (planned.length === 0) status = 'empty'          // uger findes, men ingen øvelser
            else if (runway <= 0) status = 'out'                     // forbi sidste planlagte uge = løbet tør
            else if (runway === 1) status = 'lastweek'               // sidste planlagte uge, dækket ugen ud
            else status = 'ready'
            const snoozedUntil = snoozedAthletes[a.id] || null
            const isSnoozed = snoozedUntil && new Date(snoozedUntil) > today0
            return { a, weeks, planned, loggedWeek, maxPlannedWeekNo, runway, daysSince, status, snoozedUntil, isSnoozed, returned }
          })
          const reasonText = (b) => b.returned ? 'Tilbage fra ferie — planlæg'
            : b.status === 'none' ? 'Intet program oprettet'
            : b.status === 'empty' ? 'Uger oprettet, men ingen øvelser'
            : b.status === 'out' ? 'Løbet tør — planlæg næste blok'
            : 'Sidste planlagte uge — planlæg i weekenden'
          // Rang (lavere = mere akut), matcher forsidens progReason: none>empty>(returned/out)>lastweek.
          const statusRank = (b) => b.status === 'none' ? 0 : b.status === 'empty' ? 1 : (b.returned || b.status === 'out') ? 2 : b.status === 'lastweek' ? 4 : 5
          // Kræver handling = ikke-klar (eller tilbage fra ferie), ikke på ferie. Rangeret mest akut øverst.
          const wouldNeed = (b) => b.status !== 'ferie' && (b.status !== 'ready' || b.returned)
          const needs = board.filter(b => wouldNeed(b) && !b.isSnoozed).sort((x, y) => statusRank(x) - statusRank(y))
          const snoozedNeeds = board.filter(b => wouldNeed(b) && b.isSnoozed)
          const lastText = (d) => d == null ? 'Ingen logs' : d === 0 ? 'I dag' : d === 1 ? 'I går' : `${d}d siden`
          const lastColor = (d) => d == null ? '#4a4844' : d <= 4 ? '#6cba6c' : d <= 8 ? '#c8923a' : '#e05555'
          const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

          return (
            <div style={{ ...s.page, ...(isMobile ? { padding: '1rem' } : {}) }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', margin: 0 }}>Overblik</h1>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.25rem' }}>
                  {board.length - needs.length} af {board.length} klar · har du husket at planlægge deres træning?
                </div>
              </div>

              {/* Tidslinje — alle atleters blokke på tværs af tid */}
              {(() => {
                const COL_W = isMobile ? 40 : 48
                const NAME_W = isMobile ? 88 : 132
                const ROW_H = 34
                const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
                const isoOf = (d) => d.toISOString().slice(0, 10)

                const rows = visibleAthletes.map(a => {
                  const wks = calendarWeeks[a.id] || []
                  const anchor = wks.find(w => w.start_date) // wks er sorteret stigende → tidligste daterede
                  const weekDate = anchor
                    ? (no) => new Date(new Date(anchor.start_date + 'T12:00:00').getTime() + (no - anchor.week_number) * 7 * dayMs)
                    : null
                  return { a, wks, phases: computePhases(wks), currentWk: currentWeekNo(wks, athleteCurrentWeek[a.id] ?? null), weekDate, hasAnchor: !!anchor }
                })
                const placed = rows.filter(r => r.hasAnchor)
                const tray = rows.filter(r => !r.hasAnchor && r.wks.length > 0)

                // Global kolonneskala (ISO-uger). Pad én uge i hver ende.
                let minMon = mondayOf(today0), maxMon = mondayOf(today0)
                for (const r of placed) for (const w of r.wks) {
                  const m = mondayOf(r.weekDate(w.week_number))
                  if (m < minMon) minMon = m
                  if (m > maxMon) maxMon = m
                }
                minMon = new Date(minMon.getTime() - 7 * dayMs)
                maxMon = new Date(maxMon.getTime() + 7 * dayMs)
                const nCols = Math.min(Math.round((maxMon - minMon) / (7 * dayMs)) + 1, 60)
                const colOf = (d) => Math.round((mondayOf(d) - minMon) / (7 * dayMs))
                const todayCol = colOf(today0)
                const trackW = nCols * COL_W
                const cols = Array.from({ length: nCols }, (_, i) => new Date(minMon.getTime() + i * 7 * dayMs))

                const openEdit = (r, ph) => {
                  const first = ph.weeks[0]
                  const firstStartIso = first.start_date || (r.weekDate ? isoOf(r.weekDate(first.week_number)) : isoOf(today0))
                  setTimelineEdit({ athleteId: r.a.id, weeks: ph.weeks, name: r.a.name, block: ph.name || 'Uden blok', firstStartIso })
                }

                // Hvilket ugenummer "hører til" kolonne i for en atlet, ud fra anker-modellen
                // (anker + 1 ugenr pr. kolonne). Giver den nye uge en start_date der matcher
                // dens position, så bjælken lægger sig præcis hvor der blev klikket.
                const cellWeekNo = (r, i) => {
                  const anchor = r.wks.find(w => w.start_date)
                  if (!anchor) return null
                  const anchorCol = colOf(new Date(anchor.start_date + 'T12:00:00'))
                  return anchor.week_number + (i - anchorCol)
                }
                // Lokal-sikker yyyy-mm-dd (cols[] er lokal midnat; isoOf/toISOString ville
                // rulle en dag tilbage i dansk tidszone → mandag blev til søndag).
                const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                // Klik på en tom celle → bekræft → opret én tom uge på den dato.
                const onEmptyCellClick = (r, i, d) => {
                  const newNo = cellWeekNo(r, i)
                  if (newNo == null || newNo < 1) { showFlash('Kan ikke oprette en uge før programmets start.', 'error'); return }
                  if (r.wks.some(w => w.week_number === newNo)) { showFlash('Der er allerede en uge her.', 'error'); return }
                  const label = d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
                  askConfirm(`Opret uge for ${r.a.name} med start ${label}?`, () => createCalendarWeek(r.a.id, newNo, isoLocal(d)))
                }

                return (
                  <div style={{ ...s.card, marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={s.cardLabel}>Tidslinje</div>
                      <select
                        value=""
                        onChange={e => { const a = visibleAthletes.find(x => x.id === e.target.value); if (a) openCalBlockBuilder(a) }}
                        style={{ ...s.fieldSelect, fontSize: '0.6rem', padding: '0.3rem 0.5rem', width: 'auto', color: '#c8923a', borderColor: 'rgba(200,146,58,0.4)' }}
                      >
                        <option value="">+ Opstil blokke for…</option>
                        {visibleAthletes.map(a => <option key={a.id} value={a.id} style={{ color: '#edeae2' }}>{a.name}</option>)}
                      </select>
                    </div>

                    {placed.length === 0 ? (
                      <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', padding: '0.75rem 0' }}>
                        Ingen atleter med datoer endnu — sæt en startdato nedenfor, så lægger blokkene sig her.
                      </div>
                    ) : (
                      <>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', color: '#4a4844', marginTop: '0.4rem' }}>
                        Tip: tryk på en tom celle for at oprette en uge på den dato.
                      </div>
                      <div style={{ display: 'flex', marginTop: '0.5rem', border: '1px solid rgba(237,234,226,0.06)' }}>
                        {/* Sticky navne-kolonne */}
                        <div style={{ flexShrink: 0, width: NAME_W, borderRight: '1px solid rgba(237,234,226,0.08)', background: '#16160f' }}>
                          <div style={{ height: 22, borderBottom: '1px solid rgba(237,234,226,0.06)' }} />
                          {placed.map(r => (
                            <div key={r.a.id} onClick={() => openProfile(r.a, 'program')}
                              style={{ height: ROW_H, display: 'flex', alignItems: 'center', padding: '0 0.5rem', cursor: 'pointer', borderBottom: '1px solid rgba(237,234,226,0.04)', fontSize: isMobile ? '0.72rem' : '0.8rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.a.name}
                            </div>
                          ))}
                        </div>
                        {/* Scrollbart spor */}
                        <div style={{ overflowX: 'auto', flex: 1 }}>
                          <div style={{ width: trackW }}>
                            {/* Dato-header */}
                            <div style={{ display: 'flex', height: 22, borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                              {cols.map((d, i) => (
                                <div key={i} style={{ width: COL_W, flexShrink: 0, textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.42rem', color: i === todayCol ? '#c8923a' : '#4a4844', background: i === todayCol ? 'rgba(200,146,58,0.08)' : 'transparent', lineHeight: '22px' }}>
                                  {d.getDate()}/{d.getMonth() + 1}
                                </div>
                              ))}
                            </div>
                            {/* Rækker */}
                            {placed.map(r => {
                              // Kolonner der allerede er dækket af en blok-bjælke (så vi kun gør
                              // de TOMME celler klikbare → opret-uge).
                              const covered = new Set()
                              for (const ph of r.phases) {
                                const a0 = colOf(r.weekDate(ph.weeks[0].week_number))
                                const a1 = colOf(r.weekDate(ph.weeks[ph.weeks.length - 1].week_number))
                                for (let c = a0; c <= a1; c++) covered.add(c)
                              }
                              return (
                              <div key={r.a.id} style={{ position: 'relative', height: ROW_H, borderBottom: '1px solid rgba(237,234,226,0.04)' }}>
                                {/* Tomme celler: klik = opret uge på den dato (kun gyldige slots:
                                    ledig + ugenummer >= 1). Ligger under bjælkerne i DOM → bjælker
                                    fanger deres egne klik. */}
                                {cols.map((d, i) => {
                                  if (covered.has(i)) return null
                                  const newNo = cellWeekNo(r, i)
                                  if (newNo == null || newNo < 1 || r.wks.some(w => w.week_number === newNo)) return null
                                  const hov = hoverCell && hoverCell.aid === r.a.id && hoverCell.col === i
                                  return (
                                    <div key={`cell${i}`}
                                      onClick={() => onEmptyCellClick(r, i, d)}
                                      onMouseEnter={() => setHoverCell({ aid: r.a.id, col: i })}
                                      onMouseLeave={() => setHoverCell(null)}
                                      title={`+ Opret uge · ${d.getDate()}/${d.getMonth() + 1}`}
                                      style={{ position: 'absolute', left: i * COL_W, top: 0, width: COL_W, height: ROW_H, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hov ? 'rgba(200,146,58,0.08)' : 'transparent' }}>
                                      {hov && <span style={{ color: '#c8923a', fontSize: '0.8rem', opacity: 0.8, lineHeight: 1 }}>+</span>}
                                    </div>
                                  )
                                })}
                                {/* i dag-linje */}
                                {todayCol >= 0 && todayCol < nCols && (
                                  <div style={{ position: 'absolute', left: todayCol * COL_W + COL_W / 2, top: 0, bottom: 0, width: 1, background: 'rgba(200,146,58,0.4)', pointerEvents: 'none' }} />
                                )}
                                {r.phases.map((ph, pi) => {
                                  const first = ph.weeks[0], last = ph.weeks[ph.weeks.length - 1]
                                  const c0 = colOf(r.weekDate(first.week_number))
                                  const c1 = colOf(r.weekDate(last.week_number))
                                  const color = ph.name ? blockColor(ph.name) : '#4a4844'
                                  const isDone = r.currentWk != null && last.week_number < r.currentWk
                                  const isActive = r.currentWk != null && first.week_number <= r.currentWk && r.currentWk <= last.week_number
                                  const range = first.week_number === last.week_number ? `u${first.week_number}` : `u${first.week_number}–${last.week_number}`
                                  return (
                                    <div key={pi} title={`${ph.name || 'Uden blok'} · ${range}`}
                                      onClick={() => openEdit(r, ph)}
                                      style={{
                                        position: 'absolute', left: c0 * COL_W + 2, width: Math.max((c1 - c0 + 1) * COL_W - 4, COL_W - 4),
                                        top: 5, height: ROW_H - 12, cursor: 'pointer', borderRadius: 3, overflow: 'hidden',
                                        background: isActive ? color + '33' : color + (isDone ? '14' : '22'),
                                        border: `1px solid ${isActive ? color : color + '66'}`, opacity: isDone ? 0.7 : 1,
                                        display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0 0.35rem',
                                      }}>
                                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                      <span style={{ fontSize: '0.6rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ph.name || 'Uden blok'}</span>
                                      {isDone && <span style={{ color, fontSize: '0.55rem', flexShrink: 0 }}>✓</span>}
                                      {isActive && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.4rem', textTransform: 'uppercase', color, flexShrink: 0 }}>nu</span>}
                                    </div>
                                  )
                                })}
                              </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                      </>
                    )}

                    {/* Dato-redigerings-panel */}
                    {timelineEdit && (
                      <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: '#16160f', border: '1px solid rgba(200,146,58,0.3)', borderRadius: 3 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.4rem' }}>
                          Startdato — {timelineEdit.name} · {timelineEdit.block}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button style={{ ...s.btnGhost, fontSize: '0.6rem', padding: '0.3rem 0.5rem' }}
                            onClick={() => { const d = new Date(timelineEdit.firstStartIso + 'T12:00:00'); const iso = isoOf(new Date(d.getTime() - 7 * dayMs)); setTimelineEdit(p => ({ ...p, firstStartIso: iso })); setBlockStartDate(timelineEdit.athleteId, timelineEdit.weeks, iso) }}>‹ 1 uge</button>
                          <input type="date" value={timelineEdit.firstStartIso}
                            onChange={e => { if (e.target.value) { setTimelineEdit(p => ({ ...p, firstStartIso: e.target.value })); setBlockStartDate(timelineEdit.athleteId, timelineEdit.weeks, e.target.value) } }}
                            style={{ ...s.fieldInput, fontSize: '0.7rem', padding: '0.25rem 0.4rem', width: 'auto' }} />
                          <button style={{ ...s.btnGhost, fontSize: '0.6rem', padding: '0.3rem 0.5rem' }}
                            onClick={() => { const d = new Date(timelineEdit.firstStartIso + 'T12:00:00'); const iso = isoOf(new Date(d.getTime() + 7 * dayMs)); setTimelineEdit(p => ({ ...p, firstStartIso: iso })); setBlockStartDate(timelineEdit.athleteId, timelineEdit.weeks, iso) }}>1 uge ›</button>
                          <button style={{ ...s.btnGhost, fontSize: '0.6rem', padding: '0.3rem 0.5rem', marginLeft: 'auto' }} onClick={() => setTimelineEdit(null)}>Luk</button>
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', marginTop: '0.35rem', lineHeight: 1.6 }}>
                          Sætter blokkens første uge til datoen og fordeler resten af ugerne fortløbende (7 dage pr. uge).
                        </div>
                      </div>
                    )}

                    {/* Ikke planlagt-bakke */}
                    {tray.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.4rem' }}>
                          Ikke planlagt på kalenderen ({tray.length})
                        </div>
                        {tray.map(r => (
                          <div key={r.a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(237,234,226,0.04)', flexWrap: 'wrap' }}>
                            <span onClick={() => openProfile(r.a, 'program')} style={{ fontSize: '0.82rem', color: '#edeae2', cursor: 'pointer' }}>{r.a.name}</span>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.25rem 0.5rem' }}
                                onClick={() => r.phases[0] && openEdit(r, r.phases[0])}>Sæt startdato</button>
                              <button style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.25rem 0.5rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.4)' }}
                                onClick={() => openCalBlockBuilder(r.a)}>+ blok</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Kalender-blok-bygger — opstil/forlæng en atlets blokke direkte her */}
                    {calBlockAthlete && (() => {
                      const ath = athletes.find(x => x.id === calBlockAthlete.id)
                      const existing = calendarWeeks[calBlockAthlete.id] || []
                      const nextNum = existing.length ? Math.max(...existing.map(w => w.week_number)) + 1 : 1
                      const totalWeeks = blockPlan.reduce((sum, b) => sum + (b.weeks || 0), 0)
                      const endDate = totalWeeks > 0 && planStartDate
                        ? new Date(new Date(planStartDate + 'T12:00:00').getTime() + totalWeeks * 7 * dayMs - dayMs) : null
                      const compObj = ath?.competition_date ? new Date(ath.competition_date + 'T12:00:00') : null
                      const diffDays = endDate && compObj ? Math.round((compObj - endDate) / dayMs) : null
                      const fmtD = d => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
                      return (
                        <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#16160f', border: '1px solid rgba(200,146,58,0.3)', borderRadius: 3 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' }}>
                            Opstil blokke — {calBlockAthlete.name}{existing.length ? ` · fortsætter fra uge ${nextNum}` : ''}
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={s.fieldLabel}>Startdato</div>
                            <input style={{ ...s.fieldInput, maxWidth: '180px' }} type="date" value={planStartDate} onChange={e => setPlanStartDate(e.target.value)} />
                          </div>
                          {blockSequenceRows()}
                          {totalWeeks > 0 && planStartDate && (
                            <div style={{ display: 'flex', width: '100%', height: '26px', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                              {blockPlan.map(block => {
                                const pct = (block.weeks / totalWeeks) * 100
                                return (
                                  <div key={block.id} title={`${block.name}: ${block.weeks} uge${block.weeks !== 1 ? 'r' : ''}`}
                                    style={{ width: `${pct}%`, flexShrink: 0, background: blockColor(block.name), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {block.weeks >= 2 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#141410', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 6px' }}>{block.name}</span>}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', marginBottom: '0.85rem' }}>
                            <span style={{ color: '#7a7770' }}>Total: {totalWeeks} uger</span>
                            {endDate && <span style={{ color: '#7a7770' }}> · slutter {fmtD(endDate)}</span>}
                            {diffDays != null && (
                              <span style={{ marginLeft: '0.6rem', color: diffDays >= 0 ? '#6cba6c' : '#e05555', fontWeight: 600 }}>
                                {diffDays >= 0 ? `✓ ${diffDays} dage før stævne` : `⚠ ${Math.abs(diffDays)} dage efter stævne`}
                              </span>
                            )}
                            {!compObj && <span style={{ color: '#4a4844', marginLeft: '0.6rem' }}>— ingen stævnedato sat</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button style={s.btnGhost} onClick={() => setCalBlockAthlete(null)}>Annuller</button>
                            <button style={s.btnPrimary} disabled={!planStartDate || totalWeeks === 0} onClick={() => generateWeeksFromPlan(calBlockAthlete.id)}>Opret {totalWeeks} uger</button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}

              {/* Kræver handling — uden program / uden øvelser / sidste uge nu */}
              {needs.length > 0 && (
                <div style={{ ...s.card, marginBottom: '1.5rem', borderColor: 'rgba(224,85,85,0.3)' }}>
                  <div style={{ ...s.cardLabel, color: '#e05555' }}>⚠ Kræver din opmærksomhed ({needs.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.5rem' }}>
                    {needs.map(b => {
                      const snooze = (days) => { const d = new Date(); d.setDate(d.getDate() + days); snoozeAthlete(b.a.id, d.toISOString().slice(0, 10)) }
                      return (
                        <div key={b.a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(237,234,226,0.04)', flexWrap: 'wrap' }}>
                          <div onClick={() => openProfile(b.a, 'program')} style={{ cursor: 'pointer', flex: 1, minWidth: '140px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#edeae2' }}>{b.a.name}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: b.status === 'none' ? '#e05555' : '#c8923a', marginLeft: '0.6rem' }}>{reasonText(b)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4844' }}>Udsæt</span>
                            <button onClick={() => snooze(3)} style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.25rem 0.45rem' }}>3d</button>
                            <button onClick={() => snooze(7)} style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.25rem 0.45rem' }}>7d</button>
                            <input type="date" onChange={e => e.target.value && snoozeAthlete(b.a.id, e.target.value)} style={{ ...s.fieldInput, fontSize: '0.55rem', padding: '0.2rem 0.3rem', width: '120px' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Udsatte atleter */}
              {snoozedNeeds.length > 0 && (
                <div style={{ ...s.card, marginBottom: '1.5rem' }}>
                  <div style={s.cardLabel}>Udsat ({snoozedNeeds.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.5rem' }}>
                    {snoozedNeeds.map(b => (
                      <div key={b.a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(237,234,226,0.04)' }}>
                        <span style={{ fontSize: '0.82rem', color: '#7a7770' }}>{b.a.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844' }}>udsat til {fmtDate(new Date(b.snoozedUntil))}</span>
                          <button onClick={() => snoozeAthlete(b.a.id, null)} style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.25rem 0.45rem' }}>Vis nu</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fuldt board — alle atleter */}
              <div style={{ ...s.card }}>
                <div style={s.cardLabel}>Alle atleter</div>
                {board.length === 0 ? (
                  <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', padding: '1rem 0' }}>Ingen atleter</div>
                ) : board.map((b, i) => {
                  const chip = b.status === 'ferie' ? { t: '🌴 Ferie', c: '#5b9bb5' }
                    : b.isSnoozed ? { t: `⏾ Udsat`, c: '#7a7770' }
                    : b.returned ? { t: '🌴→ Tilbage fra ferie — planlæg', c: '#c8923a' }
                    : b.status === 'ready' ? { t: `✓ Klar · ${b.runway} uger`, c: '#6cba6c' }
                    : b.status === 'lastweek' ? { t: '⚠ Sidste uge — planlæg i weekenden', c: '#c8923a' }
                    : b.status === 'out' ? { t: '⚠ Løbet tør — planlæg nu', c: '#e05555' }
                    : b.status === 'empty' ? { t: '⚠ Mangler øvelser', c: '#c8923a' }
                    : { t: '✗ Intet program', c: '#e05555' }
                  const detail = b.weeks.length === 0 ? 'Ingen uger oprettet'
                    : b.planned.length === 0 ? `${b.weeks.length} uger oprettet · ingen øvelser endnu`
                    : `${b.loggedWeek != null ? `Træner uge ${b.loggedWeek}` : 'Ikke startet'} · ${b.runway} fyldte uger tilbage · planlagt til uge ${b.maxPlannedWeekNo}`
                  return (
                    <div key={b.a.id} onClick={() => openProfile(b.a, 'program')}
                      style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.7rem 0', borderBottom: i < board.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none', cursor: 'pointer', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '0.9rem', color: '#edeae2', minWidth: '130px', flexShrink: 0 }}>{b.a.name}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#7a7770', flex: 1, minWidth: '160px' }}>{detail}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: lastColor(b.daysSince) }} />
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: lastColor(b.daysSince), minWidth: '64px' }}>{lastText(b.daysSince)}</span>
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: chip.c, border: `1px solid ${chip.c}55`, padding: '0.2rem 0.5rem', flexShrink: 0 }}>{chip.t}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', marginTop: '0.75rem', letterSpacing: '0.05em', lineHeight: 1.7 }}>
                "Klar · N uger" = N fyldte uger tilbage fra og med den uge atleten træner nu. "Sidste uge — planlæg næste" = kun den nuværende uge er fyldt. Brug "Udsæt" hvis du allerede har styr på det og ikke vil mindes om det i nogle dage. Prikken = sidst loggede træning.
              </div>
            </div>
          )
        })()}

        {view === 'list' && (
          <div style={{ ...s.page, ...(isMobile ? { padding: '1rem' } : {}) }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', margin: 0 }}>
                  Overblik
                </h1>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.25rem' }}>
                  {athletes.filter(a => !hiddenAthleteIds.has(a.id)).length} aktive atleter
                </div>
              </div>
              <button style={s.btnPrimary} onClick={() => setShowAddModal(true)}>+ Tilføj atlet</button>
            </div>
            {loading ? (
              <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Indlæser...</div>
            ) : loadError ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem', padding: '3rem 0' }}>
                <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Kunne ikke indlæse atleter.</div>
                <button style={s.btnGhost} onClick={() => { setLoading(true); fetchAthletes() }}>Prøv igen</button>
              </div>
            ) : athletes.length === 0 ? (
              <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3rem 0' }}>Ingen atleter endnu — tilføj din første</div>
            ) : (
              <>
                {/* Hurtig-handlinger — store tap-targets, mobil-først */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
                  {[
                    { icon: '⚡', label: 'Min træning', onClick: goToMyProfile },
                    { icon: '📅', label: 'Kalender', onClick: () => { setSelectedAthlete(null); setView('calendar') } },
                    { icon: '＋', label: 'Tilføj atlet', onClick: () => setShowAddModal(true) },
                    { icon: '📚', label: 'Bibliotek', onClick: () => setView('library') },
                  ].map(qa => (
                    <button key={qa.label} onClick={qa.onClick}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', minHeight: '64px', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', borderRadius: 4, cursor: 'pointer', padding: '0.75rem 0.5rem' }}>
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{qa.icon}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b8b4a8' }}>{qa.label}</span>
                    </button>
                  ))}
                </div>

                {/* Prioritet — rangeret: mest akut øverst, weekend-planlægning nederst */}
                {(() => {
                  const visible = athletes.filter(a => !hiddenAthleteIds.has(a.id))
                  const board = computeBoard(visible)
                  const boardByAid = Object.fromEntries(board.map(b => [b.a.id, b]))
                  // Lavere rank = mere akut. none > empty > løbet tør > besked > sidste uge (weekend).
                  const progReason = b => {
                    if (!b || b.isSnoozed) return null
                    if (b.status === 'ferie') return null // på ferie → ikke i Prioritet
                    if (b.returned) return { rank: 2, label: 'Tilbage fra ferie — planlæg', color: '#c8923a' }
                    if (b.status === 'none') return { rank: 0, label: 'Intet program', color: '#e05555' }
                    if (b.status === 'empty') return { rank: 1, label: 'Mangler øvelser', color: '#e05555' }
                    if (b.status === 'out') return { rank: 2, label: 'Løbet tør — planlæg nu', color: '#e05555' }
                    if (b.status === 'lastweek') return { rank: 4, label: 'Planlæg i weekenden', color: '#c8923a' }
                    return null
                  }
                  const todayStr = new Date().toISOString().slice(0, 10)
                  const items = visible.map(a => {
                    const prog = progReason(boardByAid[a.id])
                    const hasUnread = (unreadCounts[a.id] || 0) > 0
                    const msg = hasUnread ? { rank: 3, label: 'Ulæst besked', color: '#c8923a' } : null
                    // Stævne passeret men status stadig peaking → mind coach om at registrere resultat.
                    const meetDue = a.status === 'peaking' && a.competition_date && a.competition_date < todayStr
                      ? { rank: 3, label: 'Stævne passeret — registrér resultat', color: '#c8923a', tab: 'stævne' }
                      : null
                    const cands = [prog && { ...prog, tab: 'program' }, meetDue, msg && { ...msg, tab: 'beskeder' }].filter(Boolean)
                    if (!cands.length) return null
                    cands.sort((x, y) => x.rank - y.rank)
                    const primary = cands[0]
                    return { a, primary, alsoUnread: hasUnread && primary.tab !== 'beskeder' }
                  }).filter(Boolean)
                  items.sort((x, y) => x.primary.rank - y.primary.rank)
                  if (!items.length) {
                    return (
                      <div style={{ ...s.card, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6cba6c', flexShrink: 0 }} />
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.06em', color: '#7a7770' }}>Alt kører — ingen mangler lige nu</span>
                      </div>
                    )
                  }
                  return (
                    <div style={{ ...s.card, marginBottom: '1.5rem', borderColor: 'rgba(200,146,58,0.25)' }}>
                      <div style={s.cardLabel}>Prioritet</div>
                      {items.map((it, i) => (
                        <div key={it.a.id} onClick={() => openProfile(it.a, it.primary.tab)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0', borderBottom: i < items.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none', cursor: 'pointer', minHeight: '44px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: it.primary.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.85rem', color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.a.name}</span>
                            {it.alsoUnread && <span title="Ulæst besked" style={{ color: '#c8923a', fontSize: '0.7rem', flexShrink: 0 }}>✉</span>}
                          </span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: it.primary.color, textAlign: 'right', flexShrink: 0 }}>{it.primary.label} →</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Denne uge — tvær-atlet aktivitet */}
                {(() => {
                  const visible = athletes.filter(a => !hiddenAthleteIds.has(a.id))
                  if (!visible.length) return null
                  const rows = visible
                    .map(a => ({ a, act: weeklyActivity[a.id] || { sessions: 0, sets: 0 } }))
                    .sort((x, y) => y.act.sessions - x.act.sessions || y.act.sets - x.act.sets)
                  const activeCount = rows.filter(r => r.act.sessions > 0).length
                  return (
                    <div style={{ ...s.card, marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <div style={s.cardLabel}>Denne uge</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', letterSpacing: '0.06em' }}>{activeCount}/{rows.length} har trænet</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: '0.5rem' }}>
                        {rows.map((r, i) => {
                          const has = r.act.sessions > 0
                          const hol = holidayInfo(r.a)
                          const onHol = hol?.onHoliday
                          return (
                            <div key={r.a.id} onClick={() => openProfile(r.a, 'log')}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0', borderBottom: i < rows.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none', cursor: 'pointer', minHeight: '40px', opacity: has || onHol ? 1 : 0.5 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                                <span style={{ fontSize: '0.82rem', color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{r.a.name}</span>
                                {onHol && <span style={{ ...s.badge('ferie'), flexShrink: 0 }}>{ferieBadgeLabel(hol)}</span>}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                {has ? (
                                  <>
                                    <span style={{ display: 'flex', gap: '0.2rem' }}>
                                      {Array.from({ length: Math.min(r.act.sessions, 6) }).map((_, k) => (
                                        <span key={k} style={{ width: 7, height: 7, borderRadius: '50%', background: '#6cba6c' }} />
                                      ))}
                                    </span>
                                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#7a7770' }}>{r.act.sessions} træning{r.act.sessions === 1 ? '' : 'er'} · {r.act.sets} sæt</span>
                                  </>
                                ) : (
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: onHol ? '#5b9bb5' : '#4a4844' }}>{onHol ? 'På ferie' : 'Intet endnu'}</span>
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Ugeplan oversigt */}
                {(() => {
                  const visibleAthletes = athletes.filter(a => !hiddenAthleteIds.has(a.id))
                  const hiddenAthletes = athletes.filter(a => hiddenAthleteIds.has(a.id))
                  const displayAthletes = showHiddenAthletes ? athletes : visibleAthletes
                  const toggleHide = async (e, athId) => {
                    e.stopPropagation()
                    const willHide = !hiddenAthleteIds.has(athId)
                    setHiddenAthleteIds(prev => {
                      const next = new Set(prev)
                      if (willHide) next.add(athId); else next.delete(athId)
                      return next
                    })
                    await supabase.from('athletes').update({ hidden: willHide }).eq('id', athId)
                  }
                  return (
                    <div style={{ ...s.card, marginBottom: '1.75rem' }}>
                      <div style={s.cardLabel}>Dine atleter</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        {displayAthletes.map((ath, i, arr) => {
                          const ws = athleteWeekSummary[ath.id]
                          const isHidden = hiddenAthleteIds.has(ath.id)
                          return (
                            <div
                              key={ath.id}
                              style={{ display: 'flex', alignItems: 'center', padding: '0.6rem 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none', gap: '1rem', opacity: isHidden ? 0.4 : 1 }}
                            >
                              <div onClick={() => !isHidden && openProfile(ath, 'program')} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', flex: 1, gap: isMobile ? '0.2rem' : '1rem', cursor: isHidden ? 'default' : 'pointer', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: isMobile ? 0 : '140px', flexShrink: 0, maxWidth: '100%' }}>
                                  <div style={{ fontSize: '0.88rem', color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{ath.name}</div>
                                  {(() => { const h = holidayInfo(ath); return h?.onHoliday ? <span style={{ ...s.badge('ferie'), flexShrink: 0 }}>{ferieBadgeLabel(h)}</span> : null })()}
                                </div>
                                {ws ? (() => {
                                  const today = new Date(); today.setHours(12, 0, 0, 0)
                                  const lastLogDate = athleteLastLogs[ath.id]
                                  const daysSinceLog = lastLogDate
                                    ? Math.floor((today - new Date(lastLogDate + 'T12:00:00')) / (24 * 3600 * 1000))
                                    : null
                                  const dotColor = daysSinceLog == null ? '#4a4844'
                                    : daysSinceLog <= 4 ? '#6cba6c'
                                    : daysSinceLog <= 8 ? '#c8923a'
                                    : '#e05555'
                                  const logText = daysSinceLog == null ? 'Ingen logs'
                                    : daysSinceLog === 0 ? 'I dag'
                                    : daysSinceLog === 1 ? 'I går'
                                    : `${daysSinceLog}d siden`
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0, maxWidth: '100%' }}>
                                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#7a7770', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                        Uge {ws.week_number}{ws.block_name ? ` — ${ws.block_name}` : ''} · {ws.session_count} sess
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor }} />
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: dotColor }}>{logText}</span>
                                      </div>
                                    </div>
                                  )
                                })() : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1 }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4a4844', flexShrink: 0 }} />
                                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844' }}>Ingen program</span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={e => toggleHide(e, ath.id)}
                                title={isHidden ? 'Vis igen' : 'Skjul'}
                                style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', padding: '0.1rem 0.3rem', flexShrink: 0, lineHeight: 1 }}
                              >{isHidden ? '↩' : '✕'}</button>
                            </div>
                          )
                        })}
                      </div>
                      {hiddenAthletes.length > 0 && (
                        <button
                          onClick={() => setShowHiddenAthletes(p => !p)}
                          style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4844', cursor: 'pointer', marginTop: '0.75rem', padding: 0 }}
                        >{showHiddenAthletes ? 'Skjul skjulte' : `Vis ${hiddenAthletes.length} skjult${hiddenAthletes.length !== 1 ? 'e' : ''}`}</button>
                      )}
                    </div>
                  )
                })()}

                {(() => {
                  const athletesWithMsgs = athletes
                    .filter(a => latestMessages[a.id] && latestMessages[a.id].sender_role === 'athlete')
                    .sort((a, b) => latestMessages[b.id].created_at.localeCompare(latestMessages[a.id].created_at))
                  if (!athletesWithMsgs.length) return null
                  return (
                    <div style={{ ...s.card, marginBottom: '1.75rem' }}>
                      <div style={s.cardLabel}>Seneste beskeder</div>
                      {athletesWithMsgs.map((athlete, i, arr) => {
                        const msg = latestMessages[athlete.id]
                        const isUnread = (unreadCounts[athlete.id] || 0) > 0
                        return (
                          <div key={athlete.id} onClick={() => openProfile(athlete, 'beskeder')}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none', cursor: 'pointer' }}>
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <div style={{ ...s.avatar, width: '32px', height: '32px', fontSize: '0.72rem' }}>{initials(athlete.name)}</div>
                              {isUnread && <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#c8923a', border: '2px solid #1c1c18' }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', color: isUnread ? '#edeae2' : '#b8b4a8' }}>{athlete.name}</div>
                              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.72rem', color: isUnread ? '#c8923a' : '#4a4844', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {msg.content.slice(0, 60)}{msg.content.length > 60 ? '…' : ''}
                              </div>
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', flexShrink: 0 }}>{formatMsgTime(msg.created_at)}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )}

        {/* PROFILE VIEW */}
        {view === 'profile' && a && (
          <div style={{ ...s.page, ...(isMobile ? { padding: '1rem' } : {}) }}>
            <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', cursor: 'pointer', marginBottom: '1.75rem', padding: 0 }}>
              ← Tilbage til atleter
            </button>

            <div style={{ ...s.card, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr auto', gap: isMobile ? '0.75rem' : '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ ...s.avatar, width: '56px', height: '56px', fontSize: '1.3rem' }}>{initials(a.name)}</div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 400, color: '#edeae2' }}>{a.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#7a7770', marginTop: '0.2rem' }}>{a.email}{a.age ? ' · ' + a.age + ' år' : ''}</div>
                <div
                  onClick={() => { navigator.clipboard?.writeText(a.id); showFlash('Atlet-ID kopieret') }}
                  title="Klik for at kopiere — bruges som athleteId i cowork-scripts"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.04em', color: '#4a4844', marginTop: '0.3rem', cursor: 'pointer', wordBreak: 'break-all' }}
                >
                  <span>ID: {a.id}</span>
                  <span style={{ color: '#7a7770' }}>⧉</span>
                </div>
                {(() => {
                  const ls = formatLastSeen(profilesLastSeen[a.user_id])
                  if (!ls) return null
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.3rem' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ls.dotColor, flexShrink: 0 }} />
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.07em', color: ls.dotColor }}>{ls.text}</span>
                    </div>
                  )
                })()}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={s.badge(a.status)}>{statusLabels[a.status]}</span>
                <button style={s.btnDanger} onClick={() => setShowDeleteModal(true)}>Fjern</button>
              </div>
            </div>

            {/* Kompakt ikon-bar — alle sektioner ét tap væk, ingen vandret scroll. */}
            {(() => {
              const navItems = [{ key: 'hub', label: 'Hjem', icon: ic(<path d="M3 9.5L12 2l9 7.5V21H15v-7H9v7H3V9.5z" />) }, ...HUB_SECTIONS]
              const activeLabel = navItems.find(n => n.key === activeTab)?.label
              return (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? '0' : '0.1rem', justifyContent: isMobile ? 'space-between' : 'flex-start', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                    {navItems.map(n => {
                      const active = activeTab === n.key
                      return (
                        <button
                          key={n.key}
                          title={n.label}
                          onClick={() => { setActiveTab(n.key); setEditing(null) }}
                          style={{
                            position: 'relative', background: active ? 'rgba(200,146,58,0.12)' : 'none', border: 'none',
                            borderBottom: active ? '2px solid #c8923a' : '2px solid transparent', marginBottom: '-1px',
                            color: active ? '#c8923a' : '#7a7770', cursor: 'pointer', padding: isMobile ? '0.5rem 0.3rem' : '0.55rem 0.7rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.12s, background 0.12s',
                          }}
                          onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#b8b4a8' }}
                          onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#7a7770' }}
                        >
                          {n.icon}
                          {n.key === 'beskeder' && unreadCounts[a.id] > 0 && (
                            <span style={{ position: 'absolute', top: '0.25rem', right: '0.25rem', background: '#c8923a', color: '#141410', borderRadius: '999px', fontSize: '0.45rem', minWidth: '0.85rem', height: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>{unreadCounts[a.id]}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginTop: '0.6rem' }}>
                    {activeLabel}
                  </div>
                </div>
              )
            })()}

            {/* TAB: HUB — coach-landingsside med status + sektionsnavigation */}
            {activeTab === 'hub' && (() => {
              const todayStr = new Date().toISOString().slice(0, 10)
              const todayR = athleteReadiness.find(r => r.logged_date === todayStr)
              const sig = todayR && todayR.readiness_score != null ? readinessSignal(todayR.readiness_score) : null
              const trainings = weeklyActivity[a.id]?.sessions ?? 0
              const unread = unreadCounts[a.id] ?? 0
              const compDate = a.competition_date
              const weeksToComp = compDate ? Math.ceil((new Date(compDate + 'T12:00:00') - new Date()) / (7 * 24 * 3600 * 1000)) : null
              const stat = [
                sig && { label: 'Parathed i dag', value: todayR.readiness_score, sub: sig.text, color: sig.color },
                { label: 'Træninger denne uge', value: trainings, sub: weeklyActivity[a.id]?.sets ? `${weeklyActivity[a.id].sets} sæt` : 'logget', color: '#edeae2' },
                { label: 'Ulæste beskeder', value: unread, sub: unread > 0 ? 'fra atleten' : 'ingen nye', color: unread > 0 ? '#c8923a' : '#7a7770' },
                weeksToComp != null && { label: 'Til stævne', value: weeksToComp > 0 ? weeksToComp : '0', sub: weeksToComp > 0 ? 'uger' : 'passeret', color: '#c8923a' },
              ].filter(Boolean)
              return (
                <div>
                  {/* Statuslinje */}
                  {stat.length > 0 && (
                    <div style={{ ...s.card, display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${stat.length}, 1fr)`, gap: '1rem' }}>
                      {stat.map((st, i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', borderLeft: i > 0 && !isMobile ? '1px solid rgba(237,234,226,0.07)' : 'none', paddingLeft: i > 0 && !isMobile ? '1rem' : 0 }}>
                          <div style={s.fieldLabel}>{st.label}</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', color: st.color, lineHeight: 1 }}>{st.value}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', letterSpacing: '0.06em' }}>{st.sub}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sektionsgitter */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '1rem' }}>
                    {HUB_SECTIONS.map(sec => (
                      <button
                        key={sec.key}
                        onClick={() => { setActiveTab(sec.key); setEditing(null) }}
                        style={{
                          background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', textAlign: 'left',
                          padding: '1.25rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.6rem',
                          position: 'relative', transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(200,146,58,0.4)'; e.currentTarget.style.background = '#211f1a' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'; e.currentTarget.style.background = '#1c1c18' }}
                      >
                        <div style={{ color: '#c8923a' }}>{sec.icon}</div>
                        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '1rem', color: '#edeae2', fontWeight: 400 }}>{sec.label}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#7a7770', letterSpacing: '0.04em', lineHeight: 1.4 }}>{sec.desc}</div>
                        {sec.key === 'beskeder' && unread > 0 && (
                          <span style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#c8923a', color: '#141410', borderRadius: '999px', fontSize: '0.55rem', padding: '0.1rem 0.4rem', fontWeight: 600 }}>{unread}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* TAB: ANALYSE */}
            {activeTab === 'analyse' && (() => {
              const now = new Date()
              const d28 = new Date(now); d28.setDate(now.getDate() - 28)
              const d28str = d28.toISOString().slice(0, 10)
              const recentLogs = athleteLogs.filter(l => l.logged_at.slice(0, 10) >= d28str)
              const completedSessionIds = new Set(recentLogs.map(l => l.exercises?.session_id).filter(Boolean))
              const totalPlannedSessions = weeks.reduce((s, w) => s + (w.sessions?.length || 0), 0)
              const lastActivityDate = athleteLogs.length ? athleteLogs[0]?.logged_at.slice(0, 10) : null
              const totalSets4w = recentLogs.length

              const nameToCat = {}
              for (const ex of exerciseLibrary) { if (ex.name && ex.category) nameToCat[ex.name.toLowerCase()] = ex.category }
              const squatS = buildLiftSeries(athleteLogs, 'squat', nameToCat, 'Squat')
              const benchS = buildLiftSeries(athleteLogs, 'bænk', nameToCat, 'Bænkpres')
              const deadS = buildLiftSeries(athleteLogs, 'dødl', nameToCat, 'Dødløft')
              const lifts = [
                { label: 'Squat', s: squatS },
                { label: 'Bænkpres', s: benchS },
                { label: 'Dødløft', s: deadS },
              ]

              const weightChartData = [...athleteWeightLogs]
                .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
                .map(l => { const d = new Date(l.logged_at + 'T12:00:00'); return { y: l.weight, label: `${d.getDate()}/${d.getMonth() + 1}` } })

              const sessionMap = {}
              for (const log of athleteLogs) {
                const sid = log.exercises?.session_id
                if (!sid) continue
                if (!sessionMap[sid]) sessionMap[sid] = { id: sid, title: log.exercises?.sessions?.title || 'Ukendt', date: log.logged_at.slice(0, 10), setsLogged: 0, exSets: {} }
                if (log.logged_at.slice(0, 10) > sessionMap[sid].date) sessionMap[sid].date = log.logged_at.slice(0, 10)
                sessionMap[sid].setsLogged++
                if (!sessionMap[sid].exSets[log.exercise_id]) sessionMap[sid].exSets[log.exercise_id] = log.exercises?.sets || 0
              }
              const recentSessions = Object.values(sessionMap)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 10)
                .map(s => ({ ...s, plannedSets: Object.values(s.exSets).reduce((acc, v) => acc + v, 0) }))

              const fmtDate = date => new Date(date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
              const hasPlanVsActual = lifts.some(l => l.s.plannedData.length > 0)

              return (
                <div>
                  {/* AI Rapport */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button style={{ ...s.btnGhost, fontSize: '0.6rem', padding: '0.4rem 0.9rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.35)' }} onClick={() => { setAiExportText(''); setShowAiExport(true) }}>AI Rapport</button>
                  </div>

                  {showAiExport && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowAiExport(false)}>
                      <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.12)', padding: '1.5rem', width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '1rem' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={s.cardLabel}>AI Rapport — {selectedAthlete?.name}</div>
                          <button style={{ background: 'none', border: 'none', color: '#7a7770', cursor: 'pointer', fontSize: '1rem' }} onClick={() => setShowAiExport(false)}>✕</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={s.fieldLabel}>Periode:</span>
                          {[4, 8, 12, 16].map(n => (
                            <button key={n} style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.3rem 0.7rem', color: aiExportWeeks === n ? '#c8923a' : '#7a7770', borderColor: aiExportWeeks === n ? 'rgba(200,146,58,0.5)' : 'rgba(237,234,226,0.15)', background: aiExportWeeks === n ? 'rgba(200,146,58,0.08)' : 'transparent' }} onClick={() => setAiExportWeeks(n)}>{n} uger</button>
                          ))}
                          <input
                            type="number" min="1" max="52"
                            value={aiExportWeeks}
                            onChange={e => setAiExportWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                            style={{ ...s.input, width: '60px', padding: '0.3rem 0.5rem', fontSize: '0.7rem', textAlign: 'center' }}
                          />
                          <button style={{ ...s.btnPrimary, fontSize: '0.6rem', padding: '0.4rem 0.9rem' }} onClick={() => generateAIReport(aiExportWeeks)}>Generer</button>
                        </div>
                        {aiExportText && (
                          <>
                            <textarea
                              readOnly
                              value={aiExportText}
                              style={{ flex: 1, minHeight: '340px', background: '#141410', border: '1px solid rgba(237,234,226,0.1)', color: '#edeae2', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', lineHeight: 1.6, padding: '0.75rem', resize: 'vertical', outline: 'none' }}
                              onClick={e => e.target.select()}
                            />
                            <button
                              style={{ ...s.btnPrimary, fontSize: '0.6rem', padding: '0.5rem 1rem', alignSelf: 'flex-end', background: aiExportCopied ? '#4a7a4a' : undefined }}
                              onClick={() => { navigator.clipboard.writeText(aiExportText); setAiExportCopied(true); setTimeout(() => setAiExportCopied(false), 2000) }}
                            >{aiExportCopied ? '✓ Kopieret!' : 'Kopiér til udklipsholder'}</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 1. Træningsoverblik */}
                  <div style={s.card}>
                    <div style={s.cardLabel}>Træningsoverblik</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1px', background: 'rgba(237,234,226,0.07)', marginBottom: '1rem' }}>
                      {[
                        ['Sessioner (4 uger)', completedSessionIds.size],
                        ['Sæt logget (4 uger)', totalSets4w],
                        ['Sessioner i program', totalPlannedSessions || '—'],
                        ['Seneste aktivitet', lastActivityDate ? fmtDate(lastActivityDate) : '—'],
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: '#1c1c18', padding: '1rem' }}>
                          <div style={s.fieldLabel}>{label}</div>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    {totalPlannedSessions > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                          Compliance
                        </div>
                        <div style={{ flex: 1, height: '3px', background: '#242420', borderRadius: '2px', maxWidth: '180px' }}>
                          <div style={{ height: '3px', width: `${Math.min(100, Math.round(completedSessionIds.size / totalPlannedSessions * 100))}%`, background: '#c8923a', borderRadius: '2px' }} />
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#c8923a' }}>
                          {completedSessionIds.size}/{totalPlannedSessions}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Træningskonsistens heatmap */}
                  {(() => {
                    const trainingDates = new Set(athleteLogs.map(l => l.logged_at.slice(0, 10)))
                    const todayDate = new Date()
                    const WEEKS = 16, CELL = 22, GAP = 3, STEP = CELL + GAP
                    const PAD_LEFT = 18, PAD_TOP = 20
                    const W = PAD_LEFT + WEEKS * STEP + 2
                    const H = PAD_TOP + 7 * STEP
                    const monday = new Date(todayDate)
                    monday.setDate(todayDate.getDate() - ((todayDate.getDay() || 7) - 1) - (WEEKS - 1) * 7)
                    monday.setHours(12, 0, 0, 0)
                    const todayStr = todayDate.toISOString().slice(0, 10)
                    const cells = []
                    const monthLabels = []
                    for (let w = 0; w < WEEKS; w++) {
                      for (let d = 0; d < 7; d++) {
                        const dt = new Date(monday); dt.setDate(monday.getDate() + w * 7 + d)
                        const str = dt.toISOString().slice(0, 10)
                        cells.push({ w, d, str, trained: trainingDates.has(str), today: str === todayStr, future: dt > todayDate })
                      }
                      const wd = new Date(monday); wd.setDate(monday.getDate() + w * 7)
                      if (wd.getDate() <= 7) monthLabels.push({ w, label: ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'][wd.getMonth()] })
                    }
                    const totalDays = cells.filter(c => !c.future && c.trained).length
                    const totalPossible = cells.filter(c => !c.future).length
                    const pct = totalPossible > 0 ? Math.round(totalDays / totalPossible * 100) : 0
                    return (
                      <div style={s.card}>
                        <div style={{ ...s.cardLabel, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                          <span>Træningskonsistens</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#c8923a', fontWeight: 400, letterSpacing: '0.04em', textTransform: 'none' }}>{totalDays} dage · {pct}% de seneste {WEEKS} uger</span>
                        </div>
                        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                          {['M','','O','','F','','S'].map((lbl, i) => lbl && (
                            <text key={i} x={PAD_LEFT - 4} y={PAD_TOP + i * STEP + CELL / 2 + 3.5} textAnchor="end" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{lbl}</text>
                          ))}
                          {monthLabels.map(({ w, label }) => (
                            <text key={w} x={PAD_LEFT + w * STEP + CELL / 2} y={11} textAnchor="middle" fill="#7a7770" fontSize="9" fontFamily="IBM Plex Mono">{label}</text>
                          ))}
                          {cells.map(({ w, d, trained, today, future }) => (
                            <rect key={`${w}-${d}`} x={PAD_LEFT + w * STEP} y={PAD_TOP + d * STEP} width={CELL} height={CELL} rx={4}
                              fill={future ? 'rgba(237,234,226,0.02)' : trained ? '#c8923a' : '#1c1c18'}
                              opacity={future ? 0.3 : trained ? 0.82 : 1}
                              stroke={today ? 'rgba(200,146,58,0.6)' : 'rgba(237,234,226,0.05)'}
                              strokeWidth={today ? 1.5 : 0.5}
                            />
                          ))}
                        </svg>
                      </div>
                    )
                  })()}

                  {/* 3. Primære løft */}
                  <div style={s.card}>
                    <div style={s.cardLabel}>Primære løft — sværeste sæt per session</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
                      {lifts.map(({ label, s: ls }) => (
                        <div key={label}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>{label}</div>
                          <LineChart series={[{ data: ls.actualData, color: '#c8923a' }]} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Planlagt vs faktisk */}
                  {hasPlanVsActual && (
                    <div style={s.card}>
                      <div style={s.cardLabel}>
                        Planlagt vs faktisk
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          {[['#c8923a', false, 'Faktisk'], ['#7a7770', true, 'Planlagt']].map(([color, dashed, lbl]) => (
                            <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                              <svg width="16" height="8" style={{ flexShrink: 0 }}>
                                <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.75" strokeDasharray={dashed ? '4,3' : undefined} />
                              </svg>
                              {lbl}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
                        {lifts.map(({ label, s: ls }) => (
                          <div key={label}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>{label}</div>
                            <LineChart series={[
                              { data: ls.actualData, color: '#c8923a' },
                              { data: ls.plannedData, color: '#7a7770', dashed: true },
                            ]} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Ugentligt volumen */}
                  {(() => {
                    function buildWeeklyVolume(category) {
                      const weekMap = {}
                      for (const log of athleteLogs) {
                        if (log.skipped || !log.weight || !log.reps_completed) continue
                        const cat = nameToCat[(log.exercises?.name || '').toLowerCase()]
                        if (cat !== category) continue
                        const d = new Date(log.logged_at.slice(0, 10) + 'T12:00:00')
                        const day = d.getDay() || 7
                        const monday = new Date(d); monday.setDate(d.getDate() - day + 1)
                        const weekKey = monday.toISOString().slice(0, 10)
                        weekMap[weekKey] = (weekMap[weekKey] || 0) + log.weight * log.reps_completed
                      }
                      const weeks = Object.keys(weekMap).sort().slice(-10)
                      return weeks.map(w => {
                        const d = new Date(w + 'T12:00:00')
                        return { y: Math.round(weekMap[w] / 100) / 10, label: `${d.getDate()}/${d.getMonth() + 1}` }
                      })
                    }
                    const volLifts = [
                      { label: 'Squat', data: buildWeeklyVolume('Squat'), color: '#c8923a' },
                      { label: 'Bænkpres', data: buildWeeklyVolume('Bænkpres'), color: '#6cba6c' },
                      { label: 'Dødløft', data: buildWeeklyVolume('Dødløft'), color: '#6b9fd4' },
                    ]
                    if (!volLifts.some(l => l.data.length > 1)) return null
                    return (
                      <div style={s.card}>
                        <div style={s.cardLabel}>
                          Ugentligt volumen
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#4a4844', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>tons (vægt × reps / 1000)</span>
                        </div>
                        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                          {volLifts.map(({ label, color, data }) => data.length > 0 && (
                            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color }}>
                              <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.75" /></svg>
                              {label}
                            </span>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
                          {volLifts.map(({ label, data, color }) => data.length > 1 && (
                            <div key={label}>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>{label}</div>
                              <LineChart series={[{ data, color }]} height={110} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 5. PR-tidslinje */}
                  {athletePRHistory.length > 0 && (() => {
                    const mainLifts = ['squat', 'bænk', 'bench', 'dødl', 'deadlift']
                    const isMain = name => mainLifts.some(k => name.toLowerCase().includes(k))
                    const fmtPRDate = d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()} ${['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'][dt.getMonth()]} ${dt.getFullYear()}` }
                    const grouped = {}
                    for (const pr of athletePRHistory) {
                      if (!grouped[pr.exercise_name]) grouped[pr.exercise_name] = []
                      grouped[pr.exercise_name].push(pr)
                    }
                    const mainEntries = Object.entries(grouped).filter(([name]) => isMain(name))
                    const otherEntries = Object.entries(grouped).filter(([name]) => !isMain(name))
                    const ordered = [...mainEntries, ...otherEntries].slice(0, 6)
                    if (!ordered.length) return null
                    return (
                      <div style={s.card}>
                        <div style={s.cardLabel}>PR-tidslinje</div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1.25rem' }}>
                          {ordered.map(([name, prs]) => {
                            const sorted = [...prs].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
                            return (
                              <div key={name}>
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: isMain(name) ? '#c8923a' : '#7a7770', marginBottom: '0.5rem' }}>{name}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  {sorted.map((pr, i) => {
                                    const isLatest = i === sorted.length - 1
                                    return (
                                      <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLatest ? '#c8923a' : 'rgba(237,234,226,0.15)', flexShrink: 0 }} />
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: isLatest ? '#edeae2' : '#7a7770', fontWeight: isLatest ? 500 : 400 }}>
                                          {pr.weight} kg{pr.reps > 1 ? ` × ${pr.reps}` : ''}
                                        </span>
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginLeft: 'auto' }}>{fmtPRDate(pr.logged_at.slice(0, 10))}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {/* 6. Kropsvægt */}
                  {weightChartData.length > 1 && (
                    <div style={s.card}>
                      <div style={s.cardLabel}>Kropsvægt</div>
                      <LineChart series={[{ data: weightChartData, color: '#6cba6c' }]} height={120} />
                    </div>
                  )}

                  {/* 5. Seneste sessioner */}
                  <div style={s.card}>
                    <div style={s.cardLabel}>Seneste sessioner</div>
                    {recentSessions.length === 0 ? (
                      <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen loggede sessioner endnu.</div>
                    ) : recentSessions.map((sess, i) => (
                      <div key={sess.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: i < recentSessions.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', color: '#b8b4a8' }}>{sess.title}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', marginTop: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{fmtDate(sess.date)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem' }}>
                            <span style={{ color: sess.plannedSets > 0 && sess.setsLogged >= sess.plannedSets ? '#6cba6c' : '#c8923a' }}>{sess.setsLogged}</span>
                            {sess.plannedSets > 0 && <span style={{ color: '#4a4844' }}>/{sess.plannedSets}</span>}
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4a4844' }}>sæt</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 6. RPE analyse */}
                  {(() => {
                    const rpeCategories = ['Squat', 'Bænkpres', 'Dødløft']
                    const logsWithRpe = athleteLogs.filter(l => l.rpe_actual != null && !l.skipped)
                    if (logsWithRpe.length === 0) return null

                    const lbl = date => { const d = new Date(date + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }

                    function buildRpeSeries(category) {
                      const filtered = logsWithRpe.filter(l => nameToCat[(l.exercises?.name || '').toLowerCase()] === category)
                      if (!filtered.length) return { actualData: [], plannedData: [] }
                      const dateMap = {}
                      for (const log of filtered) {
                        const date = log.logged_at.slice(0, 10)
                        if (!dateMap[date]) dateMap[date] = { actual: [], planned: [] }
                        dateMap[date].actual.push(log.rpe_actual)
                        const p = parsePlannedRpe(log.exercises?.intensity)
                        if (p) dateMap[date].planned.push(p)
                      }
                      const dates = Object.keys(dateMap).sort()
                      const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
                      return {
                        actualData: dates.map(date => ({ y: Math.round(avg(dateMap[date].actual) * 10) / 10, label: lbl(date) })),
                        plannedData: dates.filter(d => dateMap[d].planned.length > 0).map(date => ({ y: Math.round(avg(dateMap[date].planned) * 10) / 10, label: lbl(date) })),
                      }
                    }

                    const rpeSeries = rpeCategories.map(cat => ({ label: cat, ...buildRpeSeries(cat) }))
                    const hasRpeCharts = rpeSeries.some(s => s.actualData.length > 0)

                    // RPE afvigelse
                    const deviations = logsWithRpe.map(l => {
                      const p = parsePlannedRpe(l.exercises?.intensity)
                      return p != null ? l.rpe_actual - p : null
                    }).filter(d => d !== null)
                    const avgDev = deviations.length > 0 ? Math.round(deviations.reduce((a, b) => a + b, 0) / deviations.length * 10) / 10 : null

                    // Fatigue trend: session-level avg RPE over time
                    const sessRpeMap = {}
                    for (const log of logsWithRpe) {
                      const date = log.logged_at.slice(0, 10)
                      if (!sessRpeMap[date]) sessRpeMap[date] = []
                      sessRpeMap[date].push(log.rpe_actual)
                    }
                    const sessRpeDates = Object.keys(sessRpeMap).sort()
                    const sessRpeAvgs = sessRpeDates.map(d => sessRpeMap[d].reduce((a, b) => a + b, 0) / sessRpeMap[d].length)
                    const last3 = sessRpeAvgs.slice(-3)
                    const fatigueWarning = last3.length >= 3 && last3[2] > last3[1] + 0.1 && last3[1] > last3[0] + 0.1

                    return (
                      <>
                        {fatigueWarning && (
                          <div style={{ ...s.card, borderLeft: '3px solid #c8923a', background: 'rgba(200,146,58,0.06)' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.5rem' }}>
                              ⚠ Stigende RPE-trend
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#b8b4a8' }}>
                              RPE har steget i de seneste {last3.length} sessioner ({last3.map(v => Math.round(v * 10) / 10).join(' → ')}). Dette kan indikere akkumuleret træthed.
                            </div>
                          </div>
                        )}

                        {avgDev != null && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>RPE afvigelse</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: 'rgba(237,234,226,0.07)' }}>
                              {[
                                ['Gns. afvigelse', `${avgDev > 0 ? '+' : ''}${avgDev}`, avgDev > 1 ? '#c8923a' : avgDev < -0.5 ? '#6cba6c' : '#edeae2'],
                                ['Sæt med RPE', deviations.length, '#edeae2'],
                              ].map(([label, value, color]) => (
                                <div key={label} style={{ background: '#1c1c18', padding: '1rem' }}>
                                  <div style={s.fieldLabel}>{label}</div>
                                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color, lineHeight: 1 }}>{value}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginTop: '0.75rem', letterSpacing: '0.06em' }}>
                              Positiv afvigelse = faktisk RPE højere end planlagt
                            </div>
                          </div>
                        )}

                        {hasRpeCharts && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>
                              RPE — planlagt vs faktisk
                              <div style={{ display: 'flex', gap: '1rem' }}>
                                {[['#c8923a', false, 'Faktisk'], ['#7a7770', true, 'Planlagt']].map(([color, dashed, lbl]) => (
                                  <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                                    <svg width="16" height="8" style={{ flexShrink: 0 }}>
                                      <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.75" strokeDasharray={dashed ? '4,3' : undefined} />
                                    </svg>
                                    {lbl}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
                              {rpeSeries.map(({ label, actualData, plannedData }) => actualData.length > 0 && (
                                <div key={label}>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>{label}</div>
                                  <LineChart series={[
                                    { data: actualData, color: '#c8923a' },
                                    { data: plannedData, color: '#7a7770', dashed: true },
                                  ]} height={110} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {/* 7. Readiness analyse */}
                  {(() => {
                    if (athleteReadiness.length === 0) return null
                    const fmtR = date => { const d = new Date(date + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }
                    const scoreData = [...athleteReadiness].reverse().map(r => ({ y: r.readiness_score, label: fmtR(r.logged_date) }))
                    const d14str = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)
                    const last14 = athleteReadiness.filter(r => r.logged_date >= d14str)
                    const sleepEntries = last14.filter(r => r.sleep_hours != null)
                    const avgSleep = sleepEntries.length > 0 ? Math.round(sleepEntries.reduce((s, r) => s + r.sleep_hours, 0) / sleepEntries.length * 10) / 10 : null
                    const soreMap = {}
                    for (const r of athleteReadiness) for (const z of (r.sore_zones || [])) soreMap[z] = (soreMap[z] || 0) + 1
                    const topZones = Object.entries(soreMap).sort((a, b) => b[1] - a[1]).slice(0, 4)
                    const sorted = [...athleteReadiness].sort((a, b) => b.logged_date.localeCompare(a.logged_date))
                    let lowStreak = 0
                    for (const r of sorted) { if (r.readiness_score < 50) lowStreak++; else break }

                    return (
                      <>
                        {lowStreak >= 3 && (
                          <div style={{ ...s.card, borderLeft: '3px solid #e05555', background: 'rgba(224,85,85,0.05)' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e05555', marginBottom: '0.5rem' }}>
                              ⚠ Lav parathed {lowStreak} dage i træk
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#b8b4a8' }}>
                              Atleten har haft parathedsscore under 50 i {lowStreak} dage i træk. Overvej en lettere session eller fri dag.
                            </div>
                          </div>
                        )}
                        <div style={s.card}>
                          <div style={s.cardLabel}>Parathed over tid</div>
                          {scoreData.length > 1
                            ? <LineChart series={[{ data: scoreData, color: '#6cba6c' }]} height={110} />
                            : <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ikke nok data endnu.</div>}
                        </div>
                        <div style={s.card}>
                          <div style={s.cardLabel}>Parathed — nøgletal</div>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '1px', background: 'rgba(237,234,226,0.07)', marginBottom: topZones.length > 0 ? '1rem' : 0 }}>
                            {[
                              ['Logs i alt', athleteReadiness.length],
                              ['Gns. søvn (2 uger)', avgSleep != null ? `${avgSleep}t` : '—'],
                              ['Seneste score', athleteReadiness[0]?.readiness_score ?? '—'],
                            ].map(([label, value]) => (
                              <div key={label} style={{ background: '#1c1c18', padding: '1rem' }}>
                                <div style={s.fieldLabel}>{label}</div>
                                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1 }}>{value}</div>
                              </div>
                            ))}
                          </div>
                          {topZones.length > 0 && (
                            <div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>Hyppigst ømme zoner</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {topZones.map(([zone, count]) => (
                                  <div key={zone} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', padding: '0.2rem 0.6rem', color: '#b8b4a8' }}>
                                    {zone} <span style={{ color: '#4a4844' }}>× {count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )
                  })()}

                  {/* === EXTENDED ANALYSE === */}
                  {(() => {
                    // Build session rating map (session_id → { date, rating })
                    const sessRatingMap = {}
                    for (const log of athleteLogs) {
                      const sid = log.exercises?.session_id
                      const rating = log.exercises?.sessions?.athlete_rating
                      if (sid && rating != null && !sessRatingMap[sid]) {
                        sessRatingMap[sid] = { date: log.logged_at.slice(0, 10), rating }
                      }
                    }

                    // --- 1. Restitutionssignal ---
                    const sortedRead = [...athleteReadiness].sort((a, b) => b.logged_date.localeCompare(a.logged_date))
                    let streak60 = 0
                    for (const r of sortedRead) { if (r.readiness_score < 60) streak60++; else break }
                    const logsWithPlannedRpe = athleteLogs.filter(l => !l.skipped && l.rpe_actual != null && parsePlannedRpe(l.exercises?.intensity) != null)
                    const recentRpeDevs = logsWithPlannedRpe.slice(-20).map(l => l.rpe_actual - parsePlannedRpe(l.exercises?.intensity))
                    const avgRpeDev30 = recentRpeDevs.length > 0 ? recentRpeDevs.reduce((a, b) => a + b, 0) / recentRpeDevs.length : 0
                    const overtrainingAlert = streak60 >= 3 && avgRpeDev30 > 0.5

                    // --- 2. Belastningsoverblik (weekly volume) ---
                    const weekVol = {}
                    for (const log of athleteLogs) {
                      if (log.skipped) continue
                      const wn = log.exercises?.sessions?.weeks?.week_number
                      if (!wn) continue
                      if (!weekVol[wn]) weekVol[wn] = { logged: 0, planned: 0 }
                      weekVol[wn].logged++
                    }
                    for (const week of weeks) {
                      const wn = week.week_number
                      if (!weekVol[wn]) weekVol[wn] = { logged: 0, planned: 0 }
                      for (const sess of (week.sessions || []))
                        for (const ex of (sess.exercises || []))
                          weekVol[wn].planned += ex.sets || 0
                    }
                    const weekBars = Object.entries(weekVol)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .slice(-8)
                      .map(([wn, d]) => ({ label: `U${wn}`, value: d.logged, planned: d.planned, highlight: d.planned > 0 && d.logged / d.planned < 0.7 }))

                    // --- 3. Readiness vs RPE scatter ---
                    const trainingDayData = {}
                    for (const log of athleteLogs) {
                      if (log.skipped) continue
                      const date = log.logged_at.slice(0, 10)
                      const p = parsePlannedRpe(log.exercises?.intensity)
                      if (log.rpe_actual != null && p != null) {
                        if (!trainingDayData[date]) trainingDayData[date] = { rpeDevs: [] }
                        trainingDayData[date].rpeDevs.push(log.rpe_actual - p)
                      }
                    }
                    for (const r of athleteReadiness) {
                      if (trainingDayData[r.logged_date]) trainingDayData[r.logged_date].readiness = r.readiness_score
                    }
                    const scatterPoints = Object.entries(trainingDayData)
                      .filter(([, d]) => d.readiness != null && d.rpeDevs.length > 0)
                      .map(([, d]) => ({ x: d.readiness, y: Math.round(d.rpeDevs.reduce((a, b) => a + b, 0) / d.rpeDevs.length * 10) / 10 }))
                    const lowRead = scatterPoints.filter(p => p.x < 60)
                    const highRead = scatterPoints.filter(p => p.x >= 60)
                    const avgDevLow = lowRead.length > 0 ? Math.round(lowRead.reduce((a, b) => a + b.y, 0) / lowRead.length * 10) / 10 : null
                    const avgDevHigh = highRead.length > 0 ? Math.round(highRead.reduce((a, b) => a + b.y, 0) / highRead.length * 10) / 10 : null
                    const readInsight = avgDevLow != null && avgDevHigh != null
                      ? avgDevLow > avgDevHigh + 0.5
                        ? `Når readiness er under 60 løfter ${a.name.split(' ')[0]} typisk over planlagt RPE (Ø ${avgDevLow > 0 ? '+' : ''}${avgDevLow} vs ${avgDevHigh > 0 ? '+' : ''}${avgDevHigh})`
                        : `Ingen klar sammenhæng mellem parathed og RPE-afvigelse (data: ${scatterPoints.length} træningsdage)`
                      : null

                    // --- 4. Sleep vs feedback ---
                    const sleepFeedbackPairs = []
                    for (const r of athleteReadiness) {
                      if (r.sleep_hours == null) continue
                      const sessionsOnDay = Object.values(sessRatingMap).filter(s => s.date === r.logged_date)
                      if (sessionsOnDay.length > 0) {
                        const avgRating = sessionsOnDay.reduce((a, b) => a + b.rating, 0) / sessionsOnDay.length
                        sleepFeedbackPairs.push({ sleep: r.sleep_hours, rating: avgRating })
                      }
                    }
                    const sleepBuckets = {}
                    for (const p of sleepFeedbackPairs) {
                      const b = p.sleep < 6 ? '<6t' : p.sleep < 7 ? '6-7t' : p.sleep < 8 ? '7-8t' : '8t+'
                      if (!sleepBuckets[b]) sleepBuckets[b] = []
                      sleepBuckets[b].push(p.rating)
                    }
                    const sleepBucketAvgs = Object.entries(sleepBuckets)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([k, vs]) => ({ bucket: k, avg: Math.round(vs.reduce((a, b) => a + b, 0) / vs.length * 10) / 10, n: vs.length }))
                    const bestBucket = sleepBucketAvgs.length > 0 ? sleepBucketAvgs.reduce((best, cur) => cur.avg > best.avg ? cur : best, sleepBucketAvgs[0]) : null

                    // --- 5. Lift trend ---
                    function liftTrend(data) {
                      if (data.length < 3) return null
                      const half = Math.ceil(data.length / 2)
                      const avg = arr => arr.reduce((a, b) => a + b.y, 0) / arr.length
                      const diff = avg(data.slice(-half)) - avg(data.slice(0, half))
                      if (diff > 2) return { text: '↑ Fremgang', color: '#6cba6c' }
                      if (diff < -2) return { text: '↓ Tilbagegang', color: '#e05555' }
                      return { text: '→ Stabilt', color: '#c8923a' }
                    }
                    function trendLine(data) {
                      const n = data.length
                      if (n < 2) return []
                      const xs = data.map((_, i) => i), ys = data.map(d => d.y)
                      const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0)
                      const sxy = xs.reduce((a, xi, i) => a + xi * ys[i], 0), sx2 = xs.reduce((a, xi) => a + xi * xi, 0)
                      const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx)
                      const intercept = (sy - slope * sx) / n
                      return [{ y: intercept, label: data[0].label }, { y: intercept + slope * (n - 1), label: data[n - 1].label }]
                    }

                    return (
                      <>
                        {overtrainingAlert && (
                          <div style={{ ...s.card, borderLeft: '3px solid #e05555', background: 'rgba(224,85,85,0.06)' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#e05555', marginBottom: '0.5rem' }}>
                              ⚠ Mulig overtræning — overvej deload
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#b8b4a8' }}>
                              Parathed under 60 i {streak60} dage i træk og RPE konsekvent over planlagt (Ø +{Math.round(avgRpeDev30 * 10) / 10}). Overvej en deload-uge eller hviledage.
                            </div>
                          </div>
                        )}

                        {weekBars.length > 0 && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>Belastningsoverblik — sæt per uge</div>
                            <BarChart bars={weekBars} height={110} />
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                              {[['#c8923a', 'Normal'], ['#e05555', 'Under 70% compliance']].map(([color, lbl]) => (
                                <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color }}>
                                  <span style={{ width: 10, height: 10, background: color, display: 'inline-block', opacity: 0.75, flexShrink: 0 }} />{lbl}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {scatterPoints.length >= 3 && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>Readiness vs RPE-afvigelse</div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                              <div>
                                <ScatterPlot points={scatterPoints} height={130} />
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
                                  {[['#6cba6c', 'Readiness ≥ 60'], ['#e05555', 'Readiness < 60']].map(([color, lbl]) => (
                                    <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color }}>
                                      <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill={color} opacity="0.7" /></svg>{lbl}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.75rem', paddingTop: isMobile ? 0 : '1rem' }}>
                                {avgDevLow != null && (
                                  <div style={{ background: '#141410', padding: '0.75rem' }}>
                                    <div style={s.fieldLabel}>Lav readiness (&lt;60)</div>
                                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: avgDevLow > 0.5 ? '#e05555' : '#edeae2' }}>{avgDevLow > 0 ? '+' : ''}{avgDevLow}</div>
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', textTransform: 'uppercase' }}>Ø RPE-afvigelse</div>
                                  </div>
                                )}
                                {avgDevHigh != null && (
                                  <div style={{ background: '#141410', padding: '0.75rem' }}>
                                    <div style={s.fieldLabel}>Høj readiness (≥60)</div>
                                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: '#edeae2' }}>{avgDevHigh > 0 ? '+' : ''}{avgDevHigh}</div>
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', textTransform: 'uppercase' }}>Ø RPE-afvigelse</div>
                                  </div>
                                )}
                                {readInsight && (
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', lineHeight: 1.6, letterSpacing: '0.02em' }}>{readInsight}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {sleepFeedbackPairs.length >= 2 && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>Søvn vs. træningsfeedback</div>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                              {sleepBucketAvgs.map(({ bucket, avg, n }) => (
                                <div key={bucket} style={{ textAlign: 'center', padding: '0.75rem 1rem', background: '#141410', border: '1px solid rgba(237,234,226,0.07)', flex: '1 1 60px', minWidth: '60px' }}>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>{bucket}</div>
                                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: avg >= 4 ? '#6cba6c' : avg >= 3 ? '#c8923a' : '#e05555' }}>{avg}</div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#4a4844', textTransform: 'uppercase', marginTop: '0.1rem' }}>{n} log{n !== 1 ? 's' : ''}</div>
                                </div>
                              ))}
                            </div>
                            {bestBucket && (
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', letterSpacing: '0.04em' }}>
                                Bedste træningsfeedback ved {bestBucket.bucket} søvn — Ø {bestBucket.avg}/5
                              </div>
                            )}
                          </div>
                        )}

                        {lifts.some(l => l.s.actualData.length >= 3) && (
                          <div style={s.card}>
                            <div style={s.cardLabel}>
                              Fremgang på primære løft
                              <div style={{ display: 'flex', gap: '1rem' }}>
                                {[['#c8923a', false, 'Løftet'], ['rgba(200,146,58,0.4)', true, 'Trend']].map(([color, dashed, lbl]) => (
                                  <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                                    <svg width="16" height="8" style={{ flexShrink: 0 }}>
                                      <line x1="0" y1="4" x2="16" y2="4" stroke={color} strokeWidth="1.75" strokeDasharray={dashed ? '4,3' : undefined} />
                                    </svg>
                                    {lbl}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1.5rem' }}>
                              {lifts.map(({ label, s: ls }) => {
                                if (ls.actualData.length < 2) return null
                                const trend = liftTrend(ls.actualData)
                                const tl = trendLine(ls.actualData)
                                return (
                                  <div key={label}>
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>{label}</span>
                                      {trend && <span style={{ color: trend.color, letterSpacing: '0.06em' }}>{trend.text}</span>}
                                    </div>
                                    <LineChart series={[
                                      { data: ls.actualData, color: '#c8923a' },
                                      { data: tl, color: 'rgba(200,146,58,0.4)', dashed: true },
                                    ]} height={100} />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                </div>
              )
            })()}

            {/* TAB: OPVARMNING */}
            {activeTab === 'opvarmning' && (() => {
              const CATEGORIES = ['Squat', 'Bænkpres', 'Dødløft']
              const athleteId = a.id

              function getTemplate(category, forAthleteId) {
                return warmupTemplates.find(t => t.exercise_category === category && t.athlete_id === forAthleteId)
              }

              function startEdit(category, forAthleteId) {
                const tpl = getTemplate(category, forAthleteId)
                setEditingWarmup({ category, athleteId: forAthleteId })
                setWarmupDraftSteps(tpl ? [...tpl.steps] : [])
                setWarmupNewStep('')
              }

              return (
                <div>
                  <div style={{ ...s.card, marginBottom: '0.5rem' }}>
                    <div style={s.cardLabel}>Atlet-specifik opvarmning — {a.name.split(' ')[0]}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.06em', marginBottom: '1.25rem' }}>
                      Tilsidesætter standard. Vises til atleten når de åbner en session med det pågældende løft.
                    </div>
                    {CATEGORIES.map(category => {
                      const tpl = getTemplate(category, athleteId)
                      const stdTpl = getTemplate(category, null)
                      const isEditing = editingWarmup?.category === category && editingWarmup?.athleteId === athleteId
                      return (
                        <div key={category} style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#edeae2' }}>{category}</div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              {tpl && !isEditing && (
                                <button style={s.btnDanger} onClick={() => deleteWarmupTemplate(tpl.id)}>Slet</button>
                              )}
                              {!isEditing && (
                                <button style={s.btnEdit} onClick={() => startEdit(category, athleteId)}>
                                  {tpl ? 'Rediger' : 'Opret'}
                                </button>
                              )}
                            </div>
                          </div>

                          {!isEditing && !tpl && stdTpl && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace', monospace", fontSize: '0.52rem', color: '#4a4844', fontStyle: 'italic' }}>Bruger standard ({stdTpl.steps.length} trin)</div>
                              <button style={s.btnEdit} onClick={() => { setEditingWarmup({ category, athleteId }); setWarmupDraftSteps([...stdTpl.steps]); setWarmupNewStep('') }}>Tilpas til atlet</button>
                            </div>
                          )}
                          {!isEditing && !tpl && !stdTpl && (
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen skabelon sat</div>
                          )}
                          {!isEditing && tpl && (
                            <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                              {tpl.steps.map((step, i) => (
                                <li key={i} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.84rem', color: '#b8b4a8', marginBottom: '0.25rem' }}>{step}</li>
                              ))}
                            </ol>
                          )}

                          {isEditing && (
                            <div>
                              <ol style={{ margin: '0 0 0.75rem', paddingLeft: '1.2rem' }}>
                                {warmupDraftSteps.map((step, i) => (
                                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                    <span style={{ flex: 1, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.84rem', color: '#b8b4a8' }}>{step}</span>
                                    <button
                                      style={{ ...s.btnEdit, fontSize: '0.48rem', padding: '0.1rem 0.4rem', color: '#e05555', borderColor: 'rgba(224,85,85,0.25)' }}
                                      onClick={() => setWarmupDraftSteps(prev => prev.filter((_, j) => j !== i))}
                                    >✕</button>
                                  </li>
                                ))}
                              </ol>
                              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <input
                                  style={{ ...s.fieldInput, flex: 1, fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                                  placeholder='F.eks. "Hip circles 2×10"'
                                  value={warmupNewStep}
                                  onChange={e => setWarmupNewStep(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && warmupNewStep.trim()) {
                                      setWarmupDraftSteps(prev => [...prev, warmupNewStep.trim()])
                                      setWarmupNewStep('')
                                    }
                                  }}
                                />
                                <button
                                  style={s.btnEdit}
                                  onClick={() => { if (warmupNewStep.trim()) { setWarmupDraftSteps(prev => [...prev, warmupNewStep.trim()]); setWarmupNewStep('') } }}
                                >+ Tilføj</button>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button style={s.btnGhost} onClick={() => { setEditingWarmup(null); setWarmupNewStep('') }}>Annuller</button>
                                <button style={s.btnPrimary} onClick={() => saveWarmupTemplate(category, warmupDraftSteps, athleteId)} disabled={saving}>Gem</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div style={s.card}>
                    <div style={s.cardLabel}>Standard opvarmning — alle atleter</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.06em', marginBottom: '1.25rem' }}>
                      Bruges hvis ingen atlet-specifik skabelon er sat.
                    </div>
                    {CATEGORIES.map(category => {
                      const stdTpl = getTemplate(category, null)
                      const isEditing = editingWarmup?.category === category && editingWarmup?.athleteId === null
                      return (
                        <div key={category} style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770' }}>{category}</div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              {stdTpl && !isEditing && (
                                <button style={s.btnDanger} onClick={() => deleteWarmupTemplate(stdTpl.id)}>Slet</button>
                              )}
                              {!isEditing && (
                                <button style={s.btnEdit} onClick={() => { setEditingWarmup({ category, athleteId: null }); setWarmupDraftSteps(stdTpl ? [...stdTpl.steps] : []); setWarmupNewStep('') }}>
                                  {stdTpl ? 'Rediger' : 'Opret'}
                                </button>
                              )}
                            </div>
                          </div>
                          {!isEditing && !stdTpl && (
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen standard sat</div>
                          )}
                          {!isEditing && stdTpl && (
                            <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                              {stdTpl.steps.map((step, i) => (
                                <li key={i} style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.84rem', color: '#b8b4a8', marginBottom: '0.25rem' }}>{step}</li>
                              ))}
                            </ol>
                          )}
                          {isEditing && (
                            <div>
                              <ol style={{ margin: '0 0 0.75rem', paddingLeft: '1.2rem' }}>
                                {warmupDraftSteps.map((step, i) => (
                                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                    <span style={{ flex: 1, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.84rem', color: '#b8b4a8' }}>{step}</span>
                                    <button
                                      style={{ ...s.btnEdit, fontSize: '0.48rem', padding: '0.1rem 0.4rem', color: '#e05555', borderColor: 'rgba(224,85,85,0.25)' }}
                                      onClick={() => setWarmupDraftSteps(prev => prev.filter((_, j) => j !== i))}
                                    >✕</button>
                                  </li>
                                ))}
                              </ol>
                              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <input
                                  style={{ ...s.fieldInput, flex: 1, fontSize: '0.82rem', padding: '0.4rem 0.6rem' }}
                                  placeholder='F.eks. "Foam roll 5 min"'
                                  value={warmupNewStep}
                                  onChange={e => setWarmupNewStep(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && warmupNewStep.trim()) {
                                      setWarmupDraftSteps(prev => [...prev, warmupNewStep.trim()])
                                      setWarmupNewStep('')
                                    }
                                  }}
                                />
                                <button
                                  style={s.btnEdit}
                                  onClick={() => { if (warmupNewStep.trim()) { setWarmupDraftSteps(prev => [...prev, warmupNewStep.trim()]); setWarmupNewStep('') } }}
                                >+ Tilføj</button>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button style={s.btnGhost} onClick={() => { setEditingWarmup(null); setWarmupNewStep('') }}>Annuller</button>
                                <button style={s.btnPrimary} onClick={() => saveWarmupTemplate(category, warmupDraftSteps, null)} disabled={saving}>Gem</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* TAB: OVERSIGT */}
            {activeTab === 'oversigt' && (
              <div>
              {(() => {
                const rawTs = profilesLastSeen[a.user_id]
                if (!rawTs) return null
                const d = new Date(rawTs)
                const exact = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }) + ' kl. ' + d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', color: '#4a4844', marginBottom: '1rem' }}>
                    Sidst aktiv: {exact}
                  </div>
                )
              })()}
              {(() => {
                const todayStr = new Date().toISOString().slice(0, 10)
                const todayR = athleteReadiness.find(r => r.logged_date === todayStr)
                if (!todayR) return null
                const sig = readinessSignal(todayR.readiness_score)
                const prevR = athleteReadiness.find(r => r.logged_date < todayStr)
                let trend = null
                if (prevR && todayR.readiness_score != null && prevR.readiness_score != null) {
                  const d = todayR.readiness_score - prevR.readiness_score
                  trend = d > 2 ? { text: `↑ +${d} vs. sidst`, color: '#6cba6c' }
                    : d < -2 ? { text: `↓ ${d} vs. sidst`, color: '#e05555' }
                    : { text: '= som sidst', color: '#7a7770' }
                }
                const params = [
                  todayR.sleep_hours != null && ['Søvn', `${todayR.sleep_hours}t`],
                  todayR.energy != null && ['Energi', `${todayR.energy}/5`],
                  todayR.motivation != null && ['Motivation', `${todayR.motivation}/5`],
                  todayR.stress != null && ['Stress', `${todayR.stress}/5`],
                  todayR.soreness_level != null && ['Ømhed', `${todayR.soreness_level}/5`],
                ].filter(Boolean)
                return (
                  <div style={{ ...s.card, background: sig.bg, marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.9rem' }}>
                        <div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.3rem' }}>Parathed i dag</div>
                          <div style={{ fontSize: '0.95rem', color: sig.color }}>{sig.text}</div>
                          {trend && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: trend.color, letterSpacing: '0.06em', marginTop: '0.25rem' }}>{trend.text}</div>}
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1.6rem', fontWeight: 500, color: sig.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                          {todayR.readiness_score}<span style={{ fontSize: '0.55rem', color: '#4a4844', fontWeight: 400, marginLeft: '0.2rem' }}>/100</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '1.1rem', flexWrap: 'wrap' }}>
                        {params.map(([label, val]) => (
                          <div key={label} style={{ textAlign: 'center' }}>
                            <div style={s.fieldLabel}>{label}</div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', color: '#edeae2' }}>{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {todayR.sore_zones?.length > 0 && (
                      <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <div style={s.fieldLabel}>Lokal ømhed</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#7a7770' }}>{todayR.sore_zones.join(', ')}</div>
                      </div>
                    )}
                  </div>
                )
              })()}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }}>
                <div style={s.card}>
                  <div style={s.cardLabel}>
                    Resultater
                    <button style={s.btnEdit} onClick={() => startEdit('stats', { squat: a.squat, bench: a.bench, deadlift: a.deadlift, training_squat: a.training_squat, training_bench: a.training_bench, training_deadlift: a.training_deadlift, status: a.status, weight_class: a.weight_class, age: a.age, competition_date: a.competition_date || '', vacation_until: a.vacation_until || '' })}>Rediger</button>
                  </div>
                  {editing === 'stats' ? (
                    <div>
                      {[['Alder', 'age'], ['Vægtklasse (kg)', 'weight_class']].map(([label, key]) => (
                        <div key={key} style={{ marginBottom: '0.75rem' }}>
                          <div style={s.fieldLabel}>{label}</div>
                          <input style={s.fieldInput} type="number" value={editData[key] || ''} onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))} />
                        </div>
                      ))}
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', margin: '1rem 0 0.5rem' }}>Konkurrencemaks</div>
                      {[['Squat (kg)', 'squat'], ['Bænkpres (kg)', 'bench'], ['Dødløft (kg)', 'deadlift']].map(([label, key]) => (
                        <div key={key} style={{ marginBottom: '0.75rem' }}>
                          <div style={s.fieldLabel}>{label}</div>
                          <input style={s.fieldInput} type="number" value={editData[key] || ''} onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))} />
                        </div>
                      ))}
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', margin: '1rem 0 0.5rem' }}>Træningsmaks</div>
                      {[['Squat (kg)', 'training_squat'], ['Bænkpres (kg)', 'training_bench'], ['Dødløft (kg)', 'training_deadlift']].map(([label, key]) => (
                        <div key={key} style={{ marginBottom: '0.75rem' }}>
                          <div style={s.fieldLabel}>{label}</div>
                          <input style={s.fieldInput} type="number" value={editData[key] || ''} onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))} />
                        </div>
                      ))}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={s.fieldLabel}>Status</div>
                        <select style={s.fieldSelect} value={editData.status} onChange={e => setEditData(prev => ({ ...prev, status: e.target.value }))}>
                          <option value="active">Aktiv</option>
                          <option value="peaking">Peaking</option>
                          <option value="offseason">Off-season</option>
                          <option value="ferie">Ferie</option>
                        </select>
                      </div>
                      {editData.status === 'ferie' && (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={s.fieldLabel}>Tilbage d. <span style={{ textTransform: 'none', fontWeight: 400, color: '#4a4844' }}>(valgfrit — tom = indtil du ændrer status)</span></div>
                          <input style={s.fieldInput} type="date" value={editData.vacation_until || ''} onChange={e => setEditData(prev => ({ ...prev, vacation_until: e.target.value }))} />
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', marginTop: '0.3rem', letterSpacing: '0.04em' }}>Atleten er ude af Prioritet under ferien og dukker op igen som "planlæg" når datoen er passeret.</div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                        <button style={s.btnGhost} onClick={() => setEditing(null)}>Annuller</button>
                        <button style={s.btnPrimary} onClick={() => saveEdit()} disabled={saving}>{saving ? 'Gemmer...' : 'Gem'}</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
                        <div><div style={s.fieldLabel}>Alder</div><div style={{ fontSize: '0.9rem', color: '#b8b4a8' }}>{a.age ? a.age + ' år' : 'Ikke angivet'}</div></div>
                        <div><div style={s.fieldLabel}>Vægtklasse</div><div style={{ fontSize: '0.9rem', color: '#b8b4a8' }}>{a.weight_class ? a.weight_class + ' kg' : 'Ikke angivet'}</div></div>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.5rem' }}>Konkurrencemaks</div>
                      <div style={s.statRow}>
                        <div style={s.statCell}><div style={s.statNum}>{a.squat || 0}</div><div style={s.statLabel}>Squat</div></div>
                        <div style={s.statCell}><div style={s.statNum}>{a.bench || 0}</div><div style={s.statLabel}>Bænk</div></div>
                        <div style={s.statCell}><div style={s.statNum}>{a.deadlift || 0}</div><div style={s.statLabel}>Dødløft</div></div>
                      </div>
                      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.5rem' }}>Træningsmaks</div>
                        <div style={s.statRow}>
                          <div style={s.statCell}><div style={s.statNum}>{a.training_squat || 0}</div><div style={s.statLabel}>Squat</div></div>
                          <div style={s.statCell}><div style={s.statNum}>{a.training_bench || 0}</div><div style={s.statLabel}>Bænk</div></div>
                          <div style={s.statCell}><div style={s.statNum}>{a.training_deadlift || 0}</div><div style={s.statLabel}>Dødløft</div></div>
                        </div>
                      </div>
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(237,234,226,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div><div style={s.fieldLabel}>Comp total</div><div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: '#edeae2' }}>{total} <span style={{ fontSize: '0.9rem', color: '#7a7770' }}>kg</span></div></div>
                        <div><div style={s.fieldLabel}>Trænings total</div><div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: '#7a7770' }}>{trainingTotal} <span style={{ fontSize: '0.9rem', color: '#4a4844' }}>kg</span></div></div>
                      </div>
                      {currentWeight !== null && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
                          <div style={s.fieldLabel}>Aktuel kropsvægt</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: '#edeae2' }}>
                              {currentWeight} <span style={{ fontSize: '0.9rem', color: '#7a7770', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300 }}>kg</span>
                            </div>
                            {weightTrend !== null && (
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: weightTrend > 0 ? '#c8923a' : weightTrend < 0 ? '#6cba6c' : '#7a7770' }}>
                                {weightTrend > 0 ? '↑ +' : weightTrend < 0 ? '↓ ' : '→ '}{weightTrend}kg siden forrige uge
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={s.card}>
                  <div style={s.cardLabel}>Kostmål</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <div style={s.fieldLabel}>Dagligt kcal-mål</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: a.kcal_target ? '#edeae2' : '#4a4844' }}>{a.kcal_target || 'Ikke sat'} {a.kcal_target ? <span style={{ fontSize: '0.85rem', color: '#7a7770', fontFamily: 'sans-serif' }}>kcal</span> : ''}</div>
                    </div>
                    <div>
                      <div style={s.fieldLabel}>Dagligt proteinmål</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: a.protein_target ? '#edeae2' : '#4a4844' }}>{a.protein_target || 'Ikke sat'} {a.protein_target ? <span style={{ fontSize: '0.85rem', color: '#7a7770', fontFamily: 'sans-serif', fontWeight: 300 }}>g</span> : ''}</div>
                    </div>
                    <button style={{ ...s.btnGhost, alignSelf: 'flex-start', marginTop: '0.5rem' }} onClick={() => { setActiveTab('kost'); setEditing('setup') }}>Rediger mål</button>
                  </div>
                </div>
              </div>

              {/* Competition date card */}
              <div style={{ ...s.card, marginTop: '1.5rem' }}>
                <div style={s.cardLabel}>
                  Næste stævne
                  {editing !== 'competition' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.btnEdit} onClick={() => openMeetResult()}>Registrér resultat</button>
                      <button style={s.btnEdit} onClick={() => startEdit('competition', { competition_date: a.competition_date || '' })}>
                        {a.competition_date ? 'Rediger' : 'Tilføj dato'}
                      </button>
                    </div>
                  )}
                </div>
                {editing === 'competition' ? (
                  <div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={s.fieldLabel}>Stævnedato</div>
                      <input style={s.fieldInput} type="date" value={editData.competition_date || ''} onChange={e => setEditData(prev => ({ ...prev, competition_date: e.target.value || null }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <button style={s.btnGhost} onClick={() => setEditing(null)}>Annuller</button>
                      <button style={s.btnPrimary} onClick={() => saveEdit()} disabled={saving}>{saving ? 'Gemmer...' : 'Gem'}</button>
                    </div>
                  </div>
                ) : a.competition_date ? (() => {
                  const compMs = new Date(a.competition_date + 'T12:00:00') - new Date()
                  const weeksLeft = Math.ceil(compMs / (7 * 24 * 3600 * 1000))
                  return (
                    <div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', marginBottom: '0.4rem' }}>
                        {new Date(a.competition_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: weeksLeft > 0 ? '#c8923a' : '#6cba6c', letterSpacing: '0.06em' }}>
                        {weeksLeft > 0 ? `${weeksLeft} uger til stævne` : 'Stævne passeret'}
                      </div>
                    </div>
                  )
                })() : (
                  <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen stævnedato sat endnu.</div>
                )}
              </div>
              </div>
            )}

            {/* TAB: KOST */}
            {activeTab === 'kost' && (
              <div>
                <div style={s.card}>
                  <div style={s.cardLabel}>
                    Athlete setup
                    <button style={s.btnEdit} onClick={() => startEdit('setup', { sex: a.sex || 'm', bodyweight: a.bodyweight, height: a.height, activity: a.activity || 1.55, goal: a.goal || 'maintain', kcal_target: a.kcal_target, protein_target: a.protein_target })}>Rediger</button>
                  </div>
                  {editing === 'setup' ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div>
                          <div style={s.fieldLabel}>Køn</div>
                          <select style={s.fieldSelect} value={editData.sex} onChange={e => setEditData(p => ({ ...p, sex: e.target.value }))}>
                            <option value="m">Mand</option>
                            <option value="f">Kvinde</option>
                          </select>
                        </div>
                        <div>
                          <div style={s.fieldLabel}>Kropsvægt (kg)</div>
                          <input style={s.fieldInput} type="number" value={editData.bodyweight || ''} onChange={e => setEditData(p => ({ ...p, bodyweight: e.target.value }))} />
                        </div>
                        <div>
                          <div style={s.fieldLabel}>Højde (cm)</div>
                          <input style={s.fieldInput} type="number" value={editData.height || ''} onChange={e => setEditData(p => ({ ...p, height: e.target.value }))} />
                        </div>
                        <div>
                          <div style={s.fieldLabel}>Aktivitet</div>
                          <select style={s.fieldSelect} value={editData.activity} onChange={e => setEditData(p => ({ ...p, activity: e.target.value }))}>
                            <option value="1.2">Stillesiddende</option>
                            <option value="1.375">Let aktiv</option>
                            <option value="1.55">Moderat aktiv</option>
                            <option value="1.725">Meget aktiv</option>
                            <option value="1.9">Ekstremt aktiv</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div>
                          <div style={s.fieldLabel}>Mål</div>
                          <select style={s.fieldSelect} value={editData.goal} onChange={e => setEditData(p => ({ ...p, goal: e.target.value }))}>
                            <option value="cut">Vægttab</option>
                            <option value="maintain">Vedligehold</option>
                            <option value="bulk">Opbygning</option>
                          </select>
                        </div>
                        <div>
                          <div style={s.fieldLabel}>Kcal-mål</div>
                          <input style={s.fieldInput} type="number" value={editData.kcal_target || ''} onChange={e => setEditData(p => ({ ...p, kcal_target: e.target.value }))} />
                        </div>
                        <div>
                          <div style={s.fieldLabel}>Proteinmål (g)</div>
                          <input style={s.fieldInput} type="number" value={editData.protein_target || ''} onChange={e => setEditData(p => ({ ...p, protein_target: e.target.value }))} />
                        </div>
                      </div>
                      <button style={{ ...s.btnGhost, marginBottom: '1rem' }} onClick={() => {
                        const { sex, bodyweight: bw, height, activity, goal } = editData
                        const age = a.age || 25
                        if (!bw || !height) return
                        const bmr = sex === 'f' ? 10 * bw + 6.25 * height - 5 * age - 161 : 10 * bw + 6.25 * height - 5 * age + 5
                        let tdee = Math.round(bmr * activity)
                        if (goal === 'cut') tdee -= 300
                        if (goal === 'bulk') tdee += 200
                        setEditData(p => ({ ...p, kcal_target: tdee, protein_target: Math.round(bw * 2.2) }))
                      }}>Beregn TDEE og udfyld</button>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button style={s.btnGhost} onClick={() => setEditing(null)}>Annuller</button>
                        <button style={s.btnPrimary} onClick={() => saveEdit()} disabled={saving}>{saving ? 'Gemmer...' : 'Gem'}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '1rem' }}>
                      {[
                        ['Køn', a.sex === 'm' ? 'Mand' : a.sex === 'f' ? 'Kvinde' : 'Ikke angivet'],
                        ['Kropsvægt', a.bodyweight ? a.bodyweight + ' kg' : 'Ikke angivet'],
                        ['Højde', a.height ? a.height + ' cm' : 'Ikke angivet'],
                        ['Kcal-mål', a.kcal_target ? a.kcal_target + ' kcal' : 'Ikke sat'],
                        ['Proteinmål', a.protein_target ? a.protein_target + 'g' : 'Ikke sat'],
                        ['Mål', { cut: 'Vægttab', maintain: 'Vedligehold', bulk: 'Opbygning' }[a.goal] || 'Ikke angivet'],
                      ].map(([label, val]) => (
                        <div key={label}><div style={s.fieldLabel}>{label}</div><div style={{ fontSize: '0.9rem', color: '#b8b4a8' }}>{val}</div></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: PROGRAM */}
            {activeTab === 'program' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7a7770' }}>
                    {weeks.length} uge{weeks.length !== 1 ? 'r' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={{ ...s.btnGhost, color: showBlockPlanner ? '#c8923a' : '#7a7770', borderColor: showBlockPlanner ? 'rgba(200,146,58,0.4)' : undefined }} onClick={() => {
                      if (!showBlockPlanner) {
                        const weeksWithDate = weeks.filter(w => w.start_date).sort((a, b) => b.week_number - a.week_number)
                        const suggestDate = weeksWithDate.length
                          ? new Date(new Date(weeksWithDate[0].start_date + 'T12:00:00').getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
                          : new Date().toISOString().slice(0, 10)
                        setPlanStartDate(suggestDate)
                        setAssignEdits(Object.fromEntries(weeks.map(w => [w.id, w.block_name || ''])))
                      }
                      setShowBlockPlanner(p => !p)
                    }}>
                      Periodiseringsplan
                    </button>
                    {weeks.length > 0 && (
                      <button style={s.btnGhost} onClick={() => copyWeek(weeks[weeks.length - 1].id)}>
                        Kopiér seneste uge →
                      </button>
                    )}
                    <button style={s.btnPrimary} onClick={() => {
                      const weeksWithDate = weeks.filter(w => w.start_date).sort((a, b) => b.week_number - a.week_number)
                      const suggestDate = weeksWithDate.length
                        ? new Date(new Date(weeksWithDate[0].start_date + 'T12:00:00').getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
                        : new Date().toISOString().slice(0, 10)
                      setAddingWeek(true)
                      setWeekForm({ week_number: '', block_name: '', coach_note: '', block_description: '', start_date: suggestDate })
                    }}>
                      + Ny uge
                    </button>
                  </div>
                </div>

                {/* Periodiseringsplan panel */}
                {showBlockPlanner && (() => {
                  const totalWeeks = blockPlan.reduce((s, b) => s + (b.weeks || 0), 0)
                  const endDate = totalWeeks > 0 && planStartDate
                    ? new Date(new Date(planStartDate + 'T12:00:00').getTime() + totalWeeks * 7 * 24 * 3600 * 1000 - 24 * 3600 * 1000)
                    : null
                  const compDate = selectedAthlete?.competition_date
                  const compDateObj = compDate ? new Date(compDate + 'T12:00:00') : null
                  const diffDays = endDate && compDateObj ? Math.round((compDateObj - endDate) / (24 * 3600 * 1000)) : null
                  const fmtD = d => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
                  const fmtShort = d => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
                  return (
                    <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '1.5rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '1rem' }}>Periodiseringsplan</div>

                      {/* Eksisterende uger — tilknyt blokke */}
                      {weeks.length > 0 && (
                        <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                          <div style={{ ...s.fieldLabel, marginBottom: '0.6rem' }}>Tilknyt blok til eksisterende uger</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                            {weeks.map(w => (
                              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', minWidth: '52px' }}>Uge {w.week_number}</span>
                                {w.start_date && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', minWidth: '80px' }}>{new Date(w.start_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</span>}
                                <select
                                  value={assignEdits[w.id] ?? w.block_name ?? ''}
                                  onChange={e => setAssignEdits(p => ({ ...p, [w.id]: e.target.value }))}
                                  style={{ ...s.fieldSelect, padding: '0.25rem 0.5rem', fontSize: '0.62rem', flex: 1, maxWidth: '180px' }}
                                >
                                  <option value="">— ingen blok —</option>
                                  {BLOCK_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                              </div>
                            ))}
                          </div>
                          <button style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.3rem 0.75rem' }} onClick={async () => {
                            await Promise.all(weeks.map(w => {
                              const newName = assignEdits[w.id] !== undefined ? (assignEdits[w.id] || null) : (w.block_name || null)
                              if (newName === (w.block_name || null)) return Promise.resolve()
                              return supabase.from('weeks').update({ block_name: newName }).eq('id', w.id)
                            }))
                            fetchWeeks(selectedAthlete.id)
                          }}>Gem tilknytninger</button>
                        </div>
                      )}

                      <div style={{ marginBottom: '1rem' }}>
                        <div style={s.fieldLabel}>Nye uger — startdato{weeks.length > 0 && <span style={{ color: '#4a4844', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (fortsætter fra uge {Math.max(...weeks.map(w => w.week_number)) + 1})</span>}</div>
                        <input style={{ ...s.fieldInput, maxWidth: '180px' }} type="date" value={planStartDate} onChange={e => setPlanStartDate(e.target.value)} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                        {blockPlan.map((block, i) => (
                          <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: blockColor(block.name), flexShrink: 0 }} />
                            <select
                              value={block.name}
                              onChange={e => setBlockPlan(p => p.map((b, j) => j === i ? { ...b, name: e.target.value } : b))}
                              style={{ ...s.fieldSelect, width: '160px', padding: '0.35rem 0.6rem', fontSize: '0.72rem' }}
                            >
                              {BLOCK_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input
                                type="number" min="1" max="20"
                                value={block.weeks}
                                onChange={e => setBlockPlan(p => p.map((b, j) => j === i ? { ...b, weeks: Math.max(1, parseInt(e.target.value) || 1) } : b))}
                                style={{ ...s.fieldInput, width: '52px', padding: '0.35rem 0.5rem', fontSize: '0.72rem', textAlign: 'center' }}
                              />
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>uge{block.weeks !== 1 ? 'r' : ''}</span>
                            </div>
                            <button onClick={() => setBlockPlan(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>✕</button>
                          </div>
                        ))}
                        <button
                          onClick={() => setBlockPlan(p => [...p, { id: Date.now(), name: BLOCK_NAMES[0], weeks: 2 }])}
                          style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.3rem 0.7rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}
                        >+ Tilføj blok</button>
                      </div>

                      {/* Tidslinje */}
                      {totalWeeks > 0 && planStartDate && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', width: '100%', height: '32px', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                            {blockPlan.map((block) => {
                              const pct = (block.weeks / totalWeeks) * 100
                              return (
                                <div key={block.id} title={`${block.name}: ${block.weeks} uge${block.weeks !== 1 ? 'r' : ''}`}
                                  style={{ width: `${pct}%`, flexShrink: 0, background: blockColor(block.name), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  {block.weeks >= 2 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#141410', fontWeight: 600, letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 6px' }}>{block.name}</span>}
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770' }}>{fmtShort(new Date(planStartDate + 'T12:00:00'))}</span>
                            {endDate && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770' }}>slutter {fmtShort(endDate)}</span>}
                          </div>
                        </div>
                      )}

                      {/* Status */}
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', marginBottom: '1rem' }}>
                        <span style={{ color: '#7a7770' }}>Total: {totalWeeks} uger</span>
                        {endDate && <span style={{ color: '#7a7770' }}> · slutter {fmtD(endDate)}</span>}
                        {diffDays != null && (
                          <span style={{ marginLeft: '0.75rem', color: diffDays >= 0 ? '#6cba6c' : '#e05555', fontWeight: 600 }}>
                            {diffDays >= 0 ? `✓ ${diffDays} dage før stævne` : `⚠ ${Math.abs(diffDays)} dage efter stævne`}
                          </span>
                        )}
                        {!compDate && <span style={{ color: '#4a4844', marginLeft: '0.75rem' }}>— sæt stævnedato i Oversigt for tjek</span>}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button style={s.btnGhost} onClick={() => setShowBlockPlanner(false)}>Luk</button>
                        <button style={s.btnPrimary} onClick={generateWeeksFromPlan} disabled={!planStartDate || totalWeeks === 0}>
                          Opret {totalWeeks} uger
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* Block overview grid */}
                {weeks.length > 0 && (() => {
                  const compDate = selectedAthlete?.competition_date
                  const compMs = compDate ? new Date(compDate + 'T12:00:00') - new Date() : null
                  const weeksToComp = compMs != null ? Math.ceil(compMs / (7 * 24 * 3600 * 1000)) : null
                  const latestWeekNum = weeks[weeks.length - 1]?.week_number
                  const compWeekNum = weeksToComp != null ? latestWeekNum + weeksToComp - 1 : null

                  const complianceByWeekNum = {}
                  for (const log of athleteLogs) {
                    const wn = log.exercises?.sessions?.weeks?.week_number
                    if (wn == null || log.skipped) continue
                    complianceByWeekNum[wn] = (complianceByWeekNum[wn] || 0) + 1
                  }
                  const totalSetsByWeekNum = {}
                  for (const week of weeks) {
                    totalSetsByWeekNum[week.week_number] = (week.sessions || [])
                      .flatMap(s => s.exercises || [])
                      .reduce((acc, e) => acc + (e.sets || 0), 0)
                  }

                  // Højeste ugenummer atleten faktisk har logget i = den uge de
                  // træner nu. Driver blok-fremdrift uafhængigt af start_date/sets
                  // (som ofte mangler), hvor den gamle rene dato-logik fejlede.
                  const loggedWeekNums = weeks.map(w => w.week_number).filter(wn => (complianceByWeekNum[wn] || 0) > 0)
                  const maxLoggedWk = loggedWeekNums.length ? Math.max(...loggedWeekNums) : null
                  // Foretræk daterede uger (samme "nu" som kalender + atlet); ellers logget fremdrift.
                  const currentWk = currentWeekNo(weeks, maxLoggedWk)

                  const phases = computePhases(weeks)

                  return (
                    <div style={{ marginBottom: '1.5rem' }}>
                      {compDate && weeksToComp != null && (
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: weeksToComp > 0 ? '#c8923a' : '#6cba6c', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                          {weeksToComp > 0 ? `${weeksToComp} uger til stævne` : 'Stævne passeret'} · {new Date(compDate + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}

                      {/* Blok-tidslinje (overblik) */}
                      {phases.some(p => p.name) && (() => {
                        const today = new Date(); today.setHours(12, 0, 0, 0)
                        const fmt = ds => new Date(ds + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
                        return (
                          <div style={{ marginBottom: '1.25rem' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.6rem' }}>
                            Periodisering · klik ✎ for at omdøbe blok
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                            {phases.map((phase, pi) => {
                              const color = phase.name ? blockColor(phase.name) : '#7a7770'
                              const first = phase.weeks[0]
                              const last = phase.weeks[phase.weeks.length - 1]
                              const range = first.week_number === last.week_number
                                ? `uge ${first.week_number}`
                                : `uge ${first.week_number}–${last.week_number}`
                              const fd = first.start_date, ld = last.start_date
                              const dates = fd && ld
                                ? `${fmt(fd)} – ${fmt(new Date(new Date(ld + 'T12:00:00').getTime() + 6 * 86400000).toISOString().slice(0, 10))}`
                                : null
                              let isDone = false, isActive = false
                              if (currentWk != null) {
                                // Nuværende uge (dato-foretrukket, ellers logget fremdrift).
                                // Forbi blokken = fuldført; uge i blokken = aktiv.
                                isDone = last.week_number < currentWk
                                isActive = first.week_number <= currentWk && currentWk <= last.week_number
                              } else if (fd && ld) {
                                // Ingen logs endnu → fald tilbage til datoer hvis sat.
                                const blockStart = new Date(fd + 'T12:00:00')
                                const blockEnd = new Date(new Date(ld + 'T12:00:00').getTime() + 7 * 86400000)
                                isDone = today >= blockEnd
                                isActive = today >= blockStart && today < blockEnd
                              }
                              return (
                                <div
                                  key={pi}
                                  onClick={() => gotoWeek(first)}
                                  style={{
                                    minWidth: '128px', flexShrink: 0, cursor: 'pointer',
                                    background: isActive ? color + '1f' : '#1c1c18',
                                    border: `1px solid ${isActive ? color : isDone ? color + '55' : 'rgba(237,234,226,0.08)'}`,
                                    borderLeft: `3px solid ${phase.name ? color : 'rgba(237,234,226,0.15)'}`,
                                    padding: '0.7rem 0.8rem',
                                    opacity: !phase.name || (!isActive && !isDone) ? 0.78 : 1,
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    {renamingBlock === first.id ? (
                                      <input
                                        autoFocus
                                        value={renameValue}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => setRenameValue(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setRenamingBlock(null) }}
                                        onBlur={async () => {
                                          const name = renameValue.trim() || null
                                          setRenamingBlock(null)
                                          if (name !== (phase.name || null)) {
                                            await supabase.from('weeks').update({ block_name: name }).in('id', phase.weeks.map(w => w.id))
                                            fetchWeeks(selectedAthlete.id)
                                          }
                                        }}
                                        style={{ flex: 1, minWidth: 0, background: '#141410', border: `1px solid ${color}`, color: '#edeae2', fontSize: '0.78rem', padding: '2px 5px' }}
                                      />
                                    ) : (
                                      <>
                                        <span style={{ fontSize: '0.82rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{phase.name || 'Uden blok'}</span>
                                        {isDone && <span style={{ color, fontSize: '0.6rem', lineHeight: 1 }}>✓</span>}
                                        {isActive && (
                                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.4rem', letterSpacing: '0.1em', textTransform: 'uppercase', color, border: `1px solid ${color}`, padding: '1px 4px', borderRadius: '2px' }}>nu</span>
                                        )}
                                        <button
                                          onClick={e => { e.stopPropagation(); setRenameValue(phase.name || ''); setRenamingBlock(first.id) }}
                                          title="Omdøb blok"
                                          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#7a7770', cursor: 'pointer', fontSize: '0.7rem', padding: '0 2px', flexShrink: 0 }}
                                        >✎</button>
                                      </>
                                    )}
                                  </div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7a7770' }}>
                                    {range} · {phase.weeks.length}u
                                  </div>
                                  {dates && (
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#4a4844', marginTop: '0.18rem' }}>{dates}</div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          </div>
                        )
                      })()}

                      {/* Periodiserings-graf: volumen (søjler) + intensitet (linje) */}
                      {weeks.length >= 2 && (() => {
                        const today = new Date(); today.setHours(12, 0, 0, 0)
                        const weekData = weeks.map(w => {
                          const exs = (w.sessions || []).flatMap(s => s.exercises || [])
                          const sets = exs.reduce((a, e) => a + (e.sets || 0), 0)
                          let rpeSum = 0, rpeSets = 0
                          for (const e of exs) {
                            const txt = /rpe/i.test(e.intensity || '') ? e.intensity : ''
                            const m = /([0-9]+(?:[.,][0-9]+)?)/.exec(txt || '')
                            if (m && e.sets) { rpeSum += parseFloat(m[1].replace(',', '.')) * e.sets; rpeSets += e.sets }
                          }
                          let active = false
                          if (w.start_date) {
                            const ws = new Date(w.start_date + 'T12:00:00')
                            active = today >= ws && today < new Date(ws.getTime() + 7 * 86400000)
                          }
                          return { w, sets, avgRpe: rpeSets ? rpeSum / rpeSets : null, color: w.block_name ? blockColor(w.block_name) : '#7a7770', active }
                        })
                        const n = weekData.length
                        const hasRpe = weekData.some(d => d.avgRpe != null)
                        const maxSets = Math.max(1, ...weekData.map(d => d.sets))
                        const PAD_L = 8, PAD_R = 8, PAD_T = 12, PAD_B = 18
                        const colW = 40, H = 150
                        const W = PAD_L + PAD_R + n * colW
                        const chartH = H - PAD_T - PAD_B
                        const rpeMin = 5, rpeMax = 10
                        const cx = i => PAD_L + i * colW + colW / 2
                        const barW = Math.min(22, colW * 0.5)
                        const yVol = v => PAD_T + chartH * (1 - v / maxSets)
                        const yRpe = r => PAD_T + chartH * (1 - (Math.min(rpeMax, Math.max(rpeMin, r)) - rpeMin) / (rpeMax - rpeMin))
                        const rpePts = weekData.map((d, i) => d.avgRpe != null ? `${cx(i)},${yRpe(d.avgRpe)}` : null).filter(Boolean).join(' ')

                        return (
                          <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844' }}>Volumen &amp; intensitet</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#7a7770' }}>
                                <span style={{ width: '8px', height: '8px', background: 'rgba(237,234,226,0.3)' }} /> sæt/uge
                              </span>
                              {hasRpe && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#7a7770' }}>
                                  <span style={{ width: '12px', height: '2px', background: '#c8923a' }} /> ø RPE
                                </span>
                              )}
                            </div>
                            <div style={{ overflowX: 'auto', paddingBottom: '0.25rem' }}>
                              <svg viewBox={`0 0 ${W} ${H}`} width={n > 8 ? W : '100%'} height={H} preserveAspectRatio="xMinYMid meet" style={{ display: 'block', maxWidth: '100%' }}>
                                {/* baseline */}
                                <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="rgba(237,234,226,0.12)" strokeWidth="1" />
                                {/* volume bars */}
                                {weekData.map((d, i) => {
                                  const h = chartH * d.sets / maxSets
                                  return (
                                    <g key={d.w.id}>
                                      <rect
                                        x={cx(i) - barW / 2} y={yVol(d.sets)} width={barW} height={h}
                                        fill={d.color + (d.active ? 'dd' : '66')}
                                        stroke={d.active ? d.color : 'none'} strokeWidth={d.active ? 1.5 : 0}
                                        rx="2"
                                      />
                                      <text x={cx(i)} y={PAD_T + chartH + 12} textAnchor="middle" fontSize="7" fill={d.active ? '#c8923a' : '#7a7770'} fontFamily="'IBM Plex Mono', monospace">{d.w.week_number}</text>
                                    </g>
                                  )
                                })}
                                {/* intensity line */}
                                {hasRpe && rpePts && (
                                  <polyline points={rpePts} fill="none" stroke="#c8923a" strokeWidth="1.5" strokeLinejoin="round" />
                                )}
                                {hasRpe && weekData.map((d, i) => d.avgRpe != null && (
                                  <circle key={'c' + d.w.id} cx={cx(i)} cy={yRpe(d.avgRpe)} r={d.active ? 3 : 2.2} fill="#1c1c18" stroke="#c8923a" strokeWidth="1.5" />
                                ))}
                              </svg>
                            </div>
                          </div>
                        )
                      })()}

                      <div style={{ overflowX: 'auto', display: 'flex', gap: '0.5rem', paddingBottom: '0.5rem', width: '100%' }}>
                        {weeks.map(week => {
                          const isLatest = week.week_number === latestWeekNum
                          const isCompWeek = compWeekNum != null && week.week_number === compWeekNum
                          const isPostComp = compWeekNum != null && week.week_number > compWeekNum
                          const logged = complianceByWeekNum[week.week_number] || 0
                          const total = totalSetsByWeekNum[week.week_number] || 0
                          const pct = total > 0 && logged > 0 ? Math.round(logged / total * 100) : null
                          const pctColor = pct == null ? '#4a4844' : pct >= 80 ? '#6cba6c' : pct >= 50 ? '#c8923a' : '#e05555'
                          return (
                            <div
                              key={week.id}
                              style={{
                                minWidth: '90px', flexShrink: 0,
                                background: isLatest ? 'rgba(200,146,58,0.1)' : '#1c1c18',
                                border: `1px solid ${isLatest ? '#c8923a' : isCompWeek ? 'rgba(108,186,108,0.5)' : 'rgba(237,234,226,0.07)'}`,
                                padding: '0.65rem 0.75rem',
                                cursor: 'pointer',
                                opacity: isPostComp ? 0.35 : 1,
                              }}
                              onClick={() => gotoWeek(week)}
                            >
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: isLatest ? '#c8923a' : '#7a7770', marginBottom: '0.2rem' }}>
                                UGE {week.week_number}{isCompWeek ? ' 🏆' : ''}
                              </div>
                              {week.block_name && (
                                <div style={{ fontSize: '0.76rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{week.block_name}</div>
                              )}
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', marginTop: '0.25rem' }}>{week.sessions?.length || 0} træninger</div>
                              {pct != null && (
                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: pctColor, marginTop: '0.2rem' }}>{pct}%</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Add week form */}
                {addingWeek && (
                  <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' }}>Ny uge</div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.5fr 1fr 1fr 1.5fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={s.fieldLabel}>Uge nr.</div>
                        <input style={s.fieldInput} type="number" placeholder="Auto" value={weekForm.week_number} onChange={e => setWeekForm(p => ({ ...p, week_number: e.target.value }))} />
                      </div>
                      <div>
                        <div style={s.fieldLabel}>Startdato</div>
                        <input style={s.fieldInput} type="date" value={weekForm.start_date} onChange={e => setWeekForm(p => ({ ...p, start_date: e.target.value }))} />
                      </div>
                      <div>
                        <div style={s.fieldLabel}>Blok</div>
                        <input style={s.fieldInput} list="block-names-list" placeholder="Vælg blok…" value={weekForm.block_name} onChange={e => setWeekForm(p => ({ ...p, block_name: e.target.value }))} />
                        <datalist id="block-names-list">{BLOCK_NAMES.map(n => <option key={n} value={n} />)}</datalist>
                      </div>
                      <div>
                        <div style={s.fieldLabel}>Coach-note</div>
                        <input style={s.fieldInput} type="text" placeholder="Note…" value={weekForm.coach_note} onChange={e => setWeekForm(p => ({ ...p, coach_note: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={s.fieldLabel}>Blok-beskrivelse</div>
                      <textarea style={{ ...s.fieldInput, minHeight: '72px', resize: 'vertical', lineHeight: 1.5 }} placeholder="Forklar formålet med denne blok…" value={weekForm.block_description} onChange={e => setWeekForm(p => ({ ...p, block_description: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.btnGhost} onClick={() => setAddingWeek(false)}>Annuller</button>
                      <button style={s.btnPrimary} onClick={addWeek}>Tilføj uge</button>
                    </div>
                  </div>
                )}

                {weeks.length === 0 && !addingWeek && (
                  <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2rem 0' }}>
                    Ingen uger endnu — tilføj den første
                  </div>
                )}

                {/* Blok-faner: vis kun én bloks uger ad gangen, så listen ikke bliver uoverskuelig */}
                {weeks.length > 0 && (() => {
                  const phases = computePhases(weeks)
                  if (phases.length <= 1 && programBlockStart !== 'all') return null // kun én blok → ingen grund til faner
                  const active = programActiveStart()
                  const chip = (key, label, isActive, color) => (
                    <button key={key} onClick={() => { setProgramBlockStart(key); setOpenWeekId(null) }}
                      style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.04em', padding: '0.4rem 0.7rem', cursor: 'pointer',
                        background: isActive ? (color ? color + '22' : 'rgba(200,146,58,0.15)') : 'transparent',
                        border: `1px solid ${isActive ? (color ? color + '88' : 'rgba(200,146,58,0.5)') : 'rgba(237,234,226,0.12)'}`,
                        color: isActive ? (color || '#c8923a') : '#7a7770' }}>{label}</button>
                  )
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                      {phases.map((phase) => {
                        const start = phase.weeks[0].week_number
                        const end = phase.weeks[phase.weeks.length - 1].week_number
                        const range = start === end ? `uge ${start}` : `uge ${start}–${end}`
                        return chip(start, `${phase.name || 'Uden blok'} · ${range}`, active === start, phase.name ? blockColor(phase.name) : null)
                      })}
                      {chip('all', `Alle (${weeks.length})`, programBlockStart === 'all', null)}
                    </div>
                  )
                })()}

                {programShownWeeks().map(week => (
                  <div key={week.id} id={`week-row-${week.id}`} style={{ marginBottom: '0.75rem' }}>
                    {/* Week header */}
                    {editingWeek === week.id ? (
                      <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.5fr 1fr 1fr 1.5fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={s.fieldLabel}>Uge nr.</div>
                            <input style={s.fieldInput} type="number" value={weekForm.week_number} onChange={e => setWeekForm(p => ({ ...p, week_number: e.target.value }))} />
                          </div>
                          <div>
                            <div style={s.fieldLabel}>Startdato</div>
                            <input style={s.fieldInput} type="date" value={weekForm.start_date} onChange={e => setWeekForm(p => ({ ...p, start_date: e.target.value }))} />
                          </div>
                          <div>
                            <div style={s.fieldLabel}>Blok</div>
                            <input style={s.fieldInput} list="block-names-list" value={weekForm.block_name} onChange={e => setWeekForm(p => ({ ...p, block_name: e.target.value }))} />
                          </div>
                          <div>
                            <div style={s.fieldLabel}>Coach-note</div>
                            <input style={s.fieldInput} type="text" value={weekForm.coach_note} onChange={e => setWeekForm(p => ({ ...p, coach_note: e.target.value }))} />
                          </div>
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={s.fieldLabel}>Blok-beskrivelse</div>
                          <textarea style={{ ...s.fieldInput, minHeight: '72px', resize: 'vertical', lineHeight: 1.5 }} placeholder="Forklar formålet med denne blok…" value={weekForm.block_description} onChange={e => setWeekForm(p => ({ ...p, block_description: e.target.value }))} />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button style={s.btnGhost} onClick={() => setEditingWeek(null)}>Annuller</button>
                          <button style={s.btnPrimary} onClick={() => updateWeek(week.id)}>Gem</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', borderLeft: openWeekId === week.id ? '3px solid #c8923a' : '3px solid transparent', padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '0.5rem' }}
                        onClick={() => setOpenWeekId(openWeekId === week.id ? null : week.id)}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a' }}>Uge {week.week_number}</span>
                            {week.start_date && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.06em' }}>{new Date(week.start_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })} – {new Date(new Date(week.start_date + 'T12:00:00').getTime() + 6 * 24 * 3600 * 1000).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</span>}
                            {week.block_name && <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' }}>{week.block_name}</span>}
                          </div>
                          {week.coach_note && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', marginTop: '0.2rem' }}>{week.coach_note}</div>}
                          {week.block_description && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.78rem', color: '#4a4844', fontStyle: 'italic', marginTop: '0.2rem' }}>{week.block_description}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase' }}>{week.sessions?.length || 0} træninger</span>
                          <button style={s.btnEdit} onClick={e => { e.stopPropagation(); setEditingWeek(week.id); setWeekForm({ week_number: week.week_number, block_name: week.block_name || '', coach_note: week.coach_note || '', block_description: week.block_description || '', start_date: week.start_date || '' }) }}>Rediger</button>
                          <button style={s.btnDanger} onClick={e => { e.stopPropagation(); deleteWeek(week.id) }}>Slet</button>
                          <span style={{ color: '#4a4844', fontSize: '0.65rem', marginLeft: '0.25rem' }}>{openWeekId === week.id ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    )}

                    {/* Sessions (expanded week) */}
                    {openWeekId === week.id && (
                      <div style={{ marginLeft: isMobile ? '0.5rem' : '1.5rem', borderLeft: '2px solid rgba(200,146,58,0.15)', paddingLeft: isMobile ? '0.5rem' : '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                        {(week.sessions || []).map((session, sessionIdx, sessionsArr) => (
                          <div key={session.id} style={{ marginBottom: '0.5rem' }}>
                            {/* Session header */}
                            {editingSession === session.id ? (
                              <div style={{ background: '#141410', border: '1px solid rgba(200,146,58,0.2)', padding: '0.75rem', marginBottom: '0.4rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={s.fieldLabel}>Titel</div>
                                    <input style={s.fieldInput} type="text" value={sessionForm.title} onChange={e => setSessionForm(p => ({ ...p, title: e.target.value }))} />
                                  </div>
                                </div>
                                {weekdayPicker}
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button style={s.btnGhost} onClick={() => setEditingSession(null)}>Annuller</button>
                                  <button style={s.btnPrimary} onClick={() => updateSession(session.id)}>Gem</button>
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{ background: '#181816', border: '1px solid rgba(237,234,226,0.06)', borderLeft: `3px solid ${sessionLogStatus(session).color}`, padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '0.5rem' }}
                                onClick={() => setOpenSessionId(openSessionId === session.id ? null : session.id)}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '0.88rem', color: '#edeae2', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {session.title}
                                    {session.weekday != null && WEEKDAYS_LONG[session.weekday] && (
                                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#c8923a', border: '1px solid rgba(200,146,58,0.4)', padding: '0.12rem 0.4rem' }}>{WEEKDAYS_LONG[session.weekday]}</span>
                                    )}
                                    {(() => {
                                      const st = sessionLogStatus(session)
                                      if (st.total === 0 && st.logged === 0) return null
                                      const label = st.kind === 'done' ? '✓ Logget' : st.kind === 'partial' ? `${st.logged}/${st.total} sæt` : 'Ikke logget'
                                      return <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: st.color, border: `1px solid ${st.color}66`, padding: '0.12rem 0.4rem' }}>{label}</span>
                                    })()}
                                  </div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.15rem' }}>
                                    {session.exercises?.length || 0} øvelser
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                                  <button style={{ ...s.btnEdit, opacity: sessionIdx === 0 ? 0.25 : 1 }} onClick={e => { e.stopPropagation(); reorderSession(week.id, session.id, 'up') }} disabled={sessionIdx === 0}>↑</button>
                                  <button style={{ ...s.btnEdit, opacity: sessionIdx === sessionsArr.length - 1 ? 0.25 : 1 }} onClick={e => { e.stopPropagation(); reorderSession(week.id, session.id, 'down') }} disabled={sessionIdx === sessionsArr.length - 1}>↓</button>
                                  {copyingSession === session.id ? (
                                    <>
                                      <select
                                        style={{ ...s.fieldInput, fontSize: '0.6rem', padding: '0.2rem 0.4rem', width: 'auto', cursor: 'pointer' }}
                                        defaultValue=""
                                        onChange={e => { if (e.target.value) copySessionToWeek(session, e.target.value) }}
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <option value="" disabled>Kopiér til uge...</option>
                                        {weeks.filter(w => w.id !== week.id).map(w => (
                                          <option key={w.id} value={w.id}>Uge {w.week_number}{w.block_name ? ` — ${w.block_name}` : ''}</option>
                                        ))}
                                      </select>
                                      <button style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.2rem 0.4rem' }} onClick={e => { e.stopPropagation(); setCopyingSession(null) }}>✕</button>
                                    </>
                                  ) : (
                                    <button style={s.btnEdit} onClick={e => { e.stopPropagation(); setCopyingSession(session.id) }}>Kopiér</button>
                                  )}
                                  <button style={s.btnEdit} onClick={e => { e.stopPropagation(); setEditingSession(session.id); setSessionForm({ title: session.title, weekday: session.weekday ?? null }) }}>Rediger</button>
                                  <button style={s.btnDanger} onClick={e => { e.stopPropagation(); deleteSession(session.id) }}>Slet</button>
                                  <span style={{ color: '#4a4844', fontSize: '0.6rem', marginLeft: '0.2rem' }}>{openSessionId === session.id ? '▲' : '▼'}</span>
                                </div>
                              </div>
                            )}

                            {/* Exercises (expanded session) */}
                            {openSessionId === session.id && (
                              <div style={{ background: '#141410', border: '1px solid rgba(237,234,226,0.06)', borderTop: 'none', padding: '0.75rem' }}>
                                {(session.exercises || []).map((ex, exIdx, exArr) => (
                                  <div key={ex.id}>
                                    {editingExercise === ex.id ? (
                                      <div style={{ padding: '0.5rem 0', borderBottom: '1px solid rgba(237,234,226,0.06)', marginBottom: '0.5rem' }}>
                                        {exFormRow}
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                          <button style={s.btnGhost} onClick={() => setEditingExercise(null)}>Annuller</button>
                                          <button style={s.btnPrimary} onClick={() => updateExercise(ex.id)}>Gem</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid rgba(237,234,226,0.04)', gap: isMobile ? '0.4rem' : 0 }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline' }}>
                                            <div style={{ fontSize: '0.85rem', color: '#b8b4a8', minWidth: '120px' }}>{ex.name}</div>
                                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>
                                              {ex.sets && `${ex.sets} sæt`}{ex.reps && ` × ${ex.reps}`}{ex.intensity && ` · ${ex.intensity}`}
                                            </div>
                                            {ex.note && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', fontStyle: 'italic' }}>{ex.note}</div>}
                                          </div>
                                          {editingRecommended === ex.id ? (
                                            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.3rem', alignItems: 'center' }}>
                                              <input
                                                style={{ ...s.fieldInput, fontSize: '0.72rem', padding: '0.2rem 0.4rem', width: '80px' }}
                                                type="number"
                                                placeholder="kg"
                                                value={recommendedInput}
                                                onChange={e => setRecommendedInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') saveRecommendedWeight(ex.id); if (e.key === 'Escape') setEditingRecommended(null) }}
                                                autoFocus
                                              />
                                              <button style={{ ...s.btnPrimary, fontSize: '0.55rem', padding: '0.2rem 0.5rem' }} onClick={() => saveRecommendedWeight(ex.id)}>Gem</button>
                                              <button style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.2rem 0.5rem' }} onClick={() => setEditingRecommended(null)}>Annuller</button>
                                            </div>
                                          ) : (
                                            (() => {
                                              const last = bestLog(ex.name, ex.reps)
                                              if (ex.recommended_weight != null) return (
                                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#c8923a', marginTop: '0.25rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => { setEditingRecommended(ex.id); setRecommendedInput(ex.recommended_weight.toString()) }}>
                                                  Anbefalet: {ex.recommended_weight}kg <span style={{ opacity: 0.6 }}>✎</span>
                                                </div>
                                              )
                                              if (last) return (
                                                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginTop: '0.25rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }} onClick={() => { setEditingRecommended(ex.id); setRecommendedInput('') }}>
                                                  Sidst logget: {last.weight}kg × {last.reps_completed} reps <span style={{ opacity: 0.6 }}>✎</span>
                                                </div>
                                              )
                                              return (
                                                <button style={{ ...s.btnSm, marginTop: '0.25rem', fontSize: '0.5rem' }} onClick={() => { setEditingRecommended(ex.id); setRecommendedInput('') }}>
                                                  + Anbefalet vægt
                                                </button>
                                              )
                                            })()
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0, marginLeft: isMobile ? 0 : '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                          {copyingExercise === ex.id ? (
                                            <>
                                              <select
                                                style={{ ...s.fieldInput, fontSize: '0.65rem', padding: '0.2rem 0.4rem', width: 'auto', cursor: 'pointer' }}
                                                defaultValue=""
                                                onChange={e => { if (e.target.value) copyExerciseToSession(ex, e.target.value) }}
                                              >
                                                <option value="" disabled>Kopiér til...</option>
                                                {weeks.map(w => {
                                                  const otherSessions = (w.sessions || []).filter(s => s.id !== session.id)
                                                  if (!otherSessions.length) return null
                                                  return (
                                                    <optgroup key={w.id} label={`Uge ${w.week_number}${w.block_name ? ` — ${w.block_name}` : ''}`}>
                                                      {otherSessions.map(s => (
                                                        <option key={s.id} value={s.id}>{s.title}</option>
                                                      ))}
                                                    </optgroup>
                                                  )
                                                })}
                                              </select>
                                              <button style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.2rem 0.4rem' }} onClick={() => setCopyingExercise(null)}>✕</button>
                                            </>
                                          ) : (
                                            <button style={s.btnEdit} onClick={() => setCopyingExercise(ex.id)}>Kopiér</button>
                                          )}
                                          <button style={{ ...s.btnEdit, opacity: exIdx === 0 ? 0.25 : 1 }} disabled={exIdx === 0} onClick={() => reorderExercise(session.id, ex.id, 'up')}>↑</button>
                                          <button style={{ ...s.btnEdit, opacity: exIdx === exArr.length - 1 ? 0.25 : 1 }} disabled={exIdx === exArr.length - 1} onClick={() => reorderExercise(session.id, ex.id, 'down')}>↓</button>
                                          <button style={s.btnEdit} onClick={() => { setEditingExercise(ex.id); const { intensityPrefix, intensity } = parseIntensity(ex.intensity); setExerciseForm({ name: ex.name, sets: ex.sets || '', reps: ex.reps || '', intensity, intensityPrefix, note: ex.note || '' }) }}>✎</button>
                                          <button style={s.btnDanger} onClick={() => deleteExercise(ex.id)}>✕</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}

                                {/* Add exercise */}
                                {addingExercise === session.id ? (
                                  <div style={{ paddingTop: '0.75rem' }}>
                                    {exFormRow}
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                      <button style={s.btnGhost} onClick={() => setAddingExercise(null)}>Annuller</button>
                                      <button style={s.btnPrimary} onClick={() => addExercise(session.id)}>Tilføj</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button style={{ ...s.btnSm, marginTop: '0.5rem' }} onClick={() => { setAddingExercise(session.id); setExerciseForm({ name: '', sets: '', reps: '', intensity: '', intensityPrefix: 'RPE', note: '' }) }}>
                                    + Tilføj øvelse
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Add session */}
                        {addingSession === week.id ? (
                          <div style={{ background: '#141410', border: '1px solid rgba(200,146,58,0.2)', padding: '0.75rem', marginTop: '0.5rem' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                              <div style={s.fieldLabel}>Titel</div>
                              <input style={s.fieldInput} type="text" placeholder="f.eks. Træning A" value={sessionForm.title} onChange={e => setSessionForm(p => ({ ...p, title: e.target.value }))} />
                            </div>
                            {weekdayPicker}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button style={s.btnGhost} onClick={() => setAddingSession(null)}>Annuller</button>
                              <button style={s.btnPrimary} onClick={() => addSession(week.id)}>Tilføj</button>
                            </div>
                          </div>
                        ) : (
                          <button style={{ ...s.btnGhost, marginTop: '0.5rem', fontSize: '0.54rem' }} onClick={() => { setAddingSession(week.id); setSessionForm({ title: '', weekday: null }) }}>
                            + Tilføj træning
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TRÆNINGSLOG */}
            {activeTab === 'log' && (() => {
              // Build trend index: exName → sorted [{ date, avg }]
              const trendEntries = {}
              for (const log of athleteLogs) {
                const name = log.exercises?.name
                if (!name) continue
                const date = log.logged_at?.slice(0, 10) || ''
                const tk = `${name}|${date}`
                if (!trendEntries[tk]) trendEntries[tk] = { name, date, weights: [] }
                if (log.weight) trendEntries[tk].weights.push(log.weight)
              }
              const trendIndex = {}
              for (const { name, date, weights } of Object.values(trendEntries)) {
                if (!trendIndex[name]) trendIndex[name] = []
                if (weights.length > 0) trendIndex[name].push({ date, avg: weights.reduce((a, b) => a + b, 0) / weights.length })
              }
              for (const arr of Object.values(trendIndex)) arr.sort((a, b) => a.date.localeCompare(b.date))

              function getTrend(exName, currentDate) {
                const history = (trendIndex[exName] || []).filter(e => e.date <= currentDate)
                if (history.length < 2) return null
                const curr = history[history.length - 1]
                const prev = history[history.length - 2]
                if (curr.date !== currentDate) return null
                const diff = Math.round((curr.avg - prev.avg) * 10) / 10
                if (diff > 0.4) return { text: `↑ +${diff}kg siden sidst`, color: '#6cba6c' }
                if (diff < -0.4) return { text: `↓ ${Math.abs(diff)}kg siden sidst`, color: '#e05555' }
                return { text: '= Samme som sidst', color: '#7a7770' }
              }

              // Group logs by date + session
              const grouped = {}
              for (const log of athleteLogs) {
                const ex = log.exercises
                const sess = ex?.sessions
                const date = log.logged_at?.slice(0, 10) || ''
                const sessId = sess?.id || 'unknown'
                const key = `${date}|${sessId}`
                if (!grouped[key]) grouped[key] = { date, sessionTitle: sess?.title || '—', weekNum: sess?.weeks?.week_number, sessionRating: sess?.athlete_rating ?? null, sessionComment: sess?.athlete_comment ?? null, exerciseMap: {} }
                const exId = log.exercise_id
                if (!grouped[key].exerciseMap[exId]) {
                  grouped[key].exerciseMap[exId] = {
                    name: ex?.name || '—',
                    plannedSets: ex?.sets || 0,
                    plannedReps: ex?.reps || '',
                    intensity: ex?.intensity || '',
                    sets: [],
                  }
                }
                grouped[key].exerciseMap[exId].sets.push({ n: log.set_number, weight: log.weight, reps: log.reps_completed, note: log.note, rpe_actual: log.rpe_actual, rpe_planned: parsePlannedRpe(log.exercises?.intensity), skipped: log.skipped })
              }
              const logSessions = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date))

              // Gruppér loggede træninger pr. uge (seneste uge øverst), sammenklappelige
              const wgMap = {}
              const weekGroups = []
              for (const sess of logSessions) {
                const key = sess.weekNum != null ? sess.weekNum : '—'
                if (!wgMap[key]) { wgMap[key] = { key, weekNum: sess.weekNum, sessions: [], latestDate: sess.date, totalSets: 0 }; weekGroups.push(wgMap[key]) }
                const g = wgMap[key]
                g.sessions.push(sess)
                if (sess.date > g.latestDate) g.latestDate = sess.date
                g.totalSets += Object.values(sess.exerciseMap).reduce((acc, ex) => acc + ex.sets.length, 0)
              }
              weekGroups.sort((a, b) => b.latestDate.localeCompare(a.latestDate))
              const latestKey = weekGroups[0]?.key
              const openSet = openLogWeeks ?? new Set(latestKey != null ? [latestKey] : [])
              const toggleWeek = key => setOpenLogWeeks(prev => {
                const base = prev ?? new Set(latestKey != null ? [latestKey] : [])
                const next = new Set(base)
                if (next.has(key)) next.delete(key); else next.add(key)
                return next
              })

              // Øvelses-filter: liste over loggede øvelser + progression for den valgte
              const exerciseNames = [...new Set(athleteLogs.map(l => l.exercises?.name).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'da'))
              const filterName = logExerciseFilter && exerciseNames.includes(logExerciseFilter) ? logExerciseFilter : null
              const e1rmOf = s => (s.weight || 0) * (1 + (s.reps || 1) / 30)
              const progression = filterName ? logSessions.map(sess => {
                const entries = Object.values(sess.exerciseMap).filter(ex => ex.name === filterName)
                if (!entries.length) return null
                const sets = entries.flatMap(e => e.sets).filter(s => !s.skipped && (s.weight || 0) > 0)
                if (!sets.length) return null
                const sortedSets = [...sets].sort((a, b) => a.n - b.n)
                const best = sets.reduce((m, s) => (e1rmOf(s) > m.v ? { v: e1rmOf(s), s } : m), { v: 0, s: null })
                const planText = [entries[0].plannedSets && `${entries[0].plannedSets} sæt`, entries[0].plannedReps && `× ${entries[0].plannedReps}`, entries[0].intensity].filter(Boolean).join(' · ')
                return { date: sess.date, weekNum: sess.weekNum, sortedSets, e1rm: Math.round(best.v * 10) / 10, planText }
              }).filter(Boolean) : []

              const renderSession = (sess, i) => {
                    const exercises = Object.values(sess.exerciseMap)
                    const totalPlanned = exercises.reduce((acc, ex) => acc + ex.plannedSets, 0)
                    const totalLogged = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
                    const allWeights = exercises.flatMap(ex => ex.sets.map(s => s.weight || 0)).filter(w => w > 0)
                    const sessAvg = allWeights.length > 0 ? Math.round(allWeights.reduce((a, b) => a + b, 0) / allWeights.length * 10) / 10 : 0

                    return (
                      <div key={i} style={{ marginBottom: '1.75rem', paddingBottom: '1.75rem', borderBottom: '1px solid rgba(237,234,226,0.05)' }}>
                        {/* Session header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                          <div>
                            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{sess.date}</div>
                              {sess.weekNum && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', textTransform: 'uppercase' }}>Uge {sess.weekNum}</div>}
                            </div>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' }}>{sess.sessionTitle}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: totalLogged >= totalPlanned && totalPlanned > 0 ? '#6cba6c' : '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {totalLogged}/{totalPlanned} sæt
                            </div>
                            {sessAvg > 0 && (
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', textTransform: 'uppercase', marginTop: '0.15rem' }}>
                                Ø {sessAvg} kg
                              </div>
                            )}
                          </div>
                        </div>

                        {sess.sessionRating && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#c8923a', letterSpacing: '0.04em' }}>
                              {'★'.repeat(sess.sessionRating)}{'☆'.repeat(5 - sess.sessionRating)}
                            </div>
                            {sess.sessionComment && (
                              <div style={{ fontSize: '0.75rem', color: '#7a7770', fontStyle: 'italic' }}>{sess.sessionComment}</div>
                            )}
                          </div>
                        )}

                        {/* Exercises */}
                        {exercises.map((ex, j) => {
                          const sortedSets = [...ex.sets].sort((a, b) => a.n - b.n)
                          const weights = sortedSets.map(s => s.weight || 0).filter(w => w > 0)
                          const exAvg = weights.length > 0 ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length * 10) / 10 : 0
                          const maxW = weights.length > 0 ? Math.max(...weights) : 0
                          const completion = ex.plannedSets > 0 ? Math.min(1, ex.sets.length / ex.plannedSets) : 0
                          const trend = getTrend(ex.name, sess.date)
                          const planText = [ex.plannedSets && `${ex.plannedSets} sæt`, ex.plannedReps && `× ${ex.plannedReps}`, ex.intensity].filter(Boolean).join(' · ')
                          const borderColor = completion >= 1 ? '#6cba6c' : completion > 0 ? '#c8923a' : 'rgba(237,234,226,0.07)'

                          return (
                            <div key={j} style={{ marginBottom: '1rem', paddingLeft: '0.75rem', borderLeft: `2px solid ${borderColor}` }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                                <div style={{ fontSize: '0.85rem', color: '#b8b4a8' }}>{ex.name}</div>
                                {trend && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: trend.color, letterSpacing: '0.06em', flexShrink: 0, marginLeft: '0.75rem' }}>{trend.text}</div>}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginBottom: '0.4rem' }}>
                                Plan: {planText}
                              </div>
                              {ex.plannedSets > 0 && (
                                <div style={{ marginBottom: '0.45rem' }}>
                                  <div style={{ height: '3px', background: '#242420', borderRadius: '2px', marginBottom: '0.25rem' }}>
                                    <div style={{ height: '3px', width: `${completion * 100}%`, background: completion >= 1 ? '#6cba6c' : '#c8923a', borderRadius: '2px' }} />
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844' }}>{ex.sets.length}/{ex.plannedSets} sæt</div>
                                    {exAvg > 0 && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#7a7770' }}>Ø {exAvg}kg{maxW > exAvg ? ` · maks ${maxW}kg` : ''}</div>}
                                  </div>
                                </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {sortedSets.map(set => {
                                  if (set.skipped) return (
                                    <div key={set.n} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.06)', padding: '0.2rem 0.5rem', color: '#4a4844' }}>
                                      <span>S{set.n} </span><span>✕</span>
                                    </div>
                                  )
                                  const rpeColor = set.rpe_actual != null && set.rpe_planned != null
                                    ? (set.rpe_actual >= set.rpe_planned + 1 ? '#c8923a' : Math.abs(set.rpe_actual - set.rpe_planned) <= 0.5 ? '#6cba6c' : '#edeae2')
                                    : '#7a7770'
                                  return (
                                    <div key={set.n} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', padding: '0.2rem 0.5rem', color: '#edeae2' }}>
                                      <span style={{ color: '#4a4844' }}>S{set.n} </span>
                                      <span style={{ color: '#c8923a' }}>{set.weight}kg</span>
                                      {set.reps && <span style={{ color: '#7a7770' }}> × {set.reps}</span>}
                                      {set.rpe_actual != null && (
                                        <span style={{ color: rpeColor, marginLeft: '0.3rem' }}>
                                          RPE {set.rpe_actual}{set.rpe_planned != null ? `/${set.rpe_planned}` : ''}
                                        </span>
                                      )}
                                      {set.note && <span style={{ color: '#4a4844', marginLeft: '0.3rem', fontStyle: 'italic' }}>{set.note}</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                }

                return (
                  <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '1.25rem' }}>
                      Træningslog
                    </div>
                    {logSessions.length === 0 ? (
                      <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Ingen loggede træninger endnu
                      </div>
                    ) : (
                      <>
                        {/* Øvelses-filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770' }}>Øvelse</span>
                          <select
                            value={filterName || ''}
                            onChange={e => setLogExerciseFilter(e.target.value || null)}
                            style={{ background: '#1c1c18', color: '#edeae2', border: '1px solid rgba(237,234,226,0.15)', borderRadius: 4, padding: '0.4rem 0.6rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', cursor: 'pointer', maxWidth: '100%' }}
                          >
                            <option value="">Alle øvelser</option>
                            {exerciseNames.map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>

                        {filterName ? (
                          progression.length === 0 ? (
                            <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                              Ingen loggede sæt for {filterName} endnu
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#edeae2', marginBottom: '1rem' }}>{filterName}</div>
                              {progression.map((row, idx) => {
                                const older = progression[idx + 1]
                                let delta = null
                                if (older && row.e1rm > 0 && older.e1rm > 0) {
                                  const d = Math.round((row.e1rm - older.e1rm) * 10) / 10
                                  delta = d > 0.4 ? { text: `↑ +${d}kg e1RM`, color: '#6cba6c' }
                                    : d < -0.4 ? { text: `↓ ${Math.abs(d)}kg e1RM`, color: '#e05555' }
                                    : { text: '= samme', color: '#7a7770' }
                                }
                                return (
                                  <div key={row.date + idx} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(237,234,226,0.05)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', minWidth: 0 }}>
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{row.date}</span>
                                        {row.weekNum != null && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', textTransform: 'uppercase' }}>Uge {row.weekNum}</span>}
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexShrink: 0 }}>
                                        {row.e1rm > 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#b8b4a8' }}>e1RM {row.e1rm}kg</span>}
                                        {delta && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: delta.color, letterSpacing: '0.06em' }}>{delta.text}</span>}
                                      </div>
                                    </div>
                                    {row.planText && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', marginBottom: '0.4rem' }}>Plan: {row.planText}</div>}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                      {row.sortedSets.map(set => (
                                        <div key={set.n} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', padding: '0.2rem 0.5rem', color: '#edeae2' }}>
                                          <span style={{ color: '#4a4844' }}>S{set.n} </span>
                                          <span style={{ color: '#c8923a' }}>{set.weight}kg</span>
                                          {set.reps && <span style={{ color: '#7a7770' }}> × {set.reps}</span>}
                                          {set.rpe_actual != null && <span style={{ color: '#7a7770', marginLeft: '0.3rem' }}>RPE {set.rpe_actual}{set.rpe_planned != null ? `/${set.rpe_planned}` : ''}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        ) : weekGroups.map(g => {
                          const open = openSet.has(g.key)
                          return (
                            <div key={g.key} style={{ marginBottom: '0.5rem' }}>
                              <button onClick={() => toggleWeek(g.key)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', borderRadius: 4, padding: '0.65rem 0.85rem', cursor: 'pointer', marginBottom: open ? '1rem' : 0 }}>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#edeae2' }}>
                                  {g.weekNum != null ? `Uge ${g.weekNum}` : 'Uden uge'}
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>{g.sessions.length} træning{g.sessions.length === 1 ? '' : 'er'} · {g.totalSets} sæt</span>
                                  <span style={{ color: '#c8923a', fontSize: '0.7rem' }}>{open ? '▾' : '▸'}</span>
                                </span>
                              </button>
                              {open && (
                                <div style={{ paddingLeft: '0.25rem' }}>
                                  {g.sessions.map((sess, i) => renderSession(sess, i))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )
            })()}

            {/* TAB: NOTER */}
            {activeTab === 'stævne' && (() => {
              const lifts = meetPlanForm.meet_type === 'sbd'
                ? [{ key: 'squat', label: 'Squat' }, { key: 'bench', label: 'Bænkpres' }, { key: 'deadlift', label: 'Dødløft' }]
                : [{ key: 'bench', label: 'Bænkpres' }]
              const fieldMap = { squat: ['squat1','squat2','squat3'], bench: ['bench1','bench2','bench3'], deadlift: ['dead1','dead2','dead3'] }

              return (
                <>
                <div style={s.card}>
                  <div style={s.cardLabel}>
                    Stævneplan — {a.name.split(' ')[0]}
                    {meetPlan && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#6cba6c', marginLeft: '0.75rem' }}>Gemt</span>}
                  </div>

                  {/* Type toggle */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={s.fieldLabel}>Stævnetype</div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {[['sbd', 'SBD'], ['bench', 'Kun bænkpres']].map(([key, label]) => (
                        <button key={key} onClick={() => setMeetPlanForm(p => ({ ...p, meet_type: key }))} style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500,
                          letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                          padding: '0.4rem 0.85rem',
                          background: meetPlanForm.meet_type === key ? '#c8923a' : 'rgba(237,234,226,0.07)',
                          color: meetPlanForm.meet_type === key ? '#141410' : '#7a7770',
                        }}>{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Attempt inputs per lift */}
                  {lifts.map(({ key, label }) => (
                    <div key={key} style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#edeae2', marginBottom: '0.6rem' }}>{label}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                        {fieldMap[key].map((field, i) => (
                          <div key={field}>
                            <div style={s.fieldLabel}>{i + 1}. forsøg</div>
                            <input
                              type="number"
                              placeholder="kg"
                              value={meetPlanForm[field]}
                              onChange={e => setMeetPlanForm(p => ({ ...p, [field]: e.target.value }))}
                              style={{ ...s.fieldInput, textAlign: 'center' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Notes */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={s.fieldLabel}>Note til atleten</div>
                    <textarea
                      style={{ ...s.fieldInput, minHeight: '72px', resize: 'vertical', lineHeight: 1.7 }}
                      placeholder="Taktik, strategi, påmindelser..."
                      value={meetPlanForm.notes}
                      onChange={e => setMeetPlanForm(p => ({ ...p, notes: e.target.value }))}
                    />
                  </div>

                  <button style={s.btnPrimary} onClick={() => saveMeetPlan(a.id)} disabled={savingMeetPlan}>
                    {savingMeetPlan ? 'Gemmer...' : 'Gem plan'}
                  </button>

                  {meetPlan && (
                    <button style={{ ...s.btnDanger, marginLeft: '0.75rem' }} onClick={async () => {
                      await supabase.from('meet_plans').delete().eq('athlete_id', a.id)
                      setMeetPlan(null)
                      setMeetPlanForm({ meet_type: 'sbd', squat1: '', squat2: '', squat3: '', bench1: '', bench2: '', bench3: '', dead1: '', dead2: '', dead3: '', notes: '' })
                    }}>
                      Slet plan
                    </button>
                  )}
                </div>

                {/* Stævnehistorik */}
                <div style={{ ...s.card, marginTop: '1.5rem' }}>
                  <div style={s.cardLabel}>
                    Stævnehistorik
                    <button style={s.btnEdit} onClick={() => openMeetResult()}>Registrér resultat</button>
                  </div>
                  {meetResults.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen stævner registreret endnu.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace" }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: '#4a4844', fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            <th style={{ padding: '0.4rem 0.5rem 0.4rem 0', fontWeight: 500 }}>Dato</th>
                            <th style={{ padding: '0.4rem 0.5rem', fontWeight: 500 }}>Stævne</th>
                            <th style={{ padding: '0.4rem 0.5rem', fontWeight: 500, textAlign: 'right' }}>S</th>
                            <th style={{ padding: '0.4rem 0.5rem', fontWeight: 500, textAlign: 'right' }}>B</th>
                            <th style={{ padding: '0.4rem 0.5rem', fontWeight: 500, textAlign: 'right' }}>D</th>
                            <th style={{ padding: '0.4rem 0.5rem', fontWeight: 500, textAlign: 'right' }}>Total</th>
                            <th style={{ padding: '0.4rem 0 0.4rem 0.5rem' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {meetResults.map(m => (
                            <tr key={m.id} style={{ borderTop: '1px solid rgba(237,234,226,0.07)', fontSize: '0.78rem', color: '#edeae2' }}>
                              <td style={{ padding: '0.5rem 0.5rem 0.5rem 0', whiteSpace: 'nowrap' }}>{new Date(m.meet_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                              <td style={{ padding: '0.5rem', color: '#b8b4a8', fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.meet_name || <span style={{ color: '#4a4844' }}>—</span>}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: m.squat != null ? '#edeae2' : '#3a3a36' }}>{m.squat != null ? m.squat : '–'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: m.bench != null ? '#edeae2' : '#3a3a36' }}>{m.bench != null ? m.bench : '–'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: m.deadlift != null ? '#edeae2' : '#3a3a36' }}>{m.deadlift != null ? m.deadlift : '–'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', color: '#c8923a' }}>{m.total != null ? m.total : '–'}</td>
                              <td style={{ padding: '0.5rem 0 0.5rem 0.5rem', textAlign: 'right' }}>
                                <button onClick={() => deleteMeetResult(m.id)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }} title="Slet">✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* PRs */}
                <div style={{ ...s.card, marginTop: '1.5rem' }}>
                  <div style={s.cardLabel}>Rekorder</div>
                  {athletePRs.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen PR'er registreret endnu.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {athletePRs.map(pr => (
                        <div key={pr.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.88rem', color: '#edeae2', fontWeight: 300 }}>{pr.exercise_name}</span>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flexShrink: 0 }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.95rem', color: '#c8923a' }}>{pr.weight} kg</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.06em' }}>{pr.logged_at.slice(0, 10)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </>
              )
            })()}

            {activeTab === 'noter' && (
              <div style={s.card}>
                <div style={s.cardLabel}>
                  Coach-noter
                  <button style={s.btnEdit} onClick={() => startEdit('notes', { notes: a.notes || '' })}>Rediger</button>
                </div>
                {editing === 'notes' ? (
                  <div>
                    <textarea style={{ ...s.fieldInput, minHeight: '120px', resize: 'vertical', lineHeight: 1.7 }} value={editData.notes} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} />
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                      <button style={s.btnGhost} onClick={() => setEditing(null)}>Annuller</button>
                      <button style={s.btnPrimary} onClick={() => saveEdit()} disabled={saving}>{saving ? 'Gemmer...' : 'Gem'}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.88rem', color: '#7a7770', lineHeight: 1.75, fontStyle: a.notes ? 'normal' : 'italic' }}>
                    {a.notes || 'Ingen noter endnu.'}
                  </div>
                )}
              </div>
            )}

            {/* TAB: BESKEDER */}
            {activeTab === 'beskeder' && (
              <div style={s.card}>
                <div style={s.cardLabel}>Beskeder med {a.name}</div>

                {/* Pinned messages */}
                {messages.filter(m => m.pinned).length > 0 && (
                  <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c8923a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19V13L15 9V4H9V9L5 13V17Z"/>
                      </svg>
                      Fastgjorte
                    </div>
                    {messages.filter(m => m.pinned).map(msg => (
                      <div key={msg.id} style={{ background: 'rgba(200,146,58,0.06)', border: '1px solid rgba(200,146,58,0.18)', padding: '0.65rem 0.75rem', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                            {msg.sender_role === 'coach' ? 'Coach' : a.name} · {formatMsgTime(msg.created_at)}
                          </div>
                          <div style={{ fontSize: '0.88rem', color: '#edeae2', lineHeight: 1.55 }}>{msg.content}</div>
                        </div>
                        <button onClick={() => togglePin(msg.id, msg.pinned)} title="Løsn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8923a', padding: '0.1rem', flexShrink: 0 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <path d="M5 17H19V13L15 9V4H9V9L5 13V17Z M12 17v5" strokeWidth="2"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message thread */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  {messages.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen beskeder endnu.</div>
                  ) : messages.map(msg => {
                    const isCoach = msg.sender_role === 'coach'
                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: isCoach ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '0.4rem' }}>
                        <div style={{ maxWidth: '72%' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem', textAlign: isCoach ? 'right' : 'left' }}>
                            {formatMsgTime(msg.created_at)}
                          </div>
                          <div style={{
                            background: isCoach ? 'rgba(200,146,58,0.11)' : '#1c1c18',
                            border: isCoach ? '1px solid rgba(200,146,58,0.22)' : '1px solid rgba(237,234,226,0.07)',
                            padding: '0.6rem 0.8rem',
                            fontSize: '0.88rem',
                            color: '#edeae2',
                            lineHeight: 1.55,
                          }}>
                            {msg.content}
                          </div>
                        </div>
                        <button
                          onClick={() => togglePin(msg.id, msg.pinned)}
                          title={msg.pinned ? 'Løsn' : 'Fastgør'}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: msg.pinned ? '#c8923a' : '#2e2e2a', padding: '0.3rem', flexShrink: 0, marginBottom: '0.1rem', transition: 'color 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#c8923a'}
                          onMouseLeave={e => e.currentTarget.style.color = msg.pinned ? '#c8923a' : '#2e2e2a'}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill={msg.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19V13L15 9V4H9V9L5 13V17Z"/>
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Send input */}
                <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '1rem' }}>
                  <input
                    style={{ ...s.fieldInput, flex: 1 }}
                    type="text"
                    placeholder="Skriv en besked..."
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendCoachMessage()}
                  />
                  <button style={s.btnPrimary} onClick={sendCoachMessage}>Send</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {meetResultForm && (() => {
        const f = meetResultForm
        const set = (patch) => setMeetResultForm(p => ({ ...p, ...patch }))
        const picked = ['squat', 'bench', 'deadlift'].filter(k => f.contest[k])
        const previewTotal = picked.reduce((sum, k) => sum + (parseFloat(f[k]) || 0), 0)
        return (
          <div style={s.overlay} onClick={e => e.target === e.currentTarget && setMeetResultForm(null)}>
            <div style={{ ...s.modal, maxWidth: '480px', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={s.modalTitle}>Registrér stævneresultat — {selectedAthlete?.name?.split(' ')[0]}</div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={s.fieldLabel}>Stævnedato</div>
                <input style={s.fieldInput} type="date" value={f.meet_date} onChange={e => set({ meet_date: e.target.value })} />
              </div>
              <div style={{ marginBottom: '1.1rem' }}>
                <div style={s.fieldLabel}>Stævnenavn (valgfrit)</div>
                <input style={s.fieldInput} type="text" placeholder="f.eks. DM i bænkpres 2026" value={f.meet_name} onChange={e => set({ meet_name: e.target.value })} />
              </div>

              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.6rem' }}>Konkurrerede løft</div>
              {[['squat', 'Squat'], ['bench', 'Bænkpres'], ['deadlift', 'Dødløft']].map(([k, label]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: '130px', cursor: 'pointer', fontSize: '0.85rem', color: f.contest[k] ? '#edeae2' : '#7a7770' }}>
                    <input type="checkbox" checked={f.contest[k]} onChange={() => setMeetResultForm(p => ({ ...p, contest: { ...p.contest, [k]: !p.contest[k] } }))} />
                    {label}
                  </label>
                  <input style={{ ...s.fieldInput, flex: 1, opacity: f.contest[k] ? 1 : 0.35 }} type="number" inputMode="decimal" placeholder="kg" disabled={!f.contest[k]} value={f.contest[k] ? f[k] : ''} onChange={e => set({ [k]: e.target.value })} />
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem', marginBottom: '1.1rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
                <span style={s.fieldLabel}>Total</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2' }}>{previewTotal || 0} <span style={{ fontSize: '0.8rem', color: '#7a7770' }}>kg</span></span>
              </div>

              <div style={{ marginBottom: '1.1rem' }}>
                <div style={s.fieldLabel}>Kropsvægt ved indvejning (valgfrit)</div>
                <input style={s.fieldInput} type="number" inputMode="decimal" placeholder="kg" value={f.bodyweight} onChange={e => set({ bodyweight: e.target.value })} />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={s.fieldLabel}>Note (valgfrit)</div>
                <textarea style={{ ...s.fieldInput, minHeight: '60px', resize: 'vertical' }} value={f.notes} onChange={e => set({ notes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.85rem', color: '#b8b4a8' }}>
                  <input type="checkbox" checked={f.setOffseason} onChange={() => set({ setOffseason: !f.setOffseason })} />
                  Sæt status til Off-season
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.85rem', color: '#b8b4a8' }}>
                  <input type="checkbox" checked={f.clearDate} onChange={() => set({ clearDate: !f.clearDate })} />
                  Ryd stævnedato
                </label>
                {!f.clearDate && (
                  <div style={{ marginLeft: '1.4rem' }}>
                    <div style={s.fieldLabel}>Ny stævnedato (valgfrit)</div>
                    <input style={s.fieldInput} type="date" value={f.newDate} onChange={e => set({ newDate: e.target.value })} />
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.85rem', color: '#b8b4a8' }}>
                  <input type="checkbox" checked={f.savePR} onChange={() => set({ savePR: !f.savePR })} />
                  Gem som rekord (PR)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button style={s.btnGhost} onClick={() => setMeetResultForm(null)}>Annuller</button>
                <button style={s.btnPrimary} onClick={() => saveMeetResult()} disabled={saving}>{saving ? 'Gemmer...' : 'Gem resultat'}</button>
              </div>
            </div>
          </div>
        )
      })()}

      {showAddModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Tilføj atlet</div>
            {[['Navn', 'name', 'text', 'Fulde navn'], ['Email', 'email', 'email', 'email@eksempel.dk'], ['Alder', 'age', 'number', 'f.eks. 28'], ['Vægtklasse (kg)', 'weightClass', 'number', 'f.eks. 83']].map(([label, key, type, placeholder]) => (
              <div key={key} style={{ marginBottom: '0.75rem' }}>
                <div style={s.fieldLabel}>{label}</div>
                <input style={s.fieldInput} type={type} placeholder={placeholder} value={newAthlete[key]} onChange={e => setNewAthlete(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={s.fieldLabel}>Status</div>
              <select style={s.fieldSelect} value={newAthlete.status} onChange={e => setNewAthlete(p => ({ ...p, status: e.target.value }))}>
                <option value="active">Aktiv</option>
                <option value="peaking">Peaking</option>
                <option value="offseason">Off-season</option>
                <option value="ferie">Ferie</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setShowAddModal(false)}>Annuller</button>
              <button style={s.btnPrimary} onClick={addAthlete} disabled={saving}>{saving ? 'Tilføjer...' : 'Tilføj'}</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowDeleteModal(false)}>
          <div style={s.modal}>
            <div style={s.modalTitle}>Fjern atlet</div>
            <p style={{ fontSize: '0.88rem', color: '#7a7770', lineHeight: 1.75, marginBottom: '1.5rem' }}>Er du sikker på at du vil fjerne {a?.name}? Det kan ikke fortrydes.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setShowDeleteModal(false)}>Annuller</button>
              <button style={s.btnDanger} onClick={deleteAthlete}>Fjern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
