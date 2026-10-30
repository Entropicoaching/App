import test from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Independent counterexamples against copied final modules in repository layout.
// Fixtures live outside src and are removed even when a probe fails.
const root = new URL('../', import.meta.url)
const graph = JSON.parse(readFileSync(new URL('./trin1Imports.json', import.meta.url), 'utf8'))
const extras = ['trin1Loader.mjs', 'trin1Dom.mjs', 'trin1Imports.json', 'trin1Flagoversigt.json',
  'trin1Flags.test.js', 'trin1On.test.js', 'trin1Off.test.js', 'trin1WeekCases.mjs', 'trin1F1.test.js',
  'athlete/prog5Dom.mjs', 'athlete/prog5Jsx.mjs', 'testModuleRegistry.mjs',
  'testModuleRegistry.json', 'coachRyd2Jsx.mjs', 'registryDom.mjs',
  'App.jsx', 'Dashboard.jsx', 'AthleteView.jsx',
  'dashboard/analyseConclusionHistory.mjs', 'approvedAnalysisConclusion.mjs',
  'opvarmStige.mjs', 'athlete/WarmupLadderView.mjs', 'athlete/opvarmStigeDom.mjs']
const paths = new Set([...Object.keys(graph), ...extras.map(path => 'src/' + path)])
const cases = [
  ['unexpected-default-on', 'src/udgivelseTrin.mjs', 'UDGIVELSE_TRIN = 0', 'UDGIVELSE_TRIN = 1', 'trin1Flags.test.js', /profile preserves default OFF/],
  ['profile-disconnected', 'src/dataEnough.mjs', "return trin1AppData2(globalThis.location?.search || '')", 'return false', 'trin1On.test.js', /effective dataEnough import/],
  ['rest-regression', 'src/athlete/ugeFeedback.js', '(dataEnoughEnabled() && p.planlagtSaet === 0)', '(false && p.planlagtSaet === 0)', 'trin1On.test.js', /rest week keeps/],
  ['wrong-next-week', 'src/athlete/ProgramTab.jsx', 'setViewingWeekIdx(gi)', 'setViewingWeekIdx(0)', 'trin1Off.test.js', /Program Sunday rest/],
  ['missing-shortcut', 'src/athlete/MobiliseringTab.jsx', 'Til dagens pas →', 'Fjernet genvej', 'trin1Off.test.js', /actual Mobilisering shortcut/],
  ['closed-import-missing', 'src/testModuleRegistry.json', './udgivelseTrin.mjs', './unrelated.mjs', 'trin1On.test.js', /Closed trin1 import/],
]
for (const [name, path, before, after, probe, diagnostic] of cases) test(`counterexample detected: ${name}`, () => {
  const directory = mkdtempSync(join(tmpdir(), `trin1-counter-${name}-`))
  const fixture = pathToFileURL(directory + '/')
  try {
    for (const path of paths) {
      const target = new URL(path, fixture)
      mkdirSync(new URL('./', target), { recursive: true })
      writeFileSync(target, readFileSync(new URL(path, root)))
    }
    const run = () => spawnSync(process.execPath, ['--test', fileURLToPath(new URL('src/' + probe, fixture))],
      { encoding: 'utf8', env: { SystemRoot: 'C:\\Windows', TEMP: tmpdir(), TMP: tmpdir(), TMPDIR: tmpdir() }, stdio: ['ignore', 'pipe', 'pipe'] })
    const control = run()
    assert.equal(control.error, undefined)
    assert.equal(control.status, 0, 'unmodified closed fixture must pass: ' + control.stdout + control.stderr)
    const target = new URL(path, fixture)
    const source = readFileSync(target, 'utf8')
    if (name === 'closed-import-missing') {
      const registry = JSON.parse(source)
      const imports = registry.recipes['src/trin1Loader.mjs#manifest:./trin1Imports.json']['src/dataEnough.mjs']
      assert.equal(imports[before], 'src/udgivelseTrin.mjs')
      imports[after] = imports[before]; delete imports[before]
      writeFileSync(target, JSON.stringify(registry))
    } else {
      assert.equal(source.split(before).length, 2, 'one exact mutation site')
      writeFileSync(target, source.replace(before, after))
    }
    const result = run()
    assert.equal(result.error, undefined)
    assert.notEqual(result.status, 0, 'broken behavior must fail its actual-module probe')
    assert.match(result.stdout + result.stderr, diagnostic)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
