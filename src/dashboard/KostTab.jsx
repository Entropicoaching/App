// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Profilfanen Kost: atlet-setup og kostmål.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'

export default function KostTab({
  a, editData, editing, isMobile, saveEdit, saving,
  setEditData, setEditing, startEdit,
}) {
  return (
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
  )
}
