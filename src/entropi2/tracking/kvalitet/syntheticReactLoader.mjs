// Test only: inspect the actual view's host element tree, without ReactDOM.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL?.endsWith('/kvalitet/Datagrundlag.mjs')) {
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
      export function createElement(type, props, ...children) {
        if (typeof type !== 'string') throw new Error('Expected host element');
        return { type, props: props || {}, children: children.flat(Infinity).filter(c => c != null && typeof c !== 'boolean') };
      }
    `) }
  }
  return nextResolve(specifier, context)
}
