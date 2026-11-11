// u8d: lukket prøve-loader tillader ingen ny import; samme regel som danskTal.decimaler.
const decimaler = (value, digits = 1) => value.toFixed(digits).replace('.', ',')
import { parsePlaybackDocument, activeMarkers, adjacentMarker } from './athlete/videoFeedbackPlayback.mjs'
import { ATHLETE, PREVIEW_ANALYSIS } from './fridayPreviewSeed.mjs'

// Declared clip metadata only. No file, measured frame, digest or video is produced.
export function previewMarkerDocument() {
  return { schema: 'vc-epik2-playback/v1', status: 'ready', athleteId: ATHLETE,
    analysisId: PREVIEW_ANALYSIS,
    clip: { name: 'syntetisk-pladsholder.webm', type: 'video/webm', size: 1,
      sha256: '0'.repeat(64), duration: 8, width: 640, height: 360 },
    markers: [
      { id: 'start', start: 1, end: 3, text: 'Hold en rolig start.',
        strokes: [{ color: '#ffcc00', points: [[0.3,0.75],[0.3,0.3]] }] },
      { id: 'bund', start: 4, end: 6, text: 'Se coachens tegnede linje ved bunden.',
        strokes: [{ color: '#00ccff', points: [[0.25,0.7],[0.75,0.7]] }] },
    ] }
}

// Preview-only still-image timeline, using the actual VC-EPIK2 validator and timing rules.
export function mountPreviewMarkers(root, scope, { enabled = false } = {}) {
  if (enabled !== true || scope?.athleteId !== ATHLETE || scope?.analysisId !== PREVIEW_ANALYSIS)
    return () => {}
  const feedback = parsePlaybackDocument(previewMarkerDocument(), scope)
  const doc = root.ownerDocument, listeners = []
  const el = (tag, text) => { const n = doc.createElement(tag); if (text) n.textContent = text; return n }
  const listen = (n, event, fn) => { n.addEventListener(event, fn); listeners.push([n,event,fn]) }
  const section = el('details'), title = el('summary', 'Åbn syntetiske tidsmarkeringer')
  title.style.minHeight = '44px'
  const help = el('p', 'Syntetisk stillbilledplads. Tiden vælges manuelt. Ingen video, måling eller teknikvurdering.')
  const frame = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  frame.setAttribute('viewBox', '0 0 640 360'); frame.setAttribute('role', 'img')
  frame.setAttribute('aria-label', 'Syntetisk stillbilledplads med coachens tegninger')
  Object.assign(frame.style, { width: '100%', display: 'block', background: '#1c2a38' })
  const background = doc.createElementNS('http://www.w3.org/2000/svg', 'text')
  background.setAttribute('x','80'); background.setAttribute('y','160'); background.setAttribute('fill','#ffffff')
  background.textContent = 'SYNTETISK STILLBILLEDPLADS'
  const strokes = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  frame.append(background, strokes)
  const comments = el('div'); comments.setAttribute('aria-live','polite')
  const label = el('label', 'Tid i den syntetiske sekvens '), slider = el('input')
  slider.type = 'range'; slider.min = '0'; slider.max = String(feedback.clip.duration); slider.step = '0.1'
  slider.setAttribute('aria-label','Tid i sekunder'); label.append(slider)
  const status = el('p'); status.setAttribute('role','status')
  const previous = el('button','Forrige markering'), next = el('button','Næste markering')
  const list = el('div'); Object.assign(list.style, { display:'grid', gap:'8px' })
  const buttons = []
  let time = feedback.markers[0].start
  function update(value) {
    if (!Number.isFinite(value) || value < 0 || value > feedback.clip.duration) return
    time = value; slider.value = String(time); status.textContent = `${decimaler(time)} s / ${feedback.clip.duration} s`
    const active = activeMarkers(feedback.markers,time)
    comments.replaceChildren(...active.map(m => el('p',m.text)))
    strokes.replaceChildren()
    for (const marker of active) for (const stroke of marker.strokes) {
      const line = doc.createElementNS('http://www.w3.org/2000/svg','polyline')
      line.setAttribute('points',stroke.points.map(([x,y]) => `${x*640},${y*360}`).join(' '))
      line.setAttribute('stroke',stroke.color); line.setAttribute('stroke-width','4'); line.setAttribute('fill','none')
      strokes.append(line)
    }
    previous.disabled = !adjacentMarker(feedback.markers,time,-1)
    next.disabled = !adjacentMarker(feedback.markers,time,1)
    buttons.forEach((b,i) => b.setAttribute('aria-pressed',String(active.includes(feedback.markers[i]))))
  }
  for (const [button,direction] of [[previous,-1],[next,1]])
    listen(button,'click',() => { const m = adjacentMarker(feedback.markers,time,direction); if (m) update(m.start) })
  for (const m of feedback.markers) {
    const b = el('button',`${decimaler(m.start)} s: ${m.text}`)
    listen(b,'click',() => update(m.start)); buttons.push(b); list.append(b)
  }
  for (const b of [previous,next,...buttons]) { b.type = 'button'; Object.assign(b.style,{minHeight:'44px',whiteSpace:'normal',overflowWrap:'anywhere'}) }
  listen(slider,'input',() => update(Number(slider.value)))
  section.append(title,help,frame,label,status,comments,previous,next,list)
  root.replaceChildren(section); update(time)
  return () => { for (const [n,event,fn] of listeners) n.removeEventListener(event,fn); root.replaceChildren() }
}
