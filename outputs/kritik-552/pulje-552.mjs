// KRITIK 552 blok 1: hvor kommer gaaderne i "Oev et tema" fra? Taeller hver bank pr. tema
// (skak main via git archive, uden browser). Skriver outputs/kritik-552/pulje-552.json.
import path from 'node:path'
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { pathToFileURL, fileURLToPath } from 'node:url'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const SKAK = 'C:/Users/Entropi/Desktop/skak'
const SHA = execSync(`git -C ${SKAK} rev-parse --short main`).toString().trim()
const dir = mkdtempSync(path.join(tmpdir(), 'k552-pulje-'))
execSync(`git -C "${SKAK}" archive -o "${path.join(dir, 's.tar')}" main data src/gaadebank-stor.js src/lichesstemaer.js`)
execSync('tar -xf s.tar', { cwd: dir })
const { GAADEBANK_STOR_GZIP_BASE64: B64 } = await import(pathToFileURL(path.join(dir, 'src', 'gaadebank-stor.js')).href)
const { LICHESS_TEMAER } = await import(pathToFileURL(path.join(dir, 'src', 'lichesstemaer.js')).href)
const j = (f) => JSON.parse(readFileSync(path.join(dir, 'data', f), 'utf8'))
const banker = {
  'lichess-temaer (544)': j('gaader-lichess.json').map((g) => ({ tema: g.tema, rating: g.rating, forTraek: !!g.forTraek })),
  'gammel lichess (261)': gunzipSync(Buffer.from(B64, 'base64')).toString('utf8').split('\n').filter(Boolean).map((l) => { const x = l.split('\t'); return { tema: x[4], rating: Number(x[3]) } }),
  'egne (278)': j('gaader.json').map((g) => ({ tema: g.tema, rating: g.svaerhed })),
  'lette (425)': j('gaader-lette.json').map((g) => ({ tema: g.tema, rating: g.svaerhed })),
  'slutspil (485)': j('gaader-slutspil.json').map((g) => ({ tema: g.tema, rating: g.svaerhed })),
}
const ud = { skak: SHA, temaer: {} }
for (const t of LICHESS_TEMAER) {
  const r = (ud.temaer[t.tag] = {})
  for (const [navn, liste] of Object.entries(banker)) {
    const l = liste.filter((g) => g.tema === t.tag)
    if (l.length) r[navn] = { antal: l.length, under900: l.filter((g) => g.rating < 900).length }
  }
  const alle = Object.values(r).reduce((s, x) => s + x.antal, 0)
  r.andelFraLichessTemaer = Math.round((100 * (r['lichess-temaer (544)']?.antal ?? 0)) / alle)
  console.log(t.tag, JSON.stringify(r))
}
writeFileSync(path.join(HERE, 'pulje-552.json'), JSON.stringify(ud, null, 1))
