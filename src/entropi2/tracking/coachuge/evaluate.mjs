import { antalOrd } from '../../antalOrd.mjs'
import { addCalendarDays } from '../../../calendarDate.js'
import { isDay } from '../visning/trackingContract.mjs'
import { buildAthleteSignalList } from '../signaler/athleteSignals.mjs'

const finite = n => typeof n === 'number' && Number.isFinite(n)
const between = (n, lo, hi) => finite(n) && n >= lo && n <= hi
const text = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 120
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const mean = rows => {
  const scale = Math.max(...rows)
  return scale === 0 ? 0 : rows.reduce((s, n) => s + n / scale, 0) / rows.length * scale
}
const median = values => {
  const a = [...values].sort((a, b) => a - b), i = Math.floor(a.length / 2)
  return a.length % 2 ? a[i] : a[i - 1] / 2 + a[i] / 2
}
export const formatNumber = n => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(n)
const f = formatNumber
const exceeds = (a, b) => a - b > Number.EPSILON * 128 * Math.max(1, Math.abs(a), Math.abs(b))

// Inputs are normalized, complete, authorized snapshots, NOT database rows.
// Whitelist every returned field: no private records or arbitrary metadata escape.
function rowsIn(rows, from, to, validate) {
  if (!Array.isArray(rows) || rows.length > 10000) return null
  if (rows.some(r => !r || !isDay(r.day))) return null
  const selected = rows.filter(r => r.day >= from && r.day <= to)
  if (new Set(selected.map(r => r.day)).size !== selected.length || selected.some(r => !validate(r))) return null
  return [...selected].sort((a, b) => compare(a.day, b.day))
}

function section(id, title, from, to, minimum, rows, value, rule, formula, observations, flagged, summary, strength = 'obs') {
  const count = rows === null ? null : rows.length
  const ready = count !== null && count >= minimum && finite(value)
  return { id, title, state: ready ? 'ready' : 'insufficient',
    flagged: ready && flagged, strength,
    value: ready ? value : null,
    dataBasis: { from, to, sampleCount: count, minimumSampleCount: minimum,
      sufficient: ready, summary: ready ? summary : count !== null && count >= minimum
        ? 'For lidt data: delvinduer eller beregningsgrundlag opfylder ikke reglen'
        : `For lidt data: ${count === null ? 'ukendt antal' : count} af mindst ${minimum} ${antalOrd(minimum, 'dag', 'dage')}`,
      rule, formula, observations: observations || [] } }
}

const fields = [
  ['sleepHours', 'Søvn', 0, 24, 't', n => exceeds(6, n), 'Middel <6 t'],
  ['sleepQuality', 'Søvnkvalitet', 1, 5, '/5', n => !exceeds(n, 2), 'Middel ≤2/5'],
  ['energy', 'Energi', 1, 5, '/5', n => !exceeds(n, 2), 'Middel ≤2/5'],
  ['stress', 'Stress', 1, 5, '/5', n => !exceeds(4, n), 'Middel ≥4/5'],
  ['soreness', 'Ømhed', 0, 10, '/10', n => !exceeds(7, n), 'Middel ≥7/10'],
]

