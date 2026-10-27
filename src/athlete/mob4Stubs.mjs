import { createElement } from './mob4Dom.mjs'
export default function Peripheral() { return null }
export const s = new Proxy({}, { get: (_, name) => name === 'badge' ? () => ({}) : {} })
export const supabase = { from() { throw Error('Backend forbidden in synthetic test') } }
export const initials = () => 'AT'
export const formatLastSeen = () => null
export const styrkeLinje = () => null
export const styrkeSmerteRegel = value => value
export const statusLabels = { active: 'Aktiv' }
export const HUB_SECTIONS = []
export function ProfileActions() { return null }
export function CoachFold({ children }) { return createElement('div', null, children) }
