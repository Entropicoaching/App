// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Skrivning om en atlet: stævneplan, opvarmning, opret/ret/fjern atlet,
// stævneresultat, samt eksport (træningsdata og sikkerhedskopi).
// Handler-fabrik: Dashboard kalder den i hvert render.
import { supabase } from '../supabase'
import { normalizeAthleteLoginEmail } from '../athleteOnboarding'
import { nextWeekStartDate } from '../weekDates'

export function lavAtletHandlinger({
  askConfirm, editData, emptyNewAthlete, exerciseLibrary, fetchAthletePRs, fetchMeetPlan,
  fetchMeetResults, fetchWarmupTemplates, meetPlanForm, meetResultForm, newAthlete, openProfile,
  selectedAthlete, session, setAddingWeek, setAddStep, setAthletes, setEditing,
  setEditingWarmup, setExportingBackup, setExportingTraening, setLastBackup, setMeetResultForm, setMeetResults,
  setNewAthlete, setSaving, setSavingMeetPlan, setSelectedAthlete, setShowAddModal, setShowDeleteModal,
  setView, setWarmupNewStep, setWeekForm, showFlash, warmupTemplates,
}) {
  async function saveMeetPlan(athleteId) {
    setSavingMeetPlan(true)
    const payload = {
      athlete_id: athleteId,
      meet_type: meetPlanForm.meet_type,
      squat1: meetPlanForm.squat1 || null, squat2: meetPlanForm.squat2 || null, squat3: meetPlanForm.squat3 || null,
      bench1: meetPlanForm.bench1 || null, bench2: meetPlanForm.bench2 || null, bench3: meetPlanForm.bench3 || null,
      dead1: meetPlanForm.dead1 || null, dead2: meetPlanForm.dead2 || null, dead3: meetPlanForm.dead3 || null,
      notes: meetPlanForm.notes || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('meet_plans').upsert(payload, { onConflict: 'athlete_id' })
    await fetchMeetPlan(athleteId)
    setSavingMeetPlan(false)
  }


  async function saveWarmupTemplate(category, steps, athleteId) {
    const existing = warmupTemplates.find(t => t.exercise_category === category && t.athlete_id === athleteId)
    if (existing) {
      await supabase.from('warmup_templates').update({ steps }).eq('id', existing.id)
    } else {
      await supabase.from('warmup_templates').insert({
        coach_id: session.user.id,
        athlete_id: athleteId,
        exercise_category: category,
        steps,
      })
    }
    fetchWarmupTemplates(selectedAthlete.id)
    setEditingWarmup(null)
    setWarmupNewStep('')
  }

  async function deleteWarmupTemplate(templateId) {
    await supabase.from('warmup_templates').delete().eq('id', templateId)
    fetchWarmupTemplates(selectedAthlete.id)
  }

  async function addAthlete() {
    if (!newAthlete.name.trim()) return
    setSaving(true)
    const na = newAthlete
    const num = v => (v !== '' && v != null ? parseFloat(v) : null)
    const int = v => (v !== '' && v != null ? parseInt(v) : null)
    const { data, error } = await supabase.from('athletes').insert({
      coach_id: session.user.id,
      name: na.name.trim(),
      email: normalizeAthleteLoginEmail(na.email) || null,
      age: int(na.age),
      sex: na.sex || null,
      bodyweight: num(na.bodyweight),
      height: num(na.height),
      weight_class: num(na.weightClass),
      status: na.status,
      goal: na.goal.trim() || null,
      competition_date: na.competition_date || null,
      notes: na.notes.trim() || null,
      // SBD-maks bruges direkte i "Dine rekorder"-totalen; OHP har ingen kolonne.
      squat: num(na.squat),
      bench: num(na.bench),
      deadlift: num(na.deadlift),
      kcal_target: int(na.kcal_target),
      protein_target: int(na.protein_target),
    }).select().single()
    if (!error) {
      // Opret startmaks som personal_records (inkl. OHP) → dukker op i atletens
      // "Dine rekorder" og e1RM-graf fra dag ét.
      const prs = [
        ['Squat', num(na.squat)], ['Bænkpres', num(na.bench)],
        ['Dødløft', num(na.deadlift)], ['OHP', num(na.ohp)],
      ].filter(([, w]) => w && w > 0)
        .map(([exercise_name, weight]) => ({ athlete_id: data.id, exercise_name, weight, reps: 1 }))
      if (prs.length) await supabase.from('personal_records').insert(prs)
      setAthletes(prev => [...prev, data])
      setShowAddModal(false)
      setAddStep(0)
      setNewAthlete(emptyNewAthlete)
      openProfile(data, 'program')
      setAddingWeek(true)
      setWeekForm({ week_number: '', block_name: '', coach_note: '', block_description: '',
        start_date: nextWeekStartDate([]) })
      showFlash(`${data.name} er oprettet. Opret den første programuge.`, 'success')
    } else {
      showFlash('Kunne ikke oprette atlet: ' + error.message, 'error')
    }
    setSaving(false)
  }

  async function saveEdit() {
    setSaving(true)
    const payload = { ...editData }
    // Tomme dato-felter må ikke sendes som '' til date-kolonner (Postgres-fejl).
    for (const k of ['competition_date', 'vacation_until']) {
      if (payload[k] === '') payload[k] = null
    }
    // Rydder man feriedatoen mens status ikke er ferie, så nulstil den helt.
    if (payload.status && payload.status !== 'ferie') payload.vacation_until = null
    const { data, error } = await supabase.from('athletes').update(payload).eq('id', selectedAthlete.id).select().single()
    if (!error) {
      setSelectedAthlete(data)
      setAthletes(prev => prev.map(a => a.id === data.id ? data : a))
    }
    setEditing(null)
    setSaving(false)
  }

  // Åbn "Registrér stævneresultat"-modal; forudfyld fra atletens stævneplan hvis den findes.
  async function openMeetResult() {
    if (!selectedAthlete) return
    const { data: mp } = await supabase.from('meet_plans').select('*').eq('athlete_id', selectedAthlete.id).maybeSingle()
    const type = mp?.meet_type || 'sbd'
    const sbd = type === 'sbd'
    setMeetResultForm({
      meet_date: selectedAthlete.competition_date || new Date().toISOString().slice(0, 10),
      meet_name: '',
      contest: { squat: sbd, bench: true, deadlift: sbd },
      squat: mp?.squat3 ?? selectedAthlete.squat ?? '',
      bench: mp?.bench3 ?? selectedAthlete.bench ?? '',
      deadlift: mp?.dead3 ?? selectedAthlete.deadlift ?? '',
      bodyweight: '',
      notes: '',
      setOffseason: true,
      clearDate: true,
      newDate: '',
      savePR: true,
    })
  }

  async function saveMeetResult() {
    const f = meetResultForm
    if (!f || !selectedAthlete) return
    const picked = ['squat', 'bench', 'deadlift'].filter(k => f.contest[k])
    if (!picked.length) { showFlash('Vælg mindst ét løft', 'error'); return }
    setSaving(true)
    const vals = {}
    picked.forEach(k => { vals[k] = (f[k] === '' || f[k] == null) ? null : parseFloat(f[k]) })
    const total = picked.reduce((sum, k) => sum + (vals[k] || 0), 0)
    const meet_type = picked.length === 3 ? 'sbd' : picked.length === 1 ? picked[0] : 'custom'
    const { error: insErr } = await supabase.from('meet_results').insert({
      athlete_id: selectedAthlete.id,
      meet_date: f.meet_date,
      meet_name: f.meet_name.trim() || null,
      meet_type,
      squat: vals.squat ?? null, bench: vals.bench ?? null, deadlift: vals.deadlift ?? null,
      total: total || null,
      bodyweight: f.bodyweight ? parseFloat(f.bodyweight) : null,
      notes: f.notes.trim() || null,
    })
    if (insErr) { showFlash('Kunne ikke gemme resultat', 'error'); setSaving(false); return }
    // Opdater kun de konkurrerede løfts maks (+ status/dato) — og kun hvis det nye
    // resultat faktisk er tungere end atletens nuværende maks. Et lavere stævneløft
    // må ikke trumfe en eksisterende rekord.
    const upd = {}
    picked.forEach(k => { if (vals[k] != null && vals[k] > (parseFloat(selectedAthlete[k]) || 0)) upd[k] = vals[k] })
    if (f.setOffseason) upd.status = 'offseason'
    if (f.clearDate) upd.competition_date = null
    else if (f.newDate) upd.competition_date = f.newDate
    if (Object.keys(upd).length) {
      const { data: updated } = await supabase.from('athletes').update(upd).eq('id', selectedAthlete.id).select().single()
      if (updated) { setSelectedAthlete(updated); setAthletes(prev => prev.map(x => x.id === updated.id ? updated : x)) }
    }
    if (f.savePR) {
      const labelMap = { squat: 'Squat', bench: 'Bænkpres', deadlift: 'Dødløft' }
      const candidates = picked.filter(k => vals[k] != null)
      // Hent nuværende bedste pr. løft, så vi kun gemmer en PR hvis stævnet slår den.
      const { data: existingPRs } = await supabase
        .from('personal_records')
        .select('exercise_name, weight')
        .eq('athlete_id', selectedAthlete.id)
        .in('exercise_name', candidates.map(k => labelMap[k]))
      const bestByName = {}
      for (const pr of (existingPRs || [])) {
        bestByName[pr.exercise_name] = Math.max(bestByName[pr.exercise_name] || 0, pr.weight || 0)
      }
      const prRows = candidates
        .filter(k => vals[k] > (bestByName[labelMap[k]] || 0))
        .map(k => ({ athlete_id: selectedAthlete.id, exercise_name: labelMap[k], weight: vals[k], reps: 1, logged_at: f.meet_date }))
      if (prRows.length) await supabase.from('personal_records').insert(prRows)
    }
    await fetchMeetResults(selectedAthlete.id)
    await fetchAthletePRs(selectedAthlete.id)
    setMeetResultForm(null)
    setSaving(false)
    showFlash('Stævneresultat registreret', 'success')
  }

  function deleteMeetResult(id) {
    askConfirm('Slet dette stævneresultat?', async () => {
      await supabase.from('meet_results').delete().eq('id', id)
      setMeetResults(prev => prev.filter(m => m.id !== id))
      showFlash('Resultat slettet', 'success')
    })
  }

  async function deleteAthlete() {
    await supabase.from('athletes').delete().eq('id', selectedAthlete.id)
    setAthletes(prev => prev.filter(a => a.id !== selectedAthlete.id))
    setShowDeleteModal(false)
    setView('list')
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportTraeningsdata() {
    setExportingTraening(true)
    const dateStr = new Date().toISOString().slice(0, 10)
    const { data: allAthletes } = await supabase.from('athletes').select('*').order('name')
    const result = { exported_at: new Date().toISOString(), athletes: [] }

    for (const ath of (allAthletes || [])) {
      const [prsRes, readRes, wgtRes, logsRes] = await Promise.all([
        supabase.from('personal_records').select('*').eq('athlete_id', ath.id).order('logged_at'),
        supabase.from('readiness_logs').select('*').eq('athlete_id', ath.id).order('logged_date'),
        supabase.from('weight_logs').select('*').eq('athlete_id', ath.id).order('logged_at'),
        supabase.from('exercise_logs')
          .select('*, exercises(id, name, sets, reps, intensity, session_id, sessions(id, title, athlete_rating, athlete_comment, weeks(week_number, block_name)))')
          .eq('athlete_id', ath.id)
          .order('logged_at'),
      ])

      const sessionDays = {}
      for (const log of (logsRes.data || [])) {
        const ex = log.exercises
        const sess = ex?.sessions
        const date = log.logged_at.slice(0, 10)
        const key = `${ex?.session_id}_${date}`
        if (!sessionDays[key]) {
          sessionDays[key] = {
            date,
            title: sess?.title || '',
            week_number: sess?.weeks?.week_number ?? null,
            block_name: sess?.weeks?.block_name ?? null,
            athlete_rating: sess?.athlete_rating ?? null,
            athlete_comment: sess?.athlete_comment ?? null,
            exerciseMap: {},
          }
        }
        const exId = log.exercise_id
        if (!sessionDays[key].exerciseMap[exId]) {
          sessionDays[key].exerciseMap[exId] = {
            name: ex?.name ?? null,
            category: exerciseLibrary.find(e => e.name.toLowerCase() === (ex?.name || '').toLowerCase())?.category ?? null,
            planned_sets: ex?.sets ?? null,
            planned_reps: ex?.reps ?? null,
            planned_intensity: ex?.intensity ?? null,
            logs: [],
          }
        }
        sessionDays[key].exerciseMap[exId].logs.push({
          set_number: log.set_number,
          weight: log.weight,
          reps_completed: log.reps_completed,
          rpe_planned: log.rpe_planned,
          rpe_actual: log.rpe_actual,
          skipped: log.skipped,
          note: log.note,
        })
      }

      const sessions = Object.values(sessionDays)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(({ exerciseMap, ...rest }) => ({
          ...rest,
          exercises: Object.values(exerciseMap).map(ex => ({
            ...ex,
            logs: ex.logs.sort((a, b) => a.set_number - b.set_number),
          })),
        }))

      result.athletes.push({
        name: ath.name,
        email: ath.email,
        weight_class: ath.weight_class,
        age: ath.age,
        personal_records: (prsRes.data || []).map(pr => ({ exercise_name: pr.exercise_name, weight: pr.weight, reps: pr.reps, logged_at: pr.logged_at })),
        readiness_logs: (readRes.data || []).map(r => ({ logged_date: r.logged_date, sleep_hours: r.sleep_hours, energy: r.energy, motivation: r.motivation, stress: r.stress, soreness_level: r.soreness_level, sore_zones: r.sore_zones, readiness_score: r.readiness_score })),
        weight_logs: (wgtRes.data || []).map(w => ({ weight: w.weight, logged_at: w.logged_at })),
        sessions,
      })
    }

    downloadJSON(result, `entropi-traening-${dateStr}`)
    setExportingTraening(false)
  }

  async function exportBackup() {
    setExportingBackup(true)
    const dateStr = new Date().toISOString().slice(0, 10)
    const tables = ['athletes', 'weeks', 'sessions', 'exercises', 'exercise_logs', 'meal_logs', 'weight_logs', 'readiness_logs', 'personal_records', 'messages', 'meet_plans', 'warmup_templates', 'exercise_library', 'custom_foods', 'meal_templates']
    const backup = { exported_at: new Date().toISOString(), tables: {} }
    for (const table of tables) {
      const { data } = await supabase.from(table).select('*')
      backup.tables[table] = data || []
    }
    downloadJSON(backup, `entropi-backup-${dateStr}`)
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ last_backup_at: now }).eq('id', session.user.id)
    setLastBackup(now)
    setExportingBackup(false)
  }

  return {
    saveMeetPlan, saveWarmupTemplate, deleteWarmupTemplate, addAthlete, saveEdit, openMeetResult,
    saveMeetResult, deleteMeetResult, deleteAthlete, downloadJSON, exportTraeningsdata, exportBackup,
  }
}
