// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Øvelsesformens række med bibliotekssøgning (exFormRow til ProgramTab).
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'

export default function ExFormRow({
  addToLibraryQuick, exerciseForm, exerciseLibrary, exerciseSearchOpen, isMobile, setExerciseForm,
  setExerciseSearchOpen,
}) {
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
            style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem', minHeight: '44px', boxSizing: 'border-box' }}
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
              style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem', minHeight: '44px', boxSizing: 'border-box' }}
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
              aria-label="Intensitetsenhed"
              style={{ ...s.fieldInput, fontSize: '0.72rem', padding: '0.4rem 0.3rem', width: 'auto', flexShrink: 0, cursor: 'pointer', minHeight: '44px', boxSizing: 'border-box' }}
              value={exerciseForm.intensityPrefix}
              onChange={e => setExerciseForm(p => ({ ...p, intensityPrefix: e.target.value }))}
            >
              <option value="RPE">RPE</option>
              <option value="%">%</option>
              <option value="Tid">Tid</option>
              <option value="Fri tekst">Fri</option>
            </select>
            <input
              style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem', flex: 1, minWidth: 0, minHeight: '44px', boxSizing: 'border-box' }}
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
            style={{ ...s.fieldInput, fontSize: '0.8rem', padding: '0.4rem 0.6rem', minHeight: '44px', boxSizing: 'border-box' }}
            type="text"
            placeholder="Note"
            value={exerciseForm.note}
            onChange={e => setExerciseForm(p => ({ ...p, note: e.target.value }))}
          />
        </div>
      </div>
    )
}
