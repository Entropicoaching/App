import { SMERTE_BESKED, smerteBeskedFor } from '../../athlete/smerteStop.js'

const komma = value => String(value ?? '').replace(/(\d)\.(\d)/, '$1,$2')

// Ordre 2093: appens stigningsforslag og smertestoppet i Entropi 2-passet (Marc 5. okt.: "smerte-note standser stigningsforslag").
// Genbruger modellerne: p.suggestNextWeight er AthleteViews udenForslagVedSmerte-pakke (smerteStop.js).
// Rammer smertestoppet løftet, vises kun den rolige linje, aldrig et forslagstal. Uden data: null (ingen tom boks).
export function sessionForslag(p, ex) {
  const f = p?.suggestNextWeight
  if (typeof f !== 'function' || !ex || ex.recommended_weight != null) return null
  let suggestion = null, besked = null
  try { suggestion = f(ex.name, ex.intensity, ex.reps); besked = smerteBeskedFor(f, ex.name) } catch { return null }
  if (suggestion?.stop || besked) return { kind: 'smerte', lines: [SMERTE_BESKED] }
  const weight = Number(suggestion?.weight)
  if (!suggestion || !Number.isFinite(weight) || weight <= 0) return null
  const lines = [`Appens forslag: ${komma(weight)} kg${suggestion.fromRpe != null ? ` (RPE ${komma(suggestion.fromRpe)})` : ''}`]
  const reps = ex.reps != null && String(ex.reps).trim() !== '' ? String(ex.reps).trim() : null
  if (reps) lines.push(`Næste: ${reps} reps @ ${komma(weight)} kg`)
  return { kind: 'forslag', lines }
}
