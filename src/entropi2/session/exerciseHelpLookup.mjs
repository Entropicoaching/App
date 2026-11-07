import { oevelsesForklaringer } from './oevelsesForklaringer.mjs'

const byExactName = new Map(oevelsesForklaringer.map(item => [item.name, item]))

// Names identify the documented variant only. Never infer from IDs, substrings,
// equipment, spelling similarity or a generic lift name. No implicit aliases.
export function exerciseHelpLookup(name) {
  return typeof name === 'string' ? byExactName.get(name) ?? null : null
}
