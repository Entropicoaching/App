// Test-only visual boundary: model/date/number modules remain actual imports.
const moduleURL = code => 'data:text/javascript,' + encodeURIComponent(code)
export async function resolve(specifier, context, next) {
  if (specifier === 'react') return { shortCircuit: true, url: moduleURL(`
    export const createElement = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(value => value != null && typeof value !== 'boolean') });
    export const useRef = () => { throw Error('Hook execution outside synthetic view boundary') };
    export const useState = () => { throw Error('Clock hooks must stay behind OFF boundary') };
    export const useEffect = () => { throw Error('Clock hooks must stay behind OFF boundary') };
  `) }
  if (specifier === '../../dashboardShared.js') return { shortCircuit: true, url: moduleURL(`
    export const s = { avatar: {}, wrap: { fontFamily: 'sans-serif' } };
    export const initials = () => 'A';
  `) }
  if (specifier === '../../dashboard/ProgramOverblikView.mjs') return {
    shortCircuit: true, url: moduleURL('export default function ProgramOverblik() { return null }') }
  return next(specifier, context)
}
