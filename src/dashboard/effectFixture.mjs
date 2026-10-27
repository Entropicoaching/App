import { readFileSync } from 'node:fs'
export async function effectFixture() {
  const source = readFileSync(new URL('./useDashboardEffekter.js', import.meta.url), 'utf8')
    .replace(/^import[^\r\n]+/gm, '')
    .replace('export function useDashboardEffekter', 'function useDashboardEffekter')
  const module = await import('data:text/javascript;base64,' + Buffer.from(
    'export function fixture(useEffect, supabase) {\n' + source + '\nreturn useDashboardEffekter\n}').toString('base64'))
  let index, previous = [], next = []
  const hook = module.fixture((callback, deps) => {
    const i = index++
    next[i] = deps
    // Only the calendar effect is exercised; other effects are out of scope.
    if (i === 2 && (!previous[i] || deps.some((d,j) => !Object.is(d, previous[i][j])))) callback()
  }, { from() { throw Error('Unexpected service use') } })
  return props => { index = 0; next = []; hook(props); previous = next }
}
