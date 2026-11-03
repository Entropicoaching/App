// Test only. Replace just React's createElement boundary for the actual view.
// This is not a ReactDOM/browser/layout test and must never be used in the app.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL?.endsWith('/BelastningOgTrend.mjs')) {
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
      export function createElement(type, props, ...children) {
        if (typeof type !== 'string') throw new Error('Only host elements expected');
        return { type, props: props || {}, children: children.flat(Infinity).filter(c => c != null && typeof c !== 'boolean') };
      }
    `) }
  }
  return nextResolve(specifier, context)
}
