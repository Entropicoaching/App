// Deterministisk programvalg.
//
// Samme input giver altid samme program. Ingen tilfældighed, ingen model,
// ingen skjult vægtning — reglerne står her, og UI'et viser begrundelsen.

// Eksplicit .js-endelse: denne fil skal også kunne importeres direkte af
// node:test, og Node kræver den fulde sti (Vite er ligeglad).
import { PROGRAMS, STARTER_PROGRAM_ID, equipmentTier, getProgram } from './programs.js'

// Et program er en kandidat hvis brugeren har niveauet, nok dage og nok udstyr.
export function candidatePrograms({ level, daysPerWeek, equipment }) {
  const tier = equipmentTier(equipment)
  const days = Number(daysPerWeek) || 0
  return PROGRAMS.filter(p =>
    p.levels.includes(level) &&
    p.days <= days &&
    p.minEquipment <= tier
  )
}

// Blandt kandidaterne vælges flest ugentlige pas; ved lige antal dage vinder
// det højeste udstyrskrav (det mest specifikke program); ved fuldstændig lige
// stand vinder rækkefølgen i PROGRAMS. Ingen kandidat → startprogrammet.
export function selectProgram({ level, daysPerWeek, equipment }) {
  const candidates = candidatePrograms({ level, daysPerWeek, equipment })
  if (!candidates.length) {
    return { programId: STARTER_PROGRAM_ID, fallback: true }
  }
  const best = candidates.reduce((a, b) => {
    if (b.days !== a.days) return b.days > a.days ? b : a
    if (b.minEquipment !== a.minEquipment) return b.minEquipment > a.minEquipment ? b : a
    return a
  })
  return { programId: best.id, fallback: false }
}

// Menneskelæselig begrundelse. Brugeren skal kunne se hvorfor netop dette
// program blev valgt — ellers er "fast og gennemskueligt" kun en påstand.
// Samme valg, men holdt inden for hvad niveauet giver adgang til.
//
// Guiden spurgte foer 5. august aldrig om gratis eller medlem — alle blev
// 'member'. Forsiden stillede to soejler op, og saa ignorerede flowet valget.
// Naar guiden nu spoerger, skal programvalget respektere svaret, ellers ville
// en gratis-bruger blive sendt direkte ind i et betalt program.
export function selectProgramForTier({ level, daysPerWeek, equipment }, tilladteIds) {
  const tilladt = new Set(tilladteIds)
  const kandidater = candidatePrograms({ level, daysPerWeek, equipment })
    .filter(p => tilladt.has(p.id))

  if (!kandidater.length) {
    // Intet af det brugeren har adgang til passer paa svarene. Tag det foerste
    // tilladte frem for at falde tilbage paa noget niveauet ikke daekker.
    const [foerste] = tilladteIds
    return { programId: foerste || STARTER_PROGRAM_ID, fallback: true }
  }

  const best = kandidater.reduce((a, b) => {
    if (b.days !== a.days) return b.days > a.days ? b : a
    if (b.minEquipment !== a.minEquipment) return b.minEquipment > a.minEquipment ? b : a
    return a
  })
  return { programId: best.id, fallback: false }
}

export function explainSelection({ level, daysPerWeek, equipment }) {
  const { programId, fallback } = selectProgram({ level, daysPerWeek, equipment })
  const program = getProgram(programId)
  const days = Number(daysPerWeek) || 0

  if (fallback) {
    return `Dine valg passer ikke på et af de fire-dages programmer, så du starter på ${program.name} — det virker med det udstyr du har.`
  }
  const parts = [`${program.days} pas om ugen`]
  if (program.minEquipment === 2) parts.push('kræver træningscenter')
  else if (program.minEquipment === 1) parts.push('kræver håndvægte')
  else parts.push('kræver intet udstyr')

  const spare = days - program.days
  const spareNote = spare > 0
    ? ` Du har sat ${days} dage af — de sidste ${spare} kan bruges på gang, cykling eller hvile.`
    : ''
  return `${program.name}: ${parts.join(', ')}.${spareNote}`
}
