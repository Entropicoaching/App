import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, dirname, basename } from 'node:path'
import { after } from 'node:test'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { jsx } from './analyseAtlet1Jsx.mjs'
export { mount, nodes, text, button } from './analyseAtlet1Dom.mjs'
// Each test process owns an isolated reconstruction, including the exact pinned OFF baseline.
const fixture = JSON.parse(readFileSync(new URL('./analyseAtlet1Baseline.json', import.meta.url), 'utf8'))
if (fixture.revision !== 'b139a215df562dd695202c2fb62958e7aa3d8b79') throw new Error('Wrong baseline')
const layout = pathToFileURL(mkdtempSync(new URL('./.analyseAtlet1-test-', import.meta.url)) + '/')
for (const [path, source] of Object.entries(fixture.sources)) {
  if (!/^src\/[A-Za-z0-9_./-]+$/.test(path) || path.split('/').includes('..')) throw new Error('Unsafe fixture path')
  for (const kind of ['base', 'final']) {
    const url = new URL(kind + '/' + path, layout)
    mkdirSync(new URL('./', url), { recursive: true }); writeFileSync(url, source)
  }
}
for (const name of ['FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'fremgangFokus.mjs', 'analyseAtlet1.mjs']) {
  writeFileSync(new URL('final/src/athlete/' + name, layout), readFileSync(new URL('./' + name, import.meta.url)))
}
const countHelper = new URL('final/src/entropi2/antalOrd.mjs', layout)
mkdirSync(new URL('./', countHelper), { recursive: true })
writeFileSync(countHelper, readFileSync(new URL('../entropi2/antalOrd.mjs', import.meta.url)))
const dom = new URL('./analyseAtlet1Dom.mjs', import.meta.url).href
registerHooks({
  resolve(specifier, context, next) {
    if (!context.parentURL?.startsWith(layout.href)) return next(specifier, context)
    if (specifier === dom) return { url: dom, shortCircuit: true }
    if (specifier === 'react' || specifier === '../athleteShared.js') return { url: dom, shortCircuit: true }
    if (!specifier.startsWith('.')) throw new Error('Forbidden synthetic import: ' + specifier)
    let url = new URL(specifier, context.parentURL)
    if (!url.href.startsWith(layout.href)) throw new Error('Synthetic path escape')
    if (!existsSync(url)) {
      const found = ['.js', '.mjs', '.jsx'].map(ext => new URL(url.href + ext)).find(existsSync)
      if (!found) throw new Error('Missing synthetic dependency: ' + url)
      url = found
    }
    return { url: url.href, shortCircuit: true }
  },
  load(url, context, next) {
    if (!url.startsWith(layout.href)) return next(url, context)
    const source = readFileSync(new URL(url), 'utf8')
    return { format: 'module', source: url.endsWith('.jsx') ? `import { h as __h } from '${dom}';\n${jsx(source)}` : source, shortCircuit: true }
  },
})
export const load = (name, kind = 'final') => import(new URL(`${kind}/src/athlete/${name}`, layout))
export const source = (name, kind = 'final') => readFileSync(new URL(`${kind}/src/athlete/${name}`, layout), 'utf8')

// Delete only this process's verified synthetic child directory after the tests.
after(() => {
  const owner = resolve(fileURLToPath(new URL('./', import.meta.url)))
  const target = resolve(fileURLToPath(layout))
  if (dirname(target) !== owner || !/^\.analyseAtlet1-test-[A-Za-z0-9]+$/.test(basename(target))) throw new Error('Unsafe synthetic cleanup target')
  rmSync(target, { recursive: true })
})
