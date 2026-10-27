import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const root = new URL('./', import.meta.url)
const shared = ['exerciseSetView.js', 'exerciseNames.js', 'inputValues.js', 'calendarDate.js']
const read = name => readFileSync(new URL(existsSync(new URL(name, root)) ? name : '../' + name, root))
for (const prefix of ['fokus', 'frem3']) {
  for (const dependency of ['node:fs', '../other/inputValues.js', '../calendarDate.js?alias']) {
    test(`${prefix}: actual module import rejects ${dependency}`, () => {
      const dir = mkdtempSync(new URL('./synthetic-counter-', root))
      mkdirSync(dir + '/athlete')
      writeFileSync(dir + '/package.json', '{"type":"module"}')
      for (const name of shared) writeFileSync(dir + '/' + name, read(name))
      for (const suffix of ['Loader.mjs', 'Dom.mjs', 'Jsx.mjs'])
        writeFileSync(dir + '/athlete/' + prefix + suffix, read(prefix + suffix))
      writeFileSync(dir + '/athlete/repRecords.mjs', `import ${JSON.stringify(dependency)};\n` + read('repRecords.mjs'))
      const script = `import { install } from './${prefix}Loader.mjs'; install(); await import('./repRecords.mjs')`
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: dir + '/athlete', encoding: 'utf8' })
      assert.equal(result.status, 1)
      assert.match(result.stderr, /Forbidden synthetic dependency:/)
      assert.ok(result.stderr.includes(dependency))
    })
  }
}
