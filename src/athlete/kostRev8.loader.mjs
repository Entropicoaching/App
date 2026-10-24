import { existsSync } from 'node:fs'
const modules = {
  kostHandlinger: 'kostHandlinger.js', kostNumbers: 'kostNumbers.mjs', kostUge: 'kostUge.mjs',
  athleteShared: '../athleteShared.js', athleteReadGuard: '../athleteReadGuard.js',
  athleteWriteGuard: '../athleteWriteGuard.js', lokaleFoedevarer: 'lokaleFoedevarer.js',
}
export async function resolve(specifier, context, nextResolve) {
  const name = specifier.split('/').at(-1).replace(/\.(?:mjs|js)$/, '')
  if (name === 'supabase') return { url: new URL('./kostRev8.fake.mjs', import.meta.url).href, shortCircuit: true }
  if (modules[name]) {
    const base = new URL(`./BASE-${name}.mjs`, import.meta.url)
    const local = existsSync(base)
    const file = local ? name === 'kostHandlinger' && !context.conditions.includes('app-rev8-base')
      ? './kostHandlinger.candidate.mjs' : `./BASE-${name}.mjs` : './' + modules[name]
    return { url: new URL(file, import.meta.url).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
