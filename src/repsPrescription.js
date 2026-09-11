// Tolker exercises.reps (fri tekst skrevet af coachen) som enten et fast
// tal, et interval ("4-6") eller "frit" — de tre eneste former sæt-loggeren
// skal kunne skelne mellem. Alt andet (fx "AMRAP", "8 pr. side") opfører sig
// som i dag: fast, ikke-redigerbar reps-visning.

export function parseRepsPrescription(reps) {
  const raw = String(reps ?? '').trim()
  if (!raw) return { type: 'fixed', min: null, max: null }

  const rangeMatch = raw.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10)
    const max = parseInt(rangeMatch[2], 10)
    return { type: 'range', min, max }
  }

  if (raw.toLowerCase() === 'frit') {
    return { type: 'free', min: null, max: null }
  }

  return { type: 'fixed', min: null, max: null }
}
