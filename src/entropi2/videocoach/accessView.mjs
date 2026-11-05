import { antalOrd } from '../antalOrd.mjs'
import { seconds } from './model.mjs'

const buttonStyle = { minHeight: 44, padding: '10px 14px', borderRadius: 8, border: '1px solid #77746b',
  background: '#25251f', color: '#edeae2', font: 'inherit', cursor: 'pointer', overflowWrap: 'anywhere' }
const rowStyle = { display: 'flex', flexWrap: 'wrap', gap: 8, marginBlock: 12 }
const panelStyle = { width: '100%', maxWidth: 480, minWidth: 0, boxSizing: 'border-box', padding: 16,
  borderRadius: 16, background: '#141410', color: '#edeae2', fontFamily: "'IBM Plex Sans', Arial, sans-serif", overflowWrap: 'anywhere' }

// Render this same entry once on home, or once per set with its existing key.
// The host supplies the ownership/read-only decision; roles are not inferred here.
export function renderFilmSetEntry(h, { state: s, controller: c, choiceKey }) {
  if (s.enabled !== true) return null
  const choice = choiceKey == null ? null : s.options.find(o => o.key === choiceKey)
  if (choiceKey != null && !choice) return null
  return h('button', { type: 'button', style: buttonStyle, 'data-videocoach-entry': choiceKey ?? 'home',
    disabled: s.busy, 'aria-label': choice ? `Film ${choice.exercise_name}, sæt ${choice.set_number}` : 'Film et sæt',
    onClick: () => c.open(choiceKey) }, 'Film et sæt')
}

export function renderAthleteAccess(h, { state: s, controller: c, renderPreview }) {
  if (s.enabled !== true || !s.open) return null
  const button = (text, action, disabled = false) => h('button', { type: 'button', style: buttonStyle, onClick: action, disabled }, text)
  const delivery = s.delivery
  const sending = ['preparing', 'sending'].includes(delivery?.phase)
  return h('section', { style: panelStyle, 'aria-label': 'Din VideoCoach', 'aria-busy': s.busy },
    h('h2', null, 'Dit sæt på video'),
    s.options.length > 0 && h('label', null, 'Sæt i dagens pas (valgfrit)',
      h('select', { value: s.choice?.key ?? '', disabled: s.busy || s.locked, style: { ...buttonStyle, width: '100%' },
        onChange: e => c.chooseSet(e.target.value) },
      h('option', { value: '' }, 'Egen video uden et sæt'),
      ...s.options.map(o => h('option', { key: o.key, value: o.key }, `${o.exercise_name} · sæt ${o.set_number}`)))),
    !s.options.length && h('p', { role: 'status' }, 'Ingen sæt i dagens pas. Du kan stadig se egen analyse og gemme lokalt.'),
    h('div', { style: rowStyle },
      button(s.source ? 'Vælg en anden video' : 'Vælg video', () => c.chooseSource('choose'), s.busy || s.locked || !s.canChoose),
      button('Optag video', () => c.chooseSource('record'), s.busy || s.locked || !s.canChoose)),
    !s.canChoose && h('p', { role: 'status' }, 'Videooptagelse og valg af video er ikke tilgængeligt her endnu.'),
    s.source && h('div', null,
      h('p', null, s.source.label),
      renderPreview ? renderPreview({ source: s.source, window: s.window }) : h('p', { role: 'status' }, 'Forhåndsvisning er ikke tilgængelig her endnu.'),
      h('p', null, `Valgt klip: ${seconds(s.window.start)} – ${seconds(s.window.end)}. Op til de sidste 15 sekunder.`),
      !s.canAnalyze && h('p', { role: 'status' }, 'Egen analyse er ikke tilgængelig her endnu.'),
      s.canAnalyze && button(s.analysis ? 'Analysér igen' : 'Analysér klippet', () => c.analyze(), s.busy || s.locked)),
    s.analysis && h('figure', { style: { margin: '16px 0' } },
      h('figcaption', null, `${s.analysis.reps} ${antalOrd(s.analysis.reps, 'gentagelse', 'gentagelser')} registreret`),
      h('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': 'Registreret bane i det valgte klip',
        style: { display: 'block', width: '100%', maxWidth: 320, aspectRatio: '1', background: '#25251f' } },
      h('polyline', { points: s.analysis.path.map(([, x, y]) => `${x * 100},${y * 100}`).join(' '),
        fill: 'none', stroke: '#c8923a', strokeWidth: 2 })),
      h('p', null, 'Bane og antal kommer fra videoanalysen. Kontrollér resultatet i din video.')),
    s.source && h('div', { style: rowStyle },
      button(s.localId ? 'Gemt lokalt' : 'Gem lokalt', () => c.saveLocal(), !s.analysis || s.busy || s.locked || !s.canSaveLocal || !!s.localId),
      !s.locked && button('Send til din coach', () => c.send(), s.busy || !s.canSend)),
    s.analysis && !s.canSaveLocal && h('p', { role: 'status' }, 'Lokal gemning er ikke tilgængelig her endnu.'),
    s.source && !s.canSend && !s.locked && h('p', { role: 'status' }, s.choice
      ? 'Afsendelse til din coach er ikke tilgængelig her endnu.' : 'Vælg et sæt i dagens pas for at sende til din coach.'),
    delivery && h('p', { role: 'status', 'aria-live': 'polite' }, ({ preparing: 'Klargør klippet…', sending: 'Sender til din coach…',
      sent: 'Sendt til din coach.', error: 'Afsendelsen er ikke bekræftet. Dit klip er bevaret.', cancelled: 'Afsendelsen er stoppet. Dit klip er bevaret.' })[delivery.phase] ?? ''),
    sending && h('progress', { max: 1, ...(delivery.progress === null ? {} : { value: delivery.progress }), 'aria-label': 'Klargøring og afsendelse' }),
    ['error', 'cancelled'].includes(delivery?.phase) && button('Prøv afsendelse igen', () => c.retrySend(), s.busy),
    (s.busy || sending) && button('Stop', () => c.cancel()),
    (s.error || delivery?.error) && h('p', { role: 'alert' }, s.error || delivery.error),
    h('p', { role: 'status', 'aria-live': 'polite' }, ({ choosing: 'Åbner dit videovalg…', analyzing: 'Analyserer dit klip…', saving: 'Gemmer lokalt…' })[s.phase] ?? s.status),
    h('div', { style: rowStyle }, s.source && button('Vælg et nyt klip', () => c.reset(), s.busy || s.locked && delivery.phase !== 'sent'),
      button('Tilbage til træning', () => c.close())),
    h('details', null, h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Om dit klip'),
      h('p', null, 'Lokal gemning deler ikke klippet med din coach. Kun Send til din coach starter en afsendelse. Hold appen åben, til afsendelsen er bekræftet.')))
}
