import { useRef, useState } from 'react'
import { indlaesAnalysePakke } from './analysePakke'

const talTekst = (v, decimaler) => v === null ? '-' : v.toLocaleString('da-DK', { minimumFractionDigits: decimaler, maximumFractionDigits: decimaler })
const liftTekst = { squat: 'Squat', baenk: 'Bænkpres', doedloeft: 'Dødløft' }
const sikkerhedTekst = { lav: 'Lav', middel: 'Middel', hoej: 'Høj' }
const celle = { padding: '0.45rem 0.35rem', textAlign: 'right', borderBottom: '1px solid rgba(237,234,226,0.08)' }

// Keyed by the saved analysis in VideoReviewModal. Closing/switching drops local data.
export default function AnalysePakkeReview() {
  const [pakke, setPakke] = useState(null)
  const [fejl, setFejl] = useState('')
  const [laeser, setLaeser] = useState(false)
  const [atlet, setAtlet] = useState('')
  const [kg, setKg] = useState('')
  const filInput = useRef(null)
  const sekvens = useRef(0)
  async function indlaes(event) {
    const fil = event.target.files?.[0]
    event.target.value = ''
    if (!fil) return
    const id = ++sekvens.current
    setPakke(null)
    setAtlet('')
    setKg('')
    setFejl('')
    setLaeser(true)
    try {
      const ny = await indlaesAnalysePakke(fil)
      if (id === sekvens.current) setPakke(ny)
    } catch (e) {
      if (id === sekvens.current) setFejl(e.message)
    } finally {
      if (id === sekvens.current) setLaeser(false)
    }
  }
  function fjern() {
    sekvens.current++
    setPakke(null)
    setFejl('')
    setLaeser(false)
    setAtlet('')
    setKg('')
  }
  return (
    <section aria-label="Lokal analyse-pakke" style={{ marginTop: '0.9rem', border: '1px solid rgba(200,146,58,0.2)', background: 'rgba(200,146,58,0.035)', padding: '0.8rem', color: '#b8b4a8', fontSize: '0.75rem', lineHeight: 1.5, overflowWrap: 'anywhere', textAlign: 'left' }}>
      <h3 style={{ color: '#edeae2', fontSize: '0.95rem', margin: '0 0 0.4rem' }}>Fart og tab</h3>
      <p style={{ margin: '0 0 0.6rem' }}>Kun lokalt i dette review. Analyse, atlet og kg gemmes eller sendes ikke. Alt forsvinder, når du genindlæser siden, lukker eller skifter review.</p>
      <button type="button" onClick={() => filInput.current?.click()} style={{ minHeight: 44, background: '#141410', border: '1px solid #7a7770', color: '#edeae2', padding: '0.45rem 0.75rem' }}>Hent analyse</button>
      <div style={{ marginTop: '0.3rem' }}>Pakke-fil i JSON, højst 512 KB</div>
      <input ref={filInput} type="file" aria-label="Vælg pakke-fil" accept=".json,application/json" onChange={indlaes} hidden />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '0.6rem', marginTop: '0.65rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem' }}>Atlet (lokalt)
          <input type="text" autoComplete="off" value={atlet} onChange={e => setAtlet(e.target.value)} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: 44, background: '#141410', border: '1px solid #7a7770', color: '#edeae2', padding: '0.4rem' }} />
        </label>
        <label style={{ display: 'grid', gap: '0.25rem' }}>Kg (lokalt)
          <input type="number" step="any" autoComplete="off" value={kg} onChange={e => setKg(e.target.value)} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', minHeight: 44, background: '#141410', border: '1px solid #7a7770', color: '#edeae2', padding: '0.4rem' }} />
        </label>
      </div>
      <p style={{ margin: '0.4rem 0' }}>Skriv selv atlet og kg for pakken. Kontrollér, at den hører til sættet du reviewer.</p>
      {laeser && <p role="status">Læser pakken…</p>}
      {fejl && <p role="alert" style={{ color: '#d79a83' }}>Pakken blev ikke indlæst: {fejl}</p>}
      {(pakke || laeser || fejl) && <button type="button" onClick={fjern} style={{ marginTop: '0.6rem', minHeight: 36, background: '#141410', border: '1px solid #7a7770', color: '#edeae2', padding: '0.35rem 0.65rem' }}>Fjern lokal pakke</button>}
      {pakke && <>
        <p role="status">Pakke indlæst lokalt: {liftTekst[pakke.lift]} · {pakke.analyzed_at} · {pakke.reps_count} reps. Kontrollér selv, at pakken hører til dette sæt.</p>
        <p style={{ color: '#c9b47f' }}>{pakke.kvalitet.skala === 'raa-45cm-skive' ? 'Rå skala: 45 cm skive antaget, ingen parallakse. Sammenlign ikke m/s på tværs af klip.' : 'Skala fra afstand og skivediameter.'} {pakke.kvalitet.seed === 'automatisk' ? 'Automatisk seed, ikke kontrolleret.' : 'Seed valgt af et menneske.'}</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums', fontSize: '0.72rem' }}>
          <caption style={{ textAlign: 'left', color: '#edeae2', marginBottom: '0.3rem' }}>Stangens fart pr. rep · - betyder ikke målt</caption>
          <thead><tr>{['Rep', 'Middel m/s', 'Top m/s', 'Tab %'].map(x => <th key={x} scope="col" style={celle}>{x}</th>)}</tr></thead>
          <tbody>{pakke.reps.map((r, i) => <tr key={i}><th scope="row" style={celle}>{r.rep}</th><td style={celle}>{talTekst(r.meanMs, 3)}</td><td style={celle}>{talTekst(r.topMs, 3)}</td><td style={celle}>{talTekst(r.tabPct, 1)}</td></tr>)}</tbody>
        </table>
        {pakke.reps.length === 0 && <p>Ingen reps målt.</p>}
        {pakke.saet.map((s, i) => <p key={i} style={{ color: '#edeae2' }}>Sættab {i + 1} (reps {s.reps.join(', ') || '-'}): {talTekst(s.tabPct, 1)}{s.tabPct !== null ? ' %' : ''}</p>)}
        <h4 style={{ color: '#edeae2', marginBottom: '0.3rem' }}>Fund fra pakken · forslag</h4>
        {pakke.findings.length === 0 && <p>Ingen fund i pakken. Det betyder ikke, at teknikken er vurderet som god.</p>}
        {pakke.findings.map((f, i) => <div key={i} style={{ marginTop: '0.6rem', borderLeft: `2px solid ${f.confidence === 'lav' ? '#7a7770' : '#c8923a'}`, paddingLeft: '0.6rem', color: f.confidence === 'lav' ? '#9f9b91' : '#edeae2' }}>
          <div>Forslag · {sikkerhedTekst[f.confidence]} sikkerhed</div><div>{f.summary}</div>
        </div>)}
        <h4 style={{ color: '#edeae2', marginBottom: '0.3rem' }}>Ikke regnet</h4>
        {pakke.ikkeRegnet.length ? <ul style={{ paddingLeft: '1.2rem' }}>{pakke.ikkeRegnet.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>Ingen yderligere grænser angivet.</p>}
        <p>{pakke.forbehold}</p>
      </>}
    </section>
  )
}
