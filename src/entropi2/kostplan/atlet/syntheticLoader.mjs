// Only the new pure view gets this explicitly named fixture, in one test worker.
// The separate real-React test has no loader and cannot use this replacement.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL === new URL('./KostplanAtlet.mjs', import.meta.url).href) {
    return { url: new URL('./syntheticReact.mjs', import.meta.url).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
