// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Registrér stævneresultat-modalen.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'

export default function StaevneResultatModal({
  meetResultForm, saveMeetResult, saving, selectedAthlete, setMeetResultForm,
}) {
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
}
