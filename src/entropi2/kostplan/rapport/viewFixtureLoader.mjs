// Scoped to this view in a single explicit test worker. Never used by the
// production entry or the independent real-React test file.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL === new URL('./KostrapportCoach.mjs', import.meta.url).href) {
    return { url: new URL('./viewFixture.mjs', import.meta.url).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
