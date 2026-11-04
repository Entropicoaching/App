// Test-only host element boundary for the actual component. Not React or layout.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL?.endsWith('/CoachMonth.mjs')) {
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
      export function createElement(type, props, ...children) {
        if (typeof type !== 'string') throw Error('Only host elements expected');
        return { type, props: props || {}, children: children.flat(Infinity).filter(c => c != null && typeof c !== 'boolean') };
      }
    `) }
  }
  return nextResolve(specifier, context)
}
