// Test-only React substitute, restricted to this standalone view's import.
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL === new URL('./BlockOverview.mjs', import.meta.url).href) {
    return { url: new URL('./viewFixture.mjs', import.meta.url).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
