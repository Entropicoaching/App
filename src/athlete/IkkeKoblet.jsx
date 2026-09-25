// Skaermen for en konto der endnu ikke er koblet til en atletprofil — flyttet
// uaendret ud af AthleteView.jsx (ordre 373). Betingelsen staar i AthleteView.
import { signOutHard } from '../supabase'
import { s } from '../athleteShared'

function IkkeKoblet({
  backBtn, session,
}) {
    // Første skærm en atlet møder hvis mailen ikke matcher en profil. Rolig,
    // menneskelig, handlingsanvisende — ingen teknisk fejltekst.
    const stuckEmail = session?.user?.email || ''
    const coachMail = `mailto:coach@entropicoaching.dk?subject=${encodeURIComponent('Kobl min konto til min atletprofil')}&body=${encodeURIComponent(`Hej coach\n\nJeg er logget ind i Entropi som ${stuckEmail || '(min mail)'}, men min konto er ikke koblet til min atletprofil endnu. Kan du koble mig til?\n\nTak!`)}`
    return (
      <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ maxWidth: 430, width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.9rem' }}>Entropi Coaching</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.9rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.15, marginBottom: '1rem' }}>Næsten klar.</h1>
          <p style={{ color: '#b8b4a8', fontSize: '0.92rem', lineHeight: 1.65, marginBottom: '1.35rem' }}>
            Din konto er endnu ikke koblet til en atletprofil. Det sker automatisk, når du logger ind med den mail, du fik invitationen på.
          </p>
          <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.1)', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1.35rem' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.35rem' }}>Du er logget ind som</div>
            <div style={{ color: '#edeae2', fontSize: '0.9rem', wordBreak: 'break-all' }}>{stuckEmail || '—'}</div>
          </div>
          <p style={{ color: '#7a7770', fontSize: '0.8rem', lineHeight: 1.65, marginBottom: '1.6rem' }}>
            Brugte du en anden mail end den fra invitationen? Log ud og prøv igen. Er du i tvivl, så skriv til din coach — så kobler han dig til.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <a href={coachMail} style={{ ...s.btnPrimary, textDecoration: 'none', display: 'block', padding: '0.85rem 1rem' }}>Skriv til din coach</a>
            {backBtn || <button style={s.btnGhost} onClick={() => signOutHard()}>Log ud og skift mail</button>}
          </div>
        </div>
      </div>
    )
}

export default IkkeKoblet
