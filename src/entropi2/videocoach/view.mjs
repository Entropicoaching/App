import { antalOrd } from '../antalOrd.mjs'
import { markerAt, seconds, MAX_SECONDS } from './model.mjs'
import { renderSyntheticBarPath } from './barPathView.mjs'

const buttonStyle = { minHeight: 44, padding: '10px 14px', borderRadius: 8, border: '1px solid #77746b', background: '#25251f', color: '#edeae2', font: 'inherit', cursor: 'pointer' }
const inputStyle = { minHeight: 44, width: '100%', boxSizing: 'border-box', font: 'inherit', color: '#edeae2', background: '#1c1c18', border: '1px solid #77746b', borderRadius: 8, padding: 8 }
const panelStyle = { width: '100%', maxWidth: 480, minWidth: 0, boxSizing: 'border-box', padding: 16, borderRadius: 16, background: '#141410', color: '#edeae2', fontFamily: "'IBM Plex Sans', Arial, sans-serif", lineHeight: 1.5, overflowWrap: 'anywhere' }
const headingStyle = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: 30, lineHeight: 1.2 }
const rowStyle = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }
function helpers(h) {
  const button = (label, onClick, disabled = false, props = {}) => h('button', { type: 'button', style: buttonStyle, onClick, disabled, ...props }, label)
  const field = (label, props) => h('label', { style: { display: 'block', marginBlock: 10 } }, label, h('input', { style: inputStyle, ...props }))
  return { button, field }
}
export function renderUpload(h, { state: s, controller: c, renderPreview, onChooseSource, onContinueLogging }) {
  if (s.enabled === false) return null
  const { button, field } = helpers(h), locked = !!s.operationId, busy = ['preparing', 'sending'].includes(s.phase)
  const boundary = s.setBoundary
  const boundaryBlocked = boundary && boundary.status !== 'ready' && !boundary.manual
  const queue = locked && h('section', { 'aria-label': 'Din afsendelse' },
    h('h3', null, s.phase === 'sent' ? 'Klar til din coach' : busy ? 'Dit løft er på vej' : 'Dit valgte løft'),
    h('p', { role: 'status', 'aria-live': 'polite' }, ({ preparing: 'Klargør dit løft…', sending: 'Sender til din coach…', sent: 'Sendt til din coach.', cancelled: 'Afsendelsen er stoppet.', error: 'Dit løft er bevaret. Prøv igen.' })[s.phase]),
    busy && h('progress', { max: 1, ...(s.progress === null ? {} : { value: s.progress }), 'aria-label': 'Klargøring og afsendelse', style: { width: '100%' } }),
    s.uploaded && s.phase !== 'sent' && h('p', null, 'Klip modtaget. Bekræftelsen mangler stadig.'),
    busy && button('Stop afsendelse', () => c.cancel()),
    ['error', 'cancelled'].includes(s.phase) && button('Prøv igen', () => c.retry()),
    busy && onContinueLogging && button('Log videre imens', () => { c.background(); onContinueLogging() }),
    h('p', null, 'Afsendelsen fortsætter, mens du logger i denne åbne session. Hold appen åben.'))
  if (s.background) return h('aside', { style: panelStyle, 'aria-label': 'Video i baggrunden' }, queue,
    s.error && h('p', { role: 'alert' }, s.error), button('Vis video', () => c.foreground()))
  return h('section', { style: panelStyle, 'aria-label': 'Send et løft' },
    h('p', { style: { color: '#c8923a', letterSpacing: '0.08em', fontFamily: "'IBM Plex Mono', Consolas, monospace" } }, `VIDEOCOACH · ${s.step} AF 3`),
    h('h2', { style: headingStyle }, ['Dit sæt', 'Vælg dit løft', 'Klar til din coach'][s.step - 1]),
    s.step === 1 && h('div', null, h('p', null, 'Giv coachen sammenhængen fra dit træningspas.'),
      h('label', null, 'Løft og sæt', h('select', { style: inputStyle, value: s.choice?.key || '', disabled: locked,
        onChange: e => c.choose(e.target.value) }, h('option', { value: '' }, 'Vælg dit sæt'),
      ...s.options.map(o => h('option', { key: o.key, value: o.key }, `${o.exercise_name} · sæt ${o.set_number} · ${o.load_kg ?? '—'} kg · ${o.reps ?? '—'} ${antalOrd(o.reps ?? '—', 'gentagelse', 'gentagelser')}`)))),
      !s.options.length && h('p', { role: 'status' }, 'Der er ingen sæt at vælge i dette pas.')),
    s.step === 2 && h('div', null,
      h('p', null, 'Coachen ser præcis det, der betyder noget.'),
      button(s.source ? 'Vælg en anden video' : 'Vælg video', onChooseSource, locked || !onChooseSource),
      s.source && h('div', null,
        h('p', null, s.source.label),
        renderPreview ? renderPreview({ source: s.source, window: s.window }) : h('p', { role: 'status' }, 'Forhåndsvisning skal forbindes til den eksisterende afspiller.'),
        h('p', { role: 'status', 'aria-live': 'polite' }, boundary?.manual
          ? 'Du har valgt intervallet manuelt. Kontrollér, at hele sættet er med.'
          : boundary?.status === 'ready'
            ? 'Hele sættet er markeret med buffer før bevægelsen og bekræftet hvile efter sidste gentagelse.'
            : boundary?.status === 'too-long'
              ? `Hele sættet varer ${seconds(boundary.window.end - boundary.window.start)} og overskrider grænsen på ${seconds(MAX_SECONDS)}. Det er ikke valgt automatisk. Vælg et interval manuelt for at fortsætte.`
              : boundary?.status === 'empty'
                ? 'Ingen tydelige gentagelser i bevægelsesdata. Vælg et interval manuelt for at fortsætte.'
                : boundary?.status === 'incomplete'
                  ? 'Hele sættets start og afsluttende hvile kunne ikke bekræftes. Vælg et interval manuelt for at fortsætte.'
                  : 'Vi starter med slutningen af videoen. Flyt rammen til det løft, du vil vise.'),
        h('div', { style: { position: 'relative', height: 64, background: '#343c2d', borderRadius: 12 }, 'aria-label': 'Hele videoens tidslinje' },
          h('div', { role: 'slider', tabIndex: locked ? -1 : 0, 'aria-label': 'Flyt dit valgte løft',
            'aria-valuemin': 0, 'aria-valuemax': s.source.duration - (s.window.end - s.window.start), 'aria-valuenow': s.window.start,
            'aria-valuetext': `${seconds(s.window.start)} til ${seconds(s.window.end)}`, 'aria-disabled': locked,
            style: { position: 'absolute', top: 0, height: '100%', boxSizing: 'border-box', minWidth: 0,
              left: `${s.window.start / s.source.duration * 100}%`, width: `${(s.window.end - s.window.start) / s.source.duration * 100}%`,
              border: '3px solid #c8923a', borderRadius: 12, background: '#c8923a30', touchAction: 'none', cursor: 'grab' },
            onPointerDown: e => {
              const width = e.currentTarget.parentElement.getBoundingClientRect().width
              if (c.dragStart(e.pointerId, e.clientX, width)) e.currentTarget.setPointerCapture?.(e.pointerId)
            },
            onPointerMove: e => c.dragMove(e.pointerId, e.clientX), onPointerUp: () => c.dragEnd(), onPointerCancel: () => c.dragEnd(),
            onKeyDown: e => {
              const delta = e.shiftKey ? 1 : 0.1
              const value = ({ ArrowLeft: s.window.start - delta, ArrowRight: s.window.start + delta, Home: 0, End: s.source.duration })[e.key]
              if (value !== undefined) { e.preventDefault(); c.move(value) }
            } })),
        h('p', null, `Valgt: ${seconds(s.window.start)} – ${seconds(s.window.end)} · ${seconds(s.window.end - s.window.start)}`),
        field('Start på løftet', { type: 'range', min: 0, max: s.window.end, step: 0.01, value: s.window.start, disabled: locked, onChange: e => c.resize('start', Number(e.target.value)) }),
        field('Slut på løftet', { type: 'range', min: s.window.start, max: s.source.duration, step: 0.01, value: s.window.end, disabled: locked, onChange: e => c.resize('end', Number(e.target.value)) }))),
    s.step === 3 && h('div', null,
      h('p', null, `${s.choice?.exercise_name} · sæt ${s.choice?.set_number}`),
      h('p', null, `${seconds(s.window?.start)} – ${seconds(s.window?.end)}`),
      h('p', null, 'Ét tydeligt løft giver din coach det bedste udgangspunkt for feedback.'),
      !locked && button('Send til din coach', () => c.send(), !s.canSend || boundaryBlocked),
      !s.canSend && h('p', { role: 'status' }, 'Klargøring og afsendelse skal forbindes, før du kan sende.'), queue),
    s.error && h('p', { role: 'alert' }, s.error),
    !locked && h('div', { style: rowStyle }, s.step > 1 && button('Tilbage', () => c.back()),
      s.step < 3 && button('Fortsæt', () => c.next(), s.step === 1 ? !s.choice : !s.source || boundaryBlocked)),
    h('details', null, h('summary', null, 'Flere klip og sammenligning'),
      h('p', null, 'Denne afsendelse viser ét løft. Flere klip i samme indlæg og side om side kræver en udvidelse af den eksisterende kontrakt.')))
}

