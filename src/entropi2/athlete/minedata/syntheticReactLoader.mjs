// Test-only element boundary. No ReactDOM, hooks or browser layout claims.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react') return { shortCircuit: true,
    url: new URL('../../analysis/reactElementFixture.mjs', import.meta.url).href }
  return nextResolve(specifier, context)
}
