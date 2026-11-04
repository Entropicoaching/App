// Explicit local test adapter only. Never registered by application or tests.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' || specifier === 'react-dom/server')
    return { url: new URL('./syntheticReactFixture.mjs', import.meta.url).href, shortCircuit: true }
  return nextResolve(specifier, context)
}
