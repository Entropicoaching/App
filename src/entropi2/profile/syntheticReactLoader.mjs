// Test-only fallback when the public copy has no installed React package.
// Installed React always wins. The fallback preserves React 19 element shape,
// including scalar/array children, booleans and the special key property.
// It does not simulate ReactDOM, hooks or layout.
export async function resolve(specifier, context, nextResolve) {
  const leaves = ['Profile.mjs', 'ProfileGoalsView.mjs'].map(name => new URL(name, import.meta.url).href)
  if (specifier !== 'react' || !leaves.includes(context.parentURL)) {
    return nextResolve(specifier, context)
  }
  try { return await nextResolve(specifier, context) }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
    return {
      url: 'data:text/javascript,' + encodeURIComponent(`
        export function createElement(type, config, ...children) {
          const props = { ...config }
          const key = config?.key == null ? null : String(config.key)
          delete props.key
          if (children.length === 1) props.children = children[0]
          else if (children.length > 1) props.children = children
          return { $$typeof: Symbol.for('react.transitional.element'), type, key, props, _owner: null }
        }
      `), shortCircuit: true,
    }
  }
}
