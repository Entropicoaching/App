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
  return files
}
