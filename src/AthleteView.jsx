import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const LOCAL_FOODS = [
  { name: 'Havregryn', kcal100: 370, protein100: 13, carb100: 58, fat100: 7 },
  { name: 'Havregrød (kogt med vand)', kcal100: 68, protein100: 2, carb100: 12, fat100: 1 },
  { name: 'Kyllingebryst', kcal100: 110, protein100: 23, carb100: 0, fat100: 2 },
  { name: 'Kyllingelår', kcal100: 177, protein100: 18, carb100: 0, fat100: 12 },
  { name: 'Oksekød 8% fedt', kcal100: 172, protein100: 20, carb100: 0, fat100: 10 },
  { name: 'Oksekød 15% fedt', kcal100: 215, protein100: 18, carb100: 0, fat100: 16 },
  { name: 'Æg', kcal100: 143, protein100: 13, carb100: 1, fat100: 10 },
  { name: 'Æggehvide', kcal100: 52, protein100: 11, carb100: 1, fat100: 0 },
  { name: 'Skyr naturel', kcal100: 63, protein100: 11, carb100: 4, fat100: 0 },
  { name: 'Kvark naturel', kcal100: 67, protein100: 12, carb100: 4, fat100: 1 },
  { name: 'Græsk yoghurt 2%', kcal100: 73, protein100: 10, carb100: 4, fat100: 2 },
  { name: 'Græsk yoghurt 0%', kcal100: 57, protein100: 10, carb100: 4, fat100: 0 },
  { name: 'Cottage cheese', kcal100: 98, protein100: 11, carb100: 3, fat100: 4 },
  { name: 'Hytteost', kcal100: 98, protein100: 11, carb100: 3, fat100: 4 },
  { name: 'Mælk minimælk', kcal100: 42, protein100: 3, carb100: 5, fat100: 1 },
  { name: 'Mælk sødmælk', kcal100: 61, protein100: 3, carb100: 5, fat100: 4 },
  { name: 'Pasta tør', kcal100: 352, protein100: 13, carb100: 70, fat100: 2 },
  { name: 'Pasta kogt', kcal100: 131, protein100: 5, carb100: 25, fat100: 1 },
  { name: 'Ris tør', kcal100: 361, protein100: 7, carb100: 79, fat100: 1 },
  { name: 'Ris kogt', kcal100: 130, protein100: 3, carb100: 28, fat100: 0 },
  { name: 'Kartofler kogte', kcal100: 87, protein100: 2, carb100: 19, fat100: 0 },
  { name: 'Søde kartofler', kcal100: 86, protein100: 2, carb100: 20, fat100: 0 },
  { name: 'Laks', kcal100: 206, protein100: 20, carb100: 0, fat100: 14 },
  { name: 'Tun i vand', kcal100: 103, protein100: 23, carb100: 0, fat100: 1 },
  { name: 'Torsk', kcal100: 82, protein100: 18, carb100: 0, fat100: 1 },
  { name: 'Rugbrød', kcal100: 220, protein100: 8, carb100: 40, fat100: 3 },
  { name: 'Franskbrød', kcal100: 265, protein100: 9, carb100: 50, fat100: 3 },
  { name: 'Proteinpulver whey', kcal100: 380, protein100: 75, carb100: 8, fat100: 5 },
  { name: 'Proteinbar', kcal100: 350, protein100: 30, carb100: 35, fat100: 10 },
  { name: 'Banan', kcal100: 89, protein100: 1, carb100: 23, fat100: 0 },
  { name: 'Æble', kcal100: 52, protein100: 0, carb100: 14, fat100: 0 },
  { name: 'Appelsin', kcal100: 47, protein100: 1, carb100: 12, fat100: 0 },
  { name: 'Mandler', kcal100: 579, protein100: 21, carb100: 22, fat100: 50 },
  { name: 'Valnødder', kcal100: 654, protein100: 15, carb100: 14, fat100: 65 },
  { name: 'Peanutbutter', kcal100: 588, protein100: 25, carb100: 20, fat100: 50 },
  { name: 'Broccoli', kcal100: 34, protein100: 3, carb100: 7, fat100: 0 },
  { name: 'Spinat', kcal100: 23, protein100: 3, carb100: 4, fat100: 0 },
  { name: 'Gulerod', kcal100: 41, protein100: 1, carb100: 10, fat100: 0 },
  { name: 'Avokado', kcal100: 160, protein100: 2, carb100: 9, fat100: 15 },
  { name: 'Olivenolie', kcal100: 884, protein100: 0, carb100: 0, fat100: 100 },
  { name: 'Smør', kcal100: 717, protein100: 1, carb100: 1, fat100: 81 },
  { name: 'Chokolademælk', kcal100: 70, protein100: 3, carb100: 12, fat100: 1 },
  { name: 'Appelsinjuice', kcal100: 45, protein100: 1, carb100: 10, fat100: 0 },
  { name: 'Rejer', kcal100: 85, protein100: 18, carb100: 1, fat100: 1 },
  { name: 'Svinekød (nakkefilet)', kcal100: 195, protein100: 18, carb100: 0, fat100: 14 },
  { name: 'Bacon', kcal100: 417, protein100: 13, carb100: 1, fat100: 42 },
  { name: 'Müsli', kcal100: 360, protein100: 10, carb100: 65, fat100: 7 },
  { name: 'Cornflakes', kcal100: 357, protein100: 7, carb100: 84, fat100: 1 },
  { name: 'Chokolade mørk 70%', kcal100: 546, protein100: 5, carb100: 46, fat100: 38 },
  { name: 'Linser kogte', kcal100: 116, protein100: 9, carb100: 20, fat100: 0 },
  { name: 'Kikærter kogte', kcal100: 164, protein100: 9, carb100: 27, fat100: 3 },
]

