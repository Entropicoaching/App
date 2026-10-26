import { useEffect, useState } from 'react'
import { dateLabel, today, unitsForFood } from '../athleteShared'
import { finiteTotal, nutritionValues, parseInputNumber } from './kostNumbers.mjs'
import './kostIDag.css'

const number = value => value.toLocaleString('da-DK', { maximumFractionDigits: 1 })

export default function KostIDag({
  athlete, kostDate, setKostDate, kostLogState, fetchLogs, fetchHistoricalMealLogs,
  searchQuery, onSearchInput, searchResults, selectedFood, selectFood,
  amount, setAmount, unitIdx, setUnitIdx, addFromSearch, renderDetails,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const date = today()
  useEffect(() => {
    if (!detailsOpen && kostDate !== date) setKostDate(date)
  }, [detailsOpen, kostDate, date, setKostDate])

  if (detailsOpen) return <div className="kost-i-dag">
    <button type="button" className="kost-secondary" onClick={() => {
      setKostDate(today())
      setDetailsOpen(false)
    }}>← Tilbage til i dag</button>
    {renderDetails()}
  </div>

  const sameDay = kostDate === date && kostLogState?.date === date && kostLogState?.athleteId === athlete.id
  const ready = sameDay && !kostLogState.loading && !kostLogState.error
  const failed = sameDay && kostLogState.error
  const logs = ready ? kostLogState.logs : []
  const units = selectedFood ? unitsForFood(selectedFood) : []
  const unit = units[unitIdx] || units[0]
  const parsedAmount = parseInputNumber(amount)
  const nutrients = selectedFood && parsedAmount > 0
    ? nutritionValues(Object.fromEntries(['kcal', 'protein', 'carb', 'fat'].map(key => [key, selectedFood[key + '100']])), parsedAmount * unit.grams / 100)
    : null

  return <div className="kost-i-dag">
    <header>
      <div className="kost-eyebrow">Kost · {dateLabel(date)}</div>
      <h1>Kost i dag</h1>
    </header>

    <section className="kost-card" aria-labelledby="kost-dagens-tal">
      <h2 id="kost-dagens-tal">Dagens mål og logning</h2>
      <div className="kost-goals">
        {[
          ['kcal', 'Kalorier', 'kcal', athlete.kcal_target],
          ['protein', 'Protein', 'g', athlete.protein_target],
        ].map(([key, label, suffix, target]) => {
          const goal = parseInputNumber(target)
          return <div key={key}>
            <h3>{label}</h3>
            <p className="kost-total">{ready ? number(finiteTotal(logs, key)) : 'Afventer'} <span>{suffix} logget</span></p>
            <p className="kost-muted">{goal > 0 ? `Mål: ${number(goal)} ${suffix}` : 'Mål ikke angivet'}</p>
          </div>
        })}
      </div>
      {!ready && <p role="status">{failed ? 'Dagens kostlog kunne ikke hentes.' : 'Henter dagens kostlog…'}</p>}
      {failed && <button type="button" className="kost-secondary" onClick={() => fetchLogs(athlete.id, date)}>Prøv igen</button>}
      {ready && <p className="kost-muted">Kulhydrat: {number(finiteTotal(logs, 'carb'))} g · Fedt: {number(finiteTotal(logs, 'fat'))} g</p>}
    </section>

    <section className="kost-card" aria-labelledby="kost-log-mad">
      <h2 id="kost-log-mad">Log mad</h2>
      <label htmlFor="kost-soeg">Søg efter en fødevare</label>
      <input id="kost-soeg" type="search" placeholder="Fx havregryn eller kylling" value={searchQuery}
        onChange={onSearchInput} autoComplete="off" disabled={saving} />
      {searchResults.length > 0 && <ul className="kost-results" aria-label="Fødevarer">
        {searchResults.map((food, index) => <li key={index}>
          <button type="button" onClick={() => selectFood(food)}>
            <span>{food.name}</span><span className="kost-muted">{food.kcal100} kcal pr. 100 g</span>
          </button>
        </li>)}
      </ul>}
      {!selectedFood && searchQuery.trim().length >= 2 && searchResults.length === 0 && <p>Ingen fødevarer fundet. Du kan oprette en under historik og detaljer.</p>}
      {selectedFood && <form onSubmit={async event => {
        event.preventDefault()
        if (!ready || saving || !nutrients) return
        setSaving(true)
        try { await addFromSearch() } finally { setSaving(false) }
      }}>
        <div className="kost-portion">
          <div>
            <label htmlFor="kost-maengde">Mængde</label>
            <input id="kost-maengde" type="text" inputMode="decimal" value={amount} disabled={saving}
              onChange={event => setAmount(event.target.value)} aria-invalid={!nutrients} />
          </div>
          <div>
            <label htmlFor="kost-enhed">Enhed</label>
            <select id="kost-enhed" value={unitIdx} disabled={saving} onChange={event => {
              const index = Number(event.target.value)
              setUnitIdx(index)
              setAmount(units[index].label === 'g' ? '100' : '1')
            }}>{units.map((item, index) => <option key={index} value={index}>{item.label === 'g' ? 'Gram' : item.label}</option>)}</select>
          </div>
        </div>
        <p aria-live="polite" className="kost-muted">{nutrients
          ? `${number(nutrients.kcal)} kcal · ${number(nutrients.protein)} g protein`
          : 'Skriv en gyldig mængde større end 0.'}</p>
        <button type="submit" className="kost-primary" disabled={!ready || saving || !nutrients}>
          {saving ? 'Logger…' : 'Log mad'}
        </button>
      </form>}
    </section>

    <section className="kost-card" aria-labelledby="kost-logget">
      <h2 id="kost-logget">Logget i dag</h2>
      {ready && (logs.length ? <ul className="kost-meals">
        {logs.map(log => <li key={log.id}><span>{log.meal}</span><span className="kost-muted">{number(parseInputNumber(log.kcal) ?? 0)} kcal · {number(parseInputNumber(log.protein) ?? 0)} g protein</span></li>)}
      </ul> : <p className="kost-muted">Ingen mad logget i dag endnu.</p>)}
      {!ready && <p className="kost-muted">{failed ? 'Logningen er ikke tilgængelig.' : 'Henter logning…'}</p>}
    </section>

    <button type="button" className="kost-secondary" onClick={() => {
      setDetailsOpen(true)
      fetchHistoricalMealLogs(athlete.id)
    }}>Historik og detaljer</button>
  </div>
}
