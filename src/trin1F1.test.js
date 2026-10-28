import test from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { DASHBOARD_MODULER } from '../scripts/dashboardKilde.mjs'

const root = new URL('../', import.meta.url)
const normalize = source => source.replace(/\r\n/g, '\n')
for (const [label, ending] of [['LF', '\n'], ['CRLF', '\r\n']]) {
  test(`F1 actual source collector in repository layout with ${label}`, async () => {
    const directory = mkdtempSync(join(tmpdir(), `trin1-f1-${label}-`))
    const fixture = pathToFileURL(directory + '/')
    try {
      const names = ['scripts/dashboardKilde.mjs', 'src/Dashboard.jsx',
        ...DASHBOARD_MODULER.map(path => 'src/' + path)]
      for (const path of names) {
        const target = new URL(path, fixture)
        mkdirSync(new URL('./', target), { recursive: true })
        writeFileSync(target, normalize(readFileSync(new URL(path, root), 'utf8')).replace(/\n/g, ending))
      }
      const module = await import(new URL('scripts/dashboardKilde.mjs', fixture))
      assert.equal(module.DASHBOARD_MODULER.filter(path => path === 'dashboard/videoReviewStatus.mjs').length, 1)
      const handler = readFileSync(new URL('src/dashboard/videoReviewStatus.mjs', fixture), 'utf8')
      assert.equal(handler.includes('\r\n'), label === 'CRLF')
      const collected = normalize(module.dashboardKilde())
      assert.ok(collected.includes(normalize(handler).replace(/(from\s+')\.\.\//g, '$1./')))
      assert.match(collected, /Den personlige sammenligning matcher ikke/)
      assert.equal((collected.match(/export function createVideoReviewStatusHandler\(/g) || []).length, 1)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
}
