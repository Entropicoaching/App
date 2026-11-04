// AthleteView already marks the active Entropi 2 athlete with data-entropi2-athlete.
// Scope the new navigation to that marker; the legacy/OFF navigation stays intact.
import { NAV_ITEMS } from './NavItems'

function BundNav({
  athlete, hasMeetPlan, setTab, sharedVideoAnalyses, tab, unreadMsgCount, visKost = true,
}) {
  const primaryKeys = ['hjem', 'program', 'fremgang', 'kost', 'beskeder']
  const available = NAV_ITEMS.filter(n => visKost || n.key !== 'kost')
    .filter(n => n.key !== 'stævnedag' || athlete?.competition_date || hasMeetPlan)
  const primary = primaryKeys.map(key => available.find(n => n.key === key)).filter(Boolean)
  const more = available.filter(n => !primaryKeys.includes(n.key))
  const activeMore = more.find(n => n.key === tab)
  const hasUnread = (unreadMsgCount + sharedVideoAnalyses.filter(a => !a.athlete_seen_at).length) > 0
  const controlStyle = active => ({
    boxSizing: 'border-box', minWidth: 44, minHeight: 56, flex: '1 1 0',
    border: 0, borderRadius: 0, padding: '6px 1px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    fontFamily: 'sans-serif', fontSize: 11, lineHeight: 1.25,
    fontWeight: active ? 700 : 400, textAlign: 'center',
    color: active ? '#f1cf7b' : '#d4d0c6', background: active ? '#31291c' : 'transparent',
    boxShadow: active ? 'inset 0 3px 0 #f1cf7b' : 'none',
  })
  const closeMore = details => {
    if (!details) return
    details.open = false
    details.querySelector('summary')?.focus()
  }
  const itemButton = ({ key, label, icon }, inMore = false) => (
    <button key={key} type="button" aria-current={tab === key ? 'page' : undefined}
      aria-label={key === 'beskeder' && hasUnread ? 'Beskeder, ulæst indhold' : undefined}
      onClick={event => {
        if (inMore) closeMore(event.currentTarget.closest('details'))
        setTab(key)
      }}
      style={inMore ? { ...controlStyle(tab === key), flexDirection: 'row', gap: 12,
        width: '100%', justifyContent: 'flex-start', padding: '8px 16px', fontSize: 14 }
        : controlStyle(tab === key)}>
      <span aria-hidden="true" style={{ position: 'relative', display: 'flex' }}>
        {icon}
        {key === 'beskeder' && hasUnread && <span data-entropi2-unread=""
          style={{ position: 'absolute', top: -3, right: -4, width: 8, height: 8,
            borderRadius: '50%', background: '#f1cf7b', border: '2px solid #1c1c18' }} />}
      </span>
      <span>{label}</span>
    </button>
  )
  return (
    <>
      <style>{`
        [data-entropi2-bundnav] { display: none; }
        [data-entropi2-athlete] [data-entropi2-legacy-bundnav] { display: none !important; }
        [data-entropi2-athlete] [data-entropi2-bundnav] { display: flex; }
        [data-entropi2-bundnav] summary { list-style: none; }
        [data-entropi2-bundnav] summary::-webkit-details-marker { display: none; }
        [data-entropi2-bundnav] :is(button, summary):focus-visible {
          outline: 3px solid #f1cf7b; outline-offset: -3px;
        }
      `}</style>
      {/* Bottom navigation — Stævne vises kun når den er relevant (stævnedato/plan),
          ellers fylder den en fast plads for de 7/8 atleter uden et stævne på vej. */}
      <nav data-entropi2-legacy-bundnav="" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1c1c18', borderTop: '1px solid rgba(237,234,226,0.07)', display: 'flex', zIndex: 100 }}>
        {NAV_ITEMS.filter(n => visKost || n.key !== 'kost').filter(n => n.key !== 'stævnedag' || athlete?.competition_date || hasMeetPlan).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              padding: '0.7rem 0',
              color: tab === key ? '#c8923a' : '#a8a498',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.52rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition: 'color 0.15s ease',
            }}
          >
            <div style={{ position: 'relative' }}>
              {icon}
              {key === 'beskeder' && (unreadMsgCount + sharedVideoAnalyses.filter(a => !a.athlete_seen_at).length) > 0 && (
                <div style={{ position: 'absolute', top: -3, right: -4, width: '8px', height: '8px', borderRadius: '50%', background: '#c8923a', border: '1.5px solid #1c1c18' }} />
              )}
            </div>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <nav data-entropi2-bundnav="" aria-label="Hovednavigation"
        style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: '#1c1c18', borderTop: '1px solid rgba(237,234,226,0.15)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {primary.map(item => itemButton(item))}
        {more.length > 0 && <details style={{ flex: '1 1 0', minWidth: 44 }}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
          }}
          onKeyDown={event => {
            if (event.key === 'Escape' && event.currentTarget.open) {
              event.preventDefault()
              event.stopPropagation()
              closeMore(event.currentTarget)
            }
          }}>
          <summary aria-label={activeMore ? `Mere, aktiv fane: ${activeMore.label}` : undefined}
            style={controlStyle(Boolean(activeMore))}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
            </svg>
            <span>Mere</span>
          </summary>
          <div style={{ position: 'absolute', bottom: '100%', right: 8, width: 'min(280px, calc(100vw - 16px))',
            maxHeight: 'min(60vh, 24rem)', overflowY: 'auto', background: '#1c1c18',
            border: '1px solid #777267', borderRadius: '8px 8px 0 0', boxShadow: '0 -4px 20px #0006' }}>
            {more.map(item => itemButton(item, true))}
          </div>
        </details>}
      </nav>
    </>
  )
}

export default BundNav
