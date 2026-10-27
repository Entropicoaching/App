// Public classic helper, imported as the real module in hermetic tests.
// Fixed cutoffs in the previous feedback have no documented measurement
// acceptance. More reps alone cannot authorize their interpretation.
globalThis.AppData2Video = Object.freeze({
  enabled() { return new URLSearchParams(globalThis.location?.search || '').get('appData2') === '1' },
  findings(v = {}) {
    const proof = v.dataEvidence || this.proof()
    if (!proof || proof.qualityChecked !== true || !Number.isInteger(proof.validReps) || proof.validReps < 3 ||
        proof.phasesKnown !== true || proof.calibrated !== true || proof.measurementBasis !== true) {
      return ['Observationsudkast afventer kvalitetskontrol, tre gyldige reps og dokumenteret målegrundlag.']
    }
    return ['Kvalitetskontrolleret observationsgrundlag registreret. ' + Object.entries(v).filter(([k, value]) => ['driftCm', 'romCm', 'mcv'].includes(k) && Number.isFinite(value)).map(([k, value]) => `${k}: ${value}`).join(', ') + '. Marc vurderer fortolkningen.']
  },
  feedback(v = {}) {
    const text = this.findings(v)[0]
    return { quality: 'unknown', strength: null, primary: null, secondary: [], strengths: [],
      context: [{ title: 'Grundlag', text }],
      athlete: { works: 'Rå observationer kan gennemgås med coachen.', focus: text,
        next: 'Coachen vurderer videoen og målegrundlaget.' } }
  },
  baseline(baselines = [], lift, variation, metrics = {}, lowConfPct, current = {}) {
    const result = { findings: [], used: [], comparedCount: 0, blockedByQuality: true }
    if (!Number.isFinite(lowConfPct) || lowConfPct < 0 || lowConfPct > 15) return result
    for (const b of baselines) {
      if (b.lift !== lift || b.variation !== variation) continue
      const m = metrics[b.metric_key]
      if (m?.eligible_for_baseline !== true || !Number.isFinite(m.value) || m.method !== b.metric_method) continue
      const version = current.engine_version && current.tracker_version ? current.engine_version + '|' + current.tracker_version : null
      const rows = (b.reference_analyses || []).filter(r => r.id && r.id !== current.id &&
        r.athlete_id === current.athlete_id && r.lift === lift && r.variation === variation &&
        ['coach_approved', 'shared'].includes(r.status) && r.engine_version + '|' + r.tracker_version === version &&
        r.metrics?.[b.metric_key]?.method === m.method && r.metrics[b.metric_key].eligible_for_baseline === true &&
        Number.isFinite(r.metrics[b.metric_key].value) && validDate(r.analyzed_at))
      const ids = new Set(rows.map(r => r.id)), dates = new Set(rows.map(r => r.analyzed_at.slice(0, 10)))
      if (!current.id || !current.athlete_id || !version || ids.size !== rows.length || ids.size < 5 || dates.size < 3) continue
      const values = rows.map(r => r.metrics[b.metric_key].value).sort((a, b) => a - b)
      const half = Math.floor(values.length / 2)
      const median = values.length % 2 ? values[half] : (values[half - 1] + values[half]) / 2
      const summary = `Observeret ${b.metric_key}: ${m.value}; referencemedian ${median} fra ${ids.size} godkendte analyser på ${dates.size} dage. Ingen teknikvurdering.`
      result.findings.push({ id: 'baseline_' + b.metric_key, kind: 'context', summary, evidence_refs: [b.metric_key], confidence: null })
      result.used.push({ metric_key: b.metric_key, metric_method: m.method, baseline_version: b.baseline_version,
        n_analyses: ids.size, median, reference_analyses: rows })
      result.comparedCount++
    }
    if (result.comparedCount) { result.blockedByQuality = false; return result }
    const reason = 'Personlig sammenligning afventer fem særskilte godkendte referenceanalyser på tre dage for hver metric med samme metode og version.'
    return { findings: [{ id: 'data_basis', kind: 'context', summary: reason, evidence_refs: [], confidence: null }], used: [], comparedCount: 0, blockedByQuality: true, reason }
  },
  mountQualityControls(doc, getClip, changed) {
    if (!this.enabled() || doc.getElementById('appData2-quality')) return
    const box = doc.createElement('fieldset'); box.id = 'appData2-quality'
    const legend = doc.createElement('legend'); legend.textContent = 'Kontrollér målegrundlaget'; box.appendChild(legend)
    const values = {}
    for (const [name, label, type] of [['validReps', 'Antal gennemgåede gyldige reps', 'number'],
      ['phasesKnown', 'Relevante faser er gennemgået', 'checkbox'], ['calibrated', 'Kalibrering er kontrolleret', 'checkbox'],
      ['measurementDocument', 'Beskriv det kontrollerede målegrundlag', 'text']]) {
      const line = doc.createElement('label'); line.textContent = label
      const input = doc.createElement('input'); input.type = type; input.name = name
      if (type === 'number') { input.min = '0'; input.step = '1' }
      input.oninput = () => { values[name] = type === 'checkbox' ? input.checked : input.value; qualityProof = null }
      line.appendChild(input); box.appendChild(line)
    }
    const button = doc.createElement('button'); button.type = 'button'; button.textContent = 'Bekræft gennemgangen'
    button.onclick = () => {
      const clip = getClip(), count = Number(values.validReps)
      qualityProof = clip && Number.isInteger(count) && count >= 3 && count <= clip.reps && values.phasesKnown &&
        values.calibrated && String(values.measurementDocument || '').trim() ? {
          key: clip.key, qualityChecked: true, validReps: count, phasesKnown: true, calibrated: true,
          measurementBasis: true, measurementDocument: values.measurementDocument,
        } : null
      currentClip = getClip
      changed()
    }
    box.appendChild(button); doc.body.appendChild(box)
  },
  proof() { return qualityProof && currentClip?.()?.key === qualityProof.key ? { ...qualityProof } : null },
})
let qualityProof = null, currentClip = null
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return false
  const date = value.slice(0, 10), n = Date.parse(date + 'T00:00:00Z')
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === date
}
