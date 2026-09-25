// ORDRE 370 · koerer Coach Briefingen paa de syntetiske atlet-uger i
// test/fixtures/briefing/ og skriver hvad den siger.
//
//   node scripts/briefing-370.mjs --dump         -> JSON for "i dag" (main 7409552)
//   node scripts/briefing-370.mjs --dump efter   -> JSON efter ordre 370 (v2 + arbejdstraeets n8n)
//
// "I dag" = reglerne fra training-signals-v1.sql (porteret i
// src/coachBriefingRules.js) -> RPC'ens alert/context-filter -> n8n-flowets
// egne kode-noder ("Keep unresolved backup items" + "Build briefing") hentet
// fra base-commit'en, koert lokalt som i n8n/verify-workflows.mjs.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import fixtures from '../test/fixtures/briefing/index.mjs'
import { briefingOrder, briefingVisible, detectSignalsV1, detectSignalsV2 } from '../src/coachBriefingRules.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const BASE_COMMIT = '7409552'

export const loadWorkflow = (ref) => JSON.parse(ref
  ? execFileSync('git', ['show', `${ref}:n8n/coach-briefing-v1.json`], { cwd: root, encoding: 'utf8' })
  : readFileSync(join(root, 'n8n', 'coach-briefing-v1.json'), 'utf8'))

const nodeCode = (workflow, name) => workflow.nodes.find(node => node.name === name).parameters.jsCode

export const runCode = (code, { input, mode = 'production', config = {}, state = {} }) => {
  const execute = new Function('$input', '$execution', '$', '$getWorkflowStaticData', code)
  return execute({ first: () => input }, { mode }, () => ({ first: () => ({ json: config }) }), () => state)
}

const config = {
  supabaseUrl: 'https://example.invalid', coachId: 'syn-coach',
  coachEmail: 'coach@example.invalid', appUrl: 'https://example.invalid/?coach=inbox&focus=next',
}

const unescape = text => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#039;', "'").replaceAll('&amp;', '&')

// Mail-raekkerne som ren tekst: "LABEL | Navn | resume | handling".
export function mailRows(html) {
  const list = html.slice(html.indexOf('Din rækkefølge'), html.indexOf('<a href='))
  return list.split('<div style="display:flex;gap:10px;padding:12px 0;border-top:1px solid #34342e">').slice(1)
    .map(row => [...row.matchAll(/>([^<>]+)</g)].map(match => unescape(match[1]).trim()).filter(Boolean).slice(1))
}

// Hele briefingen for et saet signaler, som mailen ville se ud.
export function runMail(workflow, signals) {
  const payload = {
    schema_version: 1, generated_at: '2026-09-25T10:00:00Z', coach_id: config.coachId,
    unread_messages: [], video_drafts: [], training_signals: signals,
  }
  const kept = runCode(nodeCode(workflow, 'Keep unresolved backup items'), { input: { json: payload } })
  if (!kept.length) return { subject: null, rows: [], kept: [] }
  const built = runCode(nodeCode(workflow, 'Build briefing'), { input: kept[0], config })
  if (!built.length) return { subject: null, rows: [], kept: kept[0].json.training_signals }
  return { subject: built[0].json.subject, rows: mailRows(built[0].json.html), kept: kept[0].json.training_signals, priorityVersion: built[0].json.priorityVersion }
}

// Appens "Kraever dit blik": title = headline, detail = detail, label fra detektor.
const appLabel = detector => ({
  dropout: 'Træningsmængde', stagnation: 'Udvikling', rpe_drift: 'RPE',
  pain: 'Smerte', missed_sessions: 'Fremmøde', data_conflict: 'Datatjek', pr: 'PR',
})[detector] || 'Træning'
export const appRows = signals => signals.map(signal => [signal.severity, appLabel(signal.detector), signal.headline, signal.detail])

export function foer() {
  const workflow = loadWorkflow(BASE_COMMIT)
  const perAthlete = fixtures.map(fixture => {
    const signals = briefingVisible(detectSignalsV1(fixture))
    return { id: fixture.athlete.id, name: fixture.athlete.name, about: fixture.about, app: appRows(signals), mail: runMail(workflow, signals).rows, signals }
  })
  const all = perAthlete.flatMap(entry => entry.signals)
  return { perAthlete, combined: runMail(workflow, all), app: appRows(all) }
}

export function efter() {
  const workflow = loadWorkflow()
  const perAthlete = fixtures.map(fixture => {
    const signals = detectSignalsV2(fixture)
    return { id: fixture.athlete.id, name: fixture.athlete.name, about: fixture.about, app: appRows(signals), mail: runMail(workflow, signals).rows, signals }
  })
  const all = briefingOrder(perAthlete.flatMap(entry => entry.signals))
  return { perAthlete, combined: runMail(workflow, all), app: appRows(all) }
}

if (process.argv.includes('--dump')) {
  const result = process.argv.includes('efter') ? efter() : foer()
  console.log(JSON.stringify(result, (key, value) => (key === 'signals' ? undefined : value), 2))
}
