// Kost-handlerne (kostlog, skabeloner, foedevaresoegning, egne foedevarer,
// ret/slet/fortryd) og kostfanens afledte tal (totaler, makro-cirkel, TDEE)
// — flyttet uaendret ud af AthleteView.jsx (ordre 373) som en fabrik:
// AthleteView kalder den i hvert render med sin egen tilstand, og faar de
// samme funktioner og tal tilbage (samme closures som foer). Ingen egen tilstand.
import { supabase } from '../supabase'
import { runGuardedWrite } from '../athleteWriteGuard'
import { runGuardedRead } from '../athleteReadGuard'
import { shiftDate, unitsForFood } from '../athleteShared'
import { LOCAL_FOODS } from './lokaleFoedevarer'
import { parseInputNumber, nutritionValues, finiteTotal, calendarTime } from './kostNumbers.mjs'

export function lavKostHandlinger({
  amount, athlete, createFood, customFoods, editGrams, editMacros, historicalMealLogs, kostDate,
  logs, onReadError, selectedFood, setAmount, setCreateFood, setCustomFoods, setEditGrams, setEditMacros,
  setEditingLogId, setFrequentFoods, setHistoricalMealLogs, setLogs, setMealTemplates, setSearchQuery, setSearchResults, setSelectedFood,
  setShowCreateFood, setShowSaveTemplate, setShowTemplates, setTemplateNameInput, setUndoPending, setUndoToast, setUnitIdx, shareFood,
  showFlash, templateNameInput, undoPending, undoTimerRef, undoToast, unitIdx, weightLogs,
}) {
  async function fetchLogs(athleteId, date = kostDate) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('meal_logs')
        .select('*')
        .eq('athlete_id', athleteId)
        .eq('date', date)
        .order('created_at'),
      onReadError('Dagens kostlog', athleteId),
    )
    if (!ok) return
    setLogs(data || [])
  }

  async function fetchHistoricalMealLogs(athleteId) {
    const from = new Date()
    from.setDate(from.getDate() - 28)
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('meal_logs')
        .select('date, kcal')
        .eq('athlete_id', athleteId)
        .gte('date', from.toISOString().slice(0, 10))
        .order('date'),
      onReadError('Kosthistorikken', athleteId),
    )
    if (!ok) return
    setHistoricalMealLogs(data || [])
  }

  // Find de fødevarer atleten oftest logger (sidste 30 dage) til hurtig gen-log.
  async function fetchFrequentFoods(athleteId) {
    const from = new Date()
    from.setDate(from.getDate() - 30)
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('meal_logs')
        .select('meal, kcal, protein, carb, fat, date')
        .eq('athlete_id', athleteId)
        .gte('date', from.toISOString().slice(0, 10))
        .order('date', { ascending: false }),
      onReadError('Hyppige fødevarer', athleteId),
    )
    if (!ok) return
    const map = new Map()
    for (const l of data || []) {
      if (!map.has(l.meal)) map.set(l.meal, { meal: l.meal, kcal: l.kcal, protein: l.protein, carb: l.carb, fat: l.fat, count: 0 })
      map.get(l.meal).count++
    }
    const list = [...map.values()].filter(f => f.count >= 2).sort((a, b) => b.count - a.count).slice(0, 8)
    setFrequentFoods(list)
  }

  async function quickLogFood(f) {
    if (!athlete) return
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert({
        athlete_id: athlete.id, date: kostDate,
        meal: f.meal, kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat,
      }),
      () => showFlash('Måltidet blev ikke logget. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (ok) fetchLogs(athlete.id)
  }

  async function fetchMealTemplates(athleteId) {
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('meal_templates')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false }),
      onReadError('Skabelonerne', athleteId),
    )
    if (!ok) return
    setMealTemplates(data || [])
  }

  async function copyYesterday() {
    const yStr = shiftDate(kostDate, -1) // dagen før den viste dag
    const { data } = await supabase
      .from('meal_logs')
      .select('meal, kcal, protein, carb, fat')
      .eq('athlete_id', athlete.id)
      .eq('date', yStr)
    if (!data || data.length === 0) return
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert(
        data.map(item => ({ ...item, athlete_id: athlete.id, date: kostDate }))
      ),
      () => showFlash('Måltiderne kunne ikke kopieres. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (ok) fetchLogs(athlete.id)
  }

  async function saveTemplate() {
    if (!templateNameInput.trim() || !logs.length || !athlete) return
    const items = logs.map(({ meal, kcal, protein, carb, fat }) => ({ meal, kcal, protein, carb, fat }))
    const ok = await runGuardedWrite(
      () => supabase.from('meal_templates').insert({ athlete_id: athlete.id, name: templateNameInput.trim(), items }),
      () => showFlash('Skabelonen blev ikke gemt. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchMealTemplates(athlete.id)
    setShowSaveTemplate(false)
    setTemplateNameInput('')
  }

  async function logTemplate(template) {
    if (!athlete) return
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert(
        template.items.map(item => ({ ...item, athlete_id: athlete.id, date: kostDate }))
      ),
      () => showFlash('Skabelonen kunne ikke logges. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchLogs(athlete.id)
    setShowTemplates(false)
  }

  async function deleteTemplate(id) {
    await supabase.from('meal_templates').delete().eq('id', id)
    setMealTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function fetchCustomFoods(athleteId) {
    // RLS returnerer delte fødevarer (is_shared) + egne. Tag 'mine' til badges/sletning.
    const { data, ok } = await runGuardedRead(
      () => supabase
        .from('custom_foods')
        .select('*')
        .order('name', { ascending: true }),
      onReadError('Fødevarelisten', athleteId),
    )
    if (!ok) return
    setCustomFoods((data || []).map(f => ({ ...f, mine: f.athlete_id === athleteId })))
  }

  function onSearchInput(e) {
    const q = e.target.value
    setSearchQuery(q)
    setSelectedFood(null)
    if (q.length < 2) { setSearchResults([]); return }
    const ql = q.toLowerCase()
    const custom = customFoods
      .filter(f => f.name.toLowerCase().includes(ql))
      .map(f => ({ ...f, isCustom: f.mine, isShared: !f.mine }))
    const builtin = LOCAL_FOODS.filter(f => f.name.toLowerCase().includes(ql))
    setSearchResults([...custom, ...builtin])
  }

  function selectFood(f) {
    setSelectedFood(f)
    setSearchQuery(f.name)
    setSearchResults([])
    // Hvis fødevaren har en stk-enhed, default til 1 af den (hurtigere); ellers 100 g.
    const units = unitsForFood(f)
    if (units.length > 1) { setUnitIdx(1); setAmount('1') }
    else { setUnitIdx(0); setAmount('100') }
  }

  async function addFromSearch() {
    if (!selectedFood || !athlete) return
    const units = unitsForFood(selectedFood)
    const unit = units[unitIdx] || units[0]
    const amt = parseInputNumber(amount)
    if (amt === null) return
    const grams = amt * unit.grams
    if (!Number.isFinite(grams) || grams < 0) return
    const ratio = grams / 100
    const nutrients = nutritionValues({ kcal: selectedFood.kcal100, protein: selectedFood.protein100, carb: selectedFood.carb100, fat: selectedFood.fat100 }, ratio)
    if (!nutrients) return
    // Beskriv portionen i navnet når enheden ikke er gram, så loggen er læsbar.
    const label = unit.label === 'g'
      ? `${selectedFood.name} · ${Math.round(grams)} g`
      : `${selectedFood.name} · ${amt} ${unit.label} (${Math.round(grams)} g)`
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert({
        athlete_id: athlete.id,
        date: kostDate,
        meal: label,
        kcal: nutrients.kcal,
        protein: nutrients.protein,
        carb: nutrients.carb,
        fat: nutrients.fat,
      }),
      () => showFlash('Fødevaren blev ikke logget. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    setSelectedFood(null)
    setSearchQuery('')
    fetchLogs(athlete.id)
  }

  // Hurtig-tilføj direkte fra søgeresultatet: 1 stk-enhed hvis den findes, ellers 100 g.
  // Rydder IKKE søgningen, så man kan trykke + på flere varer i træk (multi-add).
  async function quickAddSearchFood(f) {
    if (!athlete) return
    const units = unitsForFood(f)
    const unit = units.length > 1 ? units[1] : units[0]
    const amt = unit.label === 'g' ? 100 : 1
    const grams = amt * unit.grams
    if (!Number.isFinite(grams) || grams < 0) return
    const ratio = grams / 100
    const nutrients = nutritionValues({ kcal: f.kcal100, protein: f.protein100, carb: f.carb100, fat: f.fat100 }, ratio)
    if (!nutrients) return
    const label = unit.label === 'g'
      ? `${f.name} · ${Math.round(grams)} g`
      : `${f.name} · ${amt} ${unit.label} (${Math.round(grams)} g)`
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert({
        athlete_id: athlete.id,
        date: kostDate,
        meal: label,
        kcal: nutrients.kcal,
        protein: nutrients.protein,
        carb: nutrients.carb,
        fat: nutrients.fat,
      }),
      () => showFlash(`${f.name} blev ikke logget. Tjek din forbindelse og prøv igen.`, 'error'),
    )
    if (!ok) return
    fetchLogs(athlete.id)
    showFlash(`${f.name} tilføjet`)
  }

  async function saveCustomFood() {
    if (!createFood.name.trim() || !athlete) return
    const nutrients = Object.fromEntries(['kcal', 'protein', 'carb', 'fat'].map(key => [key + '100', parseInputNumber(createFood[key + '100'], 0)]))
    const unitGrams = parseInputNumber(createFood.unit_grams)
    if (Object.values(nutrients).some(value => value === null) ||
      (String(createFood.unit_grams).trim() && (unitGrams === null || unitGrams <= 0))) return
    const food = {
      athlete_id: athlete.id,
      name: createFood.name.trim(),
      ...nutrients,
      unit_label: createFood.unit_label.trim() || null,
      unit_grams: unitGrams,
      is_shared: shareFood,
    }
    const { data } = await supabase.from('custom_foods').insert(food).select().maybeSingle()
    if (data) {
      const saved = { ...data, isCustom: true, mine: true }
      setCustomFoods(prev => [saved, ...prev])
      selectFood(saved)
      setShowCreateFood(false)
      setCreateFood({ name: '', kcal100: '', protein100: '', carb100: '', fat100: '', unit_label: '', unit_grams: '' })
    }
  }

  async function deleteLog(l) {
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').delete().eq('id', l.id),
      () => showFlash('Måltidet blev ikke slettet. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    fetchLogs(athlete.id)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoToast({
      label: 'Måltid slettet',
      restore: { athlete_id: athlete.id, date: l.date, meal: l.meal, kcal: l.kcal, protein: l.protein, carb: l.carb, fat: l.fat },
    })
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000)
  }

  async function undoDelete() {
    const t = undoToast
    if (!t || undoPending) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoPending(true)
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').insert(t.restore),
      () => showFlash('Måltidet kunne ikke gendannes. Tjek din forbindelse og prøv igen.', 'error'),
    )
    setUndoPending(false)
    if (!ok) return
    setUndoToast(null)
    fetchLogs(athlete.id)
  }

  // Find gram-mængden i et logget måltidsnavn, fx "Kyllingebryst · 250 g" eller
  // "... (300 g)". Returnerer { base, grams } eller null hvis den ikke kan læses.
  function parseLoggedGrams(meal) {
    const m = String(meal).match(/(?:^| · |\()([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?)\s*g\)?\s*$/i)
    if (!m) return null
    const grams = parseInputNumber(m[1])
    if (grams === null || grams <= 0) return null
    return { base: String(meal).split(' · ')[0], grams }
  }

  function startEditLog(l) {
    setEditingLogId(l.id)
    const parsed = parseLoggedGrams(l.meal)
    if (parsed) setEditGrams(String(parsed.grams))
    else setEditGrams('')
    setEditMacros({ kcal: String(l.kcal ?? ''), protein: String(l.protein ?? ''), carb: String(l.carb ?? ''), fat: String(l.fat ?? '') })
  }

  async function saveEditLog(l) {
    const parsed = parseLoggedGrams(l.meal)
    let update
    if (parsed) {
      // Gram-skalering: vægt op/ned proportionalt og opdater gram i navnet.
      const newGrams = parseInputNumber(editGrams)
      if (newGrams === null || newGrams <= 0) return
      const factor = newGrams / parsed.grams
      const nutrients = nutritionValues(l, factor)
      if (!nutrients) return
      update = { meal: `${parsed.base} · ${Math.round(newGrams)} g`, ...nutrients }
    } else {
      // Direct edits use the same rounding as scaled portions.
      update = nutritionValues(editMacros)
      if (!update) return
    }
    const ok = await runGuardedWrite(
      () => supabase.from('meal_logs').update(update).eq('id', l.id),
      () => showFlash('Ændringen blev ikke gemt. Tjek din forbindelse og prøv igen.', 'error'),
    )
    if (!ok) return
    setEditingLogId(null)
    fetchLogs(athlete.id)
  }

  const totKcal = finiteTotal(logs, 'kcal')
  const totProtein = finiteTotal(logs, 'protein')
  const totCarb = finiteTotal(logs, 'carb')
  const totFat = finiteTotal(logs, 'fat')
  const percent = (total, target) => {
    const value = parseInputNumber(target)
    return value > 0 ? Math.round(Math.min(1, total / value) * 100) : 0
  }
  const kcalPct = percent(totKcal, athlete?.kcal_target)
  const proteinPct = percent(totProtein, athlete?.protein_target)

  const pKcal = Math.min(Number.MAX_VALUE, totProtein * 4)
  const cKcal = Math.min(Number.MAX_VALUE, totCarb * 4)
  const fKcal = Math.min(Number.MAX_VALUE, totFat * 9)
  const macroTotal = finiteTotal([{ value: pKcal }, { value: cKcal }, { value: fKcal }], 'value') || 1
  // Normalize before multiplication so the circle remains finite at extreme totals.
  const scale = Math.max(totProtein, totCarb, totFat) || 1
  const p = totProtein / scale * 4, c = totCarb / scale * 4, f = totFat / scale * 9
  const denominator = p + c + f || 1
  const circ = 2 * Math.PI * 48
  const pLen = p / denominator * circ
  const cLen = c / denominator * circ
  const fLen = f / denominator * circ

  const tdeeEstimate = (() => {
    const kcalByDate = {}
    for (const log of historicalMealLogs) {
      const kcal = parseInputNumber(log.kcal, 0)
      if (calendarTime(log.date) === null || kcal === null) return { ready: false, invalidData: true }
      const total = (kcalByDate[log.date] || 0) + kcal
      if (!Number.isFinite(total)) return { ready: false, invalidData: true }
      kcalByDate[log.date] = total
    }
    const kcalDays = Object.values(kcalByDate)
    if (kcalDays.length < 7) return { ready: false, missingKcalDays: Math.max(0, 7 - kcalDays.length) }
    if (weightLogs.some(log => calendarTime(log.logged_at) === null || !(parseInputNumber(log.weight) > 0))) return { ready: false, missingWeight: true }
    const wLogs = [...weightLogs].sort((a, b) => a.logged_at > b.logged_at ? 1 : -1)
    if (wLogs.length < 2) return { ready: false, missingWeight: true }
    const oldest = wLogs[0]
    const newest = wLogs[wLogs.length - 1]
    const daySpan = (new Date(newest.logged_at) - new Date(oldest.logged_at)) / 86400000
    if (!Number.isFinite(daySpan) || daySpan < 7) return { ready: false, missingWeight: true }
    const avgKcal = kcalDays.reduce((a, b) => a + b / kcalDays.length, 0)
    const weightChangePrDay = (parseInputNumber(newest.weight) - parseInputNumber(oldest.weight)) / daySpan
    const tdee = Math.round(avgKcal - weightChangePrDay * 7700)
    if (!Number.isFinite(tdee) || !Number.isFinite(avgKcal)) return { ready: false, invalidData: true }
    const confidence = kcalDays.length >= 14 && daySpan >= 21 ? 'høj' : kcalDays.length >= 10 && daySpan >= 14 ? 'moderat' : 'lav'
    return { ready: true, tdee, avgKcal: Math.round(avgKcal), kcalDays: kcalDays.length, daySpan: Math.round(daySpan), confidence }
  })()

  return {
    fetchLogs, fetchHistoricalMealLogs, fetchFrequentFoods, quickLogFood, fetchMealTemplates, copyYesterday, saveTemplate, logTemplate,
    deleteTemplate, fetchCustomFoods, onSearchInput, selectFood, addFromSearch, quickAddSearchFood, saveCustomFood, deleteLog,
    undoDelete, parseLoggedGrams, startEditLog, saveEditLog, totKcal, totProtein, totCarb, totFat,
    kcalPct, proteinPct, pKcal, cKcal, fKcal, macroTotal, circ, pLen,
    cLen, fLen, tdeeEstimate,
  }
}
