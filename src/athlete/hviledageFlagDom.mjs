export const Fragment = Symbol.for('fragment')
export const h = (type, props, _, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(x => x != null && typeof x !== 'boolean') })
export const createElement = (t,p,...c) => h(t,p,null,...c)
export const useState = initial => [typeof initial === 'function' ? initial() : initial, () => {}]
export const useEffect = () => {}
export const useMemo = fn => fn()
export const useRef = current => ({current})
export const supabase = new Proxy({}, {get() { throw Error('Forbidden backend access') }})
export function expand(n) {
 if (n == null || typeof n !== 'object') return n
 if (typeof n.type === 'function') return expand(n.type({...n.props, children:n.children}))
 return {...n, children:n.children.map(expand)}
}
export function nodes(n, fn) { return n && typeof n === 'object' ? [...(fn(n) ? [n] : []), ...n.children.flatMap(c=>nodes(c,fn))] : [] }
export const text = n => n == null ? '' : typeof n === 'object' ? n.children.map(text).join('') : String(n)
export function snapshot(n) { return JSON.parse(JSON.stringify(n, (k,v)=>typeof v === 'function' ? '[handler]' : typeof v === 'symbol' ? '[fragment]' : v)) }

export const createPortal = children => children
export const useId = () => 'synthetic-id'
