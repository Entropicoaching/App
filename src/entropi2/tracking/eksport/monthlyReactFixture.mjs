// Explicit synthetic fallback for hermetic worker tests; never a React claim.
export * from '../../../dashboard/analyseSamletDom.mjs'
import { useRef } from '../../../dashboard/analyseSamletDom.mjs'
export function useMemo(factory, dependencies) {
  const ref = useRef(null)
  if (!ref.current || dependencies.some((value, i) => value !== ref.current.dependencies[i]))
    ref.current = { value: factory(), dependencies }
  return ref.current.value
}
