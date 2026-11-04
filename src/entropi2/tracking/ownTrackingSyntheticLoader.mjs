// Narrow substitutions for synthetic checks only; never imported by app code.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL?.endsWith('/useOwnTracking.mjs'))
    return { shortCircuit: true, url: new URL('./ownTrackingHookFixture.mjs', import.meta.url).href }
  // Analysis imports other React leaves. All elements keep their actual types.
  if (specifier === 'react')
    return { shortCircuit: true, url: new URL('../analysis/reactElementFixture.mjs', import.meta.url).href }
  return nextResolve(specifier, context)
}
