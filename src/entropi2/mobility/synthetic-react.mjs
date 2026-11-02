// Pure public helpers import React for unrelated components. Hooks cannot run
// accidentally; the wrapper probe supplies explicit synthetic hook bindings.
export const createElement = (type, props, ...children) => ({ type, props: { ...props, children } })
let bindings
export const bindHooks = value => { bindings = value }
export const useState = () => { throw Error('React state outside synthetic scope') }
export const useEffect = (...args) => {
  if (!bindings) throw Error('React effect outside synthetic scope')
  return bindings.useEffect(...args)
}
export const useRef = (...args) => {
  if (!bindings) throw Error('React ref outside synthetic scope')
  return bindings.useRef(...args)
}
