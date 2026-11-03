// Test-only element fixture. Models and all their dependencies are real imports.
export async function resolve(specifier, context, next) {
  if (specifier === 'react') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
    export const createElement = (type, props, ...children) => ({ type, props: props || {}, children });
  `) }
  return next(specifier, context)
}
