import { kostmaalTekst } from './samletAtletprofil.js'

export default function KostmaalResume({ a, onOpen }) {
  const text = kostmaalTekst(a)
  if (!text) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem 0.75rem', fontSize: '0.8rem', color: '#b8b4a8' }}>
      <span>Kostmål · {text}</span>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', color: '#c8923a', cursor: 'pointer', font: 'inherit', minHeight: 44, padding: '0 0.25rem' }}>Se mål</button>
    </div>
  )
}
