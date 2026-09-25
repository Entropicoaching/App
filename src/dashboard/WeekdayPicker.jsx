// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Delt ugedags-vælger (weekdayPicker til ProgramTab).
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { s } from '../dashboardShared'
import { WEEKDAYS_SHORT } from './coachKonstanter'

export default function WeekdayPicker({
  sessionForm, setSessionForm,
}) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={s.fieldLabel}>Fast ugedag (valgfri)</div>
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
        {WEEKDAYS_SHORT.map((d, i) => {
          const active = sessionForm.weekday === i
          return (
            <button key={i} onClick={() => setSessionForm(p => ({ ...p, weekday: active ? null : i }))}
              style={{ ...s.btnSm, fontSize: '0.55rem', padding: '0.25rem 0.5rem', background: active ? 'rgba(200,146,58,0.18)' : 'transparent', borderColor: active ? '#c8923a' : 'rgba(237,234,226,0.12)', color: active ? '#c8923a' : '#7a7770' }}>{d}</button>
          )
        })}
        <button onClick={() => setSessionForm(p => ({ ...p, weekday: null }))}
          style={{ ...s.btnSm, fontSize: '0.55rem', padding: '0.25rem 0.5rem', background: 'transparent', borderColor: sessionForm.weekday == null ? '#c8923a' : 'rgba(237,234,226,0.12)', color: sessionForm.weekday == null ? '#c8923a' : '#7a7770' }}>Ingen</button>
      </div>
    </div>
  )
}
