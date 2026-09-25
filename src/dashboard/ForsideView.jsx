// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Forsiden: hurtigknapper, "Kræver dit blik" og atletlisten.
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { currentWeekNo, s, initials } from '../dashboardShared'
import { beregnUgensAfvigelse, sorterEfterAfvigelse } from './afvigelse'
import { coachBriefingPointKey } from '../coachBriefingSeen'
import { supabase } from '../supabase'
import { holidayInfo, ferieBadgeLabel } from './coachKonstanter'
import { videoCoachMeasurementSummary, coachVideoPriorityDetail, videoCoachMeasurementText } from './coachVideoHjaelp'

export default function ForsideView({
  athleteCurrentWeek, athleteLastLogs, athletes, athleteSortMode, athleteWeekCompletion, athleteWeekSummary,
  automationAlertsError, calendarWeeks, coachBriefingSeen, coachBriefingSeenSavingKey, coachPriorityCount, coachPriorityItems,
  fetchAthletes, goToMyProfile, handleCoachBriefingSeen, handleTrainingSignal, hiddenAthleteIds, isMobile,
  loadError, loading, messageInboxError, openCoachPriorityItem, openProfile, openVideoCoachV3,
  setAthleteSortMode, setHiddenAthleteIds, setLoading, setSelectedAthlete, setShowAllAthletes, setShowHiddenAthletes,
  setView, showAllAthletes, showHiddenAthletes, trainingSignalsError, trainingSignalUpdatingKey, unreadCounts,
  videoMeasurementByAthlete, videoReviewQueueError,
}) {
          const visibleAthletes = athletes
            .filter(ath => !hiddenAthleteIds.has(ath.id))
            .sort((x, y) => x.name.localeCompare(y.name, 'da'))
          const hiddenAthletes = athletes.filter(ath => hiddenAthleteIds.has(ath.id))
          // ORDRE 277 · commit 1: afvigelse denne uge (planlagt mod
          // gennemført, sæt + tonnage) regnet én gang pr. atlet — brugt til
          // BÅDE sorteringen og linjen i hver række (afvigelseByAthleteId
          // nedenfor), så de to aldrig kan vise forskellige tal.
          // ORDRE 285 · commit 1: `currentWeekNo` (sortér+date-math) og
          // `athleteWeeks.find(...)` blev FØR kørt igen pr. række nedenfor
          // for "Uge N"-linjen — dobbelt arbejde pr. atlet pr. render, målt
          // som den tungeste del af listen ved 30 atleter (se
          // docs/MAAL-285.md). `current`/`currentNo` regnes nu kun HER og
          // genbruges via currentWeekByAthleteId i rækkevisningen.
          const athletesWithAfvigelse = visibleAthletes.map(athlete => {
            const athleteWeeks = calendarWeeks[athlete.id] || []
            const currentNo = currentWeekNo(athleteWeeks, athleteCurrentWeek[athlete.id] ?? null)
            const current = athleteWeeks.find(week => week.week_number === currentNo)
            const completion = (athleteWeekCompletion[athlete.id] || {})[currentNo] || { sets: 0, tonnage: 0 }
            const afvigelse = beregnUgensAfvigelse({
              plannedSets: current?.planned_sets || 0,
              plannedTonnage: current?.planned_tonnage || 0,
              completedSets: completion.sets,
              completedTonnage: completion.tonnage,
            })
            return { athlete, afvigelse, current }
          })
          const afvigelseByAthleteId = new Map(athletesWithAfvigelse.map(r => [r.athlete.id, r.afvigelse]))
          const currentWeekByAthleteId = new Map(athletesWithAfvigelse.map(r => [r.athlete.id, r.current]))
          const sortedVisibleAthletes = athleteSortMode === 'afvigelse'
            ? sorterEfterAfvigelse(athletesWithAfvigelse).map(r => r.athlete)
            : visibleAthletes
          const shownAthletes = showHiddenAthletes
            ? [...sortedVisibleAthletes, ...hiddenAthletes.sort((x, y) => x.name.localeCompare(y.name, 'da'))]
            : sortedVisibleAthletes
          const ATHLETE_LIST_LIMIT = 25
          const cappedAthletes = showAllAthletes ? shownAthletes : shownAthletes.slice(0, ATHLETE_LIST_LIMIT)
          const priorityItems = coachPriorityItems
          const inboxTotal = coachPriorityCount
          // ORDRE 325: sete punkter (coach_briefing_seen) synker til bunden af
          // forhåndsvisningen i stedet for at blive fjernet — samme rækkefølge
          // som buildCoachPriorityItems ellers gav (rank/tid) inden for hver
          // gruppe, da Array#sort er stabil.
          const priorityPreview = [...priorityItems]
            .sort((a, b) => {
              const aSeen = coachBriefingSeen[coachBriefingPointKey(a)] ? 1 : 0
              const bSeen = coachBriefingSeen[coachBriefingPointKey(b)] ? 1 : 0
              return aSeen - bSeen
            })
            .slice(0, isMobile ? 3 : 4)
          const homeActions = [
            {
              key: 'training',
              label: 'Min træning',
              sub: 'Åbn dit eget program',
              color: '#c8923a',
              onClick: goToMyProfile,
              icon: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></>,
            },
            {
              key: 'video',
              label: 'Videoanalyse',
              sub: 'Analysér et løft',
              color: '#67dff5',
              onClick: openVideoCoachV3,
              icon: <><rect x="2" y="6" width="13" height="12" rx="2" /><path d="M15 10.5 22 7v10l-7-3.5" /></>,
            },
          ]

          const unshelveAthlete = async (event, athleteId) => {
            event.stopPropagation()
            setHiddenAthleteIds(prev => {
              const next = new Set(prev); next.delete(athleteId); return next
            })
            await supabase.from('athletes').update({ hidden: false }).eq('id', athleteId)
          }

          return (
            <div style={{ ...s.page, ...(isMobile ? { padding: '1rem' } : {}) }}>
              <div style={{ marginBottom: isMobile ? '1.1rem' : '1.5rem' }}>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? '1.75rem' : '2rem', fontWeight: 400, color: '#edeae2', margin: 0 }}>
                  Coach<span style={{ color: '#c8923a' }}>.</span>
                </h1>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.3rem' }}>
                  {new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: isMobile ? '0.55rem' : '0.75rem', marginBottom: isMobile ? '0.85rem' : '1rem' }}>
                {homeActions.map(action => (
                  <button key={action.key} onClick={action.onClick}
                    style={{ position: 'relative', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '0.75rem', minHeight: isMobile ? 108 : 96, padding: isMobile ? '0.85rem' : '1rem 1.1rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.08)', borderRadius: 5, cursor: 'pointer', color: '#edeae2', textAlign: 'left' }}>
                    <span style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${action.color}55`, background: `${action.color}0f`, color: action.color, borderRadius: 4 }}>
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{action.icon}</svg>
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: isMobile ? '0.84rem' : '0.92rem', color: '#edeae2', lineHeight: 1.25 }}>{action.label}</span>
                      <span style={{ display: 'block', marginTop: '0.2rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: action.color, letterSpacing: '0.035em', lineHeight: 1.35 }}>{action.sub}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div style={{ ...s.card, marginBottom: isMobile ? '0.85rem' : '1rem', padding: 0, overflow: 'hidden', borderColor: inboxTotal > 0 ? 'rgba(200,146,58,0.28)' : 'rgba(108,186,108,0.2)' }}>
                <button onClick={() => { setView('inbox'); setSelectedAthlete(null) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', minHeight: 64, padding: isMobile ? '0.75rem 0.85rem' : '0.8rem 1rem', border: 'none', borderBottom: priorityPreview.length ? '1px solid rgba(237,234,226,0.06)' : 'none', background: inboxTotal > 0 ? 'rgba(200,146,58,0.035)' : 'rgba(108,186,108,0.025)', color: '#edeae2', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${inboxTotal > 0 ? 'rgba(200,146,58,0.35)' : 'rgba(108,186,108,0.3)'}`, background: inboxTotal > 0 ? 'rgba(200,146,58,0.07)' : 'rgba(108,186,108,0.06)', color: inboxTotal > 0 ? '#c8923a' : '#6cba6c', borderRadius: 4 }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.92rem', color: '#edeae2' }}>Kræver dit blik</span>
                    <span style={{ display: 'block', marginTop: '0.16rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: inboxTotal > 0 ? '#c8923a' : '#6cba6c', letterSpacing: '0.035em' }}>{inboxTotal > 0 ? `${inboxTotal} åbne ting · vigtigste først` : 'Alt er set lige nu'}</span>
                  </span>
                  {inboxTotal > 0 && <span style={{ minWidth: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 0.32rem', borderRadius: '999px', background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', fontWeight: 700 }}>{inboxTotal}</span>}
                  <span style={{ color: '#7a7770', fontSize: '0.75rem' }}>→</span>
                </button>

                {priorityPreview.length > 0 && (
                  <div style={{ padding: isMobile ? '0.2rem 0.85rem 0.35rem' : '0.25rem 1rem 0.4rem' }}>
                    {priorityPreview.map((item, index) => {
                      const signalUpdating = item.kind === 'signal' && trainingSignalUpdatingKey === `${item.signal.o_athlete_id}:${item.signal.o_detector}`
                      // ORDRE 325: "Set" for besked/video — signalets eget "Set"
                      // ovenfor kvitterer/udsætter allerede via
                      // coach_signal_actions og lukker dermed samme hul for
                      // træningssignaler (RAPPORT-317's fund gjaldt kun
                      // unread_messages/video_drafts). Automatiseringsfejl har
                      // sin egen "Markeret som set" i selve Indbakken.
                      const briefingPointKey = coachBriefingPointKey(item)
                      const briefingSeen = briefingPointKey ? Boolean(coachBriefingSeen[briefingPointKey]) : false
                      const briefingSeenSaving = briefingPointKey && coachBriefingSeenSavingKey === briefingPointKey
                      const canMarkBriefingSeen = briefingPointKey && (item.kind === 'message' || item.kind === 'video')
                      return (
                        <div key={item.key} data-coach-briefing-point={briefingPointKey || undefined} data-coach-briefing-seen={briefingSeen ? 'true' : 'false'}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 58, borderBottom: index < priorityPreview.length - 1 ? '1px solid rgba(237,234,226,0.055)' : 'none', opacity: briefingSeen ? 0.45 : 1 }}>
                          <button onClick={() => openCoachPriorityItem(item, 'list')}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1, minHeight: 52, padding: '0.35rem 0', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                            <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: '50%', background: item.color, boxShadow: `0 0 0 3px ${item.color}18` }} />
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.38rem', minWidth: 0 }}>
                                <span style={{ color: '#edeae2', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                                <span style={{ flexShrink: 0, color: item.color, border: `1px solid ${item.color}44`, padding: '0.08rem 0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.4rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{item.label}</span>
                              </span>
                              <span style={{ display: 'block', marginTop: '0.14rem', color: '#7a7770', fontSize: '0.66rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</span>
                            </span>
                            {item.count > 0 && <span style={{ minWidth: 19, height: 19, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 0.25rem', borderRadius: '999px', background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.45rem', fontWeight: 700 }}>{item.count}</span>}
                            <span style={{ color: item.color, flexShrink: 0, fontSize: '0.7rem' }}>→</span>
                          </button>
                          {item.kind === 'signal' && (
                            <button disabled={signalUpdating} onClick={() => handleTrainingSignal(item.signal, 'acknowledge')}
                              style={{ ...s.btnGhost, minHeight: 34, padding: '0.25rem 0.45rem', fontSize: '0.43rem', opacity: signalUpdating ? 0.45 : 0.8, flexShrink: 0 }}>{signalUpdating ? '…' : 'Set'}</button>
                          )}
                          {canMarkBriefingSeen && (
                            briefingSeen ? (
                              <span style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem 0.4rem', flexShrink: 0, color: '#6cba6c', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.43rem', letterSpacing: '0.04em' }}>Set ✓</span>
                            ) : (
                              <button disabled={briefingSeenSaving} onClick={() => handleCoachBriefingSeen(item)}
                                style={{ ...s.btnGhost, minWidth: 44, minHeight: 44, padding: '0.25rem 0.55rem', fontSize: '0.43rem', opacity: briefingSeenSaving ? 0.45 : 0.8, flexShrink: 0 }}>{briefingSeenSaving ? '…' : 'Set'}</button>
                            )
                          )}
                        </div>
                      )
                    })}
                    {priorityItems.length > priorityPreview.length && (
                      <button onClick={() => { setView('inbox'); setSelectedAthlete(null) }} style={{ width: '100%', minHeight: 38, padding: '0.4rem 0 0.2rem', border: 'none', background: 'transparent', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.05em', cursor: 'pointer', textAlign: 'left' }}>
                        + {priorityItems.length - priorityPreview.length} flere i indbakken
                      </button>
                    )}
                  </div>
                )}

                {(trainingSignalsError || videoReviewQueueError || messageInboxError || automationAlertsError) && (
                  <button onClick={() => { setView('inbox'); setSelectedAthlete(null) }} style={{ width: '100%', minHeight: 44, padding: '0.55rem 0.85rem', border: 'none', borderTop: '1px solid rgba(224,85,85,0.14)', background: 'rgba(224,85,85,0.025)', color: '#d79a83', fontSize: '0.64rem', cursor: 'pointer', textAlign: 'left' }}>
                    Noget kunne ikke indlæses · åbn indbakken for detaljer
                  </button>
                )}
              </div>

              <div style={{ ...s.card, marginBottom: 0, padding: isMobile ? '0.8rem 0.9rem' : '1rem 1.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.45rem' }}>
                  <div style={s.cardLabel}>Atleter</div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#4a4844', letterSpacing: '0.06em' }}>{visibleAthletes.length} aktive</span>
                </div>

                {/* ORDRE 277 · commit 1: sortér efter afvigelse denne uge —
                    planlagt mod gennemført, størst afvigelse øverst, "ingen
                    plan" nederst. Sorteringsvalget er almindelig
                    komponent-state (athleteSortMode), uændret af at åbne og
                    lukke en atlets profil (blok 2). */}
                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.65rem' }}>
                  {[{ key: 'navn', label: 'Navn' }, { key: 'afvigelse', label: 'Afvigelse denne uge' }].map(opt => (
                    <button key={opt.key} onClick={() => setAthleteSortMode(opt.key)}
                      aria-pressed={athleteSortMode === opt.key}
                      style={{
                        padding: '0.3rem 0.55rem', borderRadius: 3, cursor: 'pointer',
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.04em',
                        border: `1px solid ${athleteSortMode === opt.key ? 'rgba(200,146,58,0.5)' : 'rgba(237,234,226,0.1)'}`,
                        background: athleteSortMode === opt.key ? 'rgba(200,146,58,0.1)' : 'transparent',
                        color: athleteSortMode === opt.key ? '#c8923a' : '#7a7770',
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {loading ? (
                  <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', padding: '1rem 0' }}>Indlæser…</div>
                ) : loadError ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.75rem 0' }}>
                    <span style={{ color: '#7a7770', fontSize: '0.72rem' }}>Kunne ikke indlæse atleter.</span>
                    <button style={s.btnGhost} onClick={() => { setLoading(true); fetchAthletes() }}>Prøv igen</button>
                  </div>
                ) : shownAthletes.length === 0 ? (
                  <div style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', padding: '1rem 0' }}>Ingen aktive atleter</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {cappedAthletes.map((athlete, index) => {
                      const isHidden = hiddenAthleteIds.has(athlete.id)
                      // ORDRE 285 · commit 1: genbrug currentWeekByAthleteId
                      // (regnet én gang ovenfor) for de synlige atleter —
                      // kun skjulte atleter (sjældne, kun vist efter "Vis
                      // skjulte") falder tilbage til at regne det her.
                      let current = currentWeekByAthleteId.get(athlete.id)
                      if (current === undefined) {
                        const athleteWeeks = calendarWeeks[athlete.id] || []
                        const currentNo = currentWeekNo(athleteWeeks, athleteCurrentWeek[athlete.id] ?? null)
                        current = athleteWeeks.find(week => week.week_number === currentNo)
                      }
                      const fallback = athleteWeekSummary[athlete.id]
                      const weekNo = current?.week_number ?? fallback?.week_number
                      const blockName = current?.block_name || fallback?.block_name
                      const sessionCount = current?.session_count ?? fallback?.session_count
                      const programLine = weekNo != null
                        ? `Uge ${weekNo}${blockName ? ` · ${blockName}` : ''}${sessionCount != null ? ` · ${sessionCount} pas` : ''}`
                        : 'Intet aktivt program'
                      const holiday = holidayInfo(athlete)
                      const unread = unreadCounts[athlete.id] || 0
                      // ORDRE 266 · commit 1: kompakt, allerede-gemt måling - se
                      // videoCoachMeasurementSummary. Fraværende (null) for en
                      // "Film et sæt"-video ingen endnu har kørt sporingen på.
                      const measurementVideo = videoMeasurementByAthlete[athlete.id]
                      const measurement = videoCoachMeasurementSummary(measurementVideo)
                      // ORDRE 277 · commit 1: "Afvigelse denne uge"-sortering
                      // viser planlagt/gennemført/sidste logning i stedet for
                      // (ikke ved siden af) den almindelige programlinje —
                      // to tal pr. atlet ville gøre listen sværere at skimme,
                      // ikke lettere, hvilket var hele ordrens pointe.
                      const afvigelse = afvigelseByAthleteId.get(athlete.id)
                      const lastLogDate = athleteLastLogs[athlete.id]
                      // eslint-disable-next-line react-hooks/purity -- uændret fra før ordre 377; lint ser det først nu (se RAPPORT-377)
                      const daysSinceLog = lastLogDate ? Math.floor((Date.now() - new Date(lastLogDate + 'T12:00:00')) / 86400000) : null
                      const lastLogText = daysSinceLog == null ? 'Ingen logs' : daysSinceLog === 0 ? 'I dag' : daysSinceLog === 1 ? 'I går' : `${daysSinceLog}d siden`
                      // Gråt som standard, grønt kun når ugen er i mål eller
                      // foran — ALDRIG rødt/advarsel, uanset hvor stor
                      // afvigelsen er (ordrens egen grænse).
                      const paaSporet = afvigelse?.harPlan && afvigelse.afvigelseSaet <= 0 && afvigelse.afvigelseTonnage <= 0
                      const afvigelseText = !afvigelse ? '' : !afvigelse.harPlan
                        ? 'Ingen plan'
                        : `Planlagt ${afvigelse.plannedSets} sæt${afvigelse.plannedTonnage > 0 ? ` · ${Math.round(afvigelse.plannedTonnage)} kg` : ''} — gennemført ${afvigelse.completedSets} sæt${afvigelse.plannedTonnage > 0 ? ` · ${Math.round(afvigelse.completedTonnage)} kg` : ''} · ${lastLogText}`
                      return (
                        <div key={athlete.id} role={isHidden ? undefined : 'button'} tabIndex={isHidden ? undefined : 0}
                          onClick={() => !isHidden && openProfile(athlete, 'program')}
                          onKeyDown={event => { if (!isHidden && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openProfile(athlete, 'program') } }}
                          style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.65rem' : '0.85rem', width: '100%', minHeight: isMobile ? 62 : 66, padding: '0.55rem 0', borderBottom: index < cappedAthletes.length - 1 ? '1px solid rgba(237,234,226,0.055)' : 'none', background: 'transparent', cursor: isHidden ? 'default' : 'pointer', textAlign: 'left', opacity: isHidden ? 0.48 : 1 }}>
                          <span style={{ ...s.avatar, width: isMobile ? 36 : 40, height: isMobile ? 36 : 40, fontSize: isMobile ? '0.72rem' : '0.82rem', flexShrink: 0, position: 'relative' }}>
                            {initials(athlete.name)}
                            {unread > 0 && <span style={{ position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: '50%', background: '#c8923a', border: '2px solid #1c1c18' }} />}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                              <span style={{ fontSize: isMobile ? '0.82rem' : '0.9rem', color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{athlete.name}</span>
                              {holiday?.onHoliday && <span style={{ ...s.badge('ferie'), flexShrink: 0 }}>{ferieBadgeLabel(holiday)}</span>}
                              {isHidden && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.42rem', color: '#7a7770', textTransform: 'uppercase' }}>Skjult</span>}
                            </span>
                            {athleteSortMode === 'afvigelse' ? (
                              <span style={{ display: 'block', marginTop: '0.18rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: !afvigelse?.harPlan ? '#7a7770' : paaSporet ? '#6cba6c' : '#7a7770', lineHeight: 1.4 }}>{afvigelseText}</span>
                            ) : (
                              <span style={{ display: 'block', marginTop: '0.18rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: weekNo != null ? '#7a7770' : '#b07b68', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{programLine}</span>
                            )}
                            {measurement && (
                              <button
                                onClick={event => {
                                  event.stopPropagation()
                                  openCoachPriorityItem({ kind: 'video', athlete, video: measurementVideo,
                                    key: `video-${measurementVideo.id}`, title: athlete.name,
                                    detail: coachVideoPriorityDetail(measurementVideo), color: '#67dff5', label: 'Video' }, 'list')
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.32rem', marginTop: '0.22rem', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                                aria-label={`Åbn gemt måling · ${videoCoachMeasurementText(measurement)}`}>
                                {measurement.pathPreview && (
                                  <svg width="11" height="18" viewBox={measurement.pathPreview.viewBox} style={{ flexShrink: 0 }} aria-hidden="true">
                                    <polyline points={measurement.pathPreview.points} fill="none" stroke="#67dff5" strokeWidth={Math.max(2, (measurement.pathPreview.y2 - measurement.pathPreview.y1) * 0.02)} strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#67dff5', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {videoCoachMeasurementText(measurement)}
                                </span>
                              </button>
                            )}
                          </span>
                          {isHidden ? (
                            <button onClick={event => unshelveAthlete(event, athlete.id)} style={{ flexShrink: 0, color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', textTransform: 'uppercase', padding: '0.35rem', border: 'none', background: 'transparent', cursor: 'pointer' }}>Vis igen</button>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                              {unread > 0 && <span style={{ color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem' }}>{unread}</span>}
                              <span style={{ color: '#4a4844', fontSize: '0.75rem' }}>→</span>
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {!showAllAthletes && shownAthletes.length > ATHLETE_LIST_LIMIT && (
                  <button onClick={() => setShowAllAthletes(true)}
                    style={{ marginTop: '0.65rem', padding: '0.45rem 0 0', border: 'none', borderTop: '1px solid rgba(237,234,226,0.05)', background: 'transparent', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                    Vis alle {shownAthletes.length} (viser {ATHLETE_LIST_LIMIT})
                  </button>
                )}

                {hiddenAthletes.length > 0 && (
                  <button onClick={() => setShowHiddenAthletes(value => !value)}
                    style={{ marginTop: '0.65rem', padding: '0.45rem 0 0', border: 'none', borderTop: '1px solid rgba(237,234,226,0.05)', background: 'transparent', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
                    {showHiddenAthletes ? 'Skjul inaktive' : `Vis ${hiddenAthletes.length} skjult${hiddenAthletes.length === 1 ? '' : 'e'}`}
                  </button>
                )}
              </div>
            </div>
          )
}
