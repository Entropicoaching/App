// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Ny atlet-modalen (3 trin).
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'

export default function NyAtletModal({
  addAthlete, addStep, newAthlete, saving, setAddStep, setNewAthlete,
  setShowAddModal,
}) {
        const set = (k, v) => setNewAthlete(p => ({ ...p, [k]: v }))
        const field = (label, key, type = 'text', placeholder = '') => (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={s.fieldLabel}>{label}</div>
            <input style={s.fieldInput} type={type} inputMode={type === 'number' ? 'decimal' : undefined} placeholder={placeholder} value={newAthlete[key]} onChange={e => set(key, e.target.value)} />
          </div>
        )
        const nameOk = newAthlete.name.trim().length > 0
        const steps = ['Stamdata', 'Nuværende maks', 'Mål & noter']
        return (
          <div style={s.overlay} onClick={e => e.target === e.currentTarget && (setShowAddModal(false), setAddStep(0))}>
            <div style={{ ...s.modal, maxWidth: '440px', maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={s.modalTitle}>Ny atlet</div>
              {/* Trin-indikator */}
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.25rem' }}>
                {steps.map((label, i) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div style={{ height: 3, borderRadius: 2, background: i <= addStep ? '#c8923a' : 'rgba(237,234,226,0.12)' }} />
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: i === addStep ? '#c8923a' : '#4a4844', marginTop: '0.3rem' }}>{label}</div>
                  </div>
                ))}
              </div>

              {addStep === 0 && (
                <>
                  {field('Fulde navn *', 'name', 'text', 'For- og efternavn')}
                  {field('Email (til login)', 'email', 'email', 'email@eksempel.dk')}
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#7a7770', marginTop: '-0.4rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    {newAthlete.email.trim()
                      ? 'Atleten logger ind med denne email. Mellemrum ryddes, og adressen gemmes med små bogstaver, så koblingen bliver entydig.'
                      : 'Email kan tilføjes senere, men atletens login kan først kobles, når den er udfyldt.'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    {field('Alder', 'age', 'number', 'år')}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={s.fieldLabel}>Køn</div>
                      <select style={s.fieldSelect} value={newAthlete.sex} onChange={e => set('sex', e.target.value)}>
                        <option value="">—</option>
                        <option value="M">Mand</option>
                        <option value="K">Kvinde</option>
                      </select>
                    </div>
                    {field('Kropsvægt (kg)', 'bodyweight', 'number', 'kg')}
                    {field('Højde (cm)', 'height', 'number', 'cm')}
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={s.fieldLabel}>Status</div>
                    <select style={s.fieldSelect} value={newAthlete.status} onChange={e => set('status', e.target.value)}>
                      <option value="active">Aktiv</option>
                      <option value="peaking">Peaking</option>
                      <option value="offseason">Off-season</option>
                      <option value="ferie">Ferie</option>
                    </select>
                  </div>
                </>
              )}

              {addStep === 1 && (
                <>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', marginBottom: '0.85rem', lineHeight: 1.6 }}>
                    Bedste løft lige nu (1RM eller tungeste topsæt). Bruges som startpunkt i atletens rekorder og grafer, og til opvarmnings-beregningen. Kan udfyldes senere.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    {field('Squat (kg)', 'squat', 'number', 'kg')}
                    {field('Bænk (kg)', 'bench', 'number', 'kg')}
                    {field('Dødløft (kg)', 'deadlift', 'number', 'kg')}
                    {field('OHP (kg)', 'ohp', 'number', 'kg')}
                  </div>
                  {field('Vægtklasse (kg)', 'weightClass', 'number', 'f.eks. 83')}
                </>
              )}

              {addStep === 2 && (
                <>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={s.fieldLabel}>Mål</div>
                    <textarea style={{ ...s.fieldInput, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }} placeholder="F.eks. blive stærkere i squat, bænk, dødløft og OHP" value={newAthlete.goal} onChange={e => set('goal', e.target.value)} />
                  </div>
                  {field('Stævnedato (hvis relevant)', 'competition_date', 'date')}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    {field('Kcal-mål', 'kcal_target', 'number', 'valgfrit')}
                    {field('Protein-mål (g)', 'protein_target', 'number', 'valgfrit')}
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={s.fieldLabel}>Coach-noter</div>
                    <textarea style={{ ...s.fieldInput, minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }} placeholder="Baggrund, skader, ting at holde øje med..." value={newAthlete.notes} onChange={e => set('notes', e.target.value)} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                <button style={s.btnGhost} onClick={() => addStep === 0 ? (setShowAddModal(false), setAddStep(0)) : setAddStep(s => s - 1)}>
                  {addStep === 0 ? 'Annuller' : '← Tilbage'}
                </button>
                {addStep < 2 ? (
                  <button style={s.btnPrimary} disabled={addStep === 0 && !nameOk} onClick={() => setAddStep(s => s + 1)}>Næste →</button>
                ) : (
                  <button style={s.btnPrimary} onClick={addAthlete} disabled={saving || !nameOk}>{saving ? 'Opretter...' : 'Opret atlet'}</button>
                )}
              </div>
            </div>
          </div>
        )
}
