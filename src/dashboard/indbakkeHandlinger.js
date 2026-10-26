import { formatMessageTime } from '../messageTime.js'

// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Coach Briefing og beskeder: "Set" på et punkt, automatiseringsfejl,
// træningssignaler (set/udsæt), læst-markering, send, fastgør og tidstekst.
// Handler-fabrik: Dashboard kalder den i hvert render.
import { coachBriefingPointKey, coachBriefingSeenErrorMessage } from '../coachBriefingSeen'
import { supabase } from '../supabase'
import { RESOLVE_AUTOMATION_ALERT_RPC, automationAlertResolveErrorMessage } from '../automationAlerts'
import { coachMessageTrack, trainingSignalFingerprint } from '../coachInboxState'

export function lavIndbakkeHandlinger({
  athletes, coachMsgTrack, fetchLatestMessages, fetchMessages, messageInput, messageThreadAthleteRef,
  selectedAthlete, sendingMessage, session, setAutomationAlertActionError, setAutomationAlerts, setAutomationAlertUpdatingId,
  setCoachBriefingSeen, setCoachBriefingSeenSavingKey, setMessageInput, setMessages, setMessageSendError, setSendingMessage,
  setTrainingSignals, setTrainingSignalUpdatingKey, showFlash,
  coachSvarEnabled = false, messageSeenPendingRef, setUnreadByTrack, setUnreadCounts,
}) {
  // "Set" på et punkt under "Kræver dit blik" (ORDRE 325): dæmper punktet i
  // appen OG lader n8n's Coach Briefing-mail se at Marc allerede har set det
  // (entropi_coach_briefing_v1's nye seen_at, se coach-briefing-seen-v1.sql).
  // Samme "aldrig stille"-princip som handleAutomationAlert: findes tabellen
  // ikke endnu, fejler trykket synligt ved punktet, punktet bliver ikke dæmpet.
  async function handleCoachBriefingSeen(item) {
    const pointKey = coachBriefingPointKey(item)
    if (!pointKey) return
    setCoachBriefingSeenSavingKey(pointKey)
    const now = new Date().toISOString()
    const { error } = await supabase.from('coach_briefing_seen').upsert({
      coach_id: session.user.id,
      point_key: pointKey,
      seen_at: now,
    }, { onConflict: 'coach_id,point_key' })
    setCoachBriefingSeenSavingKey(null)
    if (error) {
      showFlash(coachBriefingSeenErrorMessage(error), 'error')
      return
    }
    setCoachBriefingSeen(current => ({ ...current, [pointKey]: now }))
    showFlash('Markeret som set', 'success')
  }

  // "Markeret som set" går via RPC'en resolve_automation_alert_v1 (SQL-filen
  // under supabase/sql/ koeres foerst efter Marcs ja). Findes den ikke endnu,
  // bliver rækken stående og fejlen vises ved rækken - aldrig stille.
  async function handleAutomationAlert(alert) {
    setAutomationAlertUpdatingId(alert.id)
    setAutomationAlertActionError(null)
    const { error } = await supabase.rpc(RESOLVE_AUTOMATION_ALERT_RPC, { alert_id: alert.id })
    setAutomationAlertUpdatingId(null)
    if (error) {
      const message = automationAlertResolveErrorMessage(error)
      setAutomationAlertActionError({ id: alert.id, message })
      showFlash(message, 'error')
      return
    }
    setAutomationAlerts(current => current.filter(item => item.id !== alert.id))
    showFlash('Markeret som set', 'success')
  }

  async function handleTrainingSignal(signal, mode) {
    const key = `${signal.o_athlete_id}:${signal.o_detector}`
    setTrainingSignalUpdatingKey(key)
    const now = new Date()
    const snoozedUntil = mode === 'snooze'
      ? new Date(now.getTime() + 7 * 86400000).toISOString()
      : null
    const { error } = await supabase.from('coach_signal_actions').upsert({
      coach_id: session.user.id,
      athlete_id: signal.o_athlete_id,
      detector: signal.o_detector,
      signal_fingerprint: mode === 'acknowledge' ? trainingSignalFingerprint(signal) : null,
      acknowledged_at: mode === 'acknowledge' ? now.toISOString() : null,
      snoozed_until: snoozedUntil,
      updated_at: now.toISOString(),
    }, { onConflict: 'coach_id,athlete_id,detector' })
    setTrainingSignalUpdatingKey(null)
    if (error) {
      showFlash(error.message || 'Signalet kunne ikke opdateres', 'error')
      return
    }
    setTrainingSignals(current => current.filter(item =>
      item.o_athlete_id !== signal.o_athlete_id || item.o_detector !== signal.o_detector))
    showFlash(mode === 'snooze' ? 'Udsat i 7 dage' : 'Markeret som set', 'success')
  }

  async function markMessagesRead(athleteId, track) {
    // Markér kun det aktive spor som læst, så det andet spors ulæst-tæller består.
    let query = supabase.from('messages').update({ read_by_coach: true })
      .eq('athlete_id', athleteId).eq('sender_role', 'athlete').eq('read_by_coach', false)
    query = track === 'teknik'
      ? query.eq('category', 'teknik')
      : query.or('category.eq.besked,category.is.null')
    const { error } = await query
    if (error) {
      await fetchLatestMessages(athletes.map(athlete => athlete.id))
      return
    }
    if (messageThreadAthleteRef.current === athleteId) {
      setMessages(prev => prev.map(message => message.athlete_id === athleteId && message.sender_role === 'athlete' &&
        (message.category || 'besked') === track ? { ...message, read_by_coach: true } : message))
    }
    await fetchLatestMessages(athletes.map(athlete => athlete.id))
  }

  async function markMessageSeen({ athleteId, messageId, track, through }) {
    if (!coachSvarEnabled || !session?.user?.id || messageSeenPendingRef.current ||
      !athletes.some(athlete => athlete.id === athleteId)) return
    if (!messageId && (!['besked', 'teknik'].includes(track) || !Number.isFinite(Date.parse(through)))) return
    const savingKey = messageId || `message-${athleteId}-${track}`
    messageSeenPendingRef.current = true
    setCoachBriefingSeenSavingKey(savingKey)
    try {
      let query = supabase.from('messages').update({ read_by_coach: true })
        .eq('athlete_id', athleteId).eq('sender_role', 'athlete').eq('read_by_coach', false)
      if (messageId) query = query.eq('id', messageId)
      else {
        // Kun beskeder i den viste opgave. En ny besked under gemning forbliver ulæst.
        query = query.lte('created_at', through)
        query = track === 'teknik' ? query.eq('category', 'teknik') : query.or('category.eq.besked,category.is.null')
      }
      const { data, error } = await query.select('id,category')
      if (error || !data?.length) throw error || new Error('Ingen beskeder opdateret')
      const updatedIds = new Set(data.map(message => message.id))
      if (messageThreadAthleteRef.current === athleteId) {
        setMessages(current => current.map(message => updatedIds.has(message.id) ? { ...message, read_by_coach: true } : message))
      }
      const counts = { besked: 0, teknik: 0 }
      for (const message of data) counts[coachMessageTrack(message)]++
      setUnreadCounts(current => ({ ...current, [athleteId]: Math.max(0, (current[athleteId] || 0) - data.length) }))
      setUnreadByTrack(current => ({ ...current, [athleteId]: {
        besked: Math.max(0, (current[athleteId]?.besked || 0) - counts.besked),
        teknik: Math.max(0, (current[athleteId]?.teknik || 0) - counts.teknik),
      } }))
      await fetchLatestMessages(athletes.map(athlete => athlete.id))
      showFlash('Markeret som set.', 'success')
    } catch {
      showFlash('Kunne ikke markere som set. Prøv igen.', 'error')
    } finally {
      messageSeenPendingRef.current = false
      setCoachBriefingSeenSavingKey(null)
    }
  }

  async function sendCoachMessage() {
    const content = messageInput.trim()
    if (!content || !selectedAthlete || sendingMessage) return
    const athleteId = selectedAthlete.id

    setSendingMessage(true)
    setMessageSendError(null)
    try {
      const { error } = await supabase.from('messages').insert({ athlete_id: athleteId, sender_role: 'coach', content, category: coachMsgTrack })
      if (error) throw error
      if (messageThreadAthleteRef.current === athleteId) setMessageInput('')
      await Promise.all([
        fetchMessages(athleteId),
        fetchLatestMessages(athletes.map(a => a.id)),
      ])
    } catch {
      if (messageThreadAthleteRef.current === athleteId) {
        setMessageSendError('Beskeden blev ikke sendt. Din tekst er bevaret — prøv igen.')
      }
    } finally {
      setSendingMessage(false)
    }
  }

  async function togglePin(messageId, currentPinned) {
    await supabase.from('messages').update({ pinned: !currentPinned }).eq('id', messageId)
    fetchMessages(selectedAthlete.id)
  }

  function formatMsgTime(ts) {
    return formatMessageTime(ts)
  }

  return {
    handleCoachBriefingSeen, handleAutomationAlert, handleTrainingSignal, markMessagesRead, markMessageSeen, sendCoachMessage, togglePin,
    formatMsgTime,
  }
}
