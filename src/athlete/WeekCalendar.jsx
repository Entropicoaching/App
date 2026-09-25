// Ugestrimlen paa forsiden — flyttet uaendret ud af AthleteView.jsx (ordre 373).
import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from './ugeHjaelp'

// Ugekalender på forsiden: 7 celler (man-søn) med ugens sessioner placeret på
// deres weekday. Klik på en dag med session åbner den i Program-fanen.
//
// ORDRE 330 · blok 1 — Marcs dom: man så ikke tydeligt hvilken dag man stod
// på, og dagene flød sammen til én blok. Derfor bæres hver tilstand nu af
// FORM, ikke kun en farvenuance:
//   - den viste dag (dagens pas' dag, `shownWd`): 2 px kant, fed ugedag,
//     lille trekant under cellen,
//   - i dag: datoen står i en udfyldt lys cirkel (aria-current="date"),
//   - pas-dage: fast kant + prik, klarede pas: ✓,
//   - hviledage: stiplet kant, "hvile" i stedet for prik, dæmpet.
// Og der er luft (0.5rem) mellem dagene. Uden datoer på ugen (ældre
// programmer) regnes den aktive uge som denne uge, så "i dag" stadig vises.
function WeekCalendar({ week, weekStart, exerciseLogs, onOpenSession, shownWd }) {
  const sessions = week?.sessions || []
  if (!sessions.length) return null
  const sessDone = s => (s.exercises || []).length > 0 &&
    (s.exercises || []).every(ex => exerciseLogs.some(l => l.exercise_id === ex.id))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayWd = (today.getDay() + 6) % 7
  const days = [...Array(7)].map((_, wd) => {
    let date = null
    if (weekStart) { date = new Date(weekStart.getTime() + wd * 86400000); date.setHours(0, 0, 0, 0) }
    return { wd, date, sessions: sessions.filter(s => s.weekday === wd) }
  })
  const flex = sessions.filter(s => s.weekday == null)
  const mono = "'IBM Plex Mono', monospace"
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {/* ORDRE 339 · blok 1 (F2 fra KRITIK-330-326) — med gap 0.5rem blev
          cellerne 40 px brede på 360 px (328 px indhold). Strimlen låner nu
          0,5rem af sidens margen i hver side og har 0,35rem mellemrum (330's
          krav om ≥5 px luft holder): 344 px → ≥44 px pr. celle på 360 px. */}
      <div data-dagstrimmel="" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.35rem', margin: '0 -0.5rem' }}>
        {days.map(d => {
          const isToday = d.date ? d.date.getTime() === today.getTime() : d.wd === todayWd
          const has = d.sessions.length > 0
          const allDone = has && d.sessions.every(sessDone)
          const isShown = shownWd != null && d.wd === shownWd
          const state = !has ? 'hvile' : allDone ? 'klaret' : 'pas'
          const border = isShown ? '2px solid #c8923a'
            : state === 'klaret' ? '1px solid rgba(108,186,108,0.45)'
            : state === 'pas' ? '1px solid rgba(237,234,226,0.22)'
            : '1px dashed rgba(237,234,226,0.1)'
          const bg = isShown ? 'rgba(200,146,58,0.14)' : state === 'klaret' ? 'rgba(108,186,108,0.07)' : state === 'pas' ? 'rgba(237,234,226,0.04)' : 'transparent'
          const open = has ? (d.sessions.find(s => !sessDone(s)) || d.sessions[0]) : null
          const label = [
            WEEKDAYS_LONG[d.wd],
            isToday && 'i dag',
            has ? d.sessions.map(s => s.title).join(', ') : 'hviledag',
            allDone && 'klaret',
            isShown && 'vises nu',
          ].filter(Boolean).join(' · ')
          return (
            <button
              key={d.wd}
              type="button"
              data-dag={state}
              data-vist={isShown ? 'ja' : undefined}
              aria-current={isToday ? 'date' : undefined}
              aria-label={label}
              onClick={() => open && onOpenSession(open.id)}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                minWidth: 0, minHeight: '64px', boxSizing: 'border-box',
                padding: isShown ? '0.4rem 0 0.35rem' : '0.45rem 0 0.4rem', background: bg,
                border, borderRadius: 4,
                cursor: has ? 'pointer' : 'default', fontFamily: mono,
                opacity: state === 'hvile' && !isToday ? 0.7 : 1,
              }}
            >
              {/* ORDRE 339 · blok 1 (F1) — ugedag 7,7 px → ~10,4 px, "hvile" 6,4 px → 9,6 px. */}
              <span data-ugedag="" style={{ fontSize: '0.65rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: isShown ? 700 : 400, color: isShown ? '#c8923a' : isToday ? '#edeae2' : '#7a7770' }}>
                {WEEKDAYS_SHORT[d.wd]}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '1.45rem', height: '1.45rem', borderRadius: '50%',
                fontFamily: "'Playfair Display', serif", fontSize: '0.85rem', lineHeight: 1,
                fontWeight: isShown || isToday ? 700 : 400,
                background: isToday ? '#edeae2' : 'transparent',
                color: isToday ? '#141410' : has ? '#edeae2' : '#4a4844',
              }}>
                {d.date ? d.date.getDate() : ''}
              </span>
              <span data-dagstatus="" style={{ fontSize: '0.6rem', letterSpacing: 0, lineHeight: 1, height: '0.7rem', textTransform: 'uppercase', color: allDone ? '#6cba6c' : isShown ? '#c8923a' : has ? '#a9a69e' : '#4a4844' }}>
                {allDone ? '✓' : has ? '●' : 'hvile'}
              </span>
              {isShown && (
                <span aria-hidden="true" style={{ position: 'absolute', bottom: '-7px', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #c8923a' }} />
              )}
            </button>
          )
        })}
      </div>
      {flex.length > 0 && (
        <div style={{ fontFamily: mono, fontSize: '0.5rem', letterSpacing: '0.06em', color: '#4a4844', marginTop: '0.5rem' }}>
          + {flex.length} fleksibel{flex.length > 1 ? 'le' : ''} session{flex.length > 1 ? 'er' : ''} uden fast dag
        </div>
      )}
    </div>
  )
}

export default WeekCalendar
