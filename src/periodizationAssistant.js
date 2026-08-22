const BLOCK_PURPOSES = {
  Akkumulering: 'Byg robust volumen og teknisk arbejde.',
  Intensificering: 'Skub styrkespecificitet og tungere arbejde gradvist.',
  Peak: 'Prioritér specifikke løft og friskhed frem mod præstation.',
  Deload: 'Sænk træthed og bevar rytmen før næste blok.',
  GPP: 'Byg generel kapacitet, bevægelseskvalitet og tolerance.',
  Hypertrofi: 'Byg muskelmasse og arbejdskapacitet med kontrolleret volumen.',
  Styrke: 'Prioritér tunge, stabile løft med tilstrækkelig tekniktræning.',
  Transition: 'Skab en rolig overgang og saml læring før næste retning.',
}

export function blockPurpose(name) {
  return BLOCK_PURPOSES[name] || 'Beskriv blokkens formål før den oprettes.'
}

export function withBlockPurposes(blocks) {
  return blocks.map(block => ({
    ...block,
    description: String(block.description || '').trim() || blockPurpose(block.name),
  }))
}

function isoAtNoon(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null
  const date = new Date(`${iso}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function fullWeeksUntil({ startDate, competitionDate }) {
  const start = isoAtNoon(startDate)
  const competition = isoAtNoon(competitionDate)
  if (!start || !competition) return null
  const weeks = Math.floor((competition.getTime() - start.getTime()) / (7 * 86400000))
  return weeks > 0 ? weeks : null
}

function block(name, weeks) {
  return weeks > 0 ? { name, weeks } : null
}

function competitionBlocks(totalWeeks) {
  if (totalWeeks === 1) return [block('Peak', 1)]
  if (totalWeeks === 2) return [block('Deload', 1), block('Peak', 1)]
  if (totalWeeks === 3) return [block('Intensificering', 1), block('Deload', 1), block('Peak', 1)]

  const deloadWeeks = 1
  const peakWeeks = totalWeeks >= 6 ? 2 : 1
  const intensificationWeeks = totalWeeks >= 8 ? Math.min(4, Math.max(2, Math.floor(totalWeeks * 0.35))) : 1
  const accumulationWeeks = totalWeeks - deloadWeeks - peakWeeks - intensificationWeeks
  return [
    block('Akkumulering', accumulationWeeks),
    block('Intensificering', intensificationWeeks),
    block('Deload', deloadWeeks),
    block('Peak', peakWeeks),
  ].filter(Boolean)
}

/**
 * Et gennemsigtigt, redigerbart planudkast — aldrig en automatisk programbeslutning.
 * En fremtidig model kan bruge samme input/output-kontrakt uden at få skriveadgang.
 */
export function buildPeriodizationSuggestion({ focus = 'competition', startDate, competitionDate }) {
  if (focus === 'competition') {
    const availableWeeks = fullWeeksUntil({ startDate, competitionDate })
    if (!availableWeeks) {
      return {
        ok: false,
        reason: 'Sæt en kommende stævnedato for et stævnespecifikt forslag.',
        blocks: [],
      }
    }
    return {
      ok: true,
      reason: `Forslag til ${availableWeeks} hele uger frem mod stævnet. Gennemgå før oprettelse.`,
      blocks: withBlockPurposes(competitionBlocks(availableWeeks)),
    }
  }

  const blocks = focus === 'offseason'
    ? [block('GPP', 3), block('Hypertrofi', 4), block('Styrke', 3), block('Deload', 1)]
    : [block('Hypertrofi', 4), block('Styrke', 3), block('Deload', 1)]
  return {
    ok: true,
    reason: 'Et generelt udkast. Tilpas blokke og uger til den konkrete atlet før oprettelse.',
    blocks: withBlockPurposes(blocks.filter(Boolean)),
  }
}
