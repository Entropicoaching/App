import { useState, useEffect } from 'react'
import { supabase } from './supabase'

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

const statusLabels = { active: 'Aktiv', peaking: 'Peaking', offseason: 'Off-season' }
const statusColors = { active: '#6cba6c', peaking: '#c8923a', offseason: '#7a7770' }

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const s = {
  wrap: { minHeight: '100vh', background: '#141410', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, display: 'flex' },
  sidebar: { width: '220px', minHeight: '100vh', background: '#1c1c18', borderRight: '1px solid rgba(237,234,226,0.07)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0 },
  sidebarLogo: { padding: '1.5rem 1.25rem 1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' },
  wordmark: { fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#edeae2' },
  sub: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.2rem' },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1.25rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: active ? '#c8923a' : '#7a7770', cursor: 'pointer', borderLeft: active ? '2px solid #c8923a' : '2px solid transparent', background: active ? 'rgba(200,146,58,0.08)' : 'transparent' }),
  sidebarFooter: { padding: '1rem 1.25rem', borderTop: '1px solid rgba(237,234,226,0.07)', marginTop: 'auto', fontSize: '0.78rem', color: '#4a4844' },
  main: { marginLeft: '220px', flex: 1 },
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
  const [view, setView] = useState('list')
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [activeTab, setActiveTab] = useState('oversigt')
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

  // Program state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)

  const [weeks, setWeeks] = useState([])
  const [openWeekId, setOpenWeekId] = useState(null)
  const [openSessionId, setOpenSessionId] = useState(null)
  const [addingWeek, setAddingWeek] = useState(false)
  const [addingSession, setAddingSession] = useState(null)
  const [addingExercise, setAddingExercise] = useState(null)
  const [editingWeek, setEditingWeek] = useState(null)
  const [editingSession, setEditingSession] = useState(null)
  const [editingExercise, setEditingExercise] = useState(null)
  const [weekForm, setWeekForm] = useState({ week_number: '', block_name: '', coach_note: '', block_description: '' })
  const [sessionForm, setSessionForm] = useState({ title: '' })
  const [exerciseForm, setExerciseForm] = useState({ name: '', sets: '', reps: '', intensity: '', intensityPrefix: 'RPE', note: '' })
  const [athleteLogs, setAthleteLogs] = useState([])
  const [athleteWeightLogs, setAthleteWeightLogs] = useState([])
  const [athleteReadiness, setAthleteReadiness] = useState([])
  const [athletePRs, setAthletePRs] = useState([])
  const [warmupTemplates, setWarmupTemplates] = useState([])
  const [editingWarmup, setEditingWarmup] = useState(null)
  const [warmupDraftSteps, setWarmupDraftSteps] = useState([])
  const [warmupNewStep, setWarmupNewStep] = useState('')
  const [editingRecommended, setEditingRecommended] = useState(null)
  const [recommendedInput, setRecommendedInput] = useState('')
  const [copyingExercise, setCopyingExercise] = useState(null)

  const [previewPickerOpen, setPreviewPickerOpen] = useState(false)
  const [exerciseLibrary, setExerciseLibrary] = useState([])
  const [exerciseSearchOpen, setExerciseSearchOpen] = useState(false)
  const [editingLibraryEx, setEditingLibraryEx] = useState(null)
  const [libraryEditForm, setLibraryEditForm] = useState({ name: '', category: '' })
  const [addingLibraryEx, setAddingLibraryEx] = useState(false)
  const [libraryAddForm, setLibraryAddForm] = useState({ name: '', category: 'Accessory' })
  const [librarySearch, setLibrarySearch] = useState('')

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => { fetchAthletes(); fetchExerciseLibrary() }, [])
  useEffect(() => {
    if ((activeTab === 'program' || activeTab === 'analyse') && selectedAthlete) {
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
    }
  }, [activeTab, selectedAthlete?.id])

  useEffect(() => {
    if (activeTab === 'opvarmning' && selectedAthlete) {
      fetchWarmupTemplates(selectedAthlete.id)
    }
  }, [activeTab, selectedAthlete?.id])

  async function fetchAthletes() {
    const { data, error } = await supabase.from('athletes').select('*').order('name')
    if (!error) {
      setAthletes(data || [])
      if (data?.length) {
        fetchLatestMessages(data.map(a => a.id))
        fetchProfilesLastSeen(data)
      }
    }
    setLoading(false)
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
        .sort((a, b) => a.session_order - b.session_order)
        .map(s => ({ ...s, exercises: (s.exercises || []).sort((a, b) => a.exercise_order - b.exercise_order) }))
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
    })
    setAddingWeek(false)
    setWeekForm({ week_number: '', block_name: '', coach_note: '', block_description: '' })
    fetchWeeks(selectedAthlete.id)
  }

  async function updateWeek(weekId) {
    await supabase.from('weeks').update({
      week_number: parseInt(weekForm.week_number),
      block_name: weekForm.block_name || null,
      coach_note: weekForm.coach_note || null,
      block_description: weekForm.block_description || null,
    }).eq('id', weekId)
    setEditingWeek(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function deleteWeek(weekId) {
    if (!window.confirm('Slet denne uge og alle dens træninger?')) return
    await supabase.from('weeks').delete().eq('id', weekId)
    if (openWeekId === weekId) setOpenWeekId(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function addSession(weekId) {
    const week = weeks.find(w => w.id === weekId)
    const nextOrder = week?.sessions?.length || 0
    await supabase.from('sessions').insert({
      week_id: weekId,
      title: sessionForm.title || 'Træning',
      session_order: nextOrder,
    })
    setAddingSession(null)
    setSessionForm({ title: '' })
    fetchWeeks(selectedAthlete.id)
  }

  async function updateSession(sessionId) {
    await supabase.from('sessions').update({ title: sessionForm.title }).eq('id', sessionId)
    setEditingSession(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function deleteSession(sessionId) {
    if (!window.confirm('Slet denne træning?')) return
    await supabase.from('sessions').delete().eq('id', sessionId)
    if (openSessionId === sessionId) setOpenSessionId(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function reorderSession(weekId, sessionId, direction) {
    const week = weeks.find(w => w.id === weekId)
    const sorted = [...(week?.sessions || [])].sort((a, b) => a.session_order - b.session_order)
    const idx = sorted.findIndex(s => s.id === sessionId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx], b = sorted[swapIdx]
    await supabase.from('sessions').update({ session_order: b.session_order }).eq('id', a.id)
    await supabase.from('sessions').update({ session_order: a.session_order }).eq('id', b.id)
    fetchWeeks(selectedAthlete.id)
  }

  async function reorderExercise(sessionId, exerciseId, direction) {
    const session = weeks.flatMap(w => w.sessions || []).find(s => s.id === sessionId)
    const sorted = [...(session?.exercises || [])].sort((a, b) => a.exercise_order - b.exercise_order)
    const idx = sorted.findIndex(e => e.id === exerciseId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx], b = sorted[swapIdx]
    await supabase.from('exercises').update({ exercise_order: b.exercise_order }).eq('id', a.id)
    await supabase.from('exercises').update({ exercise_order: a.exercise_order }).eq('id', b.id)
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

  async function deleteLibraryExercise(id) {
    if (!window.confirm('Slet øvelse fra biblioteket?')) return
    await supabase.from('exercise_library').delete().eq('id', id)
    fetchExerciseLibrary()
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
    return v
  }

  function parseIntensity(stored) {
    if (!stored) return { intensityPrefix: 'RPE', intensity: '' }
    if (stored.startsWith('RPE ')) return { intensityPrefix: 'RPE', intensity: stored.slice(4) }
    if (stored.endsWith('%')) return { intensityPrefix: '%', intensity: stored.slice(0, -1) }
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
    if (error) { alert(`Kunne ikke gemme: ${error.message}`); return }
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
      .select('id, set_number, weight, reps_completed, note, logged_at, rpe_actual, skipped, exercise_id, exercises(id, name, sets, reps, intensity, recommended_weight, session_id, sessions(id, title, athlete_rating, athlete_comment, weeks(week_number, block_name)))')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .limit(500)
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
    if (!data) { setAthletePRs([]); return }
    const seen = new Set()
    const prs = []
    for (const pr of data) {
      if (!seen.has(pr.exercise_name)) {
        seen.add(pr.exercise_name)
        prs.push(pr)
      }
    }
    setAthletePRs(prs)
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
    const { data, error } = await supabase.from('athletes').update(editData).eq('id', selectedAthlete.id).select().single()
    if (!error) {
      setSelectedAthlete(data)
      setAthletes(prev => prev.map(a => a.id === data.id ? data : a))
    }
    setEditing(null)
    setSaving(false)
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
    const tables = ['athletes', 'weeks', 'sessions', 'exercises', 'exercise_logs', 'meal_logs', 'weight_logs', 'readiness_logs', 'personal_records', 'messages']
    const backup = { exported_at: new Date().toISOString(), tables: {} }
    for (const table of tables) {
      const { data } = await supabase.from(table).select('*')
      backup.tables[table] = data || []
    }
    downloadJSON(backup, `entropi-backup-${dateStr}`)
    setExportingBackup(false)
  }

  function openProfile(athlete, tab = 'oversigt') {
    setSelectedAthlete(athlete)
    setActiveTab(tab)
    setEditing(null)
    setView('profile')
    setMessages([])
    setMessageInput('')
    setWeeks([])
    setAthleteWeightLogs([])
    setOpenWeekId(null)
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
              <option value="Fri tekst">Fri</option>
            </select>
            <input
              style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem', flex: 1, minWidth: 0 }}
              type={exerciseForm.intensityPrefix === 'Fri tekst' ? 'text' : 'number'}
              placeholder={exerciseForm.intensityPrefix === 'RPE' ? 'f.eks. 8' : exerciseForm.intensityPrefix === '%' ? 'f.eks. 80' : 'tekst...'}
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
        <div style={s.sidebarLogo}>
          <div style={s.wordmark}>Entropi<span style={{ color: '#c8923a' }}>.</span></div>
          <div style={s.sub}>Coach Portal</div>
        </div>
        <nav style={{ flex: 1, padding: '1rem 0' }}>
          <div style={s.navItem(view === 'list' || view === 'profile')} onClick={() => { setView('list'); setSidebarOpen(false) }}>Atleter</div>
          <div style={s.navItem(view === 'library')} onClick={() => { setView('library'); setSidebarOpen(false) }}>Bibliotek</div>
        </nav>
        <div style={s.sidebarFooter}>
          <div style={{ color: '#7a7770', marginBottom: '0.3rem' }}>Marc Schlichting</div>
          <div style={{ fontSize: '0.7rem' }}>{session.user.email}</div>
          {onPreviewAthlete && !previewPickerOpen && (
            <button
              onClick={() => setPreviewPickerOpen(true)}
              style={{ ...s.btnPrimary, marginTop: '0.75rem', width: '100%' }}
            >Se som atlet</button>
          )}
          {onPreviewAthlete && previewPickerOpen && (
            <div style={{ marginTop: '0.75rem', background: '#141410', border: '1px solid rgba(200,146,58,0.3)', padding: '0.5rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.4rem' }}>Vælg profil</div>
              {athletes.map(a => (
                <div
                  key={a.id}
                  onClick={() => { setPreviewPickerOpen(false); onPreviewAthlete(a.id) }}
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', color: '#b8b4a8', cursor: 'pointer', borderRadius: '1px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(237,234,226,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{a.name}</div>
              ))}
              <button onClick={() => setPreviewPickerOpen(false)} style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem', width: '100%' }}>Annuller</button>
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
          <div style={{ ...s.topbarTitle, flex: 1 }}>{view === 'library' ? 'Øvelsesbibliotek' : view === 'list' ? 'Atleter' : a?.name}</div>
          {view === 'list' && <button style={s.btnPrimary} onClick={() => setShowAddModal(true)}>+ Tilføj atlet</button>}
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
        {view === 'list' && (
          <div style={{ ...s.page, ...(isMobile ? { padding: '1rem' } : {}) }}>
            <div style={{ marginBottom: '1.75rem' }}>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2' }}>
                Dine <em style={{ fontStyle: 'italic', color: '#7a7770' }}>atleter.</em>
              </h1>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.25rem' }}>
                {athletes.length} atlet{athletes.length !== 1 ? 'er' : ''}
              </div>
            </div>
            {loading ? (
              <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Indlæser...</div>
            ) : athletes.length === 0 ? (
              <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3rem 0' }}>Ingen atleter endnu — tilføj din første</div>
            ) : (
              <>
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
                <div style={s.grid}>
                  {athletes.map(athlete => (
                    <div key={athlete.id} style={s.athleteCard} onClick={() => openProfile(athlete)}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1c1c18'; e.currentTarget.style.borderTop = '2px solid #c8923a' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#141410'; e.currentTarget.style.borderTop = '2px solid transparent' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={s.avatar}>{initials(athlete.name)}</div>
                        {(unreadCounts[athlete.id] || 0) > 0 && <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#c8923a', border: '2px solid #141410' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.92rem', color: '#edeae2' }}>{athlete.name}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4844' }}>
                          {athlete.weight_class ? athlete.weight_class + 'kg' : 'Ingen vægtklasse'} · {athlete.email || 'Ingen email'}
                        </div>
                        {(() => {
                          const ls = formatLastSeen(profilesLastSeen[athlete.user_id])
                          if (!ls) return null
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ls.dotColor, flexShrink: 0 }} />
                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: '#7a7770' }}>{ls.text}</span>
                            </div>
                          )
                        })()}
                        {latestMessages[athlete.id] && (
                          <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.72rem', color: '#4a4844', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: latestMessages[athlete.id].sender_role === 'coach' ? '#7a7770' : '#c8923a' }}>
                              {latestMessages[athlete.id].sender_role === 'coach' ? 'Du: ' : `${athlete.name.split(' ')[0]}: `}
                            </span>
                            {latestMessages[athlete.id].content}
                          </div>
                        )}
                      </div>
                      <span style={s.badge(athlete.status)}>{statusLabels[athlete.status]}</span>
                    </div>
                  ))}
                </div>
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

            <div style={{ ...s.tabs, overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
              {[['oversigt', 'Oversigt'], ['kost', 'Kost & mål'], ['program', 'Program'], ['noter', 'Noter'], ['analyse', 'Analyse'], ['opvarmning', 'Opvarmning'], ['beskeder', 'Beskeder']].map(([key, label]) => (
                <button key={key} style={{ ...s.tab(activeTab === key), whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => { setActiveTab(key); setEditing(null) }}>{label}</button>
              ))}
            </div>

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

                  {/* 2. Primære løft */}
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

                  {/* 4. Kropsvægt */}
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
                return (
                  <div style={{ ...s.card, background: sig.bg, marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.3rem' }}>Parathed i dag</div>
                        <div style={{ fontSize: '0.95rem', color: sig.color }}>{sig.text}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                        {todayR.sleep_hours != null && <div style={{ textAlign: 'center' }}><div style={s.fieldLabel}>Søvn</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', color: '#edeae2' }}>{todayR.sleep_hours}t</div></div>}
                        {todayR.energy != null && <div style={{ textAlign: 'center' }}><div style={s.fieldLabel}>Energi</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', color: '#edeae2' }}>{todayR.energy}/5</div></div>}
                        {todayR.stress != null && <div style={{ textAlign: 'center' }}><div style={s.fieldLabel}>Stress</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', color: '#edeae2' }}>{todayR.stress}/5</div></div>}
                        {todayR.sore_zones?.length > 0 && <div><div style={s.fieldLabel}>Ømhed</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#7a7770' }}>{todayR.sore_zones.join(', ')}</div></div>}
                      </div>
                    </div>
                  </div>
                )
              })()}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }}>
                <div style={s.card}>
                  <div style={s.cardLabel}>
                    Resultater
                    <button style={s.btnEdit} onClick={() => startEdit('stats', { squat: a.squat, bench: a.bench, deadlift: a.deadlift, training_squat: a.training_squat, training_bench: a.training_bench, training_deadlift: a.training_deadlift, status: a.status, weight_class: a.weight_class, age: a.age, competition_date: a.competition_date || '' })}>Rediger</button>
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
                        </select>
                      </div>
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
                    <button style={s.btnEdit} onClick={() => startEdit('competition', { competition_date: a.competition_date || '' })}>
                      {a.competition_date ? 'Rediger' : 'Tilføj dato'}
                    </button>
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
                    {weeks.length > 0 && (
                      <button style={s.btnGhost} onClick={() => copyWeek(weeks[weeks.length - 1].id)}>
                        Kopiér seneste uge →
                      </button>
                    )}
                    <button style={s.btnPrimary} onClick={() => { setAddingWeek(true); setWeekForm({ week_number: '', block_name: '', coach_note: '' }) }}>
                      + Ny uge
                    </button>
                  </div>
                </div>

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

                  const phases = computePhases(weeks)

                  return (
                    <div style={{ marginBottom: '1.5rem' }}>
                      {compDate && weeksToComp != null && (
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: weeksToComp > 0 ? '#c8923a' : '#6cba6c', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                          {weeksToComp > 0 ? `${weeksToComp} uger til stævne` : 'Stævne passeret'} · {new Date(compDate + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}

                      {/* Phase bar */}
                      {phases.some(p => p.name) && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', height: '36px', gap: '2px', marginBottom: '0.5rem' }}>
                            {phases.map((phase, pi) => {
                              const color = blockColor(phase.name)
                              const firstWeekId = phase.weeks[0].id
                              return (
                                <div
                                  key={pi}
                                  title={phase.name ? `${phase.name} · ${phase.weeks.length} uger` : `${phase.weeks.length} uger (ingen blok)`}
                                  style={{
                                    flex: `${phase.weeks.length} 0 0`,
                                    background: phase.name ? color + '22' : 'rgba(237,234,226,0.04)',
                                    border: `1px solid ${phase.name ? color + '55' : 'rgba(237,234,226,0.1)'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    minWidth: 0,
                                  }}
                                  onClick={() => {
                                    setOpenWeekId(firstWeekId)
                                    setTimeout(() => document.getElementById(`week-row-${firstWeekId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
                                  }}
                                >
                                  {phase.name && (
                                    <span style={{
                                      fontFamily: "'IBM Plex Mono', monospace",
                                      fontSize: '0.48rem',
                                      letterSpacing: '0.08em',
                                      textTransform: 'uppercase',
                                      color,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      padding: '0 8px',
                                    }}>{phase.name} · {phase.weeks.length}u</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                            {phases.filter(p => p.name).map((phase, pi) => (
                              <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <div style={{ width: '7px', height: '7px', background: blockColor(phase.name), flexShrink: 0 }} />
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#7a7770', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                  {phase.name} — {phase.weeks.length} {phase.weeks.length === 1 ? 'uge' : 'uger'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ overflowX: 'auto', display: 'flex', gap: '0.5rem', paddingBottom: '0.5rem' }}>
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
                              onClick={() => {
                                setOpenWeekId(week.id)
                                setTimeout(() => document.getElementById(`week-row-${week.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
                              }}
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
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.5fr 1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      {[['Uge nr.', 'week_number', 'number'], ['Blok navn', 'block_name', 'text'], ['Coach-note', 'coach_note', 'text']].map(([label, key, type]) => (
                        <div key={key}>
                          <div style={s.fieldLabel}>{label}</div>
                          <input style={s.fieldInput} type={type} placeholder={label} value={weekForm[key]} onChange={e => setWeekForm(p => ({ ...p, [key]: e.target.value }))} />
                        </div>
                      ))}
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

                {weeks.map(week => (
                  <div key={week.id} id={`week-row-${week.id}`} style={{ marginBottom: '0.75rem' }}>
                    {/* Week header */}
                    {editingWeek === week.id ? (
                      <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '0.5fr 1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          {[['Uge nr.', 'week_number', 'number'], ['Blok navn', 'block_name', 'text'], ['Coach-note', 'coach_note', 'text']].map(([label, key, type]) => (
                            <div key={key}>
                              <div style={s.fieldLabel}>{label}</div>
                              <input style={s.fieldInput} type={type} value={weekForm[key]} onChange={e => setWeekForm(p => ({ ...p, [key]: e.target.value }))} />
                            </div>
                          ))}
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
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a' }}>Uge {week.week_number}</span>
                          {week.block_name && <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2', marginLeft: '0.75rem' }}>{week.block_name}</span>}
                          {week.coach_note && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', marginTop: '0.2rem' }}>{week.coach_note}</div>}
                          {week.block_description && <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.78rem', color: '#4a4844', fontStyle: 'italic', marginTop: '0.2rem' }}>{week.block_description}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase' }}>{week.sessions?.length || 0} træninger</span>
                          <button style={s.btnEdit} onClick={e => { e.stopPropagation(); setEditingWeek(week.id); setWeekForm({ week_number: week.week_number, block_name: week.block_name || '', coach_note: week.coach_note || '', block_description: week.block_description || '' }) }}>Rediger</button>
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
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button style={s.btnGhost} onClick={() => setEditingSession(null)}>Annuller</button>
                                  <button style={s.btnPrimary} onClick={() => updateSession(session.id)}>Gem</button>
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{ background: '#181816', border: '1px solid rgba(237,234,226,0.06)', padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '0.5rem' }}
                                onClick={() => setOpenSessionId(openSessionId === session.id ? null : session.id)}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '0.88rem', color: '#edeae2' }}>{session.title}</div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.15rem' }}>
                                    {session.exercises?.length || 0} øvelser
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                                  <button style={{ ...s.btnEdit, opacity: sessionIdx === 0 ? 0.25 : 1 }} onClick={e => { e.stopPropagation(); reorderSession(week.id, session.id, 'up') }} disabled={sessionIdx === 0}>↑</button>
                                  <button style={{ ...s.btnEdit, opacity: sessionIdx === sessionsArr.length - 1 ? 0.25 : 1 }} onClick={e => { e.stopPropagation(); reorderSession(week.id, session.id, 'down') }} disabled={sessionIdx === sessionsArr.length - 1}>↓</button>
                                  <button style={s.btnEdit} onClick={e => { e.stopPropagation(); setEditingSession(session.id); setSessionForm({ title: session.title }) }}>Rediger</button>
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
                                                {(week.sessions || []).filter(s => s.id !== session.id).map(s => (
                                                  <option key={s.id} value={s.id}>{s.title}</option>
                                                ))}
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
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button style={s.btnGhost} onClick={() => setAddingSession(null)}>Annuller</button>
                              <button style={s.btnPrimary} onClick={() => addSession(week.id)}>Tilføj</button>
                            </div>
                          </div>
                        ) : (
                          <button style={{ ...s.btnGhost, marginTop: '0.5rem', fontSize: '0.54rem' }} onClick={() => { setAddingSession(week.id); setSessionForm({ title: '' }) }}>
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
            {activeTab === 'program' && (() => {
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

              return (
                <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '1.5rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '1.25rem' }}>
                    Træningslog
                  </div>

                  {logSessions.length === 0 ? (
                    <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Ingen loggede træninger endnu
                    </div>
                  ) : logSessions.map((sess, i) => {
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
                  })}
                </div>
              )
            })()}

            {/* TAB: NOTER */}
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