const s = {
  wrap: { minHeight: '100vh', background: '#141410', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300 },
  topbar: { height: '52px', borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', background: '#1c1c18', position: 'sticky', top: 0, zIndex: 50 },
  logo: { fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' },
  page: { maxWidth: '680px', margin: '0 auto', padding: '1.5rem 1rem 6rem' },
  card: { background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.25rem', marginBottom: '1.5rem' },
  cardLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' },
  fieldLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.3rem' },
  fieldInput: { width: '100%', background: '#141410', border: '1px solid rgba(237,234,226,0.13)', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.88rem', fontWeight: 300, padding: '0.55rem 0.75rem', outline: 'none' },
  btnPrimary: { background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' },
  btnGhost: { background: 'transparent', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(237,234,226,0.13)', padding: '0.5rem 1rem', cursor: 'pointer' },
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const NAV_ITEMS = [
  {
    key: 'hjem',
    label: 'Hjem',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 2l9 7.5V21H15v-7H9v7H3V9.5z" />
      </svg>
    ),
  },
  {
    key: 'program',
    label: 'Program',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="6" y1="12" x2="18" y2="12" />
        <rect x="3" y="8.5" width="3" height="7" rx="1" />
        <rect x="18" y="8.5" width="3" height="7" rx="1" />
        <line x1="1" y1="10" x2="1" y2="14" />
        <line x1="23" y1="10" x2="23" y2="14" />
      </svg>
    ),
  },
  {
    key: 'kost',
    label: 'Kost',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <path d="M3 2v5a3 3 0 0 0 6 0V2" />
        <line x1="6" y1="7" x2="6" y2="22" />
        <line x1="21" y1="2" x2="21" y2="22" />
        <path d="M17 2a4 4 0 0 1 4 4" />
      </svg>
    ),
  },
  {
    key: 'beskeder',
    label: 'Beskeder',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    key: 'profil',
    label: 'Profil',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
      </svg>
    ),
  },
]

export default function AthleteView({ session, onExitPreview, role, coachAthleteId }) {
  const [tab, setTab] = useState('hjem')
  const [athlete, setAthlete] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedFood, setSelectedFood] = useState(null)
  const [amount, setAmount] = useState(100)
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState({ name: '', kcal: '', protein: '', carb: '' })

  // Messages state
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')

  // Program state
  const [currentWeek, setCurrentWeek] = useState(null)
  const [progOpenSession, setProgOpenSession] = useState(null)
  const [exerciseLogs, setExerciseLogs] = useState([])
  const [logInputs, setLogInputs] = useState({})
  const [lastLogByExerciseName, setLastLogByExerciseName] = useState({})
  const [weightLogs, setWeightLogs] = useState([])
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  useEffect(() => { fetchAthlete() }, [])
  useEffect(() => { if (tab === 'beskeder' && athlete) fetchAthleteMessages() }, [tab, athlete?.id])

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setLoadError(true), 10000)
    return () => clearTimeout(timer)
  }, [loading])

  async function fetchAthlete() {
    if (!coachAthleteId && role !== 'athlete') { setLoading(false); return }
    const query = supabase.from('athletes').select('*')
    const { data } = await (coachAthleteId
      ? query.eq('id', coachAthleteId)
      : query.eq('email', session.user.email)
    ).maybeSingle()
    if (data) {
      setAthlete(data)
      fetchLogs(data.id)
      fetchProgram(data.id)
      fetchAthleteMessages(data.id)
      fetchWeightLogs(data.id)
    }
    setLoading(false)
  }

  async function fetchProgram(athleteId) {
    const { data } = await supabase
      .from('weeks')
      .select('*, sessions(*, exercises(*))')
      .eq('athlete_id', athleteId)
      .order('week_number', { ascending: false })
      .limit(1)
    if (data && data[0]) {
      const week = {
        ...data[0],
        sessions: (data[0].sessions || [])
          .sort((a, b) => a.session_order - b.session_order)
          .map(s => ({ ...s, exercises: (s.exercises || []).sort((a, b) => a.exercise_order - b.exercise_order) }))
      }
      setCurrentWeek(week)
      fetchExerciseLogs(athleteId, week)
      fetchLastLogs(athleteId, week)
    }
  }

  async function fetchExerciseLogs(athleteId, week) {
    const exerciseIds = (week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id))
    if (exerciseIds.length === 0) { setExerciseLogs([]); return }
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .in('exercise_id', exerciseIds)
      .gte('logged_at', todayStart.toISOString())
    setExerciseLogs(data || [])
    const inputs = {}
    for (const log of (data || [])) {
      inputs[`${log.exercise_id}_${log.set_number}`] = {
        weight: log.weight?.toString() || '',
        note: log.note || '',
      }
    }
    setLogInputs(prev => ({ ...prev, ...inputs }))
  }

  async function fetchLastLogs(athleteId, week) {
    const exerciseNames = [...new Set((week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.name)))]
    if (exerciseNames.length === 0) return
    const { data } = await supabase
      .from('exercise_logs')
      .select('weight, reps_completed, logged_at, exercises(name)')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .limit(500)
    if (!data) return
    const map = {}
    for (const log of data) {
      const name = log.exercises?.name
      if (name && !map[name] && (log.weight > 0 || log.reps_completed > 0)) {
        map[name] = { weight: log.weight, reps_completed: log.reps_completed }
      }
    }
    setLastLogByExerciseName(map)
  }

  async function logSet(exerciseId, setNumber, totalSets, repsCompleted) {
    const key = `${exerciseId}_${setNumber}`
    const input = logInputs[key] || {}
    const payload = {
      weight: parseFloat(input.weight) || 0,
      reps_completed: parseInt(repsCompleted) || 0,
      note: input.note || null,
    }
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    if (existing) {
      await supabase.from('exercise_logs').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('exercise_logs').insert({
        exercise_id: exerciseId,
        athlete_id: athlete.id,
        set_number: setNumber,
        ...payload,
      })
    }
    // Auto-fill next set weight if empty
    if (setNumber < totalSets) {
      const nextKey = `${exerciseId}_${setNumber + 1}`
      setLogInputs(p => ({
        ...p,
        [nextKey]: { weight: p[nextKey]?.weight || input.weight, note: p[nextKey]?.note || '' },
      }))
    }
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function fetchWeightLogs(athleteId) {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .limit(14)
    setWeightLogs(data || [])
  }

  async function logWeight() {
    if (!weightInput || !athlete) return
    setSavingWeight(true)
    const todayStr = today()
    const existing = weightLogs.find(l => l.logged_at === todayStr)
    if (existing) {
      await supabase.from('weight_logs').update({ weight: parseFloat(weightInput) }).eq('id', existing.id)
    } else {
      await supabase.from('weight_logs').insert({ athlete_id: athlete.id, weight: parseFloat(weightInput), logged_at: todayStr })
    }
    setSavingWeight(false)
    setWeightInput('')
    fetchWeightLogs(athlete.id)
  }

  async function fetchAthleteMessages(id) {
    const athleteId = id || athlete?.id
    if (!athleteId) return
    const { data } = await supabase.from('messages').select('*').eq('athlete_id', athleteId).order('created_at')
    setMessages(data || [])
  }

  async function sendAthleteMessage() {
    if (!messageInput.trim() || !athlete) return
    await supabase.from('messages').insert({ athlete_id: athlete.id, sender_role: 'athlete', content: messageInput.trim() })
    setMessageInput('')
    fetchAthleteMessages(athlete.id)
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

  async function fetchLogs(athleteId) {
    const { data } = await supabase
      .from('meal_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('date', today())
      .order('created_at')
    setLogs(data || [])
  }

  function onSearchInput(e) {
    const q = e.target.value
    setSearchQuery(q)
    setSelectedFood(null)
    if (q.length < 2) { setSearchResults([]); return }
    const results = LOCAL_FOODS.filter(f =>
      f.name.toLowerCase().includes(q.toLowerCase())
    )
    setSearchResults(results)
  }

  function selectFood(f) {
    setSelectedFood(f)
    setSearchQuery(f.name)
    setSearchResults([])
    setAmount(100)
  }

  async function addFromSearch() {
    if (!selectedFood || !athlete) return
    const ratio = amount / 100
    await supabase.from('meal_logs').insert({
      athlete_id: athlete.id,
      date: today(),
      meal: selectedFood.name,
      kcal: Math.round(selectedFood.kcal100 * ratio),
      protein: Math.round(selectedFood.protein100 * ratio),
      carb: Math.round(selectedFood.carb100 * ratio),
      fat: Math.round(selectedFood.fat100 * ratio),
    })
    setSelectedFood(null)
    setSearchQuery('')
    fetchLogs(athlete.id)
  }

  async function addManual() {
    if (!manual.name.trim() || !athlete) return
    await supabase.from('meal_logs').insert({
      athlete_id: athlete.id,
      date: today(),
      meal: manual.name,
      kcal: parseInt(manual.kcal) || 0,
      protein: parseInt(manual.protein) || 0,
      carb: parseInt(manual.carb) || 0,
      fat: 0,
    })
    setManual({ name: '', kcal: '', protein: '', carb: '' })
    setShowManual(false)
    fetchLogs(athlete.id)
  }

  async function deleteLog(id) {
    await supabase.from('meal_logs').delete().eq('id', id)
    fetchLogs(athlete.id)
  }

  const totKcal = logs.reduce((a, l) => a + (l.kcal || 0), 0)
  const totProtein = logs.reduce((a, l) => a + (l.protein || 0), 0)
  const totCarb = logs.reduce((a, l) => a + (l.carb || 0), 0)
  const totFat = logs.reduce((a, l) => a + (l.fat || 0), 0)
  const kcalPct = athlete?.kcal_target ? Math.min(100, Math.round(totKcal / athlete.kcal_target * 100)) : 0
  const proteinPct = athlete?.protein_target ? Math.min(100, Math.round(totProtein / athlete.protein_target * 100)) : 0

  const pKcal = totProtein * 4
  const cKcal = totCarb * 4
  const fKcal = totFat * 9
  const macroTotal = pKcal + cKcal + fKcal || 1
  const circ = 2 * Math.PI * 48
  const pLen = (pKcal / macroTotal) * circ
  const cLen = (cKcal / macroTotal) * circ
  const fLen = (fKcal / macroTotal) * circ

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 10 ? 'morgen' : hour < 12 ? 'formiddag' : hour < 17 ? 'eftermiddag' : 'aften'
  const days = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
  const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']

  const backBtn = onExitPreview && (
    <button
      onClick={onExitPreview}
      style={{ background: 'rgba(200,146,58,0.12)', color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(200,146,58,0.35)', padding: '0.35rem 0.85rem', cursor: 'pointer' }}
    >← Coach view</button>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      {loadError ? (
        <>
          <div style={{ color: '#7a7770' }}>Kunne ikke indlæse data.</div>
          {backBtn || <button style={s.btnGhost} onClick={() => window.location.reload()}>Prøv igen</button>}
        </>
      ) : 'Indlæser...'}
      {!loadError && backBtn}
    </div>
  )

  if (!athlete) return (
    <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Din konto er ikke tilknyttet en atlet endnu.</div>
      <div style={{ color: '#4a4844', fontSize: '0.82rem' }}>Kontakt din coach for at få adgang.</div>
      {backBtn || <button style={s.btnGhost} onClick={() => supabase.auth.signOut()}>Log ud</button>}
    </div>
  )

  const progressBars = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
      {[
        { label: 'Kalorier', val: totKcal, target: athlete.kcal_target, unit: 'kcal', pct: kcalPct, color: '#c8923a' },
        { label: 'Protein', val: totProtein, target: athlete.protein_target, unit: 'g', pct: proteinPct, color: '#6cba6c' },
      ].map(({ label, val, target, unit, pct, color }) => (
        <div key={label} style={s.card}>
          <div style={s.cardLabel}>{label}</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1, marginBottom: '0.6rem' }}>
            {val} <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.8rem', color: '#7a7770', fontWeight: 300 }}>/ {target || '?'} {unit}</span>
          </div>
          <div style={{ height: '3px', background: '#242420', borderRadius: '2px' }}>
            <div style={{ height: '3px', width: pct + '%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginTop: '0.35rem' }}>{pct}%</div>
        </div>
      ))}
    </div>
  )

  return (
    <div style={s.wrap}>
      {/* Topbar */}
      <div style={s.topbar}>
        <div style={s.logo}>Entropi<span style={{ color: '#c8923a' }}>.</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {backBtn}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844' }}>{today()}</div>
        </div>
      </div>

      {/* Page content */}
      <div style={s.page}>

        {/* HJEM */}
        {tab === 'hjem' && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                God <em style={{ fontStyle: 'italic', color: '#7a7770' }}>{greeting}</em>.
              </h1>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.25rem' }}>
                {days[now.getDay()]} d. {now.getDate()}. {months[now.getMonth()]} {now.getFullYear()}
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardLabel}>Mit program</div>
              {!currentWeek ? (
                <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Intet program tilknyttet endnu.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a' }}>
                      Uge {currentWeek.week_number}
                    </span>
                    {currentWeek.block_name && (
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' }}>
                        {currentWeek.block_name}
                      </span>
                    )}
                  </div>
                  {(currentWeek.sessions || []).length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen træninger i denne uge endnu.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {(currentWeek.sessions || []).map(sess => (
                        <button
                          key={sess.id}
                          onClick={() => { setTab('program'); setProgOpenSession(sess.id) }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(237,234,226,0.03)',
                            border: '1px solid rgba(237,234,226,0.07)',
                            color: '#edeae2',
                            padding: '0.6rem 0.75rem',
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left',
                            fontFamily: "'IBM Plex Sans', sans-serif",
                            fontWeight: 300,
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,146,58,0.35)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'}
                        >
                          <span style={{ fontSize: '0.88rem' }}>{sess.title}</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', flexShrink: 0, marginLeft: '0.75rem' }}>
                            {(sess.exercises || []).length} øvelser →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ ...s.card, cursor: 'pointer' }} onClick={() => setTab('beskeder')}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,146,58,0.25)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'}
            >
              <div style={s.cardLabel}>Seneste besked fra coach</div>
              {(() => {
                const lastCoach = [...messages].reverse().find(m => m.sender_role === 'coach')
                if (!lastCoach) return <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen beskeder endnu.</div>
                return (
                  <>
                    <div style={{ fontSize: '0.88rem', color: '#edeae2', lineHeight: 1.6, marginBottom: '0.4rem' }}>{lastCoach.content}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{formatMsgTime(lastCoach.created_at)}</div>
                  </>
                )
              })()}
            </div>

            {(() => {
              const todayStr = today()
              const todayLog = weightLogs.find(l => l.logged_at === todayStr)
              const showInput = !todayLog || weightInput !== ''
              const last7 = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - (6 - i))
                const dayLabels = ['Sø', 'Ma', 'Ti', 'On', 'To', 'Fr', 'Lø']
                return { date: d.toISOString().slice(0, 10), label: dayLabels[d.getDay()] }
              })
              return (
                <div style={s.card}>
                  <div style={s.cardLabel}>Kropsvægt</div>
                  {showInput ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <input
                        style={{ ...s.fieldInput, maxWidth: '90px', fontSize: '1rem', padding: '0.5rem 0.6rem' }}
                        type="number"
                        step="0.1"
                        placeholder="kg"
                        value={weightInput}
                        onChange={e => setWeightInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && logWeight()}
                      />
                      <button style={s.btnPrimary} onClick={logWeight} disabled={savingWeight || !weightInput}>
                        {savingWeight ? '...' : 'Log'}
                      </button>
                      {todayLog && (
                        <button style={s.btnGhost} onClick={() => setWeightInput('')}>Annuller</button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: '#edeae2' }}>{todayLog.weight}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770' }}>kg · logget i dag</span>
                      <button style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.2rem 0.5rem', marginLeft: '0.25rem' }} onClick={() => setWeightInput(todayLog.weight.toString())}>Ret</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {last7.map((day, i) => {
                      const log = weightLogs.find(l => l.logged_at === day.date)
                      const isToday = day.date === todayStr
                      return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#c8923a', minHeight: '0.65rem' }}>
                            {log ? log.weight : ''}
                          </div>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: log ? '#c8923a' : '#242420', border: isToday && !log ? '1px solid #4a4844' : 'none', flexShrink: 0 }} />
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: isToday ? '#7a7770' : '#4a4844', textTransform: 'uppercase' }}>
                            {day.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {progressBars}
          </>
        )}

        {/* PROGRAM */}
        {tab === 'program' && (
          <>
            {!currentWeek ? (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Program</div>
                  <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Dit program.</h1>
                </div>
                <div style={s.card}>
                  <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Intet program tilknyttet endnu.</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.4rem' }}>
                    Uge {currentWeek.week_number}
                  </div>
                  <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                    {currentWeek.block_name || 'Dit program'}.
                  </h1>
                  {currentWeek.coach_note && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', color: '#7a7770', marginTop: '0.5rem', letterSpacing: '0.04em' }}>
                      {currentWeek.coach_note}
                    </div>
                  )}
                </div>

                {(currentWeek.sessions || []).map(session => {
                  const isOpen = progOpenSession === session.id
                  const sessionExIds = (session.exercises || []).map(e => e.id)
                  const sessionLogs = exerciseLogs.filter(l => sessionExIds.includes(l.exercise_id))
                  const totalSets = (session.exercises || []).reduce((acc, e) => acc + (e.sets || 0), 0)
                  const loggedSets = sessionLogs.length
                  const isDone = totalSets > 0 && loggedSets >= totalSets

                  return (
                    <div key={session.id} style={{ marginBottom: '0.75rem' }}>
                      {/* Session card header */}
                      <div
                        style={{ ...s.card, marginBottom: 0, cursor: 'pointer', borderLeft: isDone ? '3px solid #6cba6c' : isOpen ? '3px solid #c8923a' : '3px solid transparent' }}
                        onClick={() => setProgOpenSession(isOpen ? null : session.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ ...s.cardLabel, marginBottom: '0.3rem', fontSize: '0.72rem' }}>{session.title}</div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {(session.exercises || []).length} øvelser · {loggedSets}/{totalSets} sæt logget
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {isDone && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#6cba6c', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Færdig ✓</span>}
                            <span style={{ color: '#4a4844', fontSize: '0.65rem' }}>{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Exercises */}
                      {isOpen && (
                        <div style={{ background: '#181816', border: '1px solid rgba(237,234,226,0.07)', borderTop: 'none', padding: '1rem' }}>
                          {(session.exercises || []).map((ex, exIdx) => {
                            const isLast = exIdx === (session.exercises.length - 1)
                            return (
                              <div key={ex.id} style={{ marginBottom: isLast ? 0 : '1.25rem', paddingBottom: isLast ? 0 : '1.25rem', borderBottom: isLast ? 'none' : '1px solid rgba(237,234,226,0.06)' }}>
                                {/* Exercise info */}
                                <div style={{ marginBottom: '0.6rem' }}>
                                  <div style={{ fontSize: '1.05rem', color: '#edeae2', marginBottom: '0.1rem' }}>{ex.name}</div>
                                  {ex.recommended_weight != null ? (
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#c8923a', marginBottom: '0.2rem' }}>
                                      Anbefalet: {ex.recommended_weight}kg
                                    </div>
                                  ) : lastLogByExerciseName[ex.name] ? (
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#4a4844', marginBottom: '0.2rem' }}>
                                      Sidst: {lastLogByExerciseName[ex.name].weight}kg × {lastLogByExerciseName[ex.name].reps_completed} reps
                                    </div>
                                  ) : null}
                                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', color: '#c8923a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.1rem' }}>
                                    {[ex.sets && `${ex.sets} sæt`, ex.reps && `× ${ex.reps}`, ex.intensity && ex.intensity].filter(Boolean).join(' · ')}
                                  </div>
                                  {ex.note && (
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#7a7770', marginTop: '0.1rem', fontStyle: 'italic' }}>{ex.note}</div>
                                  )}
                                </div>

                                {/* Set logging rows */}
                                {Array.from({ length: ex.sets || 0 }, (_, i) => i + 1).map(setNum => {
                                  const key = `${ex.id}_${setNum}`
                                  const logged = exerciseLogs.find(l => l.exercise_id === ex.id && l.set_number === setNum)
                                  const input = logInputs[key] || { weight: '', note: '' }
                                  return (
                                    <div key={setNum} style={{ marginBottom: '0.75rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem' }}>
                                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '52px' }}>
                                          Sæt {setNum}
                                        </div>
                                        <input
                                          style={{ ...s.fieldInput, maxWidth: '90px', padding: '0.65rem 0.5rem', fontSize: '1.1rem', textAlign: 'center' }}
                                          type="number"
                                          placeholder="kg"
                                          value={input.weight}
                                          onChange={e => setLogInputs(p => ({ ...p, [key]: { ...p[key], weight: e.target.value } }))}
                                        />
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.88rem', color: '#c8923a', whiteSpace: 'nowrap' }}>
                                          × {ex.reps || '—'}
                                        </span>
                                        <button
                                          style={{ ...s.btnPrimary, padding: '0.65rem 1rem', fontSize: '0.65rem', background: logged ? '#6cba6c' : '#c8923a' }}
                                          onClick={() => logSet(ex.id, setNum, ex.sets, ex.reps)}
                                        >
                                          {logged ? '✓' : 'Log'}
                                        </button>
                                      </div>
                                      <div style={{ paddingLeft: 'calc(52px + 0.75rem)' }}>
                                        <input
                                          style={{ ...s.fieldInput, fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#7a7770', fontStyle: 'italic' }}
                                          type="text"
                                          placeholder="Tilføj note..."
                                          value={input.note}
                                          onChange={e => setLogInputs(p => ({ ...p, [key]: { ...p[key], note: e.target.value } }))}
                                        />
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}

                          {(session.exercises || []).length === 0 && (
                            <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen øvelser i denne træning endnu.</div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {(currentWeek.sessions || []).length === 0 && (
                  <div style={s.card}>
                    <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen træninger i denne uge endnu.</div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* KOST */}
        {tab === 'kost' && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Kost</div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Kostlog.</h1>
            </div>

            {progressBars}

            {/* Search */}
            <div style={s.card}>
              <div style={s.cardLabel}>Tilføj fødevare</div>

              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <input
                  style={s.fieldInput}
                  type="text"
                  placeholder="Søg... (kylling, havregryn, pasta...)"
                  value={searchQuery}
                  onChange={onSearchInput}
                  autoComplete="off"
                />
              </div>

              {searchResults.length > 0 && (
                <div style={{ background: '#141410', border: '1px solid rgba(237,234,226,0.13)', marginBottom: '0.75rem', maxHeight: '240px', overflowY: 'auto' }}>
                  {searchResults.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => selectFood(f)}
                      style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,146,58,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontSize: '0.88rem', color: '#edeae2' }}>{f.name}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#7a7770', textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                        {f.kcal100} kcal · P: {f.protein100}g · K: {f.carb100}g<br />
                        <span style={{ color: '#4a4844' }}>pr. 100g</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedFood && (
                <div style={{ background: 'rgba(200,146,58,0.06)', border: '1px solid rgba(200,146,58,0.2)', padding: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.88rem', color: '#edeae2', marginBottom: '0.4rem' }}>{selectedFood.name}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginBottom: '0.75rem' }}>
                    {Math.round(selectedFood.kcal100 * amount / 100)} kcal · P: {Math.round(selectedFood.protein100 * amount / 100)}g · K: {Math.round(selectedFood.carb100 * amount / 100)}g · F: {Math.round(selectedFood.fat100 * amount / 100)}g
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div>
                      <div style={s.fieldLabel}>Mængde (g)</div>
                      <input style={{ ...s.fieldInput, maxWidth: '100px' }} type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} />
                    </div>
                    <button style={s.btnPrimary} onClick={addFromSearch}>Tilføj</button>
                    <button style={s.btnGhost} onClick={() => { setSelectedFood(null); setSearchQuery('') }}>Annuller</button>
                  </div>
                </div>
              )}

              <button
                style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: showManual ? '#c8923a' : '#7a7770', cursor: 'pointer', padding: 0 }}
                onClick={() => setShowManual(!showManual)}
              >
                {showManual ? '− Skjul manuel indtastning' : '+ Tilføj manuelt'}
              </button>

              {showManual && (
                <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#141410', border: '1px solid rgba(237,234,226,0.07)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    {[['Navn', 'name', 'text', 'Beskrivelse'], ['Kcal', 'kcal', 'number', '0'], ['Protein (g)', 'protein', 'number', '0'], ['Kulhydrat (g)', 'carb', 'number', '0']].map(([label, key, type, placeholder]) => (
                      <div key={key}>
                        <div style={s.fieldLabel}>{label}</div>
                        <input style={s.fieldInput} type={type} placeholder={placeholder} value={manual[key]} onChange={e => setManual(p => ({ ...p, [key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <button style={s.btnPrimary} onClick={addManual}>Tilføj</button>
                </div>
              )}
            </div>

            {/* Meal log */}
            <div style={s.card}>
              <div style={s.cardLabel}>Dagens måltider — {today()}</div>

              {logs.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen måltider logget endnu i dag.</div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                    <thead>
                      <tr style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844' }}>
                        <th style={{ textAlign: 'left', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Måltid</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Kcal</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Protein</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Kulh.</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Fedt</th>
                        <th style={{ borderBottom: '1px solid rgba(237,234,226,0.07)', width: '24px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(l => (
                        <tr key={l.id} style={{ fontSize: '0.85rem' }}>
                          <td style={{ padding: '0.45rem 0', color: '#b8b4a8' }}>{l.meal}</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>{l.kcal}</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.protein}g</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.carb}g</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.fat}g</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0' }}>
                            <button onClick={() => deleteLog(l.id)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                      <tr style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
                        <td style={{ padding: '0.5rem 0', color: '#7a7770', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#c8923a' }}>{totKcal}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#7a7770' }}>{totProtein}g</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#7a7770' }}>{totCarb}g</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#7a7770' }}>{totFat}g</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>

                  {totKcal > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', paddingTop: '1rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <svg width="100" height="100" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="48" fill="none" stroke="#242420" strokeWidth="14" />
                          <circle cx="60" cy="60" r="48" fill="none" stroke="#6cba6c" strokeWidth="14"
                            strokeDasharray={`${pLen} ${circ - pLen}`} strokeDashoffset="0"
                            transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.5s' }} />
                          <circle cx="60" cy="60" r="48" fill="none" stroke="#c8923a" strokeWidth="14"
                            strokeDasharray={`${cLen} ${circ - cLen}`} strokeDashoffset={-pLen}
                            transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.5s' }} />
                          <circle cx="60" cy="60" r="48" fill="none" stroke="#7a7770" strokeWidth="14"
                            strokeDasharray={`${fLen} ${circ - fLen}`} strokeDashoffset={-(pLen + cLen)}
                            transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.5s' }} />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2', lineHeight: 1 }}>{totKcal}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.15rem' }}>kcal</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                        {[
                          { label: 'Protein', val: totProtein, unit: 'g', pct: Math.round(pKcal / macroTotal * 100), color: '#6cba6c' },
                          { label: 'Kulhydrat', val: totCarb, unit: 'g', pct: Math.round(cKcal / macroTotal * 100), color: '#c8923a' },
                          { label: 'Fedt', val: totFat, unit: 'g', pct: Math.round(fKcal / macroTotal * 100), color: '#7a7770' },
                        ].map(({ label, val, unit, pct, color }) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', flex: 1 }}>{label}</div>
                            <div style={{ fontSize: '0.85rem', color: '#edeae2' }}>{val}<span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, color: '#7a7770' }}>{unit}</span></div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#4a4844', minWidth: '30px', textAlign: 'right' }}>{pct}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* BESKEDER */}
        {tab === 'beskeder' && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Beskeder</div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Din coach.</h1>
            </div>

            <div style={s.card}>
              {/* Pinned messages */}
              {messages.filter(m => m.pinned).length > 0 && (
                <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c8923a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19V13L15 9V4H9V9L5 13V17Z"/>
                    </svg>
                    Fastgjorte beskeder
                  </div>
                  {messages.filter(m => m.pinned).map(msg => (
                    <div key={msg.id} style={{ background: 'rgba(200,146,58,0.06)', border: '1px solid rgba(200,146,58,0.18)', padding: '0.65rem 0.75rem', marginBottom: '0.4rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                        {msg.sender_role === 'coach' ? 'Coach' : 'Dig'} · {formatMsgTime(msg.created_at)}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#edeae2', lineHeight: 1.55 }}>{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Message thread */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', maxHeight: '460px', overflowY: 'auto' }}>
                {messages.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen beskeder endnu. Send en besked til din coach.</div>
                ) : messages.map(msg => {
                  const isMe = msg.sender_role === 'athlete'
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '0.4rem' }}>
                      <div style={{ maxWidth: '78%' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem', textAlign: isMe ? 'right' : 'left' }}>
                          {formatMsgTime(msg.created_at)}
                        </div>
                        <div style={{
                          background: isMe ? 'rgba(200,146,58,0.11)' : '#141410',
                          border: isMe ? '1px solid rgba(200,146,58,0.22)' : '1px solid rgba(237,234,226,0.07)',
                          padding: '0.6rem 0.8rem',
                          fontSize: '0.88rem',
                          color: '#edeae2',
                          lineHeight: 1.55,
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Send input */}
              <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '1rem' }}>
                <input
                  style={{ ...s.fieldInput, flex: 1 }}
                  type="text"
                  placeholder="Skriv en besked til din coach..."
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendAthleteMessage()}
                />
                <button style={s.btnPrimary} onClick={sendAthleteMessage}>Send</button>
              </div>
            </div>
          </>
        )}

        {/* PROFIL */}
        {tab === 'profil' && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Profil</div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                {athlete.name || session.user.email.split('@')[0]}.
              </h1>
            </div>

            <div style={s.card}>
              <div style={s.cardLabel}>Konto</div>
              {[
                ['Navn', athlete.name || '—'],
                ['E-mail', session.user.email],
              ].map(([label, val]) => (
                <div key={label} style={{ marginBottom: '1rem' }}>
                  <div style={s.fieldLabel}>{label}</div>
                  <div style={{ fontSize: '0.88rem', color: '#edeae2' }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={s.card}>
              <div style={s.cardLabel}>Mål</div>
              {[
                ['Kalorieindtag', athlete.kcal_target ? `${athlete.kcal_target} kcal` : '—'],
                ['Proteinindtag', athlete.protein_target ? `${athlete.protein_target} g` : '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ marginBottom: '1rem' }}>
                  <div style={s.fieldLabel}>{label}</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: '#c8923a' }}>{val}</div>
                </div>
              ))}
            </div>

            <button
              style={{ ...s.btnGhost, width: '100%', padding: '0.75rem', textAlign: 'center' }}
              onClick={() => supabase.auth.signOut()}
            >
              Log ud
            </button>
          </>
        )}
      </div>

      {/* Bottom navigation */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1c1c18', borderTop: '1px solid rgba(237,234,226,0.07)', display: 'flex', zIndex: 100 }}>
        {NAV_ITEMS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              padding: '0.7rem 0',
              color: tab === key ? '#c8923a' : '#4a4844',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.46rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              transition: 'color 0.15s ease',
            }}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
