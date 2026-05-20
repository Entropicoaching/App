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
  page: { maxWidth: '680px', margin: '0 auto', padding: '1.5rem 1rem 4rem' },
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

export default function AthleteView({ session }) {
  const [athlete, setAthlete] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedFood, setSelectedFood] = useState(null)
  const [amount, setAmount] = useState(100)
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState({ name: '', kcal: '', protein: '', carb: '' })

  useEffect(() => { fetchAthlete() }, [])

  async function fetchAthlete() {
    const { data, error } = await supabase
      .from('athletes')
      .select('*')
      .eq('email', session.user.email)
      .single()
    if (!error && data) {
      setAthlete(data)
      fetchLogs(data.id)
    }
    setLoading(false)
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

  const totKcal = logs.reduce((s, l) => s + (l.kcal || 0), 0)
  const totProtein = logs.reduce((s, l) => s + (l.protein || 0), 0)
  const totCarb = logs.reduce((s, l) => s + (l.carb || 0), 0)
  const totFat = logs.reduce((s, l) => s + (l.fat || 0), 0)
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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      Indlæser...
    </div>
  )

  if (!athlete) return (
    <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Din konto er ikke tilknyttet en atlet endnu.</div>
      <div style={{ color: '#4a4844', fontSize: '0.82rem' }}>Kontakt din coach for at få adgang.</div>
      <button style={s.btnGhost} onClick={() => supabase.auth.signOut()}>Log ud</button>
    </div>
  )

  return (
    <div style={s.wrap}>
      <div style={s.topbar}>
        <div style={s.logo}>Entropi<span style={{ color: '#c8923a' }}>.</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844' }}>{today()}</div>
          <button style={{ ...s.btnGhost, padding: '0.3rem 0.75rem' }} onClick={() => supabase.auth.signOut()}>Log ud</button>
        </div>
      </div>

      <div style={s.page}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
            God <em style={{ fontStyle: 'italic', color: '#7a7770' }}>{greeting}</em>.
          </h1>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.25rem' }}>
            {days[now.getDay()]} d. {now.getDate()}. {months[now.getMonth()]} {now.getFullYear()}
          </div>
        </div>

        {/* Progress bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Kalorier i dag', val: totKcal, target: athlete.kcal_target, unit: 'kcal', pct: kcalPct, color: '#c8923a' },
            { label: 'Protein i dag', val: totProtein, target: athlete.protein_target, unit: 'g', pct: proteinPct, color: '#6cba6c' },
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

          {/* Search results */}
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

          {/* Selected food panel */}
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

          {/* Manual entry */}
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
      </div>
    </div>
  )
}
