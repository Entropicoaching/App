// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Øvelsesbiblioteket (view === 'library').
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'

export default function BibliotekView({
  addingLibraryEx, addLibraryExercise, deleteLibraryExercise, editingLibraryEx, exerciseLibrary, isMobile,
  libraryAddForm, libraryEditForm, librarySearch, setAddingLibraryEx, setEditingLibraryEx, setLibraryAddForm,
  setLibraryEditForm, setLibrarySearch, updateLibraryExercise,
}) {
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
}
