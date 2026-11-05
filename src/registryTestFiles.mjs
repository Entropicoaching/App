// Read only the pinned app layout into a synthetic in-memory filesystem.
import { readFileSync, readdirSync } from 'node:fs'
export function snapshotFiles(root) {
  const files = new Map()
  const walk = (relative, depth = 0) => {
    for (const item of readdirSync(new URL(relative, root), { withFileTypes: true })) {
      const name = relative + item.name
      if (item.isDirectory()) {
        // Historical mutation-output directories are not source modules.
        if (depth === 0 && ['athlete', 'dashboard', 'volume', 'assets'].includes(item.name)) walk(name + '/', 1)
      } else files.set(new URL(name, root).href, readFileSync(new URL(name, root), 'utf8'))
    }
  }
  for (const dir of ['src/', 'scripts/', 'e2e/']) walk(dir)
  // Exact new screen dependencies; do not recursively admit entropi2.
  for (const name of ['src/entropi2/antalOrd.mjs',
    'src/entropi2/flag.mjs', 'src/entropi2/program/blok/blockOverviewModel.mjs',
    'src/entropi2/analysis/blokslut/programBlokslut.mjs',
    'src/entropi2/analysis/blokslut/blokslutModel.mjs',
    'src/entropi2/analysis/weekOverview.mjs', 'src/entropi2/analysis/publicContract.mjs',
    // R1-E2-COACH-TIDSFEEDBACK-ID1: shared message presentation imported by legacy surfaces.
    'src/entropi2/conversation/conversationModel.mjs']) {
    files.set(new URL(name, root).href, readFileSync(new URL(name, root), 'utf8'))
  }
  return files
}
