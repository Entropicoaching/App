// Test-only host-tree inspection. This does not emulate React or a browser DOM.
// Exact view scope prevents this fixture from leaking into other React tests.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react' && context.parentURL === new URL('./AthleteWeek.mjs', import.meta.url).href) {
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
      export function createElement(type, props, ...children) {
        if (typeof type !== 'string') throw Error('Host elements only');
        return { type, props: props || {}, children: children.flat(Infinity)
          .filter(child => child != null && typeof child !== 'boolean') };
      }
    `) }
  }
  return nextResolve(specifier, context)
}
