// ORDRE 439 · blok 2 — "din uge": vises på forsiden, når ugens sidste pas er
// klaret (tallene regnes i dinUge.js). Én linje til coachen, hvis atleten vil;
// den sendes som en almindelig besked (sendUgeLinje), og coachen ser intet
// andet nyt.
import { useState } from 'react'
import { s } from '../athleteShared'
import { tonnageTekst, erUgeLinjeSendt, markerUgeLinjeSendt } from './dinUge'

const mono = "'IBM Plex Mono', monospace"
const kg = (n) => String(n).replace('.', ',')

function Tal({ label, vaerdi, enhed }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.45rem', color: '#edeae2', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
        {vaerdi}{enhed && <span style={{ fontFamily: mono, fontSize: '0.56rem', color: '#7a7770', marginLeft: '0.2rem' }}>{enhed}</span>}
      </div>
      <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginTop: '0.3rem' }}>{label}</div>
    </div>
  )
}

function DinUgeKort({ uge, athleteId, weekId, sendUgeLinje }) {
  const [tekst, setTekst] = useState('')
  const [sender, setSender] = useState(false)
  const [sendt, setSendt] = useState(() => erUgeLinjeSendt(athleteId, weekId))
  if (!uge) return null

  async function send() {
    if (!tekst.trim() || sender) return
    setSender(true)
    const ok = await sendUgeLinje(uge.ugeNr, tekst)
    setSender(false)
    if (ok) { markerUgeLinjeSendt(athleteId, weekId); setSendt(true); setTekst('') }
  }

  const rekorder = uge.rekorder
  return (
    <div data-din-uge={uge.ugeNr ?? ''} style={{ ...s.card, textAlign: 'left' }}>
      <div style={s.cardLabel}>Din uge</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1.2, marginBottom: '1rem' }}>
        {uge.ugeNr != null ? `Uge ${uge.ugeNr} er klaret.` : 'Ugen er klaret.'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
        <Tal label="Pas" vaerdi={`${uge.pasKlaret}/${uge.pasIalt}`} />
        <Tal label="Tonnage" vaerdi={tonnageTekst(uge.tonnage).replace(/ kg$/, '')} enhed="kg" />
        <Tal label="Rekorder" vaerdi={rekorder ? String(rekorder.length) : '–'} />
      </div>

      {rekorder && rekorder.length > 0 && (
        <div data-din-uge-rekorder={rekorder.length} style={{ marginBottom: '1rem' }}>
          {rekorder.map((r, i) => (
            <div key={`${r.noegle}-${i}`} style={{ fontSize: '0.85rem', color: '#edeae2', padding: '0.25rem 0' }}>
              <span aria-hidden="true" style={{ color: '#c8923a' }}>🏆 </span>
              {r.type === 'e1rm'
                ? <>{r.navn} e1RM {r.e1rm} kg <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#7a7770' }}>+{r.plus} kg</span></>
                : <>{r.navn} {kg(r.weight)} kg × {r.reps} <span style={{ fontFamily: mono, fontSize: '0.62rem', color: '#7a7770' }}>+{r.plus} {r.plus === 1 ? 'rep' : 'reps'}</span></>}
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ fontFamily: mono, fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.4rem' }}>Dine vurderinger</div>
        {uge.vurderinger.map(v => (
          <div key={v.id} data-vurdering={v.rating ?? ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', padding: '0.2rem 0' }}>
            <span style={{ fontSize: '0.82rem', color: '#b8b4a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.titel}</span>
            <span style={{ fontFamily: mono, fontSize: '0.72rem', color: v.rating ? '#edeae2' : '#4a4844', flexShrink: 0 }}>{v.rating ? `${v.rating}/5` : '–'}</span>
          </div>
        ))}
      </div>

      {!sendUgeLinje ? null : sendt ? (
        <div data-din-uge-sendt="" style={{ fontFamily: mono, fontSize: '0.6rem', letterSpacing: '0.04em', color: '#7a7770' }}>
          Sendt til din coach. Svaret kommer under Beskeder.
        </div>
      ) : (
        <div>
          <label htmlFor="din-uge-linje" style={{ display: 'block', fontFamily: mono, fontSize: '0.56rem', letterSpacing: '0.04em', color: '#b8b4a8', marginBottom: '0.4rem' }}>
            Vil du skrive noget til din coach om ugen?
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="din-uge-linje"
              value={tekst}
              onChange={e => setTekst(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              placeholder="Én linje, hvis du vil"
              maxLength={500}
              style={{ ...s.fieldInput, flex: 1, minWidth: 0, minHeight: '44px', boxSizing: 'border-box', fontSize: '16px' }}
            />
            <button
              type="button"
              onClick={send}
              disabled={!tekst.trim() || sender}
              style={{ ...s.btnPrimary, minHeight: '44px', flexShrink: 0, opacity: !tekst.trim() || sender ? 0.5 : 1 }}
            >{sender ? '…' : 'Send'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DinUgeKort
