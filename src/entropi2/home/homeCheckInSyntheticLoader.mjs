export function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL === new URL('./HomeCheckIn.mjs', import.meta.url).href)
    return { shortCircuit: true, url: new URL('../checkin/syntheticReact.mjs', import.meta.url).href }
  return nextResolve(specifier, context)
}
