// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Profilfanen Noter: coach-noter.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'

export default function NoterTab({
  a, editData, editing, saveEdit, saving, setEditData,
  setEditing, startEdit,
}) {
  return (
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
  )
}
