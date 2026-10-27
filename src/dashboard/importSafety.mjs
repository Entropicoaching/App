import { posix } from 'node:path'

export function relativeImports(source) {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"]((?:\.\.?\/)[^'"]+)['"]/g)].map(match => match[1])
}

// Paths are an explicit virtual filesystem. Never use the host's case rules.
export function ambiguousImports(files) {
  const names = Object.keys(files)
  return names.flatMap(file => {
    if (!/\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(file)) return []
    return relativeImports(files[file]).flatMap(specifier => {
      const target = posix.normalize(posix.join(posix.dirname(file), specifier)).toLowerCase()
      if (names.some(name => name.toLowerCase() === target)) return []
      const matches = names.filter(name => {
        const extension = posix.extname(name)
        return extension && name.slice(0, -extension.length).toLowerCase() === target
      }).sort()
      return matches.length > 1 ? [{ file, specifier, matches }] : []
    })
  })
}

export function resolveInsensitive(file, specifier, names, extensions = ['.mjs', '.js', '.jsx']) {
  const target = posix.normalize(posix.join(posix.dirname(file), specifier)).toLowerCase()
  for (const suffix of ['', ...extensions]) {
    const matches = names.filter(name => name.toLowerCase() === target + suffix)
    if (matches.length > 1) throw Error('Multiple case variants: ' + specifier)
    if (matches.length) return matches[0]
  }
  return null
}
