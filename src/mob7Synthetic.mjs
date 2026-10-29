const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
// Own synthetic React tree, hooks and import boundary. No browser or backend.
import { registryHooks } from './testModuleRegistry.mjs'
const root = new URL('./', import.meta.url)
const modules = new Map([
  ['mobilityAdherence.mjs', ['react', './mobilityHelped.mjs']],
  ['mobilityHelped.mjs', ['react']],
  ['mobilityHomework.mjs', ['react', './athlete/mobilityCatalog.mjs']],
  ['athlete/mobilityCatalog.mjs', []],
].map(([name, imports]) => [new URL(name, root).href, imports]))
export function allowedImport(specifier, parentURL) {
  if (modules.has(parentURL) && !modules.get(parentURL).includes(specifier)) throw Error('Forbidden synthetic import: ' + specifier)
}
export function install() {
  return registerHooks({ resolve(specifier, context, next) {
    allowedImport(specifier, context.parentURL)
    if (modules.has(context.parentURL) && specifier === 'react') return { url: import.meta.url, shortCircuit: true }
    return next(specifier, context)
  } })
}
export function cloneElement(element, props) { return { ...element, props: { ...element.props, ...props } } }
let current
export function createElement(type, props, ...children) { return { type, props: { ...props, children: (children.length ? children : [props?.children]).flat(Infinity).filter(child => child !== undefined) } } }
export function useState(initial) {
  const instance = current, index = instance.cursor++
  if (!(index in instance.state)) instance.state[index] = typeof initial === 'function' ? initial() : initial
  return [instance.state[index], value => { instance.state[index] = typeof value === 'function' ? value(instance.state[index]) : value }]
}
export function useEffect(effect, deps) {
  const instance = current, index = instance.cursor++, previous = instance.effects[index]
  if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
    instance.pending.push(() => { previous?.cleanup?.(); instance.effects[index] = { deps, cleanup: effect() } })
  }
}
export function mount(Component, initial) {
  const instances = new Map()
  let props = initial
  const dispose = instance => instance.effects.forEach(effect => effect?.cleanup?.())
  function expand(node, path, visited) {
    if (node == null || typeof node === 'boolean') return null
    if (typeof node !== 'object') return String(node)
    if (typeof node.type === 'function') {
      const key = `${path}:${node.type.name}:${node.props.key ?? ''}`
      visited.add(key)
      if (!instances.has(key)) instances.set(key, { state: [], cursor: 0, effects: [], pending: [] })
      const before = current, instance = instances.get(key)
      current = instance; instance.cursor = 0
      let result
      try { result = node.type(node.props) } finally { current = before }
      return expand(result, key, visited)
    }
    return { ...node, props: { ...node.props, children: node.props.children.map((child, i) => expand(child, path + '/' + i, visited)).filter(child => child !== null) } }
  }
  return {
    render(next = props) {
      props = next
      const visited = new Set(), result = expand(createElement(Component, props), 'root', visited)
      for (const [key, instance] of instances) {
        if (!visited.has(key)) { dispose(instance); instances.delete(key) }
        else instance.pending.splice(0).forEach(effect => effect())
      }
      return result
    },
    unmount() { for (const instance of instances.values()) dispose(instance); instances.clear() },
  }
}
export const memory = () => { const data = new Map(); return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) } }
export const text = tree => tree == null ? '' : typeof tree !== 'object' ? String(tree) : tree.props.children.map(text).join(' ')
export const nodes = (tree, predicate) => tree && typeof tree === 'object' ? [...(predicate(tree) ? [tree] : []), ...tree.props.children.flatMap(child => nodes(child, predicate))] : []
export function button(tree, label) {
  const found = nodes(tree, node => node.type === 'button' && text(node).trim() === label)
  if (found.length !== 1) throw Error('Expected one button: ' + label)
  return found[0]
}
