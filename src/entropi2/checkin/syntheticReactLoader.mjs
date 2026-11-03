// Test-only boundary: imports the actual component with synthetic React hooks.
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL === new URL('./WeeklyCheckIn.mjs', import.meta.url).href) {
    return { shortCircuit: true, url: new URL('./syntheticReact.mjs', import.meta.url).href }
  }
  return nextResolve(specifier, context)
}
