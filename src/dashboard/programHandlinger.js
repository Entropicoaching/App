// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Program og kalender: blok-accordion, log-status pr. session, uge-/session-/
// øvelsesskrivning (tilføj, ret, slet, flyt, kopiér), ugeudkast og
// progression, blokplan, kalender-uger og -datoer, udsæt, øvelsesbiblioteket
// og "Sæt datoer". Handler-fabrik: Dashboard kalder den i hvert render.
import { computePhases } from '../dashboardShared'
import { supabase } from '../supabase'
import { progressionOverrideErrors, updateDraftForecast, updateForecastOverrideReason } from '../progressionDraft'
import { blockPurpose, buildPeriodizationSuggestion } from '../periodizationAssistant'
import { nextWeekStartDate, fillMissingWeekDates } from '../weekDates'

export function lavProgramHandlinger({
  askConfirm, athleteLogs, athletes, blockPlan, calendarWeeks, exerciseForm,
  exerciseLibrary, fetchAthleteWeekSummaries, fetchCalendarWeeks, fetchExerciseLibrary, fetchWeeks, libraryAddForm,
  libraryEditForm, openSessionId, openWeekId, planAssistantFocus, planStartDate, programBlockStart,
  recommendedInput, selectedAthlete, session, sessionForm, setAddingExercise, setAddingLibraryEx,
  setAddingSession, setAddingWeek, setApprovingProgression, setBlockPlan, setCalBlockAthlete, setCopyingExercise,
  setCopyingSession, setEditingExercise, setEditingLibraryEx, setEditingRecommended, setEditingSession, setEditingWeek,
  setExerciseForm, setLibraryAddForm, setOpenSessionId, setOpenWeekId, setPlanStartDate, setProgramBlockStart,
  setSessionForm, setShowBlockPlanner, setSnoozedAthletes, setWeekDateFill, setWeekDraft, setWeekForm,
  showFlash, weekDateFill, weekDraft, weekForm, weeks,
}) {
  // --- Program-fane: blok-accordion (vis én blok ad gangen) ---
  function programActiveStart() {
    if (programBlockStart === 'all') return 'all'
    const phases = computePhases(weeks)
    if (programBlockStart != null && phases.some(p => p.weeks[0].week_number === programBlockStart)) return programBlockStart
    const openPhase = openWeekId ? phases.find(p => p.weeks.some(w => w.id === openWeekId)) : null
    return (openPhase || phases[phases.length - 1])?.weeks[0]?.week_number ?? null
  }
  function programShownWeeks() {
    if (programBlockStart === 'all') return weeks
    const phases = computePhases(weeks)
    const start = programActiveStart()
    const ph = phases.find(p => p.weeks[0].week_number === start)
    return ph ? ph.weeks : weeks
  }
  function gotoWeek(week) {
    const ph = computePhases(weeks).find(p => p.weeks.some(w => w.id === week.id))
    if (ph) setProgramBlockStart(ph.weeks[0].week_number)
    setOpenWeekId(week.id)
    setTimeout(() => document.getElementById(`week-row-${week.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
  }
  // Hvor meget har atleten logget i en session: grøn=fuldt, amber=i gang, grå=intet.
  function sessionLogStatus(session) {
    const total = (session.exercises || []).reduce((a, e) => a + (e.sets || 0), 0)
    let logged = 0
    for (const log of athleteLogs) {
      if (!log.skipped && log.exercises?.session_id === session.id) logged++
    }
    let kind
    if (total > 0) {
      logged = Math.min(logged, total)
      kind = logged === 0 ? 'none' : logged >= total ? 'done' : 'partial'
    } else {
      kind = logged > 0 ? 'done' : 'none' // øvelser uden sæt-mål: vis blot om der er logget
    }
    const color = kind === 'done' ? '#6cba6c' : kind === 'partial' ? '#c8923a' : '#3a3a36'
    return { kind, logged, total, color }
  }


  // Find hvilket ugenummer hver atlet sidst loggede træning i (= hvor de er nu).
  // Sætter en bloks startdato fra kalender-tidslinjen og cascader fortløbende
  // datoer ud på hver uge i blokken (uge N = startdato + 7×(N − førsteUgeNr)).
  // Giver hver uge en eksplicit start_date → tidslinje + phase bar/board firmer op.
  async function setBlockStartDate(athleteId, blockWeeks, isoDate) {
    if (!isoDate || !blockWeeks?.length) return
    const sorted = [...blockWeeks].sort((a, b) => a.week_number - b.week_number)
    const base = new Date(isoDate + 'T12:00:00')
    const firstNo = sorted[0].week_number
    await Promise.all(sorted.map(w => {
      const d = new Date(base.getTime() + (w.week_number - firstNo) * 7 * 86400000)
      const ds = d.toISOString().slice(0, 10)
      return w.start_date === ds ? null : supabase.from('weeks').update({ start_date: ds }).eq('id', w.id)
    }))
    await fetchCalendarWeeks(athletes.map(a => a.id))
    if (selectedAthlete?.id === athleteId) fetchWeeks(athleteId)
  }


  // Udsæt opmærksomhed på en atlet til en dato (ISO yyyy-mm-dd). null = fjern udsættelse.
  // Persisteres i athletes.snooze_until så det følger med på tværs af enheder.
  async function snoozeAthlete(athId, untilDate) {
    setSnoozedAthletes(prev => {
      const next = { ...prev }
      if (untilDate) next[athId] = untilDate; else delete next[athId]
      return next
    })
    await supabase.from('athletes').update({ snooze_until: untilDate || null }).eq('id', athId)
  }




  async function approveDraftProgressionState() {
    const draftData = weekDraft?.data
    const proposal = draftData?.progression?.proposal
    const draft = draftData?.draft
    if (!proposal || !draft || !selectedAthlete?.id) return
    const overrideErrors = progressionOverrideErrors(proposal)
    if (overrideErrors.length) {
      setWeekDraft(current => current?.data ? {
        ...current,
        data: {
          ...current.data,
          progression: { ...current.data.progression, approval_error: overrideErrors.join(' · ') },
        },
      } : current)
      return
    }
    setApprovingProgression(true)
    const { data, error } = await supabase.functions.invoke('draft-next-week', {
      body: {
        mode: 'approve_progression_state',
        athlete_id: selectedAthlete.id,
        payload: {
          state: proposal,
          source_week_id: draft.source_week_id,
          target_week_number: draft.target_week_number,
          target_week_id: draft.target_week_id,
          draft_payload: draft.p_payload,
        },
      },
    })
    setApprovingProgression(false)
    if (error || data?.error || !data?.progression?.state_id) {
      let msg = data?.error || error?.message || 'Progressionstilstanden kunne ikke godkendes'
      try { const body = await error?.context?.json(); if (body?.error) msg = body.error } catch { /* behold msg */ }
      setWeekDraft(current => current?.data ? {
        ...current,
        data: {
          ...current.data,
          progression: { ...current.data.progression, approval_error: msg },
        },
      } : current)
      return
    }
    setWeekDraft(current => {
      if (!current?.data?.draft || current.data.draft.source_week_id !== draft.source_week_id) return current
      return {
        data: {
          ...current.data,
          draft: { ...current.data.draft, progression_state_id: data.progression.state_id },
          progression: { ...current.data.progression, ...data.progression, display_state: proposal, approval_error: null },
        },
      }
    })
    showFlash('Progressionstilstanden er godkendt for dette ugeudkast', 'success')
  }

  function editDraftForecast(key, field, value) {
    setWeekDraft(current => {
      const draftData = current?.data
      const draftPayload = draftData?.draft?.p_payload
      const progression = draftData?.progression
      const forecastState = progression?.proposal || progression?.display_state
      if (!draftPayload || !forecastState) return current
      const changed = updateDraftForecast({
        draftPayload,
        forecastState,
        baselineState: progression.baseline_state || forecastState,
        key,
        field,
        value,
      })
      if (!changed) return current
      return {
        ...current,
        data: {
          ...draftData,
          draft: { ...draftData.draft, p_payload: changed.draftPayload, progression_state_id: null },
          progression: {
            ...progression,
            status: 'approval_required',
            can_commit: false,
            state_id: null,
            version: null,
            proposal: changed.forecastState,
            display_state: changed.forecastState,
            reasons: ['Kladden er ændret og skal godkendes igen.'],
            approval_error: null,
          },
        },
      }
    })
  }

  function setDraftForecastOverrideReason(key, reason) {
    setWeekDraft(current => {
      const draftData = current?.data
      const progression = draftData?.progression
      const forecastState = progression?.proposal || progression?.display_state
      if (!forecastState) return current
      const nextState = updateForecastOverrideReason(forecastState, key, reason)
      return {
        ...current,
        data: {
          ...draftData,
          progression: {
            ...progression,
            proposal: nextState,
            display_state: nextState,
            approval_error: null,
          },
        },
      }
    })
  }

  async function addWeek() {
    const nextNum = weeks.length > 0 ? Math.max(...weeks.map(w => w.week_number)) + 1 : 1
    await supabase.from('weeks').insert({
      athlete_id: selectedAthlete.id,
      week_number: weekForm.week_number ? parseInt(weekForm.week_number) : nextNum,
      block_name: weekForm.block_name || null,
      coach_note: weekForm.coach_note || null,
      block_description: weekForm.block_description || null,
      start_date: weekForm.start_date || null,
    })
    setAddingWeek(false)
    setWeekForm({ week_number: '', block_name: '', coach_note: '', block_description: '', start_date: '' })
    fetchWeeks(selectedAthlete.id)
  }

  async function updateWeek(weekId) {
    await supabase.from('weeks').update({
      week_number: parseInt(weekForm.week_number),
      block_name: weekForm.block_name || null,
      coach_note: weekForm.coach_note || null,
      block_description: weekForm.block_description || null,
      start_date: weekForm.start_date || null,
    }).eq('id', weekId)
    setEditingWeek(null)
    fetchWeeks(selectedAthlete.id)
  }

  // Genererer tomme uger ud fra blockPlan for en atlet. Default = den valgte atlet
  // (Program-fanen), men kan kaldes med en athleteId fra kalenderen.
  async function generateWeeksFromPlan(athleteId = selectedAthlete?.id) {
    if (!athleteId || !planStartDate || !blockPlan.length) return
    // Find atletens eksisterende uger fra den rigtige kilde (Program-fane vs kalender).
    const existing = athleteId === selectedAthlete?.id ? weeks : (calendarWeeks[athleteId] || [])
    const nextNum = existing.length > 0 ? Math.max(...existing.map(w => w.week_number)) + 1 : 1
    const rows = []
    let weekNum = nextNum
    let currentDate = new Date(planStartDate + 'T12:00:00')
    for (const block of blockPlan) {
      for (let i = 0; i < (block.weeks || 1); i++) {
        rows.push({
          athlete_id: athleteId,
          week_number: weekNum++,
          block_name: block.name || null,
          start_date: currentDate.toISOString().slice(0, 10),
          coach_note: null,
          block_description: block.description || blockPurpose(block.name),
        })
        currentDate = new Date(currentDate.getTime() + 7 * 24 * 3600 * 1000)
      }
    }
    await supabase.from('weeks').insert(rows)
    setShowBlockPlanner(false)
    setCalBlockAthlete(null)
    if (athleteId === selectedAthlete?.id) fetchWeeks(athleteId)
    await fetchCalendarWeeks(athletes.map(a => a.id))
    fetchAthleteWeekSummaries(athletes.map(a => a.id))
  }

  // Planassistenten har ingen skriveadgang: den erstatter kun det lokale, redigerbare udkast.
  function applyPeriodizationSuggestion() {
    const suggestion = buildPeriodizationSuggestion({
      focus: planAssistantFocus,
      startDate: planStartDate,
      competitionDate: selectedAthlete?.competition_date,
    })
    if (!suggestion.ok) {
      showFlash(suggestion.reason, 'error')
      return
    }
    setBlockPlan(suggestion.blocks.map((block, index) => ({ id: Date.now() + index, ...block })))
    showFlash(suggestion.reason, 'success')
  }

  // Opretter ÉN tom uge (ingen sessioner/øvelser) for en atlet med en eksplicit
  // startdato — bruges når coachen klikker på en tom celle i kalender-tidslinjen.
  // week_number udledes af kalderen (se onEmptyCellClick) så ugen lægger sig præcis
  // hvor der blev klikket og holder anker-modellen konsistent. Samme insert-form
  // som addWeek/generateWeeksFromPlan.
  async function createCalendarWeek(athleteId, weekNumber, isoDate) {
    await supabase.from('weeks').insert({
      athlete_id: athleteId,
      week_number: weekNumber,
      block_name: null,
      coach_note: null,
      block_description: null,
      start_date: isoDate,
    })
    await fetchCalendarWeeks(athletes.map(a => a.id))
    fetchAthleteWeekSummaries(athletes.map(a => a.id))
    if (selectedAthlete?.id === athleteId) fetchWeeks(athleteId)
    showFlash('Uge oprettet — åbn atleten for at lægge øvelser ind.')
  }

  // Åbn kalender-blok-byggeren for en atlet; seed startdato efter deres sidste daterede uge (ellers i dag).
  function openCalBlockBuilder(a) {
    const wks = calendarWeeks[a.id] || []
    setPlanStartDate(nextWeekStartDate(wks))
    setCalBlockAthlete({ id: a.id, name: a.name })
  }

  function deleteWeek(weekId) {
    askConfirm('Slet denne uge og alle dens træninger?', async () => {
      await supabase.from('weeks').delete().eq('id', weekId)
      if (openWeekId === weekId) setOpenWeekId(null)
      fetchWeeks(selectedAthlete.id)
    })
  }

  async function addSession(weekId) {
    const week = weeks.find(w => w.id === weekId)
    const nextOrder = week?.sessions?.length || 0
    await supabase.from('sessions').insert({
      week_id: weekId,
      title: sessionForm.title || 'Træning',
      session_order: nextOrder,
      weekday: sessionForm.weekday ?? null,
    })
    setAddingSession(null)
    setSessionForm({ title: '', weekday: null })
    fetchWeeks(selectedAthlete.id)
  }

  async function updateSession(sessionId) {
    await supabase.from('sessions').update({ title: sessionForm.title, weekday: sessionForm.weekday ?? null }).eq('id', sessionId)
    setEditingSession(null)
    fetchWeeks(selectedAthlete.id)
  }

  function deleteSession(sessionId) {
    askConfirm('Slet denne træning?', async () => {
      await supabase.from('sessions').delete().eq('id', sessionId)
      if (openSessionId === sessionId) setOpenSessionId(null)
      fetchWeeks(selectedAthlete.id)
    })
  }

  async function reorderSession(weekId, sessionId, direction) {
    const week = weeks.find(w => w.id === weekId)
    const sorted = [...(week?.sessions || [])].sort((a, b) => (a.session_order - b.session_order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const idx = sorted.findIndex(s => s.id === sessionId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return
    ;[sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]]
    // Renummerér HELE ugen fortløbende (0,1,2,...). Robust selv når flere dage
    // delte samme session_order — en simpel ombytning af to ens værdier ville
    // ellers ikke ændre noget (årsag til at logget-importerede uger sad fast).
    await Promise.all(sorted.map((sn, i) =>
      sn.session_order === i ? null : supabase.from('sessions').update({ session_order: i }).eq('id', sn.id)))
    fetchWeeks(selectedAthlete.id)
  }

  async function reorderExercise(sessionId, exerciseId, direction) {
    const session = weeks.flatMap(w => w.sessions || []).find(s => s.id === sessionId)
    const sorted = [...(session?.exercises || [])].sort((a, b) => (a.exercise_order - b.exercise_order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const idx = sorted.findIndex(e => e.id === exerciseId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return
    ;[sorted[idx], sorted[swapIdx]] = [sorted[swapIdx], sorted[idx]]
    // Samme robuste renummerering som for dage (mod dublerede exercise_order).
    await Promise.all(sorted.map((ex, i) =>
      ex.exercise_order === i ? null : supabase.from('exercises').update({ exercise_order: i }).eq('id', ex.id)))
    fetchWeeks(selectedAthlete.id)
  }

  async function copySessionToWeek(session, targetWeekId) {
    const targetWeek = weeks.find(w => w.id === targetWeekId)
    const nextOrder = targetWeek?.sessions?.length || 0
    const { data: newSession } = await supabase.from('sessions').insert({
      week_id: targetWeekId,
      title: session.title,
      session_order: nextOrder,
    }).select().single()
    if (!newSession) return
    for (const ex of (session.exercises || [])) {
      await supabase.from('exercises').insert({
        session_id: newSession.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        intensity: ex.intensity,
        note: ex.note,
        recommended_weight: ex.recommended_weight ?? null,
        exercise_order: ex.exercise_order,
      })
    }
    setCopyingSession(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function copyExerciseToSession(ex, targetSessionId) {
    const targetSession = weeks.flatMap(w => w.sessions || []).find(s => s.id === targetSessionId)
    const nextOrder = targetSession?.exercises?.length || 0
    await supabase.from('exercises').insert({
      session_id: targetSessionId,
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      intensity: ex.intensity,
      note: ex.note,
      recommended_weight: ex.recommended_weight ?? null,
      exercise_order: nextOrder,
    })
    setCopyingExercise(null)
    fetchWeeks(selectedAthlete.id)
  }


  async function addLibraryExercise() {
    if (!libraryAddForm.name.trim()) return
    await supabase.from('exercise_library').insert({
      coach_id: session.user.id,
      name: libraryAddForm.name.trim(),
      category: libraryAddForm.category || 'Accessory',
    })
    setAddingLibraryEx(false)
    setLibraryAddForm({ name: '', category: 'Accessory' })
    fetchExerciseLibrary()
  }

  async function updateLibraryExercise(id) {
    if (!libraryEditForm.name.trim()) return
    const oldName = exerciseLibrary.find(e => e.id === id)?.name
    const newName = libraryEditForm.name.trim()
    await supabase.from('exercise_library').update({ name: newName, category: libraryEditForm.category }).eq('id', id)
    if (oldName && oldName !== newName) {
      await supabase.from('exercises').update({ name: newName }).eq('name', oldName)
      await supabase.from('personal_records').update({ exercise_name: newName }).eq('exercise_name', oldName)
    }
    setEditingLibraryEx(null)
    fetchExerciseLibrary()
  }

  function deleteLibraryExercise(id) {
    askConfirm('Slet øvelse fra biblioteket?', async () => {
      await supabase.from('exercise_library').delete().eq('id', id)
      fetchExerciseLibrary()
    })
  }

  async function addToLibraryQuick(name) {
    await supabase.from('exercise_library').insert({
      coach_id: session.user.id,
      name,
      category: 'Accessory',
    })
    fetchExerciseLibrary()
  }

  function canonicalName(typed) {
    if (!typed.trim()) return typed
    const lower = typed.trim().toLowerCase()
    const match = exerciseLibrary.find(e => e.name.toLowerCase() === lower)
    return match ? match.name : typed.trim()
  }

  function buildIntensity() {
    const v = exerciseForm.intensity.trim()
    if (!v) return null
    if (exerciseForm.intensityPrefix === 'RPE') return `RPE ${v}`
    if (exerciseForm.intensityPrefix === '%') return `${v}%`
    // "Tid": coachen skriver bare et tal → gem som "N sek" (atlet-appens stopur
    // forstår det via parseDuration). Hvis coachen selv tilføjer enhed/tekst
    // (fx "30 pr side"), bevares det.
    if (exerciseForm.intensityPrefix === 'Tid') return /\d\s*(sek|sec|min|s)\b/i.test(v) ? v : `${v} sek`
    return v
  }

  function parseIntensity(stored) {
    if (!stored) return { intensityPrefix: 'RPE', intensity: '' }
    if (stored.startsWith('RPE ')) return { intensityPrefix: 'RPE', intensity: stored.slice(4) }
    if (stored.endsWith('%')) return { intensityPrefix: '%', intensity: stored.slice(0, -1) }
    // Ren "N sek" → vis igen som Tid med bare tallet
    const m = stored.match(/^(\d+)\s*sek$/i)
    if (m) return { intensityPrefix: 'Tid', intensity: m[1] }
    return { intensityPrefix: 'Fri tekst', intensity: stored }
  }

  async function addExercise(sessionId) {
    const week = weeks.find(w => w.sessions?.some(s => s.id === sessionId))
    const session = week?.sessions?.find(s => s.id === sessionId)
    const nextOrder = session?.exercises?.length || 0
    await supabase.from('exercises').insert({
      session_id: sessionId,
      name: canonicalName(exerciseForm.name) || 'Øvelse',
      sets: parseInt(exerciseForm.sets) || null,
      reps: exerciseForm.reps || null,
      intensity: buildIntensity(),
      note: exerciseForm.note || null,
      exercise_order: nextOrder,
    })
    setAddingExercise(null)
    setExerciseForm({ name: '', sets: '', reps: '', intensity: '', intensityPrefix: 'RPE', note: '' })
    fetchWeeks(selectedAthlete.id)
  }

  async function updateExercise(exerciseId) {
    await supabase.from('exercises').update({
      name: canonicalName(exerciseForm.name),
      sets: parseInt(exerciseForm.sets) || null,
      reps: exerciseForm.reps || null,
      intensity: buildIntensity(),
      note: exerciseForm.note || null,
    }).eq('id', exerciseId)
    setEditingExercise(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function deleteExercise(exerciseId) {
    await supabase.from('exercises').delete().eq('id', exerciseId)
    fetchWeeks(selectedAthlete.id)
  }

  async function saveRecommendedWeight(exerciseId) {
    const val = recommendedInput.trim() ? parseFloat(recommendedInput) : null
    const { error } = await supabase.from('exercises').update({ recommended_weight: val }).eq('id', exerciseId)
    if (error) { showFlash(`Kunne ikke gemme: ${error.message}`, 'error'); return }
    setEditingRecommended(null)
    fetchWeeks(selectedAthlete.id)
  }

  async function copyWeek(weekId) {
    const week = weeks.find(w => w.id === weekId)
    if (!week) return
    const nextNum = Math.max(...weeks.map(w => w.week_number)) + 1
    const { data: newWeek } = await supabase.from('weeks').insert({
      athlete_id: selectedAthlete.id,
      week_number: nextNum,
      block_name: week.block_name,
      coach_note: week.coach_note,
      block_description: week.block_description,
      start_date: nextWeekStartDate(weeks),
    }).select().single()
    if (!newWeek) return
    for (const session of (week.sessions || [])) {
      const { data: newSession } = await supabase.from('sessions').insert({
        week_id: newWeek.id,
        title: session.title,
        session_order: session.session_order,
      }).select().single()
      if (newSession) {
        for (const ex of (session.exercises || [])) {
          await supabase.from('exercises').insert({
            session_id: newSession.id,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            intensity: ex.intensity,
            note: ex.note,
            exercise_order: ex.exercise_order,
          })
        }
      }
    }
    fetchWeeks(selectedAthlete.id)
    setOpenWeekId(newWeek.id)
  }

  // "Sæt datoer" (ordre 204, commit 2): forbereder previewet, rører ingen data endnu.
  function previewWeekDateFill() {
    setWeekDateFill({ rows: fillMissingWeekDates(weeks), saving: false })
  }

  // Gemmer previewet med samme skrive-kald som resten af uge-redigeringen
  // (supabase.from('weeks').update(...).eq('id', ...), jf. "Gem tilknytninger").
  async function applyWeekDateFill() {
    if (!weekDateFill?.rows?.length) { setWeekDateFill(null); return }
    setWeekDateFill(current => ({ ...current, saving: true }))
    await Promise.all(weekDateFill.rows.map(row =>
      supabase.from('weeks').update({ start_date: row.start_date }).eq('id', row.id)
    ))
    setWeekDateFill(null)
    fetchWeeks(selectedAthlete.id)
    showFlash(`${weekDateFill.rows.length} uge${weekDateFill.rows.length !== 1 ? 'r' : ''} fik en dato`, 'success')
  }

  return {
    programActiveStart, programShownWeeks, gotoWeek, sessionLogStatus, setBlockStartDate, snoozeAthlete,
    approveDraftProgressionState, editDraftForecast, setDraftForecastOverrideReason, addWeek, updateWeek, generateWeeksFromPlan,
    applyPeriodizationSuggestion, createCalendarWeek, openCalBlockBuilder, deleteWeek, addSession, updateSession,
    deleteSession, reorderSession, reorderExercise, copySessionToWeek, copyExerciseToSession, addLibraryExercise,
    updateLibraryExercise, deleteLibraryExercise, addToLibraryQuick, canonicalName, buildIntensity, parseIntensity,
    addExercise, updateExercise, deleteExercise, saveRecommendedWeight, copyWeek, previewWeekDateFill,
    applyWeekDateFill,
  }
}
