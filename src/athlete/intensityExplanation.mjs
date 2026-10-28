// Placeholder copy requested in APP-PROG5. No training or logging decisions.
export function intensityExplanation(intensity) {
  if (typeof intensity !== 'string') return null
  const match = intensity.trim().match(/^(RPE|RIR)\s*(10|[0-9])$/i)
  if (!match) return null
  const kind = match[1].toUpperCase(), value = Number(match[2])
  if (kind === 'RPE' ? value < 6 || value > 10 : value > 4) return null
  const reserve = kind === 'RPE' ? 10 - value : value
  const words = ['ingen gentagelser', 'én gentagelse', 'to gentagelser', 'tre gentagelser', 'fire gentagelser']
  return `${kind} ${value}: du kunne have taget ${words[reserve]} mere. Erfaring og teknik påvirker vurderingen, så sammenlign kun med din egen over tid.`
}
