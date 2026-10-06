// ORDRE 1466: .gitignore skal holde skaermbilleder/video/trace ude af git
// (ORDRE 1458). Fejler hvis nogen fjerner linjerne; maalinger og verify-scripts
// skal stadig kunne spores.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const ignoreret = sti => spawnSync('git', ['check-ignore', '-q', sti], { cwd: root }).status === 0

for (const sti of [
  'outputs/a.png', 'outputs/x/y/z.png', 'outputs/Y.PNG', 'outputs/k/b.jpg', 'outputs/k/c.webp',
  'outputs/k/d.avif', 'outputs/k/e.bmp', 'outputs/k/f.mkv', 'outputs/k/g.avi',
  'outputs/k/trace.zip', 'outputs/k/rapport.pdf', 'outputs/k/net.har', 'outputs/k/v.MP4',
]) {
  test(`ignoreret: ${sti}`, () => assert.ok(ignoreret(sti)))
}

for (const sti of ['outputs/k/maal.json', 'outputs/k/note.md', 'outputs/k/tal.txt', 'outputs/verify-x.mjs']) {
  test(`stadig sporbar: ${sti}`, () => assert.ok(!ignoreret(sti)))
}
