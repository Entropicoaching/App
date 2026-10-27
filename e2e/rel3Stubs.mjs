import { createElement as h } from './rel3Dom.mjs'
// Kun dekorative styles og den allerede daekkede legacy-detaljevisning erstattes.
export const s = new Proxy({}, { get: () => ({}) })
export default function LegacyDetails() { return h('p', null, 'Syntetisk legacy-grænse') }
