// Hermetic host-tree inspection only; does not emulate React reconciliation or DOM.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL?.endsWith('/smerte/PainHistory.mjs')) {
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
      export function createElement(type, props, ...children) {
        if (typeof type !== 'string') throw Error('Only host elements supported');
        return { type, props: props || {}, children: children.flat(Infinity)
          .filter(child => child != null && typeof child !== 'boolean') };
      }
    `) }
  }
  return nextResolve(specifier, context)
}
