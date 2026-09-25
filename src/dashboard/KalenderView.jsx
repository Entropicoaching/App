// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Kalenderen: planoverblik, tidslinje, blok-bygger, kræver handling, board.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { buildPlanOverview, planOverviewCounts } from '../planOverview'
import { currentWeekNo, s, computePhases, blockColor } from '../dashboardShared'
import { holidayInfo } from './coachKonstanter'

export default function KalenderView({
  askConfirm, athleteCurrentWeek, athleteLastLogs, athletes, blockPlan, blockSequenceRows,
  calBlockAthlete, calendarWeeks, createCalendarWeek, generateWeeksFromPlan, hiddenAthleteIds, hoverCell,
  isMobile, openCalBlockBuilder, openPlanReview, openProfile, planStartDate, setBlockStartDate,
  setCalBlockAthlete, setHoverCell, setPlanStartDate, setTimelineEdit, showFlash, snoozeAthlete,
  snoozedAthletes, timelineEdit,
}) {
          const today0 = new Date(); today0.setHours(0, 0, 0, 0)
          const dayMs = 86400000
          const visibleAthletes = athletes.filter(a => !hiddenAthleteIds.has(a.id))
          const planEntries = buildPlanOverview({ athletes: visibleAthletes, calendarWeeks, today: today0 })
          const planCounts = planOverviewCounts(planEntries)
          const planningNeeds = planEntries.filter(entry => entry.status !== 'covered')
          const featuredPlanEntries = planningNeeds.slice(0, 3)
          const featuredPlanIds = new Set(featuredPlanEntries.map(entry => entry.athlete.id))
          const remainingPlanEntries = planEntries.filter(entry => !featuredPlanIds.has(entry.athlete.id))
          const planTone = {
            danger: { color: '#e99b86', border: 'rgba(224,85,85,0.3)', background: 'rgba(224,85,85,0.055)' },
            warning: { color: '#d7b16e', border: 'rgba(200,146,58,0.3)', background: 'rgba(200,146,58,0.05)' },
            ready: { color: '#8ebd8e', border: 'rgba(108,186,108,0.25)', background: 'rgba(108,186,108,0.045)' },
          }

          // Udled status pr. atlet ud fra HVOR DE ER NU (seneste loggede uge) og
          // hvor mange FYLDTE uger (med øvelser) der er tilbage fra og med den uge.
          // "Runway" tæller den nuværende uge MED — så en atlet hvis næste uge er
          // fyldt har runway >= 2 = Klar (i stedet for falsk "planlæg næste").
          const board = visibleAthletes.map(a => {
            const weeks = calendarWeeks[a.id] || []
            const planned = weeks.filter(w => w.exercise_count > 0)            // uger du har lagt øvelser i
            const maxPlannedWeekNo = planned.length ? Math.max(...planned.map(w => w.week_number)) : null
            const minPlannedWeekNo = planned.length ? Math.min(...planned.map(w => w.week_number)) : null
            const loggedWeek = athleteCurrentWeek[a.id] ?? null
            // Dato-bevidst "nu" (samme som tidslinjen): ugen hvis datospænd dækker i dag,
            // ellers seneste loggede uge, ellers første planlagte uge.
            const ref = currentWeekNo(weeks, loggedWeek) ?? minPlannedWeekNo   // hvor de er nu
            const runway = ref != null ? planned.filter(w => w.week_number >= ref).length : planned.length
            const lastLog = athleteLastLogs[a.id]
            const daysSince = lastLog ? Math.floor((today0 - new Date(lastLog + 'T12:00:00')) / dayMs) : null
            const holiday = holidayInfo(a)
            const returned = holiday && !holiday.onHoliday           // ferie slut → skal genaktiveres/planlægges
            let status // ready | lastweek | out | empty | none | ferie (samme rangering som forsidens computeBoard)
            if (holiday?.onHoliday) status = 'ferie'                 // på ferie → ingen handling
            else if (weeks.length === 0) status = 'none'
            else if (planned.length === 0) status = 'empty'          // uger findes, men ingen øvelser
            else if (runway <= 0) status = 'out'                     // forbi sidste planlagte uge = løbet tør
            else if (runway === 1) status = 'lastweek'               // sidste planlagte uge, dækket ugen ud
            else status = 'ready'
            const snoozedUntil = snoozedAthletes[a.id] || null
            const isSnoozed = snoozedUntil && new Date(snoozedUntil) > today0
            return { a, weeks, planned, loggedWeek, maxPlannedWeekNo, runway, daysSince, status, snoozedUntil, isSnoozed, returned }
          })
          const reasonText = (b) => b.returned ? 'Tilbage fra ferie — planlæg'
            : b.status === 'none' ? 'Intet program oprettet'
            : b.status === 'empty' ? 'Uger oprettet, men ingen øvelser'
            : b.status === 'out' ? 'Løbet tør — planlæg næste blok'
            : 'Sidste planlagte uge — planlæg i weekenden'
          // Rang (lavere = mere akut), matcher forsidens progReason: none>empty>(returned/out)>lastweek.
          const statusRank = (b) => b.status === 'none' ? 0 : b.status === 'empty' ? 1 : (b.returned || b.status === 'out') ? 2 : b.status === 'lastweek' ? 4 : 5
          // Kræver handling = ikke-klar (eller tilbage fra ferie), ikke på ferie. Rangeret mest akut øverst.
          const wouldNeed = (b) => b.status !== 'ferie' && (b.status !== 'ready' || b.returned)
          const needs = board.filter(b => wouldNeed(b) && !b.isSnoozed).sort((x, y) => statusRank(x) - statusRank(y))
          const snoozedNeeds = board.filter(b => wouldNeed(b) && b.isSnoozed)
          const lastText = (d) => d == null ? 'Ingen logs' : d === 0 ? 'I dag' : d === 1 ? 'I går' : `${d}d siden`
          const lastColor = (d) => d == null ? '#4a4844' : d <= 4 ? '#6cba6c' : d <= 8 ? '#c8923a' : '#e05555'
          const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

          return (
            <div style={{ ...s.page, ...(isMobile ? { padding: '1rem' } : {}) }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', margin: 0 }}>Overblik</h1>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.25rem' }}>
                  {board.length - needs.length} af {board.length} klar · har du husket at planlægge deres træning?
                </div>
              </div>

              {/* Planoverblik: forklarbare spørgsmål før den konkrete planlægningsflade. */}
              <div style={{ ...s.card, marginBottom: '1.5rem', borderColor: 'rgba(200,146,58,0.28)', background: 'linear-gradient(135deg, rgba(200,146,58,0.065), rgba(28,28,24,0.5))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                  <div style={{ ...s.cardLabel, color: '#c8923a', marginBottom: 0 }}>Planoverblik</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: planningNeeds.length ? '#c8923a' : '#6cba6c', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {planningNeeds.length ? `${planningNeeds.length} næste beslutning${planningNeeds.length === 1 ? '' : 'er'}` : 'Alle planer har luft'}
                  </div>
                </div>
                <div style={{ color: '#98948a', fontSize: '0.68rem', lineHeight: 1.45, marginBottom: featuredPlanEntries.length ? '0.75rem' : 0 }}>
                  Et sparringslag: det viser næste beslutningspunkt og begrundelsen — ikke en automatisk træningsforskrift.
                </div>

                {featuredPlanEntries.map(entry => {
                  const tone = planTone[entry.tone]
                  return (
                    <div key={entry.athlete.id} style={{ borderTop: '1px solid rgba(237,234,226,0.07)', padding: '0.7rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <button onClick={() => openProfile(entry.athlete, 'program')} style={{ background: 'none', border: 0, padding: 0, color: '#edeae2', cursor: 'pointer', fontSize: '0.86rem', textAlign: 'left' }}>{entry.athlete.name}</button>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.04em', color: tone.color, border: `1px solid ${tone.border}`, background: tone.background, padding: '0.16rem 0.32rem' }}>{entry.headline}</span>
                        </div>
                        <div style={{ marginTop: '0.25rem', fontSize: '0.65rem', color: '#7a7770', lineHeight: 1.4 }}>{entry.sparring}</div>
                      </div>
                      <button style={{ ...s.btnGhost, color: '#c8923a', borderColor: 'rgba(200,146,58,0.4)', fontSize: '0.55rem', padding: '0.35rem 0.6rem' }} onClick={() => openPlanReview(entry)}>Åbn plan</button>
                    </div>
                  )
                })}

                {remainingPlanEntries.length > 0 && (
                  <details style={{ borderTop: '1px solid rgba(237,234,226,0.07)', marginTop: featuredPlanEntries.length ? 0 : '0.65rem', paddingTop: '0.45rem' }}>
                    <summary style={{ minHeight: 36, display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.05em' }}>
                      Vis resterende {remainingPlanEntries.length} · {planCounts.covered || 0} dækket
                    </summary>
                    <div style={{ marginTop: '0.3rem' }}>
                      {remainingPlanEntries.map(entry => {
                        const tone = planTone[entry.tone]
                        return (
                          <div key={entry.athlete.id} style={{ padding: '0.55rem 0', borderTop: '1px solid rgba(237,234,226,0.05)', display: 'flex', justifyContent: 'space-between', gap: '0.6rem', alignItems: 'center' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: '#b8b4a8', fontSize: '0.75rem' }}>{entry.athlete.name}</div>
                              <div style={{ marginTop: '0.12rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.45rem', color: tone.color }}>{entry.headline}</div>
                            </div>
                            <button style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.3rem 0.5rem' }} onClick={() => openPlanReview(entry)}>Åbn</button>
                          </div>
                        )
                      })}
                    </div>
                  </details>
                )}
              </div>

              {/* Tidslinje — alle atleters blokke på tværs af tid */}
              {(() => {
                const COL_W = isMobile ? 40 : 48
                const NAME_W = isMobile ? 88 : 132
                const ROW_H = 34
                const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
                const isoOf = (d) => d.toISOString().slice(0, 10)

                const rows = visibleAthletes.map(a => {
                  const wks = calendarWeeks[a.id] || []
                  const anchor = wks.find(w => w.start_date) // wks er sorteret stigende → tidligste daterede
                  const weekDate = anchor
                    ? (no) => new Date(new Date(anchor.start_date + 'T12:00:00').getTime() + (no - anchor.week_number) * 7 * dayMs)
                    : null
                  return { a, wks, phases: computePhases(wks), currentWk: currentWeekNo(wks, athleteCurrentWeek[a.id] ?? null), weekDate, hasAnchor: !!anchor }
                })
                const placed = rows.filter(r => r.hasAnchor)
                const tray = rows.filter(r => !r.hasAnchor && r.wks.length > 0)

                // Global kolonneskala (ISO-uger). Pad én uge i hver ende.
                let minMon = mondayOf(today0), maxMon = mondayOf(today0)
                for (const r of placed) for (const w of r.wks) {
                  const m = mondayOf(r.weekDate(w.week_number))
                  if (m < minMon) minMon = m
                  if (m > maxMon) maxMon = m
                }
                minMon = new Date(minMon.getTime() - 7 * dayMs)
                maxMon = new Date(maxMon.getTime() + 7 * dayMs)
                const nCols = Math.min(Math.round((maxMon - minMon) / (7 * dayMs)) + 1, 60)
                const colOf = (d) => Math.round((mondayOf(d) - minMon) / (7 * dayMs))
                const todayCol = colOf(today0)
                const trackW = nCols * COL_W
                const cols = Array.from({ length: nCols }, (_, i) => new Date(minMon.getTime() + i * 7 * dayMs))

                const openEdit = (r, ph) => {
                  const first = ph.weeks[0]
                  const firstStartIso = first.start_date || (r.weekDate ? isoOf(r.weekDate(first.week_number)) : isoOf(today0))
                  setTimelineEdit({ athleteId: r.a.id, weeks: ph.weeks, name: r.a.name, block: ph.name || 'Uden blok', firstStartIso })
                }

                // Hvilket ugenummer "hører til" kolonne i for en atlet, ud fra anker-modellen
                // (anker + 1 ugenr pr. kolonne). Giver den nye uge en start_date der matcher
                // dens position, så bjælken lægger sig præcis hvor der blev klikket.
                const cellWeekNo = (r, i) => {
                  const anchor = r.wks.find(w => w.start_date)
                  if (!anchor) return null
                  const anchorCol = colOf(new Date(anchor.start_date + 'T12:00:00'))
                  return anchor.week_number + (i - anchorCol)
                }
                // Lokal-sikker yyyy-mm-dd (cols[] er lokal midnat; isoOf/toISOString ville
                // rulle en dag tilbage i dansk tidszone → mandag blev til søndag).
                const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                // Klik på en tom celle → bekræft → opret én tom uge på den dato.
                const onEmptyCellClick = (r, i, d) => {
                  const newNo = cellWeekNo(r, i)
                  if (newNo == null || newNo < 1) { showFlash('Kan ikke oprette en uge før programmets start.', 'error'); return }
                  if (r.wks.some(w => w.week_number === newNo)) { showFlash('Der er allerede en uge her.', 'error'); return }
                  const label = d.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
                  askConfirm(`Opret uge for ${r.a.name} med start ${label}?`, () => createCalendarWeek(r.a.id, newNo, isoLocal(d)))
                }

                return (
                  <div style={{ ...s.card, marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={s.cardLabel}>Tidslinje</div>
                      <select
                        value=""
                        onChange={e => { const a = visibleAthletes.find(x => x.id === e.target.value); if (a) openCalBlockBuilder(a) }}
                        style={{ ...s.fieldSelect, fontSize: '0.6rem', padding: '0.3rem 0.5rem', width: 'auto', color: '#c8923a', borderColor: 'rgba(200,146,58,0.4)' }}
                      >
                        <option value="">+ Opstil blokke for…</option>
                        {visibleAthletes.map(a => <option key={a.id} value={a.id} style={{ color: '#edeae2' }}>{a.name}</option>)}
                      </select>
                    </div>

                    {placed.length === 0 ? (
                      <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', padding: '0.75rem 0' }}>
                        Ingen atleter med datoer endnu — sæt en startdato nedenfor, så lægger blokkene sig her.
                      </div>
                    ) : (
                      <>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', color: '#4a4844', marginTop: '0.4rem' }}>
                        Tip: tryk på en tom celle for at oprette en uge på den dato.
                      </div>
                      <div style={{ display: 'flex', marginTop: '0.5rem', border: '1px solid rgba(237,234,226,0.06)' }}>
                        {/* Sticky navne-kolonne */}
                        <div style={{ flexShrink: 0, width: NAME_W, borderRight: '1px solid rgba(237,234,226,0.08)', background: '#16160f' }}>
                          <div style={{ height: 22, borderBottom: '1px solid rgba(237,234,226,0.06)' }} />
                          {placed.map(r => (
                            <div key={r.a.id} onClick={() => openProfile(r.a, 'program')}
                              style={{ height: ROW_H, display: 'flex', alignItems: 'center', padding: '0 0.5rem', cursor: 'pointer', borderBottom: '1px solid rgba(237,234,226,0.04)', fontSize: isMobile ? '0.72rem' : '0.8rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {r.a.name}
                            </div>
                          ))}
                        </div>
                        {/* Scrollbart spor */}
                        <div style={{ overflowX: 'auto', flex: 1 }}>
                          <div style={{ width: trackW }}>
                            {/* Dato-header */}
                            <div style={{ display: 'flex', height: 22, borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                              {cols.map((d, i) => (
                                <div key={i} style={{ width: COL_W, flexShrink: 0, textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.42rem', color: i === todayCol ? '#c8923a' : '#4a4844', background: i === todayCol ? 'rgba(200,146,58,0.08)' : 'transparent', lineHeight: '22px' }}>
                                  {d.getDate()}/{d.getMonth() + 1}
                                </div>
                              ))}
                            </div>
                            {/* Rækker */}
                            {placed.map(r => {
                              // Kolonner der allerede er dækket af en blok-bjælke (så vi kun gør
                              // de TOMME celler klikbare → opret-uge).
                              const covered = new Set()
                              for (const ph of r.phases) {
                                const a0 = colOf(r.weekDate(ph.weeks[0].week_number))
                                const a1 = colOf(r.weekDate(ph.weeks[ph.weeks.length - 1].week_number))
                                for (let c = a0; c <= a1; c++) covered.add(c)
                              }
                              return (
                              <div key={r.a.id} style={{ position: 'relative', height: ROW_H, borderBottom: '1px solid rgba(237,234,226,0.04)' }}>
                                {/* Tomme celler: klik = opret uge på den dato (kun gyldige slots:
                                    ledig + ugenummer >= 1). Ligger under bjælkerne i DOM → bjælker
                                    fanger deres egne klik. */}
                                {cols.map((d, i) => {
                                  if (covered.has(i)) return null
                                  const newNo = cellWeekNo(r, i)
                                  if (newNo == null || newNo < 1 || r.wks.some(w => w.week_number === newNo)) return null
                                  const hov = hoverCell && hoverCell.aid === r.a.id && hoverCell.col === i
                                  return (
                                    <div key={`cell${i}`}
                                      onClick={() => onEmptyCellClick(r, i, d)}
                                      onMouseEnter={() => setHoverCell({ aid: r.a.id, col: i })}
                                      onMouseLeave={() => setHoverCell(null)}
                                      title={`+ Opret uge · ${d.getDate()}/${d.getMonth() + 1}`}
                                      style={{ position: 'absolute', left: i * COL_W, top: 0, width: COL_W, height: ROW_H, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: hov ? 'rgba(200,146,58,0.08)' : 'transparent' }}>
                                      {hov && <span style={{ color: '#c8923a', fontSize: '0.8rem', opacity: 0.8, lineHeight: 1 }}>+</span>}
                                    </div>
                                  )
                                })}
                                {/* i dag-linje */}
                                {todayCol >= 0 && todayCol < nCols && (
                                  <div style={{ position: 'absolute', left: todayCol * COL_W + COL_W / 2, top: 0, bottom: 0, width: 1, background: 'rgba(200,146,58,0.4)', pointerEvents: 'none' }} />
                                )}
                                {r.phases.map((ph, pi) => {
                                  const first = ph.weeks[0], last = ph.weeks[ph.weeks.length - 1]
                                  const c0 = colOf(r.weekDate(first.week_number))
                                  const c1 = colOf(r.weekDate(last.week_number))
                                  const color = ph.name ? blockColor(ph.name) : '#4a4844'
                                  const isDone = r.currentWk != null && last.week_number < r.currentWk
                                  const isActive = r.currentWk != null && first.week_number <= r.currentWk && r.currentWk <= last.week_number
                                  const range = first.week_number === last.week_number ? `u${first.week_number}` : `u${first.week_number}–${last.week_number}`
                                  return (
                                    <div key={pi} title={`${ph.name || 'Uden blok'} · ${range}`}
                                      onClick={() => openEdit(r, ph)}
                                      style={{
                                        position: 'absolute', left: c0 * COL_W + 2, width: Math.max((c1 - c0 + 1) * COL_W - 4, COL_W - 4),
                                        top: 5, height: ROW_H - 12, cursor: 'pointer', borderRadius: 3, overflow: 'hidden',
                                        background: isActive ? color + '33' : color + (isDone ? '14' : '22'),
                                        border: `1px solid ${isActive ? color : color + '66'}`, opacity: isDone ? 0.7 : 1,
                                        display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0 0.35rem',
                                      }}>
                                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                      <span style={{ fontSize: '0.6rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ph.name || 'Uden blok'}</span>
                                      {isDone && <span style={{ color, fontSize: '0.55rem', flexShrink: 0 }}>✓</span>}
                                      {isActive && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.4rem', textTransform: 'uppercase', color, flexShrink: 0 }}>nu</span>}
                                    </div>
                                  )
                                })}
                              </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                      </>
                    )}

                    {/* Dato-redigerings-panel */}
                    {timelineEdit && (
                      <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: '#16160f', border: '1px solid rgba(200,146,58,0.3)', borderRadius: 3 }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.4rem' }}>
                          Startdato — {timelineEdit.name} · {timelineEdit.block}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <button style={{ ...s.btnGhost, fontSize: '0.6rem', padding: '0.3rem 0.5rem' }}
                            onClick={() => { const d = new Date(timelineEdit.firstStartIso + 'T12:00:00'); const iso = isoOf(new Date(d.getTime() - 7 * dayMs)); setTimelineEdit(p => ({ ...p, firstStartIso: iso })); setBlockStartDate(timelineEdit.athleteId, timelineEdit.weeks, iso) }}>‹ 1 uge</button>
                          <input type="date" value={timelineEdit.firstStartIso}
                            onChange={e => { if (e.target.value) { setTimelineEdit(p => ({ ...p, firstStartIso: e.target.value })); setBlockStartDate(timelineEdit.athleteId, timelineEdit.weeks, e.target.value) } }}
                            style={{ ...s.fieldInput, fontSize: '0.7rem', padding: '0.25rem 0.4rem', width: 'auto' }} />
                          <button style={{ ...s.btnGhost, fontSize: '0.6rem', padding: '0.3rem 0.5rem' }}
                            onClick={() => { const d = new Date(timelineEdit.firstStartIso + 'T12:00:00'); const iso = isoOf(new Date(d.getTime() + 7 * dayMs)); setTimelineEdit(p => ({ ...p, firstStartIso: iso })); setBlockStartDate(timelineEdit.athleteId, timelineEdit.weeks, iso) }}>1 uge ›</button>
                          <button style={{ ...s.btnGhost, fontSize: '0.6rem', padding: '0.3rem 0.5rem', marginLeft: 'auto' }} onClick={() => setTimelineEdit(null)}>Luk</button>
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', marginTop: '0.35rem', lineHeight: 1.6 }}>
                          Sætter blokkens første uge til datoen og fordeler resten af ugerne fortløbende (7 dage pr. uge).
                        </div>
                      </div>
                    )}

                    {/* Ikke planlagt-bakke */}
                    {tray.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.4rem' }}>
                          Ikke planlagt på kalenderen ({tray.length})
                        </div>
                        {tray.map(r => (
                          <div key={r.a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(237,234,226,0.04)', flexWrap: 'wrap' }}>
                            <span onClick={() => openProfile(r.a, 'program')} style={{ fontSize: '0.82rem', color: '#edeae2', cursor: 'pointer' }}>{r.a.name}</span>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.25rem 0.5rem' }}
                                onClick={() => r.phases[0] && openEdit(r, r.phases[0])}>Sæt startdato</button>
                              <button style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.25rem 0.5rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.4)' }}
                                onClick={() => openCalBlockBuilder(r.a)}>+ blok</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Kalender-blok-bygger — opstil/forlæng en atlets blokke direkte her */}
                    {calBlockAthlete && (() => {
                      const ath = athletes.find(x => x.id === calBlockAthlete.id)
                      const existing = calendarWeeks[calBlockAthlete.id] || []
                      const nextNum = existing.length ? Math.max(...existing.map(w => w.week_number)) + 1 : 1
                      const totalWeeks = blockPlan.reduce((sum, b) => sum + (b.weeks || 0), 0)
                      const endDate = totalWeeks > 0 && planStartDate
                        ? new Date(new Date(planStartDate + 'T12:00:00').getTime() + totalWeeks * 7 * dayMs - dayMs) : null
                      const compObj = ath?.competition_date ? new Date(ath.competition_date + 'T12:00:00') : null
                      const diffDays = endDate && compObj ? Math.round((compObj - endDate) / dayMs) : null
                      const fmtD = d => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
                      return (
                        <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#16160f', border: '1px solid rgba(200,146,58,0.3)', borderRadius: 3 }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' }}>
                            Opstil blokke — {calBlockAthlete.name}{existing.length ? ` · fortsætter fra uge ${nextNum}` : ''}
                          </div>
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={s.fieldLabel}>Startdato</div>
                            <input style={{ ...s.fieldInput, maxWidth: '180px' }} type="date" value={planStartDate} onChange={e => setPlanStartDate(e.target.value)} />
                          </div>
                          {blockSequenceRows()}
                          {totalWeeks > 0 && planStartDate && (
                            <div style={{ display: 'flex', width: '100%', height: '26px', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                              {blockPlan.map(block => {
                                const pct = (block.weeks / totalWeeks) * 100
                                return (
                                  <div key={block.id} title={`${block.name}: ${block.weeks} uge${block.weeks !== 1 ? 'r' : ''}`}
                                    style={{ width: `${pct}%`, flexShrink: 0, background: blockColor(block.name), display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {block.weeks >= 2 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#141410', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 6px' }}>{block.name}</span>}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', marginBottom: '0.85rem' }}>
                            <span style={{ color: '#7a7770' }}>Total: {totalWeeks} uger</span>
                            {endDate && <span style={{ color: '#7a7770' }}> · slutter {fmtD(endDate)}</span>}
                            {diffDays != null && (
                              <span style={{ marginLeft: '0.6rem', color: diffDays >= 0 ? '#6cba6c' : '#e05555', fontWeight: 600 }}>
                                {diffDays >= 0 ? `✓ ${diffDays} dage før stævne` : `⚠ ${Math.abs(diffDays)} dage efter stævne`}
                              </span>
                            )}
                            {!compObj && <span style={{ color: '#4a4844', marginLeft: '0.6rem' }}>— ingen stævnedato sat</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button style={s.btnGhost} onClick={() => setCalBlockAthlete(null)}>Annuller</button>
                            <button style={s.btnPrimary} disabled={!planStartDate || totalWeeks === 0} onClick={() => generateWeeksFromPlan(calBlockAthlete.id)}>Opret {totalWeeks} uger</button>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}

              {/* Kræver handling — uden program / uden øvelser / sidste uge nu */}
              {needs.length > 0 && (
                <div style={{ ...s.card, marginBottom: '1.5rem', borderColor: 'rgba(224,85,85,0.3)' }}>
                  <div style={{ ...s.cardLabel, color: '#e05555' }}>⚠ Kræver din opmærksomhed ({needs.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.5rem' }}>
                    {needs.map(b => {
                      const snooze = (days) => { const d = new Date(); d.setDate(d.getDate() + days); snoozeAthlete(b.a.id, d.toISOString().slice(0, 10)) }
                      return (
                        <div key={b.a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(237,234,226,0.04)', flexWrap: 'wrap' }}>
                          <div onClick={() => openProfile(b.a, 'program')} style={{ cursor: 'pointer', flex: 1, minWidth: '140px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#edeae2' }}>{b.a.name}</span>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: b.status === 'none' ? '#e05555' : '#c8923a', marginLeft: '0.6rem' }}>{reasonText(b)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4844' }}>Udsæt</span>
                            <button onClick={() => snooze(3)} style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.25rem 0.45rem' }}>3d</button>
                            <button onClick={() => snooze(7)} style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.25rem 0.45rem' }}>7d</button>
                            <input type="date" onChange={e => e.target.value && snoozeAthlete(b.a.id, e.target.value)} style={{ ...s.fieldInput, fontSize: '0.55rem', padding: '0.2rem 0.3rem', width: '120px' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Udsatte atleter */}
              {snoozedNeeds.length > 0 && (
                <div style={{ ...s.card, marginBottom: '1.5rem' }}>
                  <div style={s.cardLabel}>Udsat ({snoozedNeeds.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.5rem' }}>
                    {snoozedNeeds.map(b => (
                      <div key={b.a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid rgba(237,234,226,0.04)' }}>
                        <span style={{ fontSize: '0.82rem', color: '#7a7770' }}>{b.a.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844' }}>udsat til {fmtDate(new Date(b.snoozedUntil))}</span>
                          <button onClick={() => snoozeAthlete(b.a.id, null)} style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.25rem 0.45rem' }}>Vis nu</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fuldt board — alle atleter */}
              <div style={{ ...s.card }}>
                <div style={s.cardLabel}>Alle atleter</div>
                {board.length === 0 ? (
                  <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', padding: '1rem 0' }}>Ingen atleter</div>
                ) : board.map((b, i) => {
                  const chip = b.status === 'ferie' ? { t: '🌴 Ferie', c: '#5b9bb5' }
                    : b.isSnoozed ? { t: `⏾ Udsat`, c: '#7a7770' }
                    : b.returned ? { t: '🌴→ Tilbage fra ferie — planlæg', c: '#c8923a' }
                    : b.status === 'ready' ? { t: `✓ Klar · ${b.runway} uger`, c: '#6cba6c' }
                    : b.status === 'lastweek' ? { t: '⚠ Sidste uge — planlæg i weekenden', c: '#c8923a' }
                    : b.status === 'out' ? { t: '⚠ Løbet tør — planlæg nu', c: '#e05555' }
                    : b.status === 'empty' ? { t: '⚠ Mangler øvelser', c: '#c8923a' }
                    : { t: '✗ Intet program', c: '#e05555' }
                  const detail = b.weeks.length === 0 ? 'Ingen uger oprettet'
                    : b.planned.length === 0 ? `${b.weeks.length} uger oprettet · ingen øvelser endnu`
                    : `${b.loggedWeek != null ? `Træner uge ${b.loggedWeek}` : 'Ikke startet'} · ${b.runway} fyldte uger tilbage · planlagt til uge ${b.maxPlannedWeekNo}`
                  return (
                    <div key={b.a.id} onClick={() => openProfile(b.a, 'program')}
                      style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.7rem 0', borderBottom: i < board.length - 1 ? '1px solid rgba(237,234,226,0.05)' : 'none', cursor: 'pointer', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: '0.9rem', color: '#edeae2', minWidth: '130px', flexShrink: 0 }}>{b.a.name}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#7a7770', flex: 1, minWidth: '160px' }}>{detail}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: lastColor(b.daysSince) }} />
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: lastColor(b.daysSince), minWidth: '64px' }}>{lastText(b.daysSince)}</span>
                      </div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: chip.c, border: `1px solid ${chip.c}55`, padding: '0.2rem 0.5rem', flexShrink: 0 }}>{chip.t}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', marginTop: '0.75rem', letterSpacing: '0.05em', lineHeight: 1.7 }}>
                "Klar · N uger" = N fyldte uger tilbage fra og med den uge atleten træner nu. "Sidste uge — planlæg næste" = kun den nuværende uge er fyldt. Brug "Udsæt" hvis du allerede har styr på det og ikke vil mindes om det i nogle dage. Prikken = sidst loggede træning.
              </div>
            </div>
          )
}
