import { useState, useEffect } from 'react'
import { supabase } from './supabase'

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

export default function Dashboard({ session }) {
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
  const [weekForm, setWeekForm] = useState({ week_number: '', block_name: '', coach_note: '' })
  const [sessionForm, setSessionForm] = useState({ title: '' })
  const [exerciseForm, setExerciseForm] = useState({ name: '', sets: '', reps: '', intensity: '', note: '' })
  const [athleteLogs, setAthleteLogs] = useState([])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => { fetchAthletes() }, [])
  useEffect(() => {
    if (activeTab === 'program' && selectedAthlete) {
      fetchWeeks(selectedAthlete.id)
      fetchAthleteLogs(selectedAthlete.id)
    }
  }, [activeTab, selectedAthlete?.id])

  async function fetchAthletes() {
    const { data, error } = await supabase.from('athletes').select('*').order('name')
    if (!error) setAthletes(data || [])
    setLoading(false)
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
    })
    setAddingWeek(false)
    setWeekForm({ week_number: '', block_name: '', coach_note: '' })
    fetchWeeks(selectedAthlete.id)
  }

  async function updateWeek(weekId) {
    await supabase.from('weeks').update({
      week_number: parseInt(weekForm.week_number),
      block_name: weekForm.block_name || null,
      coach_note: weekForm.coach_note || null,
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

  async function addExercise(sessionId) {
    const week = weeks.find(w => w.sessions?.some(s => s.id === sessionId))
    const session = week?.sessions?.find(s => s.id === sessionId)
    const nextOrder = session?.exercises?.length || 0
    await supabase.from('exercises').insert({
      session_id: sessionId,
      name: exerciseForm.name || 'Øvelse',
      sets: parseInt(exerciseForm.sets) || null,
      reps: exerciseForm.reps || null,
      intensity: exerciseForm.intensity || null,
      note: exerciseForm.note || null,
      exercise_order: nextOrder,
    })
    setAddingExercise(null)
    setExerciseForm({ name: '', sets: '', reps: '', intensity: '', note: '' })
    fetchWeeks(selectedAthlete.id)
  }

  async function updateExercise(exerciseId) {
    await supabase.from('exercises').update({
      name: exerciseForm.name,
      sets: parseInt(exerciseForm.sets) || null,
      reps: exerciseForm.reps || null,
      intensity: exerciseForm.intensity || null,
      note: exerciseForm.note || null,
    }).eq('id', exerciseId)
    setEditingExercise(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function deleteExercise(exerciseId) {
    await supabase.from('exercises').delete().eq('id', exerciseId)
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

  async function fetchAthleteLogs(athleteId) {
    const { data } = await supabase
      .from('exercise_logs')
      .select('id, set_number, weight, reps_completed, note, logged_at, exercise_id, exercises(id, name, sets, reps, intensity, session_id, sessions(id, title, weeks(week_number, block_name)))')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .limit(300)
    setAthleteLogs(data || [])
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

  function openProfile(athlete) {
    setSelectedAthlete(athlete)
    setActiveTab('oversigt')
    setEditing(null)
    setView('profile')
    setWeeks([])
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

  const exFormRow = (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.5fr 0.7fr 0.8fr 1.5fr', gap: '0.5rem', alignItems: 'end' }}>
      {[['Navn', 'name', 'text'], ['Sæt', 'sets', 'number'], ['Reps', 'reps', 'text'], ['Intensitet', 'intensity', 'text'], ['Note', 'note', 'text']].map(([label, key, type]) => (
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
    </div>
  )

  return (
    <div style={s.wrap}>
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
          <div style={s.navItem(true)}>Atleter</div>
        </nav>
        <div style={s.sidebarFooter}>
          <div style={{ color: '#7a7770', marginBottom: '0.3rem' }}>Marc Schlichting</div>
          <div style={{ fontSize: '0.7rem' }}>{session.user.email}</div>
          <button onClick={() => supabase.auth.signOut()} style={{ ...s.btnGhost, marginTop: '0.75rem', width: '100%' }}>Log ud</button>
        </div>
      </aside>

      <main style={{ ...s.main, ...(isMobile ? { marginLeft: 0 } : {}) }}>
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
          <div style={{ ...s.topbarTitle, flex: 1 }}>{view === 'list' ? 'Atleter' : a?.name}</div>
          {view === 'list' && <button style={s.btnPrimary} onClick={() => setShowAddModal(true)}>+ Tilføj atlet</button>}
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div style={s.page}>
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
              <div style={s.grid}>
                {athletes.map(athlete => (
                  <div key={athlete.id} style={s.athleteCard} onClick={() => openProfile(athlete)}
                    onMouseEnter={e => { e.currentTarget.style.background = '#1c1c18'; e.currentTarget.style.borderTop = '2px solid #c8923a' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#141410'; e.currentTarget.style.borderTop = '2px solid transparent' }}>
                    <div style={s.avatar}>{initials(athlete.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.92rem', color: '#edeae2' }}>{athlete.name}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4844' }}>
                        {athlete.weight_class ? athlete.weight_class + 'kg' : 'Ingen vægtklasse'} · {athlete.email || 'Ingen email'}
                      </div>
                    </div>
                    <span style={s.badge(athlete.status)}>{statusLabels[athlete.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PROFILE VIEW */}
        {view === 'profile' && a && (
          <div style={s.page}>
            <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', cursor: 'pointer', marginBottom: '1.75rem', padding: 0 }}>
              ← Tilbage til atleter
            </button>

            <div style={{ ...s.card, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ ...s.avatar, width: '56px', height: '56px', fontSize: '1.3rem' }}>{initials(a.name)}</div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', fontWeight: 400, color: '#edeae2' }}>{a.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#7a7770', marginTop: '0.2rem' }}>{a.email}{a.age ? ' · ' + a.age + ' år' : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={s.badge(a.status)}>{statusLabels[a.status]}</span>
                <button style={s.btnDanger} onClick={() => setShowDeleteModal(true)}>Fjern</button>
              </div>
            </div>

            <div style={s.tabs}>
              {[['oversigt', 'Oversigt'], ['kost', 'Kost & mål'], ['program', 'Program'], ['noter', 'Noter']].map(([key, label]) => (
                <button key={key} style={s.tab(activeTab === key)} onClick={() => { setActiveTab(key); setEditing(null) }}>{label}</button>
              ))}
            </div>

            {/* TAB: OVERSIGT */}
            {activeTab === 'oversigt' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={s.card}>
                  <div style={s.cardLabel}>
                    Resultater
                    <button style={s.btnEdit} onClick={() => startEdit('stats', { squat: a.squat, bench: a.bench, deadlift: a.deadlift, training_squat: a.training_squat, training_bench: a.training_bench, training_deadlift: a.training_deadlift, status: a.status, weight_class: a.weight_class, age: a.age })}>Rediger</button>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
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

                {/* Add week form */}
                {addingWeek && (
                  <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '1rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' }}>Ny uge</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '0.5fr 1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      {[['Uge nr.', 'week_number', 'number'], ['Blok navn', 'block_name', 'text'], ['Coach-note', 'coach_note', 'text']].map(([label, key, type]) => (
                        <div key={key}>
                          <div style={s.fieldLabel}>{label}</div>
                          <input style={s.fieldInput} type={type} placeholder={label} value={weekForm[key]} onChange={e => setWeekForm(p => ({ ...p, [key]: e.target.value }))} />
                        </div>
                      ))}
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
                  <div key={week.id} style={{ marginBottom: '0.75rem' }}>
                    {/* Week header */}
                    {editingWeek === week.id ? (
                      <div style={{ background: '#1c1c18', border: '1px solid rgba(200,146,58,0.3)', padding: '1.25rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '0.5fr 1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          {[['Uge nr.', 'week_number', 'number'], ['Blok navn', 'block_name', 'text'], ['Coach-note', 'coach_note', 'text']].map(([label, key, type]) => (
                            <div key={key}>
                              <div style={s.fieldLabel}>{label}</div>
                              <input style={s.fieldInput} type={type} value={weekForm[key]} onChange={e => setWeekForm(p => ({ ...p, [key]: e.target.value }))} />
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button style={s.btnGhost} onClick={() => setEditingWeek(null)}>Annuller</button>
                          <button style={s.btnPrimary} onClick={() => updateWeek(week.id)}>Gem</button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', borderLeft: openWeekId === week.id ? '3px solid #c8923a' : '3px solid transparent', padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onClick={() => setOpenWeekId(openWeekId === week.id ? null : week.id)}
                      >
                        <div>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a' }}>Uge {week.week_number}</span>
                          {week.block_name && <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2', marginLeft: '0.75rem' }}>{week.block_name}</span>}
                          {week.coach_note && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', marginTop: '0.2rem' }}>{week.coach_note}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase' }}>{week.sessions?.length || 0} træninger</span>
                          <button style={s.btnEdit} onClick={e => { e.stopPropagation(); setEditingWeek(week.id); setWeekForm({ week_number: week.week_number, block_name: week.block_name || '', coach_note: week.coach_note || '' }) }}>Rediger</button>
                          <button style={s.btnDanger} onClick={e => { e.stopPropagation(); deleteWeek(week.id) }}>Slet</button>
                          <span style={{ color: '#4a4844', fontSize: '0.65rem', marginLeft: '0.25rem' }}>{openWeekId === week.id ? '▲' : '▼'}</span>
                        </div>
                      </div>
                    )}

                    {/* Sessions (expanded week) */}
                    {openWeekId === week.id && (
                      <div style={{ marginLeft: '1.5rem', borderLeft: '2px solid rgba(200,146,58,0.15)', paddingLeft: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                        {(week.sessions || []).map(session => (
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
                                style={{ background: '#181816', border: '1px solid rgba(237,234,226,0.06)', padding: '0.75rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                onClick={() => setOpenSessionId(openSessionId === session.id ? null : session.id)}
                              >
                                <div>
                                  <div style={{ fontSize: '0.88rem', color: '#edeae2' }}>{session.title}</div>
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.15rem' }}>
                                    {session.exercises?.length || 0} øvelser
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                  <button style={s.btnEdit} onClick={e => { e.stopPropagation(); setEditingSession(session.id); setSessionForm({ title: session.title }) }}>Rediger</button>
                                  <button style={s.btnDanger} onClick={e => { e.stopPropagation(); deleteSession(session.id) }}>Slet</button>
                                  <span style={{ color: '#4a4844', fontSize: '0.6rem', marginLeft: '0.2rem' }}>{openSessionId === session.id ? '▲' : '▼'}</span>
                                </div>
                              </div>
                            )}

                            {/* Exercises (expanded session) */}
                            {openSessionId === session.id && (
                              <div style={{ background: '#141410', border: '1px solid rgba(237,234,226,0.06)', borderTop: 'none', padding: '0.75rem' }}>
                                {(session.exercises || []).map(ex => (
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
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid rgba(237,234,226,0.04)' }}>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', flex: 1 }}>
                                          <div style={{ fontSize: '0.85rem', color: '#b8b4a8', minWidth: '120px' }}>{ex.name}</div>
                                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>
                                            {ex.sets && `${ex.sets} sæt`}{ex.reps && ` × ${ex.reps}`}{ex.intensity && ` · ${ex.intensity}`}
                                          </div>
                                          {ex.note && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', fontStyle: 'italic' }}>{ex.note}</div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                                          <button style={s.btnEdit} onClick={() => { setEditingExercise(ex.id); setExerciseForm({ name: ex.name, sets: ex.sets || '', reps: ex.reps || '', intensity: ex.intensity || '', note: ex.note || '' }) }}>✎</button>
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
                                  <button style={{ ...s.btnSm, marginTop: '0.5rem' }} onClick={() => { setAddingExercise(session.id); setExerciseForm({ name: '', sets: '', reps: '', intensity: '', note: '' }) }}>
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
                if (!grouped[key]) grouped[key] = { date, sessionTitle: sess?.title || '—', weekNum: sess?.weeks?.week_number, exerciseMap: {} }
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
                grouped[key].exerciseMap[exId].sets.push({ n: log.set_number, weight: log.weight, reps: log.reps_completed, note: log.note })
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
                                {sortedSets.map(set => (
                                  <div key={set.n} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', padding: '0.2rem 0.5rem', color: '#edeae2' }}>
                                    <span style={{ color: '#4a4844' }}>S{set.n} </span>
                                    <span style={{ color: '#c8923a' }}>{set.weight}kg</span>
                                    {set.reps && <span style={{ color: '#7a7770' }}> × {set.reps}</span>}
                                    {set.note && <span style={{ color: '#4a4844', marginLeft: '0.3rem', fontStyle: 'italic' }}>{set.note}</span>}
                                  </div>
                                ))}
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
