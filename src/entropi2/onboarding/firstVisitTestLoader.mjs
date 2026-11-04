export function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL === new URL('./AthleteIntroduction.mjs', import.meta.url).href)
    return { shortCircuit: true, url: new URL('./firstVisitTestHost.mjs', import.meta.url).href }
  return nextResolve(specifier, context)
}
