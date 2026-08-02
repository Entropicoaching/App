// Deterministisk valg af programtemplate. Dette vælger kun en reviewet struktur;
// det udsteder endnu ikke et færdigt træningsprogram.

import { PROGRAM_TEMPLATES, findTemplate } from './programTemplates.js'

export const TEMPLATE_MATCHER_VERSION = 3
export const PROGRAM_MATCH_INPUT_SCHEMA_VERSION = 4

const GOALS = new Set(['general-strength', 'powerlifting-foundation'])
const LEVELS = new Set(['begynder', 'oevet'])
const DAYS = new Set([2, 3, 4])
// The product deliberately exposes two meaningful environments. "Basic gym"
// looked precise but did not contain enough information to select safely.
const EQUIPMENT = new Set(['home', 'gym'])
const SQUAT_STYLES = new Set(['', 'high-bar', 'low-bar', 'not-sure'])
const DEADLIFT_STYLES = new Set(['', 'conventional', 'sumo', 'not-sure'])

function normalise(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return {
    goal: String(source.goal || '').trim(),
    level: String(source.level || '').trim(),
    daysPerWeek: Number(source.daysPerWeek),
    equipment: String(source.equipment || '').trim(),
    squatStyle: String(source.squatStyle || '').trim(),
    deadliftStyle: String(source.deadliftStyle || '').trim(),
  }
}

export function validateTemplateInput(input) {
  const profile = normalise(input)
  if (!GOALS.has(profile.goal) || !LEVELS.has(profile.level) || !DAYS.has(profile.daysPerWeek) || !EQUIPMENT.has(profile.equipment)) {
    return { valid: false, input: profile, reason: 'ugyldigt-grundinput' }
  }
  if (!SQUAT_STYLES.has(profile.squatStyle) || !DEADLIFT_STYLES.has(profile.deadliftStyle)) {
    return { valid: false, input: profile, reason: 'ugyldig-variant' }
  }
  return { valid: true, input: profile, reason: null }
}

export function candidateTemplates(input) {
  const validation = validateTemplateInput(input)
  if (!validation.valid) return []
  const profile = validation.input
  if (!Number.isInteger(profile.daysPerWeek)) return []

  return PROGRAM_TEMPLATES.filter(template =>
    template.status === 'review' &&
    template.focus.includes(profile.goal) &&
    template.levels.includes(profile.level) &&
    template.days === profile.daysPerWeek &&
    template.equipment === profile.equipment
  )
}

export function selectTemplate(input) {
  const validation = validateTemplateInput(input)
  const profile = validation.input
  if (!validation.valid) {
    return { outcome: 'manual-review', templateId: null, matcherVersion: TEMPLATE_MATCHER_VERSION, matchInput: profile, reason: validation.reason }
  }
  const candidates = candidateTemplates(profile)
  if (candidates.length !== 1) {
    return {
      outcome: 'manual-review',
      templateId: null,
      matcherVersion: TEMPLATE_MATCHER_VERSION,
      matchInput: profile,
      reason: candidates.length > 1 ? 'flere-gyldige-templates' : 'ingen-gyldig-template',
    }
  }

  const template = candidates[0]
  return {
    outcome: 'matched',
    templateId: template.id,
    matcherVersion: TEMPLATE_MATCHER_VERSION,
    matchInput: profile,
    reason: 'entydigt-match',
  }
}

export function explainTemplateSelection(input) {
  const selection = selectTemplate(input)
  if (selection.outcome !== 'matched') {
    return 'Dine valg passer ikke sikkert på en af de nuværende programrammer. Vi foreslår ikke et program endnu.'
  }

  const template = findTemplate(selection.templateId)
  const goal = selection.matchInput.goal === 'powerlifting-foundation'
    ? 'Du har valgt et styrkeløftfundament.'
    : 'Du har valgt generel styrke.'
  return `${goal} Med ${selection.matchInput.daysPerWeek} træningsdage og ${selection.matchInput.equipment} passer ${template.label || template.id} på den nuværende programramme.`
}
