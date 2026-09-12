// Coach Briefing / Indbakke — udskilt fra Dashboard.jsx (ordre 130 · commit 2)
// som sin egen lazy-loadede chunk, så atletlisten og check-in-gennemgangen
// ikke skal hente denne visning for at boote. Ren udflytning af JSX'en fra
// "view === 'inbox'"-blokken - ingen logikændring, kun frie variable gjort
// eksplicitte som props.
import { coachPriorityFocus } from '../coachPriority'
import { coachInboxCompletionStatus, shouldCollapseCoachConversations } from '../coachInboxState'
import { s, initials } from '../dashboardShared'

export default function IndbakkeView({
  athletes, coachPriorityItems, handleTrainingSignal, hiddenAthleteIds, inboxRefreshing,
  inboxRefreshStatus, isMobile, latestByTrack, messageInboxError, openCoachPriorityItem,
  openProfile, refreshCoachInbox, setCoachMsgTrack, trainingSignalsError,
  trainingSignalUpdatingKey, unreadByTrack, videoReviewQueueError,
}) {
  const visible = athletes.filter(athlete => !hiddenAthleteIds.has(athlete.id))
  const priorityItems = coachPriorityItems
  const priorityFocus = coachPriorityFocus(priorityItems)
  const rows = visible.flatMap(athlete => ['teknik', 'besked'].map(track => ({
        athlete,
        track,
        last: latestByTrack[athlete.id]?.[track] || null,
        unread: unreadByTrack[athlete.id]?.[track] || 0,
      }))).filter(row => row.last)
        .sort((x, y) => {
          if ((x.unread > 0) !== (y.unread > 0)) return x.unread > 0 ? -1 : 1
          return (y.last?.created_at || '').localeCompare(x.last?.created_at || '')
        })
  const fmtT = ts => {
    const date = new Date(ts); const now = new Date()
    return date.toDateString() === now.toDateString()
      ? date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  }
  const priorityError = trainingSignalsError || videoReviewQueueError || messageInboxError
  const completionStatus = coachInboxCompletionStatus({
    priorityCount: priorityItems.length,
    refreshStatus: inboxRefreshStatus,
    hasError: Boolean(priorityError),
  })
  const renderPriorityItem = item => {
    const signalUpdating = item.kind === 'signal' && trainingSignalUpdatingKey === `${item.signal.o_athlete_id}:${item.signal.o_detector}`
    return (
      <div key={item.key} style={{ padding: '0.62rem 0.7rem', border: `1px solid ${item.color}30`, background: '#171713' }}>
        <button onClick={() => openCoachPriorityItem(item, 'inbox')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', width: '100%', minHeight: 42, padding: 0, border: 'none', background: 'transparent', color: '#edeae2', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: '50%', background: item.color, boxShadow: `0 0 0 3px ${item.color}18` }} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem' }}>{item.title}</span>
              <span style={{ color: item.color, border: `1px solid ${item.color}44`, padding: '0.08rem 0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.4rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{item.label}</span>
            </span>
            <span style={{ display: 'block', marginTop: '0.18rem', color: '#7a7770', fontSize: '0.66rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</span>
          </span>
          {item.createdAt && <span style={{ color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', flexShrink: 0 }}>{fmtT(item.createdAt)}</span>}
          {item.count > 0 && <span style={{ minWidth: 19, height: 19, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 0.25rem', borderRadius: '999px', background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.45rem', fontWeight: 700 }}>{item.count}</span>}
          <span style={{ color: item.color, flexShrink: 0, fontSize: '0.7rem' }}>→</span>
        </button>
        {item.kind === 'signal' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem', paddingTop: '0.45rem', borderTop: '1px solid rgba(237,234,226,0.055)' }}>
            <button disabled={signalUpdating} onClick={() => handleTrainingSignal(item.signal, 'snooze')}
              style={{ ...s.btnGhost, padding: '0.28rem 0.5rem', fontSize: '0.46rem', opacity: signalUpdating ? 0.5 : 0.85 }}>Udsæt 7 dage</button>
            <button disabled={signalUpdating} onClick={() => handleTrainingSignal(item.signal, 'acknowledge')}
              style={{ ...s.btnPrimary, padding: '0.28rem 0.55rem', fontSize: '0.46rem', opacity: signalUpdating ? 0.5 : 1 }}>{signalUpdating ? 'Gemmer…' : 'Set'}</button>
          </div>
        )}
      </div>
    )
  }
  const unreadConversationCount = rows.filter(row => row.unread > 0).length
  const collapseConversations = shouldCollapseCoachConversations({
    isMobile,
    priorityCount: priorityItems.length,
    conversationCount: rows.length,
    hasMessageError: Boolean(messageInboxError),
  })
  const conversationsPanel = (
    <div style={{ ...s.card, marginBottom: 0, padding: '0.85rem 0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: rows.length || messageInboxError ? '0.45rem' : 0 }}>
        <div style={s.cardLabel}>Alle samtaler</div>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#4a4844' }}>{unreadConversationCount} ulæste spor</span>
      </div>
      {messageInboxError && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', marginBottom: rows.length ? '0.45rem' : 0, padding: '0.55rem 0.6rem', border: '1px solid rgba(224,85,85,0.18)', background: 'rgba(224,85,85,0.035)' }}>
          <span style={{ color: '#d79a83', fontSize: '0.64rem', lineHeight: 1.45 }}>{messageInboxError}</span>
          <button disabled={inboxRefreshing} onClick={refreshCoachInbox} style={{ ...s.btnGhost, minHeight: 34, padding: '0.3rem 0.55rem', fontSize: '0.45rem', opacity: inboxRefreshing ? 0.55 : 1, flexShrink: 0 }}>{inboxRefreshing ? 'Opdaterer…' : 'Prøv igen'}</button>
        </div>
      )}
      {!messageInboxError && rows.length === 0 ? (
        <div style={{ color: '#4a4844', fontSize: '0.7rem', padding: '0.45rem 0' }}>Ingen samtaler endnu. Start en besked fra atletens profil.</div>
      ) : rows.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((row, index) => {
            const technique = row.track === 'teknik'
            const trackColor = technique ? '#67dff5' : '#7a7770'
            return (
              <button key={`${row.athlete.id}-${row.track}`} onClick={() => { setCoachMsgTrack(row.track); openProfile(row.athlete, 'beskeder', 'inbox') }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', width: '100%', minHeight: 58, padding: '0.55rem 0', border: 'none', borderBottom: index < rows.length - 1 ? '1px solid rgba(237,234,226,0.055)' : 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ ...s.avatar, width: 36, height: 36, fontSize: '0.75rem', flexShrink: 0, borderColor: row.unread > 0 ? 'rgba(200,146,58,0.5)' : 'rgba(237,234,226,0.13)' }}>{initials(row.athlete.name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span style={{ fontSize: '0.84rem', color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.athlete.name}</span>
                    <span style={{ color: trackColor, border: `1px solid ${trackColor}44`, padding: '0.08rem 0.3rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.4rem', letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}>{technique ? 'Teknik & løft' : 'Besked'}</span>
                  </span>
                  <span style={{ display: 'block', marginTop: '0.16rem', color: row.unread > 0 ? '#b8b4a8' : '#7a7770', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.last.sender_role === 'coach' ? 'Dig: ' : ''}{row.last.content}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844' }}>{fmtT(row.last.created_at)}</span>
                  {row.unread > 0 && <span style={{ minWidth: 19, height: 19, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 0.28rem', borderRadius: '999px', background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', fontWeight: 700 }}>{row.unread}</span>}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
  return (
    <div style={{ ...s.page, ...(isMobile ? { padding: '1rem' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', margin: 0 }}>
            Indbakke<span style={{ color: '#c8923a' }}>.</span>
          </h1>
          {inboxRefreshStatus && (
            <div style={{ marginTop: '0.22rem', color: inboxRefreshStatus.kind === 'success' ? '#7fa188' : '#d79a83', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.04em' }}>
              {inboxRefreshStatus.kind === 'success' ? 'Opdateret' : `Delvist opdateret (${inboxRefreshStatus.completed}/${inboxRefreshStatus.total})`} kl. {new Date(inboxRefreshStatus.refreshedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <button disabled={inboxRefreshing} onClick={refreshCoachInbox}
          style={{ ...s.btnGhost, minHeight: 36, padding: '0.35rem 0.6rem', fontSize: '0.46rem', opacity: inboxRefreshing ? 0.55 : 0.9, flexShrink: 0 }}>
          {inboxRefreshing ? 'Opdaterer…' : '↻ Opdater'}
        </button>
      </div>

      {(priorityItems.length > 0 || priorityError) && (
        <div style={{ ...s.card, marginBottom: '1rem', borderColor: 'rgba(200,146,58,0.28)', background: 'rgba(200,146,58,0.035)', padding: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: priorityItems.length || priorityError ? '0.65rem' : 0 }}>
            <div>
              <div style={{ ...s.cardLabel, color: '#c8923a' }}>Vigtigst nu</div>
              <div style={{ color: '#7a7770', fontSize: '0.66rem', marginTop: '0.2rem' }}>Alerts først · derefter ældste ubesvarede besked eller video.</div>
            </div>
            {priorityItems.length > 0 && <span style={{ background: '#c8923a', color: '#141410', borderRadius: '999px', minWidth: '1.35rem', height: '1.35rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 0.35rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', fontWeight: 700 }}>{priorityItems.length}</span>}
          </div>
          {priorityError && <div style={{ color: '#d79a83', fontSize: '0.64rem', lineHeight: 1.45, marginBottom: priorityItems.length ? '0.6rem' : 0 }}>Noget af prioriteringskøen kunne ikke opdateres. Brug Opdater for at prøve igen.</div>}
          {priorityFocus.currentItem && (
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.45rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770' }}>Næste opgave</div>
              {renderPriorityItem(priorityFocus.currentItem)}
              {priorityFocus.remainingCount > 0 && (
                <details style={{ marginTop: '0.15rem' }}>
                  <summary style={{ minHeight: 38, display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.04em', listStylePosition: 'inside' }}>
                    Vis {priorityFocus.remainingCount} øvrige {priorityFocus.remainingCount === 1 ? 'opgave' : 'opgaver'}
                  </summary>
                  <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.3rem' }}>
                    {priorityFocus.remainingItems.map(renderPriorityItem)}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {completionStatus === 'complete' && (
        <div style={{ ...s.card, marginBottom: '1rem', borderColor: 'rgba(108,186,108,0.24)', background: 'rgba(108,186,108,0.035)', padding: '0.85rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(108,186,108,0.38)', background: 'rgba(108,186,108,0.07)', color: '#6cba6c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem' }}>✓</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', color: '#c9d7c7', fontSize: '0.78rem' }}>Indbakken er ryddet</span>
            <span style={{ display: 'block', marginTop: '0.16rem', color: '#7a7770', fontSize: '0.64rem', lineHeight: 1.4 }}>Ingen beskeder, videoer eller træningssignaler kræver dit blik lige nu.</span>
          </span>
        </div>
      )}

      {collapseConversations ? (
        <details style={{ border: '1px solid rgba(237,234,226,0.1)', background: '#171713' }}>
          <summary style={{ minHeight: 48, padding: '0.7rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', cursor: 'pointer', color: '#b8b4a8', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <span>Vis alle samtaler</span>
            <span style={{ color: unreadConversationCount > 0 ? '#c8923a' : '#5a5751', fontSize: '0.46rem', letterSpacing: '0.03em', textTransform: 'none' }}>{rows.length} samtaler · {unreadConversationCount} ulæste</span>
          </summary>
          <div style={{ borderTop: '1px solid rgba(237,234,226,0.07)' }}>{conversationsPanel}</div>
        </details>
      ) : conversationsPanel}
    </div>
  )
}
