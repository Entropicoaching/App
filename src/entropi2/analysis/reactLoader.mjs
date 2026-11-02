// The only substituted import is React's createElement -> synthetic DOM.
// Application adapter/model and all metric helpers are actual imported files.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react') return { url: new URL('./testDom.mjs', import.meta.url).href, shortCircuit: true }
  return nextResolve(specifier, context)
}
