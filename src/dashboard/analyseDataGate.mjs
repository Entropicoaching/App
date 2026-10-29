// Analysis-only opt-in. Shared dataEnough release and consumers stay unchanged.
import { dataEnoughEnabled as sharedEnabled, dataAllowed as sharedAllowed, dataMessage as sharedMessage, hasEnoughData } from '../dataEnough.mjs'
import { analyseMissingDataEnabled } from '../analyseMissingFlag.mjs'
import { MISSING_REQUIREMENTS } from '../dataMissing.mjs'

export function dataEnoughEnabled() {
  return analyseMissingDataEnabled() || sharedEnabled()
}
export function dataAllowed(id, evidence = {}) {
  return analyseMissingDataEnabled() ? hasEnoughData(id, evidence) : sharedAllowed(id, evidence)
}
export function dataMessage(id) {
  return analyseMissingDataEnabled()
    ? MISSING_REQUIREMENTS[id] || 'Endnu ikke nok sammenligneligt grundlag.'
    : sharedMessage(id)
}
