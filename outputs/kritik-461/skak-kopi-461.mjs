// ORDRE 461: en kopi af skak-main til at teste. Skak-mappen roeres ikke:
// `git archive` pakker main ud i en midlertidig mappe, og node_modules laanes med
// en junction til skak-mappens egne (kun laesning). Samme greb som 361/374/441.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, symlinkSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const SKAK_ROD = 'C:\\Users\\Entropi\\Desktop\\skak'
export const SKAK_MAIN_VENTET = '1791bc0' // 436, 448 og 454 merget

export function skakKopi(rev = 'main') {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'kritik461-'))
  const mappe = path.join(tmp, 'skak')
  mkdirSync(mappe, { recursive: true })
  const tar = path.join(tmp, 'skak.tar')
  execFileSync('git', ['-C', SKAK_ROD, 'archive', '--format=tar', '-o', tar, rev])
  execFileSync('tar', ['-xf', 'skak.tar', '-C', 'skak'], { cwd: tmp })
  const nm = path.join(mappe, 'node_modules')
  if (!existsSync(nm)) symlinkSync(path.join(SKAK_ROD, 'node_modules'), nm, 'junction')
  const hash = execFileSync('git', ['-C', SKAK_ROD, 'rev-parse', '--short', rev]).toString().trim()
  return {
    mappe,
    hash,
    url: (fil) => pathToFileURL(path.join(mappe, fil)).href,
    importer: (rel) => import(pathToFileURL(path.join(mappe, rel)).href),
  }
}
