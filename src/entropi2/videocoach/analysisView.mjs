import { antalOrd } from '../antalOrd.mjs'

const buttonStyle = { minHeight: 44, padding: '10px 14px', border: '1px solid #77746b', borderRadius: 8,
  color: '#edeae2', background: '#25251f', font: 'inherit' }

// Mount under Analyse/Fremgang; filter by the host's actual session and exercise IDs.
export function renderVideoAnalyses(h, { state, controller, sessionId, exerciseId }) {
  if (state.enabled !== true) return null
  const rows = state.records.filter(row => (sessionId === undefined || row.choice.session_id === sessionId)
    && (exerciseId === undefined || row.choice.exercise_id === exerciseId))
  return h('section', { 'aria-label': 'Videoanalyser', 'data-videocoach-analysis': true,
    style: { width: '100%', minWidth: 0, boxSizing: 'border-box', overflowWrap: 'anywhere', color: '#edeae2' } },
  h('h2', null, 'Dine videoanalyser'),
  !rows.length && h('p', { role: 'status' }, 'Ingen videoanalyse for dette løft og pas endnu.'),
  ...rows.map(row => h('article', { key: row.clientAnalysisId, 'aria-label': `${row.choice.exercise_name}, sæt ${row.choice.set_number}` },
    h('h3', null, `${row.choice.session_date} · ${row.choice.exercise_name} · sæt ${row.choice.set_number}`),
    h('p', null, `${row.analysis.reps} ${antalOrd(row.analysis.reps, 'gentagelse', 'gentagelser')} registreret`),
    h('p', { role: 'status', 'aria-live': 'polite' }, row.phase === 'sent' ? 'Sendt i samtalen til din coach.'
      : ['preparing', 'sending'].includes(row.phase) ? 'Sender analysen i samtalen…'
        : ['error', 'cancelled'].includes(row.phase) ? 'Afsendelsen er ikke bekræftet. Analysen er bevaret.' : 'Analysen er på denne enhed. Ikke sendt til coach.'),
    row.error && h('p', { role: 'alert' }, row.error),
    row.phase !== 'sent' && h('button', { type: 'button', style: buttonStyle,
      disabled: !state.canSend || ['preparing', 'sending'].includes(row.phase),
      onClick: () => controller.send(row.clientAnalysisId) }, ['error', 'cancelled'].includes(row.phase) ? 'Prøv afsendelse igen' : 'Send til din coach'),
    !state.canSend && h('p', { role: 'status' }, 'Afsendelse i samtalen er ikke tilgængelig her endnu.'),
    h('details', null, h('summary', { style: { minHeight: 44 } }, 'Se banen'),
      h('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': 'Registreret bane',
        style: { width: '100%', maxWidth: 320, aspectRatio: '1' } },
        h('polyline', { points: row.analysis.path.map(([, x, y]) => `${x * 100},${y * 100}`).join(' '),
          fill: 'none', stroke: '#c8923a', strokeWidth: 2 })),
      h('p', null, 'Kontrollér bane og antal i din video. Analysen er ikke coachens vurdering.')))))
}
