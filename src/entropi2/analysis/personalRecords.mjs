import { estimatedOneRepMax } from '../../exerciseProgress.js'
import { adaptPublicContract } from './publicContract.mjs'
import { MAIN_LIFTS } from './weekOverview.mjs'

// Pure read of the existing loaded logs, with the adapter's validation and
// local edit/undo ownership. No freshness/evidence gate: these are recorded
// maxima, not trends or readiness. Never claim a lifetime record.
export function personalRecords(props = {}, now = new Date()) {
  const contract = adaptPublicContract(props, now, { maxAgeDays: Infinity })
  const unavailable = contract.loading ? 'Henter løftehistorik. Rekorderne er ikke klar.'
    : !contract.historyReady ? 'Løftehistorik mangler. Rekorderne er ikke klar.'
      : !contract.today ? 'Dato mangler. Rekorderne kan ikke vises.' : null
  const lifts = []
  if (!unavailable) {
    for (const lift of MAIN_LIFTS) {
      const sets = contract.rows.filter(r => !r._optimistic && r.lift === lift)
        .map(r => ({ weight: r.weight, reps: r.reps_completed, date: r.logged_at,
          value: estimatedOneRepMax(r.weight, r.reps_completed) }))
        .filter(r => r.value > 0 && Number.isFinite(r.value))
      if (!sets.length) continue
      const heaviest = [...sets].sort((a, b) => b.weight - a.weight || b.reps - a.reps || a.date.localeCompare(b.date))[0]
      const bestEstimate = [...sets].sort((a, b) => b.value - a.value || b.weight - a.weight || a.date.localeCompare(b.date))[0]
      lifts.push({ lift, heaviest, bestEstimate })
    }
  }
  return { lifts, message: unavailable || (lifts.length ? 'Rekorder i den indlæste historik.'
    : 'Ingen rekorder i den indlæste historik. Log vægt og gentagelser på tunge sæt.'),
    note: 'Kun bekræftede tunge sæt med 1–8 gentagelser i kendte programblokke indgår. Deload, taper og aflastning er udeladt. e1RM er et beregnet enrepetitionsmaksimum. Ved samme vægt vælges flest gentagelser; ens rekorder vises med første dato.' }
}
