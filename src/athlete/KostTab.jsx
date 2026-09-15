// Kost-fanen (kostlog, søgning, skabeloner, TDEE-estimat) — udskilt fra
// AthleteView.jsx (ordre 232 · commit 3) som sin egen lazy-loadede chunk,
// samme LazyBoundary-mønster som Dashboard.jsx's fire faner (130/163/228)
// og src/athlete/MobiliseringTab.jsx + StaevnedagTab.jsx (232 · commit 2).
// Ren udflytning af JSX'en — ingen logikændring, kun frie variable gjort
// eksplicitte som props. Skrivefunktionerne (quickLogFood, deleteLog, ...)
// bliver i AthleteView.jsx (verify:athlete-write-failures læser dem der).
import { Fragment } from 'react'
import { dateLabel, s, shiftDate, today, unitsForFood } from '../athleteShared'

export default function KostTab({
  addFromSearch, amount, athlete, cKcal, cLen, circ, copyYesterday, createFood,
  deleteLog, deleteTemplate, editGrams, editMacros, editingLogId, fKcal, fLen,
  frequentFoods, kostDate, logTemplate, logs, macroTotal, mealTemplates,
  onSearchInput, pKcal, pLen, parseLoggedGrams, progressBars, quickAddSearchFood,
  quickLogFood, saveCustomFood, saveEditLog, saveTemplate, searchQuery,
  searchResults, selectFood, selectedFood, setAmount, setCreateFood, setEditGrams,
  setEditMacros, setEditingLogId, setKostDate, setSearchQuery, setSelectedFood,
  setShareFood, setShowCreateFood, setShowSaveTemplate, setShowTdee,
  setShowTemplates, setTemplateNameInput, setUnitIdx, shareFood, showCreateFood,
  showSaveTemplate, showTdee, showTemplates, startEditLog, tdeeEstimate,
  templateNameInput, totCarb, totFat, totKcal, totProtein, unitIdx,
}) {
return (
<>
  <div style={{ marginBottom: '1rem' }}>
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Kost</div>
    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Kostlog.</h1>
  </div>

  {/* Dato-navigator */}
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '0.4rem 0.5rem' }}>
    <button onClick={() => setKostDate(d => shiftDate(d, -1))} style={{ ...s.btnGhost, fontSize: '0.7rem', padding: '0.35rem 0.8rem' }}>←</button>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8923a' }}>{dateLabel(kostDate)}</div>
      {kostDate !== today() && (
        <button onClick={() => setKostDate(today())} style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4844', cursor: 'pointer', padding: '0.1rem 0' }}>↺ tilbage til i dag</button>
      )}
    </div>
    <button
      onClick={() => kostDate < today() && setKostDate(d => shiftDate(d, 1))}
      disabled={kostDate >= today()}
      style={{ ...s.btnGhost, fontSize: '0.7rem', padding: '0.35rem 0.8rem', opacity: kostDate >= today() ? 0.25 : 1 }}
    >→</button>
  </div>

  {progressBars}

  {/* TDEE estimate — kompakt, foldes ud */}
  <div style={{ ...s.card, marginBottom: '1.5rem' }}>
    {!tdeeEstimate.ready ? (
      <>
        <div style={s.cardLabel}>Estimeret TDEE</div>
        <div style={{ fontSize: '0.82rem', color: '#4a4844' }}>
          {tdeeEstimate.missingWeight
            ? 'Vej dig mindst 2 gange med 7 dages mellemrum for at aktivere dette estimat.'
            : `Log kalorier i mindst ${tdeeEstimate.missingKcalDays} dage mere for at aktivere dette estimat.`}
        </div>
      </>
    ) : (
      <>
        <div onClick={() => setShowTdee(v => !v)} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', cursor: 'pointer' }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844' }}>Estimeret TDEE</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1 }}>{tdeeEstimate.tdee}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770' }}>kcal/dag</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: tdeeEstimate.confidence === 'høj' ? '#6cba6c' : tdeeEstimate.confidence === 'moderat' ? '#c8923a' : '#7a7770', border: `1px solid ${tdeeEstimate.confidence === 'høj' ? 'rgba(108,186,108,0.4)' : tdeeEstimate.confidence === 'moderat' ? 'rgba(200,146,58,0.4)' : 'rgba(122,119,112,0.3)'}`, padding: '0.15rem 0.4rem' }}>{tdeeEstimate.confidence}</span>
            <span style={{ color: '#4a4844', fontSize: '0.7rem' }}>{showTdee ? '⌃' : '⌄'}</span>
          </span>
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', lineHeight: 1.5, marginTop: '0.35rem' }}>
          Det din krop cirka bruger på en dag, regnet af dine egne vejninger og din kost.
        </div>
        {showTdee && (
          <div style={{ marginTop: '0.75rem' }}>
            {athlete.kcal_target && (() => {
              const diff = athlete.kcal_target - tdeeEstimate.tdee
              const absDiff = Math.abs(diff)
              if (absDiff < 100) return (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginBottom: '0.5rem' }}>
                  Dit mål matcher vedligeholdelse <span style={{ color: '#6cba6c' }}>≈</span>
                </div>
              )
              return (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginBottom: '0.5rem' }}>
                  Dit mål er <span style={{ color: diff > 0 ? '#6cba6c' : '#c8923a' }}>{diff > 0 ? '+' : ''}{diff} kcal</span> ift. vedligeholdelse — {diff > 0 ? 'overskud (bulk)' : 'underskud (cut)'}
                </div>
              )
            })()}
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.06em' }}>
              Baseret på {tdeeEstimate.kcalDays} dages kalorielogging · {tdeeEstimate.daySpan} dages vægtdata · gns. {tdeeEstimate.avgKcal} kcal/dag
            </div>
          </div>
        )}
      </>
    )}
  </div>

  {/* Search */}
  <div style={s.card}>
    <div style={s.cardLabel}>Tilføj fødevare</div>

    {frequentFoods.length > 0 && (
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.4rem' }}>Ofte brugt — tryk for at logge</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {frequentFoods.map((f, i) => (
            <button
              key={i}
              onClick={() => quickLogFood(f)}
              title={`${f.meal} · ${f.kcal} kcal · P ${f.protein}g`}
              style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', maxWidth: '100%' }}
            >
              <span style={{ color: '#c8923a' }}>+</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', color: '#b8b4a8' }}>{f.meal}</span>
              <span style={{ color: '#4a4844' }}>{f.kcal}kcal</span>
            </button>
          ))}
        </div>
      </div>
    )}

    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
      <button
        style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.4rem 0.75rem', flex: 1 }}
        onClick={copyYesterday}
      >Kopier i går</button>
      <button
        style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.4rem 0.75rem', flex: 1, color: showTemplates ? '#c8923a' : '#7a7770', borderColor: showTemplates ? 'rgba(200,146,58,0.4)' : undefined }}
        onClick={() => setShowTemplates(!showTemplates)}
      >Skabeloner{mealTemplates.length > 0 ? ` (${mealTemplates.length})` : ''}</button>
    </div>

    {showTemplates && (
      <div style={{ marginBottom: '0.75rem', background: '#141410', border: '1px solid rgba(237,234,226,0.07)' }}>
        {mealTemplates.length === 0 ? (
          <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#4a4844' }}>Ingen skabeloner endnu — log et måltid og gem det nedenfor.</div>
        ) : (
          mealTemplates.map(t => (
            <div key={t.id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.88rem', color: '#edeae2', marginBottom: '0.2rem' }}>{t.name}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>
                  {t.items.length} madvarer · {t.items.reduce((a, i) => a + (i.kcal || 0), 0)} kcal
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button style={{ ...s.btnPrimary, padding: '0.4rem 0.75rem', fontSize: '0.52rem' }} onClick={() => logTemplate(t)}>Log alt</button>
                <button onClick={() => deleteTemplate(t.id)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: '0.4rem' }}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>
    )}

    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
      <input
        style={s.fieldInput}
        type="text"
        placeholder="Søg... (kylling, havregryn, pasta...)"
        value={searchQuery}
        onChange={onSearchInput}
        autoComplete="off"
      />
    </div>

    {searchResults.length > 0 && (
      <>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.35rem' }}>Tryk + for hurtig-log · tryk navnet for at vælge mængde</div>
      <div style={{ background: '#141410', border: '1px solid rgba(237,234,226,0.13)', marginBottom: '0.75rem', maxHeight: '240px', overflowY: 'auto' }}>
        {searchResults.map((f, i) => (
          <div
            key={i}
            onClick={() => selectFood(f)}
            style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,146,58,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.88rem', color: '#edeae2' }}>{f.name}</span>
              {f.isCustom && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8923a', border: '1px solid rgba(200,146,58,0.4)', padding: '0.1rem 0.3rem' }}>din</span>}
              {f.isShared && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6cba6c', border: '1px solid rgba(108,186,108,0.4)', padding: '0.1rem 0.3rem' }}>delt</span>}
              {(f.isCustom || f.isShared) && f.unit_label && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#7a7770' }}>1 {f.unit_label} = {f.unit_grams}g</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0, marginLeft: '1rem' }}>
              {(() => {
                const u = unitsForFood(f).find(x => x.label !== 'g')
                return (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#7a7770', textAlign: 'right' }}>
                    {u ? (
                      <>
                        {Math.round(f.kcal100 * u.grams / 100)} kcal · P: {Math.round(f.protein100 * u.grams / 100)}g<br />
                        <span style={{ color: '#4a4844' }}>pr. {u.label} ({u.grams}g)</span>
                      </>
                    ) : (
                      <>
                        {f.kcal100} kcal · P: {f.protein100}g · K: {f.carb100}g<br />
                        <span style={{ color: '#4a4844' }}>pr. 100g</span>
                      </>
                    )}
                  </div>
                )
              })()}
              <button
                onClick={e => { e.stopPropagation(); quickAddSearchFood(f) }}
                title="Hurtig-tilføj 1 portion — tryk navnet for at vælge mængde"
                style={{ flexShrink: 0, width: '44px', height: '44px', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', borderRadius: '50%', border: '1px solid rgba(200,146,58,0.5)', background: 'rgba(200,146,58,0.1)', color: '#c8923a', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >+</button>
            </div>
          </div>
        ))}
      </div>
      </>
    )}

    {selectedFood && (() => {
      const units = unitsForFood(selectedFood)
      const unit = units[unitIdx] || units[0]
      const amt = parseFloat(amount) || 0
      const grams = amt * unit.grams
      const ratio = grams / 100
      const quickAmounts = unit.label === 'g' ? [50, 100, 150, 200, 250] : [1, 2, 3, 4]
      return (
      <div style={{ background: 'rgba(200,146,58,0.06)', border: '1px solid rgba(200,146,58,0.2)', padding: '1rem', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.88rem', color: '#edeae2', marginBottom: '0.4rem' }}>{selectedFood.name}</div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginBottom: '0.75rem' }}>
          {Math.round(selectedFood.kcal100 * ratio)} kcal · P: {Math.round(selectedFood.protein100 * ratio)}g · K: {Math.round(selectedFood.carb100 * ratio)}g · F: {Math.round(selectedFood.fat100 * ratio)}g
          {unit.label !== 'g' && <span style={{ color: '#4a4844' }}> · {Math.round(grams)} g</span>}
        </div>

        {/* Enhedsvælger — kun vist når fødevaren har mere end gram */}
        {units.length > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
            {units.map((u, ui) => (
              <button
                key={ui}
                onClick={() => { setUnitIdx(ui); setAmount(u.label === 'g' ? '100' : '1') }}
                style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.3rem 0.7rem', color: ui === unitIdx ? '#c8923a' : '#7a7770', borderColor: ui === unitIdx ? 'rgba(200,146,58,0.5)' : undefined }}
              >{u.label === 'g' ? 'Gram' : u.label}</button>
            ))}
          </div>
        )}

        {/* Hurtig-mængder */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.6rem' }}>
          {quickAmounts.map(q => (
            <button
              key={q}
              onClick={() => setAmount(String(q))}
              style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.3rem 0.6rem', color: amt === q ? '#c8923a' : '#7a7770', borderColor: amt === q ? 'rgba(200,146,58,0.5)' : undefined }}
            >{q}{unit.label === 'g' ? 'g' : ` ${unit.label}`}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div>
            <div style={s.fieldLabel}>Mængde ({unit.label})</div>
            <input style={{ ...s.fieldInput, maxWidth: '100px' }} type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <button style={s.btnPrimary} onClick={addFromSearch}>Tilføj</button>
          <button style={s.btnGhost} onClick={() => { setSelectedFood(null); setSearchQuery('') }}>Annuller</button>
        </div>
      </div>
      )
    })()}

    <button
      style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: showCreateFood ? '#c8923a' : '#7a7770', cursor: 'pointer', padding: 0 }}
      onClick={() => setShowCreateFood(!showCreateFood)}
    >
      {showCreateFood ? '− Skjul' : '+ Opret ny fødevare'}
    </button>

    {showCreateFood && (
      <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#141410', border: '1px solid rgba(200,146,58,0.2)' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.75rem' }}>
          Makroer pr. 100g — gemmes til din personlige liste
        </div>
        <div style={{ marginBottom: '0.6rem' }}>
          <div style={s.fieldLabel}>Navn</div>
          <input style={s.fieldInput} type="text" placeholder="Fx hjemmelavet lasagne" value={createFood.name} onChange={e => setCreateFood(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
          {[['Kcal', 'kcal100'], ['Protein (g)', 'protein100'], ['Kulhydrat (g)', 'carb100'], ['Fedt (g)', 'fat100']].map(([label, key]) => (
            <div key={key}>
              <div style={s.fieldLabel}>{label}</div>
              <input style={s.fieldInput} type="number" inputMode="decimal" placeholder="0" value={createFood[key]} onChange={e => setCreateFood(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>
          Valgfri enhed — gør det muligt at logge i stk/portion i stedet for gram
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={s.fieldLabel}>Enhed (navn)</div>
            <input style={s.fieldInput} type="text" placeholder="fx stk, portion, skive" value={createFood.unit_label} onChange={e => setCreateFood(p => ({ ...p, unit_label: e.target.value }))} />
          </div>
          <div>
            <div style={s.fieldLabel}>Gram pr. enhed</div>
            <input style={s.fieldInput} type="number" inputMode="decimal" placeholder="fx 150" value={createFood.unit_grams} onChange={e => setCreateFood(p => ({ ...p, unit_grams: e.target.value }))} />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={shareFood} onChange={e => setShareFood(e.target.checked)} style={{ accentColor: '#c8923a', width: '16px', height: '16px' }} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#b8b4a8' }}>Del med alle atleter (fælles bibliotek)</span>
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={s.btnPrimary} onClick={saveCustomFood}>Gem og log</button>
          <button style={s.btnGhost} onClick={() => { setShowCreateFood(false); setCreateFood({ name: '', kcal100: '', protein100: '', carb100: '', fat100: '', unit_label: '', unit_grams: '' }) }}>Annuller</button>
        </div>
      </div>
    )}

  </div>

  {/* Meal log */}
  <div style={s.card}>
    <div style={s.cardLabel}>{kostDate === today() ? 'Dagens måltider' : `Måltider — ${dateLabel(kostDate)}`}</div>

    {logs.length === 0 ? (
      <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen måltider logget endnu i dag.</div>
    ) : (
      <>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844' }}>
              <th style={{ textAlign: 'left', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Måltid</th>
              <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Kcal</th>
              <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Protein</th>
              <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Kulh.</th>
              <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Fedt</th>
              <th style={{ borderBottom: '1px solid rgba(237,234,226,0.07)', width: '24px' }}></th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => {
              const editing = editingLogId === l.id
              const parsed = parseLoggedGrams(l.meal)
              return (
              <Fragment key={l.id}>
              <tr style={{ fontSize: '0.85rem', opacity: editing ? 0.5 : 1 }}>
                <td style={{ padding: '0.45rem 0', color: '#b8b4a8' }}>{l.meal}</td>
                <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>{l.kcal}</td>
                <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.protein}g</td>
                <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.carb}g</td>
                <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.fat}g</td>
                <td style={{ textAlign: 'right', padding: '0.45rem 0', whiteSpace: 'nowrap' }}>
                  <button onClick={() => editing ? setEditingLogId(null) : startEditLog(l)} title="Rediger" style={{ background: 'none', border: 'none', color: editing ? '#c8923a' : '#4a4844', cursor: 'pointer', fontSize: '0.7rem', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✎</button>
                  <button onClick={() => deleteLog(l)} title="Slet" style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', minWidth: '44px', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </td>
              </tr>
              {editing && (
                <tr>
                  <td colSpan={6} style={{ padding: '0.5rem 0 0.75rem' }}>
                    <div style={{ background: '#141410', border: '1px solid rgba(200,146,58,0.2)', padding: '0.75rem', display: 'flex', alignItems: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {parsed ? (
                        <div>
                          <div style={s.fieldLabel}>Ny mængde (g)</div>
                          <input style={{ ...s.fieldInput, maxWidth: '100px' }} type="number" inputMode="decimal" autoFocus value={editGrams} onChange={e => setEditGrams(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditLog(l)} />
                        </div>
                      ) : (
                        [['Kcal', 'kcal'], ['Protein', 'protein'], ['Kulh.', 'carb'], ['Fedt', 'fat']].map(([label, key]) => (
                          <div key={key}>
                            <div style={s.fieldLabel}>{label}</div>
                            <input style={{ ...s.fieldInput, maxWidth: '70px' }} type="number" inputMode="decimal" value={editMacros[key]} onChange={e => setEditMacros(p => ({ ...p, [key]: e.target.value }))} />
                          </div>
                        ))
                      )}
                      <button style={s.btnPrimary} onClick={() => saveEditLog(l)}>Gem</button>
                      <button style={s.btnGhost} onClick={() => setEditingLogId(null)}>Annuller</button>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
              )
            })}
            <tr style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
              <td style={{ padding: '0.5rem 0', color: '#7a7770', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</td>
              <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#c8923a' }}>{totKcal}</td>
              <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#7a7770' }}>{totProtein}g</td>
              <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#7a7770' }}>{totCarb}g</td>
              <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#7a7770' }}>{totFat}g</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginBottom: '0.75rem' }}>
          <button
            style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: showSaveTemplate ? '#c8923a' : '#7a7770', cursor: 'pointer', padding: 0 }}
            onClick={() => setShowSaveTemplate(!showSaveTemplate)}
          >{showSaveTemplate ? '− Skjul' : '+ Gem som skabelon'}</button>
          {showSaveTemplate && (
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                style={{ ...s.fieldInput, flex: 1 }}
                type="text"
                placeholder="Fx Morgenmad, Pre-workout..."
                value={templateNameInput}
                onChange={e => setTemplateNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveTemplate()}
              />
              <button style={{ ...s.btnPrimary, padding: '0.55rem 0.75rem', fontSize: '0.55rem', flexShrink: 0 }} onClick={saveTemplate}>Gem</button>
            </div>
          )}
        </div>

        {totKcal > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', paddingTop: '1rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width="100" height="100" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="48" fill="none" stroke="#242420" strokeWidth="14" />
                <circle cx="60" cy="60" r="48" fill="none" stroke="#6cba6c" strokeWidth="14"
                  strokeDasharray={`${pLen} ${circ - pLen}`} strokeDashoffset="0"
                  transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.5s' }} />
                <circle cx="60" cy="60" r="48" fill="none" stroke="#c8923a" strokeWidth="14"
                  strokeDasharray={`${cLen} ${circ - cLen}`} strokeDashoffset={-pLen}
                  transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.5s' }} />
                <circle cx="60" cy="60" r="48" fill="none" stroke="#7a7770" strokeWidth="14"
                  strokeDasharray={`${fLen} ${circ - fLen}`} strokeDashoffset={-(pLen + cLen)}
                  transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.5s' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2', lineHeight: 1 }}>{totKcal}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.15rem' }}>kcal</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
              {[
                { label: 'Protein', val: totProtein, unit: 'g', pct: Math.round(pKcal / macroTotal * 100), color: '#6cba6c' },
                { label: 'Kulhydrat', val: totCarb, unit: 'g', pct: Math.round(cKcal / macroTotal * 100), color: '#c8923a' },
                { label: 'Fedt', val: totFat, unit: 'g', pct: Math.round(fKcal / macroTotal * 100), color: '#7a7770' },
              ].map(({ label, val, unit, pct, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', flex: 1 }}>{label}</div>
                  <div style={{ fontSize: '0.85rem', color: '#edeae2' }}>{val}<span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, color: '#7a7770' }}>{unit}</span></div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#4a4844', minWidth: '30px', textAlign: 'right' }}>{pct}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )}
  </div>
</>
)
}
