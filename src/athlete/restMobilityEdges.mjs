// Explicit HVILE4 edges for the existing synthetic program/rest loaders.
// Resolve normally after validation; never discover dependencies or relax guards.
const edges = {
  'restMobility.mjs': ['../mobilityHomework.mjs', './coachMobility.mjs', './mobilityFocus.mjs', './mobilityCatalog.mjs'],
  'coachMobility.mjs': ['./mobilityFocus.mjs'],
  'mobilityFocus.mjs': [],
  'mobilityCatalog.mjs': [],
  '../mobilityHomework.mjs': ['react', './athlete/mobilityCatalog.mjs'],
}
export function assertRestMobilityEdge(specifier, parentURL, root) {
  const parent = Object.keys(edges).find(path => new URL(path, root).href === parentURL)
  if (parent !== undefined && !edges[parent].includes(specifier))
    throw Error('Unapproved synthetic dependency: ' + specifier)
  const normalized = decodeURIComponent(specifier).replaceAll(String.fromCharCode(92), '/')
  const name = normalized.split('/').at(-1).split(/[?#]/)[0].replace(/\.mjs$/i, '').toLowerCase()
  const target = Object.keys(edges).find(path => path.split('/').at(-1).replace(/\.mjs$/i, '').toLowerCase() === name)
  if (target !== undefined && parent === undefined &&
      !(parentURL === new URL('RestDays.jsx', root).href && specifier === './restMobility.mjs'))
    throw Error('Unapproved synthetic dependency: ' + specifier)
}
