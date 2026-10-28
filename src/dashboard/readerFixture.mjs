import { readFileSync } from 'node:fs'
// Import the actual reader with synthetic external service boundaries.
// data: modules work with the ordinary node --test command.
export async function readerFixture(payload, { enabled = true, fail = false } = {}) {
  const calls = [], values = {}, statuses = {}
  const supabase = { from(table) {
    const call = { table }; calls.push(call)
    const query = {}
    for (const method of ['select', 'in', 'gte', 'order', 'limit']) query[method] = (...args) => { call[method] = args; return query }
    query.then = (resolve, reject) => fail === 'throw' ? Promise.reject(new Error('synthetic')).then(resolve, reject) :
      Promise.resolve(fail ? { data: null, error: { message: 'synthetic' } } : { data: payload[table] || [], error: null }).then(resolve, reject)
    return query
  } }
  const dependencies = { supabase }
  const source = readFileSync(new URL('./laesninger.js', import.meta.url), 'utf8').replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g, (_, names, specifier) => {
      if (specifier === './coachMeetSource.mjs' || specifier === './coachMorningSource.mjs' || specifier === './coachActions.mjs' || specifier === './coachWeekOverview.mjs' || specifier === './afvigelse.js' || ['../dataEnough.mjs', '../dataEvidence.mjs', '../rpeEvidence.mjs', '../videoEvidence.mjs'].includes(specifier)) {
        return `import {${names}} from ${JSON.stringify(new URL(specifier === './afvigelse.js' ? './afvigelse.js' : specifier, import.meta.url).href)}`
      }
      for (const name of names.split(',').map(n => n.trim())) {
        if (name !== 'supabase') dependencies[name] = () => { throw Error(`Unexpected use: ${name}`) }
      }
      return `const {${names}} = dependencies`
    })
  const imports = [], body = source.replace(/^import[^\r\n]+/gm, line => { imports.push(line); return '' })
  const moduleSource = imports.join('\n') + '\nexport function fixture(dependencies) {\n' +
    body.replace('export function lavLaesninger', 'function lavLaesninger') + '\nreturn {lavLaesninger}\n}'
  const module = await import('data:text/javascript;base64,' + Buffer.from(moduleSource).toString('base64'))
  const setters = Object.fromEntries(['CalendarWeeks','AthleteCurrentWeek','AthleteWeekCompletion'].map(name =>
    ['set'+name, value => { values[name] = value }]))
  const reader = module.fixture(dependencies).lavLaesninger({ ...setters, coachWeekEnabled: enabled,
    setCoachWeekDataStatus(update) { Object.assign(statuses, update(statuses)) } })
  return { reader, calls, values, statuses }
}
