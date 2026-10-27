import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { calendarDay } from '../calendarDate.js'
import { s } from '../dashboardShared'
import { danskDatoTekst } from '../danskDato.js'
import { coachMessageTrack } from '../coachInboxState.js'
import { HUB_SECTIONS } from './hubSektioner'
import { atletStatus } from './samletAtletprofil.js'
import KostmaalResume from './KostmaalResume'

const primary = ['program', 'log', 'beskeder']
const lifts = { squat: 'Squat', bench: 'Bænkpres', deadlift: 'Dødløft' }
const statusNames = { active: 'Aktiv', peaking: 'Formtop', offseason: 'Grundtræning', ferie: 'Ferie' }
const button = { background: 'none', border: 'none', color: '#b8b4a8', cursor: 'pointer', font: 'inherit', minHeight: 44 }

export default function SamletProfilHoved({
  a, activeTab, athleteLogs, gotoWeek, isMobile, latestByTrack, messages, navMenuOpen,
  nextPriorityItem, openCoachPriorityItem, openAwaitingAnalysisVideo, openVideoAnalysisReview,
  priorityQueueContext, profilePriorityContext, profileReturnView, setActiveTab, setCoachMsgTrack,
  setEditing, setNavMenuOpen, setOpenSessionId, setShowDeleteModal,
  setView, showFlash, unreadCounts, videoReviewQueue, weeks,
}) {
  const menu = useRef(null)
  const toggle = useRef(null)
  const [pendingVideo, setPendingVideo] = useState(null)
  // Den globale kø er begrænset til 50 videoer. Hent den seneste for netop
  // denne atlet, også når andre atleter fylder hele køen.
  useEffect(() => {
    let ignore = false
    supabase.from('video_analyses')
      .select('id,athlete_id,client_analysis_id,lift,variation,load_kg,reps_count,created_at,source_mode,status,session_context,analysis_state,video_path')
      .eq('athlete_id', a.id).eq('status', 'draft')
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data, error }) => {
        if (!ignore) setPendingVideo({ athleteId: a.id, rows: error ? [] : data || [] })
      }, () => { if (!ignore) setPendingVideo({ athleteId: a.id, rows: [] }) })
    return () => { ignore = true }
  }, [a.id, videoReviewQueue])
  useEffect(() => {
    if (!navMenuOpen) return
    const close = e => {
      if (e.type === 'keydown') {
        if (e.key !== 'Escape') return
        toggle.current?.focus()
      } else if (menu.current?.contains(e.target)) return
      setNavMenuOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [navMenuOpen, setNavMenuOpen])
  const go = key => { setActiveTab(key); setEditing(null); setNavMenuOpen(false) }
  const status = atletStatus({ athleteId: a.id, weeks, logs: athleteLogs,
    messages: [...Object.values(latestByTrack[a.id] || {}), ...messages],
    videos: pendingVideo?.athleteId === a.id ? pendingVideo.rows : [] })
  const openNext = () => {
    go('program')
    const week = weeks.find(w => w.athlete_id === a.id && w.sessions?.some(session => session.id === status.next.id))
    if (week) gotoWeek(week)
    setOpenSessionId(status.next.id)
  }
  const items = [
    status.week && { label: 'Denne uge', value: status.week.planned != null
      ? `${status.week.logged} af ${status.week.planned} pas logget` : `${status.week.logged} pas logget`, action: () => go('log') },
    status.message && { label: 'Seneste besked', value: status.message.content,
      detail: status.message.sender_role === 'coach' ? 'Fra dig' : 'Fra atleten',
      action: () => { setCoachMsgTrack(coachMessageTrack(status.message)); go('beskeder') } },
    status.video && { label: 'Video venter', value: lifts[status.video.lift] || 'Video', detail: danskDatoTekst(calendarDay(status.video.created_at || null)),
      action: () => {
        go('analyse')
        if (status.video.analysis_state === 'awaiting_analysis') openAwaitingAnalysisVideo(status.video)
        else openVideoAnalysisReview(status.video)
      } },
    status.next && { label: 'Næste pas', value: status.next.title, detail: danskDatoTekst(status.next.date), action: openNext },
  ].filter(Boolean)
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button onClick={() => setView(profileReturnView)} style={{ ...button, color: '#99958b', fontSize: '0.75rem', padding: 0 }}>← Tilbage til {profileReturnView === 'inbox' ? 'indbakken' : 'atleter'}</button>
        {nextPriorityItem && <button style={{ ...button, color: '#c8923a', fontSize: '0.75rem' }} onClick={() => openCoachPriorityItem(nextPriorityItem, 'inbox')}>Næste opgave →</button>}
        {priorityQueueContext?.state === 'complete' && <span style={{ color: '#6cba6c', fontSize: '0.75rem' }}>Køen er ryddet</span>}
      </div>
      <header style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 400, fontSize: '1.6rem', color: '#edeae2', margin: 0, overflowWrap: 'anywhere' }}>{a.name}</h1>
          <span style={s.badge(a.status)}>{statusNames[a.status]}</span>
        </div>
        {profilePriorityContext && <p style={{ fontSize: '0.8rem', color: '#b8b4a8', margin: '0.5rem 0' }}>{profilePriorityContext.summary}</p>}
      </header>
      {items.length > 0 && <section aria-label="Atletstatus" style={{ ...s.card, padding: '0.25rem', marginBottom: '0.5rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(item => <button key={item.label} onClick={item.action} style={{ ...button, textAlign: 'left', padding: '0.75rem', minWidth: 0 }}>
          <span style={{ display: 'block', color: '#99958b', fontSize: '0.7rem', marginBottom: '0.3rem' }}>{item.label}</span>
          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', fontSize: '0.85rem', color: '#edeae2', lineHeight: 1.4 }}>{item.value}</span>
          {item.detail && <span style={{ display: 'block', color: '#99958b', fontSize: '0.7rem', marginTop: '0.2rem' }}>{item.detail}</span>}
        </button>)}
      </section>}
      {activeTab !== 'kost' && <KostmaalResume a={a} onOpen={() => go('kost')} />}
      <nav aria-label="Atletens faner" style={{ display: 'flex', borderBottom: '1px solid rgba(237,234,226,0.12)', marginBottom: '1rem' }}>
        {primary.map(key => <button key={key} onClick={() => go(key)} aria-current={activeTab === key ? 'page' : undefined} style={{ ...button, flex: 1, fontSize: '0.8rem', color: activeTab === key ? '#c8923a' : '#b8b4a8', borderBottom: activeTab === key ? '2px solid #c8923a' : '2px solid transparent' }}>
          {HUB_SECTIONS.find(section => section.key === key).label}{key === 'beskeder' && unreadCounts[a.id] > 0 ? ` (${unreadCounts[a.id]})` : ''}
        </button>)}
        <div ref={menu} style={{ position: 'relative' }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setNavMenuOpen(false) }}>
          <button ref={toggle} aria-expanded={navMenuOpen} aria-controls="atlet-mere" onClick={() => setNavMenuOpen(open => !open)} style={{ ...button, padding: '0 0.75rem', fontSize: '0.8rem', color: primary.includes(activeTab) ? '#b8b4a8' : '#c8923a' }}>Mere ▾</button>
          {navMenuOpen && <div id="atlet-mere" style={{ position: isMobile ? 'fixed' : 'absolute', right: isMobile ? '1rem' : 0, ...(isMobile ? { bottom: 'calc(76px + env(safe-area-inset-bottom))', maxHeight: 'calc(100dvh - 110px)', overflowY: 'auto' } : { top: '100%' }), width: 'min(17rem, 80vw)', zIndex: 41, background: '#1c1c18', border: '1px solid rgba(237,234,226,0.15)', boxShadow: '0 10px 30px #0008', padding: '0.25rem' }}>
            {HUB_SECTIONS.filter(section => !primary.includes(section.key)).map(section => <button key={section.key} onClick={() => go(section.key)} aria-current={activeTab === section.key ? 'page' : undefined} style={{ ...button, display: 'block', textAlign: 'left', padding: '0.5rem 0.75rem', width: '100%', fontSize: '0.85rem', color: activeTab === section.key ? '#c8923a' : '#b8b4a8' }}>
              {section.key === 'oversigt' ? 'Profil og resultater' : section.key === 'kost' ? 'Kostmål' : section.label}
            </button>)}
            <button style={{ ...button, display: 'block', padding: '0.5rem 0.75rem', textAlign: 'left', width: '100%', fontSize: '0.85rem', borderTop: '1px solid #ffffff14' }} onClick={() => { navigator.clipboard?.writeText(a.id); showFlash('Atlet-ID kopieret'); setNavMenuOpen(false) }}>Kopiér atlet-ID</button>
            <button style={{ ...button, display: 'block', padding: '0.5rem 0.75rem', width: '100%', textAlign: 'left', color: '#e88888', fontSize: '0.85rem' }} onClick={() => { setNavMenuOpen(false); setShowDeleteModal(true) }}>Fjern atlet</button>
          </div>}
        </div>
      </nav>
    </>
  )
}
