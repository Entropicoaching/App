import { rel1030Feature } from './rel1030.mjs'

export const DEFAULT_HVILEDAGE_LISTE = false

// Local opt-in only: no persistence or data access.
export function hviledageListeEnabled(flag = DEFAULT_HVILEDAGE_LISTE, search = '') {
  const values = new URLSearchParams(search).getAll('hviledage')
  return flag === true || rel1030Feature('hviledage', search)
    || (values.length === 1 && values[0] === '1')
}
