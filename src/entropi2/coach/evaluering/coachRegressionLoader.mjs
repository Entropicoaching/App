// Supplemental local fixture for the existing coach-folder regression tests.
// The base fixture predates useRef; actual non-React imports remain untouched.
export async function resolve(specifier, context, next) {
  if (specifier === 'react') return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
    export const createElement = (type, props, ...children) => ({type, props: props || {}, children: children.flat(Infinity).filter(v => v != null && typeof v !== 'boolean')});
    export const useState = () => { throw Error('Hooks must remain behind OFF'); };
    export const useEffect = useState;
    export const useRef = useState;
  `) }
  return next(specifier, context)
}
