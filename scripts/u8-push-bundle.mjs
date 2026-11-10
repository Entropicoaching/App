// U8 (ordre 78): samler edge-funktionen u8-push til én fil, der kan indsættes i Supabase-editoren.
// Bruger vite, som repoet allerede har; ingen ny afhængighed. Kør: node scripts/u8-push-bundle.mjs
// Med --check skrives intet; scriptet fejler, hvis den gemte fil ikke svarer til kilden.
import { build } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = new URL('../supabase/functions-udkast/u8-push/', import.meta.url)
const target = new URL('u8-push.bundle.js', dir)
const HEAD = '// u8-push samlet til én fil (U8, ordre 78). UDKAST, ikke deployet. Ret ikke her:\n' +
  '// ret kilden i supabase/functions-udkast/u8-push/ og kør node scripts/u8-push-bundle.mjs.\n'

export async function bundle() {
  const output = await build({ configFile: false, logLevel: 'silent', root: fileURLToPath(dir),
    build: { write: false, minify: false, target: 'es2022', emptyOutDir: false, reportCompressedSize: false,
      lib: { entry: fileURLToPath(new URL('index.ts', dir)), formats: ['es'], fileName: 'u8-push' } } })
  const chunks = (Array.isArray(output) ? output : [output]).flatMap(o => o.output).filter(c => c.type === 'chunk')
  if (chunks.length !== 1) throw Error(`Forventede én fil, fik ${chunks.length}`)
  return HEAD + chunks[0].code.replace(/\r\n/g, '\n')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const code = await bundle()
  if (process.argv.includes('--check')) {
    const saved = readFileSync(target, 'utf8').replace(/\r\n/g, '\n')
    if (saved !== code) { console.error('u8-push.bundle.js er forældet: kør node scripts/u8-push-bundle.mjs'); process.exit(1) }
    console.log('u8-push.bundle.js svarer til kilden')
  } else {
    writeFileSync(target, code)
    console.log(`Skrev ${fileURLToPath(target)} (${code.length} tegn)`)
  }
}
