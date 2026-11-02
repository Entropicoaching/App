// Isolated synthetic run that returns descriptions instead of DOM nodes.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react') return { url: new URL('./reactElementFixture.mjs', import.meta.url).href, shortCircuit: true }
  return nextResolve(specifier, context)
}
