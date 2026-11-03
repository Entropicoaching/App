// Test boundary only: actual view/model/date imports remain unchanged.
// Host-element descriptions are not ReactDOM or browser-layout verification.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react') return { shortCircuit: true,
    url: new URL('./syntheticReact.mjs', import.meta.url).href }
  return nextResolve(specifier, context)
}
