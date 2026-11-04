import { beregnVolumenPrUge } from '../../volume/beregn.js'
import { MUSKELGRUPPER } from '../../volume/muskelkort.js'

// Same read-only props and standard exercise map as athlete/VolumenTab.jsx.
// No coach overrides, extra queries, program data or alternative set formula.
export function volumeModel({ volumeLogs, volumeLoading = true, volumeError, now = new Date() } = {}) {
  if (volumeError) return { state: 'error', message: 'Din volumen kunne ikke hentes. Prøv at åbne fanen igen.' }
  if (volumeLoading) return { state: 'loading', message: 'Henter din volumen…' }
  if (!Array.isArray(volumeLogs)) return { state: 'unavailable', message: 'Din volumen er ikke klar endnu.' }
  const sets = volumeLogs.filter(log => log && !log._optimistic).map(log => ({
    oevelseNavn: log.exercises?.name,
    loggetDato: log.logged_at,
    skipped: log.skipped,
  }))
  const weeks = beregnVolumenPrUge(sets, { antalUger: 2, referenceDato: now })
  if (weeks.length !== 2) return { state: 'unavailable', message: 'Dato mangler. Din volumen kan ikke vises.' }
  const [current, previous] = weeks
  const rows = Object.entries(MUSKELGRUPPER).map(([key, label]) => ({
    key, label, current: current.grupper[key]?.ialt ?? 0, previous: previous.grupper[key]?.ialt ?? 0,
  })).filter(row => row.current > 0 || row.previous > 0)
  return { state: 'ready', current, previous, rows,
    empty: rows.length === 0 && current.ukendteSaet === 0 && previous.ukendteSaet === 0 }
}

const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 })
export const formatSets = value => number.format(value)
export function weekLabel(key) {
  const [year, week] = key.split('-W')
  return `uge ${Number(week)}, ${year}`
}