/** Pure model, explicit opt-in. OFF does not read data. See README.md. */
export function evaluateCoachWeek(options = {}) {
  if (options?.enabled !== true) return { state: 'off', automaticChanges: false }
  const data = options.data
  const base = { automaticChanges: false, sections: [], flags: [] }
  if (data?.state === 'loading') return { ...base, state: 'loading' }
  if (!data || data.state !== 'ready' || data.complete !== true || !text(data.athleteId)
    || !isDay(data.asOf) || !addCalendarDays(data.asOf, -83)) return { ...base, state: 'error' }
  const { asOf, athleteId } = data
  const start = days => addCalendarDays(asOf, 1 - days)
  const daily = rowsIn(data.daily, start(7), asOf, r => r.source === 'athlete_manual'
    && fields.every(([key, , lo, hi]) => r[key] == null || between(r[key], lo, hi))
    && (r.pain == null || between(r.pain, 0, 10))
    && (!(r.pain > 0) || text(r.painLocation))
    && (!(r.soreness > 0) || text(r.sorenessLocation)))
  const sections = fields.map(([key, title, , , unit, flag, rule]) => {
    const rows = daily?.filter(r => r[key] != null) ?? null
    const value = rows?.length ? mean(rows.map(r => r[key])) : null
    return section(key, title, start(7), asOf, 4, rows, value, rule,
      'Aritmetisk middel af kendte dage; huller udfyldes ikke',
      rows?.map(r => `${r.day}: ${r[key]} ${unit}${key === 'soreness' && r.soreness > 0 ? ` · ${r.sorenessLocation}` : ''}`),
      value !== null && flag(value), `${f(value)} ${unit} · ${rows?.length}/7 dage`)
  })
  const painRows = daily?.filter(r => r.pain != null) ?? null
  const maxPain = painRows?.length ? Math.max(...painRows.map(r => r.pain)) : null
  const highestPain = painRows?.filter(r => r.pain === maxPain)
  sections.unshift(section('pain', 'Smerte', start(7), asOf, 1, painRows, maxPain,
    'Én observation ≥7/10: afklar smerte før øgning', 'Højeste enkeltobservation; intet gennemsnit',
    painRows?.map(r => `${r.day}: ${r.pain}/10${r.pain > 0 ? ` · ${r.painLocation}` : ''}`),
    maxPain >= 7, `Højeste smerte ${f(maxPain)}/10 · ${highestPain?.map(r => `${r.day}${r.pain > 0 ? ` · ${r.painLocation}` : ''}`).join('; ')} · ${painRows?.length}/7 dage`, 'vigtig'))

  const loadRows = rowsIn(data.loadDays, start(28), asOf, r => r.known === true
    && between(r.tonnageKg, 0, Number.MAX_VALUE) && (r.tonnageKg > 0 || r.restConfirmed === true))
  const acute = loadRows ? loadRows.filter(r => r.day >= start(7)).reduce((s, r) => s + r.tonnageKg, 0) : null
  const chronic = loadRows ? loadRows.reduce((s, r) => s + r.tonnageKg / 4, 0) : null
  const ratio = finite(acute) && finite(chronic) && chronic > 0 ? acute / chronic : null
  sections.push(section('load', 'Belastning', start(28), asOf, 28, loadRows, ratio,
    'A/C >1,5', 'A = sum sidste 7 dage; C = sum sidste 28 dage /4 (inkluderer A)',
    loadRows?.map(r => `${r.day}: ${r.tonnageKg} kg${r.restConfirmed === true ? ' · bekræftet hvile' : ''}`),
    finite(ratio) && exceeds(ratio, 1.5), `A ${f(acute)} kg · C ${f(chronic)} kg/uge · A/C ${f(ratio)} · ${loadRows?.length}/28 kendte dage`))

  // One explicitly selected lift + variant. Per-day best comes from actual sets.
  const strength = data.strength
  let strengthRows = null
  if (text(strength?.exerciseId) && text(strength.variantId) && Array.isArray(strength.sets)
    && strength.sets.length <= 10000 && Array.from(strength.sets).every(r => r && isDay(r.day)
      && text(r.id) && r.exerciseId === strength.exerciseId && r.variantId === strength.variantId
      && r.unit === 'kg' && typeof r.confirmed === 'boolean' && typeof r.skipped === 'boolean'
      && typeof r.deload === 'boolean' && between(r.kg, 0, Number.MAX_VALUE)
      && Number.isInteger(r.reps) && r.reps >= 0)
    && new Set(strength.sets.map(r => r.id)).size === strength.sets.length) {
    const best = new Map()
    let invalidEstimate = false
    for (const r of strength.sets) {
      if (r.day < start(84) || r.day > asOf || !r.confirmed || r.skipped || r.deload || r.kg <= 0 || r.reps < 1 || r.reps > 10) continue
      const estimate = r.kg * (1 + r.reps / 30)
      if (!finite(estimate)) { invalidEstimate = true; break }
      if (!best.has(r.day) || estimate > best.get(r.day).value) best.set(r.day, { day: r.day, value: estimate, kg: r.kg, reps: r.reps })
    }
    if (!invalidEstimate) strengthRows = [...best.values()].sort((a, b) => compare(a.day, b.day))
  }
  const early = strengthRows?.filter(r => r.day < addCalendarDays(start(84), 28))
  const late = strengthRows?.filter(r => r.day >= start(28))
  const before = early?.length ? median(early.map(r => r.value)) : null
  const after = late?.length ? median(late.map(r => r.value)) : null
  const delta = early?.length >= 3 && late?.length >= 3 ? 100 * (after / before - 1) : null
  sections.push(section('strength', 'Styrke', start(84), asOf, 6, strengthRows, delta,
    'Ændring <−2%; mindst 3 datoer i hver endeblok',
    'e1RM = kg × (1 + reps/30); højeste pr. dag; median første/sidste 28 dage',
    strengthRows?.map(r => `${r.day}: ${r.kg} kg × ${r.reps} reps → e1RM ${r.value} kg`),
    finite(delta) && exceeds(-2, delta), `${strength?.exerciseId} / ${strength?.variantId}: ${f(delta)}% · median ${f(before)} → ${f(after)} kg · ${early?.length}/${late?.length} datoer i endeblokke`))

  const nutrition = rowsIn(data.nutritionDays, start(28), asOf, r => r.complete === true
    && between(r.proteinG, 0, Number.MAX_VALUE) && finite(r.targetG) && r.targetG > 0 && text(r.targetVersion))
  const coverage = nutrition?.length ? mean(nutrition.map(r => r.proteinG / r.targetG * 100)) : null
  sections.push(section('nutrition', 'Protein', start(28), asOf, 21, nutrition, coverage,
    'Middel <90%; mindst 21 komplette dage med dateret mål', 'Middel af dagens protein_g / dagens mål_g ×100',
    nutrition?.map(r => `${r.day}: ${r.proteinG} g / ${r.targetG} g · målversion ${r.targetVersion}`),
    finite(coverage) && exceeds(90, coverage), `${f(coverage)}% af daterede proteinmål · ${nutrition?.length}/28 komplette dage`))

  const weights = rowsIn(data.weightDays, start(14), asOf, r => finite(r.kg) && r.kg > 0)
  const old = weights?.filter(r => r.day < start(7)), recent = weights?.filter(r => r.day >= start(7))
  const oldMean = old?.length ? mean(old.map(r => r.kg)) : null
  const newMean = recent?.length ? mean(recent.map(r => r.kg)) : null
  const change = old?.length >= 4 && recent?.length >= 4 ? 100 * (newMean / oldMean - 1) : null
  sections.push(section('weight', 'Vægt', start(14), asOf, 8, weights, change,
    'Absolut ændring >1%; mindst 4 datoer i hvert 7-dages vindue', '100 × (nyt middel / gammelt middel −1)',
    weights?.map(r => `${r.day}: ${r.kg} kg`), finite(change) && exceeds(Math.abs(change), 1),
    `${f(change)}% · ${f(oldMean)} → ${f(newMean)} kg · ${old?.length}/${recent?.length} datoer i vinduer`))

  const c = data.compliance
  const valid = c?.complete === true && text(c.programVersion) && Array.isArray(c.plannedIds)
    && Array.isArray(c.completedIds) && Array.isArray(c.extraIds)
    && [c.plannedIds, c.completedIds, c.extraIds].every(a => a.length <= 10000
      && Array.from(a).every(text) && new Set(a).size === a.length)
    && c.completedIds.every(id => c.plannedIds.includes(id)) && c.extraIds.every(id => !c.plannedIds.includes(id))
  const compliance = section('compliance', 'Planlagte pas', start(7), asOf, 1, null, null,
    '<75% bekræftede planlagte pas', '100 × gennemførte planlagte session-ID’er / planlagte session-ID’er', [], false, '')
  if (valid) {
    const n = c.plannedIds.length, value = n ? c.completedIds.length / n * 100 : null
    Object.assign(compliance, { state: n ? 'ready' : 'notPlanned', value, flagged: n > 0 && value < 75 })
    Object.assign(compliance.dataBasis, { sufficient: n > 0, sampleCount: n, minimumSampleCount: 1,
      summary: n ? `${c.completedIds.length}/${n} pas = ${f(value)}% · ${c.extraIds.length} ekstra pas` : 'Ingen planlagte pas',
      observations: [`Programversion: ${c.programVersion}`, `Planlagte: ${c.plannedIds.join(', ')}`, `Bekræftede: ${c.completedIds.join(', ')}`, `Ekstra: ${c.extraIds.join(', ')}`] })
  }
  sections.push(compliance)

  const sources = { load: 'belastning', strength: 'styrke', nutrition: 'kost', weight: 'vaegt' }
  const outputs = sections.filter(s => sources[s.id]).map(s => ({ athleteId, source: sources[s.id],
    signals: s.flagged ? [{ key: s.id, subject: 'weekly', strength: s.strength, reason: s.dataBasis.rule, dataBasis: s.dataBasis }] : [] }))
  const aggregated = buildAthleteSignalList({ enabled: true, athleteId, outputs })
  const accepted = new Set(aggregated.map(s => s.key))
  const flags = sections.filter(s => s.flagged && (!sources[s.id] || accepted.has(s.id)))
    .sort((a, b) => (a.strength === 'vigtig' ? 0 : 1) - (b.strength === 'vigtig' ? 0 : 1) || compare(a.id, b.id))
  const insufficient = sections.some(s => s.state === 'insufficient')
  const empty = sections.every(s => s.state === 'insufficient' && !s.dataBasis.sampleCount)
  return { ...base, asOf, from: start(7), state: flags.length ? 'flags' : empty ? 'empty' : insufficient ? 'insufficient' : 'noFlags',
    sections, flags, insufficient }
}