export function renderReview(h, { state: s, controller: c, renderPreview, renderTransport, previewAspectRatio = '16 / 9' }) {
  if (s.enabled === false) return null
  const { button, field } = helpers(h)
  const point = e => { const r = e.currentTarget.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] : [NaN, NaN] }
  const strokes = [...s.markers.filter(m => markerAt(m, s.time)).flatMap(m => m.strokes), ...s.strokes, ...(s.drawing ? [s.drawing] : [])]
  return h('section', { style: panelStyle, 'aria-label': 'Coachens gennemgang' },
    h('h2', { style: headingStyle }, 'Din konklusion'),
    h('p', null, 'Giv atleten én tydelig retning, før du går i detaljen.'),
    ...[['works', 'Det fungerer'], ['focus', 'Atletens fokus'], ['next_set', 'Næste gang']].map(([key, label]) =>
      h('label', { key, style: { display: 'block', marginBlock: 10 } }, label,
        h('textarea', { style: inputStyle, value: s.conclusion[key], maxLength: 600, disabled: s.busy, onChange: e => c.conclusion(key, e.target.value) }))),
    button('Gem konklusion som kladde', () => c.saveConclusion(), s.busy || !s.canSaveConclusion),
    h('p', null, 'Deling og godkendelse sker i den eksisterende reviewfunktion.'),
    h('h3', null, 'Vis det, du mener'),
    !renderPreview && h('p', null, 'Forbind den eksisterende afspiller for at gennemgå videoen. Tegnefeltet nedenfor er en lokal kladde.'),
    field('Tidspunkt i klippet', { type: 'number', min: 0, max: s.duration, step: 0.01, value: s.time, disabled: s.busy, onChange: e => c.time(Number(e.target.value)) }),
    button('Gå til tidspunkt', () => c.seek(s.time), s.busy || !s.canSeek),
    h('p', null, 'Tegn på den normaliserede ramme. Tegningerne vises ved markeringens tidspunkt; ingen automatisk bevægelsessporing.'),
    h('div', { style: { position: 'relative', aspectRatio: previewAspectRatio, background: '#30382a', width: '100%' } },
      renderPreview && renderPreview({ time: s.time, onTime: value => c.time(value) }),
      h('svg', { viewBox: '0 0 1 1', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Tegnefelt til markering',
      style: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: '1px solid #b3c5a0', boxSizing: 'border-box', touchAction: 'none' },
      onPointerDown: e => { if (c.drawStart(e.pointerId, ...point(e))) e.currentTarget.setPointerCapture?.(e.pointerId) },
      onPointerMove: e => c.drawMove(e.pointerId, ...point(e)), onPointerUp: e => c.drawEnd(e.pointerId), onPointerCancel: () => c.drawCancel() },
      ...strokes.map((stroke, i) => h('polyline', { key: i, points: stroke.points.map(p => p.join(',')).join(' '), stroke: stroke.color, fill: 'none', strokeWidth: 3, vectorEffect: 'non-scaling-stroke' })))),
    renderTransport && renderTransport(),
    renderSyntheticBarPath(h, { result: s.barPath, error: s.barPathError }),
    button('Fortryd sidste streg', () => c.undo(), s.busy || !s.strokes.length),
    field('Markering fra (sekunder)', { type: 'number', min: 0, max: s.duration, step: 0.01, value: s.start, disabled: s.busy, onChange: e => c.marker('start', Number(e.target.value)) }),
    field('Markering til (sekunder)', { type: 'number', min: 0, max: s.duration, step: 0.01, value: s.end, disabled: s.busy, onChange: e => c.marker('end', Number(e.target.value)) }),
    field('Kommentar til markeringen', { value: s.text, maxLength: 2000, disabled: s.busy, onChange: e => c.marker('text', e.target.value) }),
    button('Tilføj markering', () => c.addMarker(), s.busy),
    h('ol', null, ...s.markers.map(m => h('li', { key: m.id }, button(`${seconds(m.start)} · ${m.text || 'Tegning'}`, () => c.seek(m.start), s.busy),
      button('Fjern markering', () => c.removeMarker(m.id), s.busy)))),
    button('Gem markeringer', () => c.saveMarkers(), s.busy || !s.canSaveMarkers),
    !s.canSaveMarkers && h('p', { role: 'status' }, 'Markeringer er lokale kladder her. Den eksisterende markeringskontrakt skal forbindes for at gemme dem.'),
    h('h3', null, 'Feedback i samtalen'),
    field(`Besked om ${seconds(s.time)}`, { value: s.reply, maxLength: 600, disabled: s.busy, onChange: e => c.reply(e.target.value) }),
    button('Send tidsfeedback', () => c.sendFeedback(), s.busy || !s.canSend || !s.reply.trim()),
    button('Prøv ventende feedback igen', () => c.retryFeedback(), s.busy || !s.canSend),
    !s.canSend && h('p', null, 'Forbind den eksisterende samtale for at sende feedback.'),
    s.error && h('p', { role: 'alert' }, s.error), h('p', { role: 'status', 'aria-live': 'polite' }, s.status))
}
