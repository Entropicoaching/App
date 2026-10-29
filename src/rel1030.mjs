// Lokalt tilvalg for denne URL. Ingen lagring eller dataadgang.
export const DEFAULT_REL1030 = false
export const REL1030_FEATURES = Object.freeze([
  'hviledage', 'mobilitetFoerPas', 'mobilitetFokus', 'mobilitetHjalp',
  'analyseSamlet', 'analyseSammenlign', 'coachRyd', 'coachUge',
  'videoFeedbackPlayback', 'analyseConclusion', 'mobilitetCoach', 'mobilitetHjemme',
])
export function rel1030Enabled(search = '') {
  const values = new URLSearchParams(search).getAll('rel1030')
  return values.length === 1 && values[0] === '1'
}
export function rel1030Feature(feature, search = '') {
  return REL1030_FEATURES.includes(feature) && rel1030Enabled(search)
}
export function rel1030Mobility(props, search = '') {
  if (!rel1030Enabled(search)) return props
  return { ...props, mobilitetFoerPas: true, mobilitetFokus: true, mobilitetHjalp: true, mobilitetCoach: true, mobilitetHjemme: true }
}
