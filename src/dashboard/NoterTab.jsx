import { visibleCoachNotes, saveCoachNoteText } from '../athlete/coachMobility.mjs'
import { WARMUP_BASE } from '../athlete/mobilityCatalog.mjs'
import CoachNotesPage from './CoachNotesPage.mjs'
// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Profilfanen Noter: coach-noter.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'

export default function NoterTab({ coachNotesEnabled = false, onAddNote,
  mobilitetCoach = false, mobilityCoachId, mobilityClient, onMobilitySaved, setSaving, showFlash,
  a, editData, editing, saveEdit, saving, setEditData,
  setEditing, startEdit,
}) {
  if (coachNotesEnabled === true) return <CoachNotesPage key={a.id} athlete={mobilitetCoach === true ? { ...a, notes: visibleCoachNotes(a.notes) } : a} onAddNote={onAddNote} />
  const notes = mobilitetCoach === true ? visibleCoachNotes(a.notes) : a.notes
  async function saveNotes() {
    if (mobilitetCoach !== true) return saveEdit()
    setSaving(true)
    try {
      const result = await saveCoachNoteText({ enabled: true, client: mobilityClient, coachId: mobilityCoachId, athlete: a, noteText: editData.notes, library: WARMUP_BASE })
      if (result.error) showFlash(result.error, 'error')
      else { onMobilitySaved(result.athlete); setEditing(null) }
    } finally { setSaving(false) }
  }
  return (
              <div style={s.card}>
                <div style={s.cardLabel}>
                  Coach-noter
                  <button style={s.btnEdit} onClick={() => startEdit('notes', { notes: notes || '' })}>Rediger</button>
                </div>
                {editing === 'notes' ? (
                  <div>
                    <textarea style={{ ...s.fieldInput, minHeight: '120px', resize: 'vertical', lineHeight: 1.7 }} value={editData.notes} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} />
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                      <button style={s.btnGhost} onClick={() => setEditing(null)}>Annuller</button>
                      <button style={s.btnPrimary} onClick={() => saveNotes()} disabled={saving}>{saving ? 'Gemmer...' : 'Gem'}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.88rem', color: '#7a7770', lineHeight: 1.75, fontStyle: notes ? 'normal' : 'italic' }}>
                    {notes || 'Ingen noter endnu.'}
                  </div>
                )}
              </div>
  )
}
