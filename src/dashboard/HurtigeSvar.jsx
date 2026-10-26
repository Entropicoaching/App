import { s } from '../dashboardShared'
import { insertCoachTemplate } from './coachSvar.js'

export default function HurtigeSvar({ coachSvar, messageInput, setMessageInput, setMessageSendError, sendingMessage }) {
  if (!coachSvar.enabled) return null
  return (
    <section aria-label="Hurtige svar" style={{ marginBottom: '0.75rem' }}>
      <div style={s.cardLabel}>Hurtige svar</div>
      <p style={{ color: '#7a7770', fontSize: '0.75rem' }}>Indsæt et svar og ret teksten før Send. Dine svar gemmes på denne enhed.</p>
      {coachSvar.templates.map(text => (
        <div key={text} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <button type="button" disabled={sendingMessage} onClick={() => {
            setMessageInput(current => insertCoachTemplate(current, text))
            setMessageSendError(null)
          }} style={{ ...s.btnGhost, minHeight: 44, flex: 1, minWidth: 0, textAlign: 'left', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', textTransform: 'none', fontFamily: 'inherit', fontSize: '0.85rem', letterSpacing: 0, lineHeight: 1.5 }}>{text}</button>
          <button type="button" disabled={sendingMessage} aria-label={`Slet hurtigt svar: ${text}`} onClick={() => coachSvar.removeTemplate(text)} style={{ ...s.btnGhost, minHeight: 44, fontSize: '0.65rem' }}>Slet</button>
        </div>
      ))}
      <button type="button" disabled={sendingMessage || !messageInput.trim()} onClick={() => coachSvar.addTemplate(messageInput)} style={{ ...s.btnGhost, minHeight: 44, fontSize: '0.65rem', marginTop: '0.3rem' }}>Gem som hurtigt svar</button>
    </section>
  )
}
