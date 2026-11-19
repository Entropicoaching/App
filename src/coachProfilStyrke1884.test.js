import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { installCoachTabsFixture, service, baseProps } from './dashboard/coachTabsFixture.mjs'

// Ordre 1884: en fejlet laesning af atletens styrkelinje og smertesignal paa profilen skal vises som fejl,
// ikke som tom tilstand. Den rigtige ProfilHoved.jsx koeres; kun databasegraensen og hook-koereren er faste.
installCoachTabsFixture({ realReact: true })
const hooks = new URL('./profilStyrkeHooks1884.mjs', import.meta.url).href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'react' && context.parentURL?.endsWith('/dashboard/ProfilHoved.jsx')) return { url: hooks, shortCircuit: true }
    return next(specifier, context)
  },
})
const { default: Profil } = await import('./dashboard/ProfilHoved.jsx')

const tick = () => new Promise(resolve => setImmediate(resolve))
const walk = n => Array.isArray(n) ? n.flatMap(walk) : n && typeof n === 'object' ? [n, ...walk(n.props?.children)] : []
const text = n => Array.isArray(n) ? n.map(text).join(' ') : n == null || typeof n === 'boolean' ? '' : typeof n === 'object' ? text(n.props?.children) : String(n)

function monter(props) {
  const r = { slots: {}, idx: 0, effects: [], dirty: false }
  globalThis[Symbol.for('PROFIL-STYRKE-1884.runtime')] = r
  let tree
  const tegn = async () => {
    for (let i = 0; i < 8; i++) {
      r.idx = 0; r.dirty = false
      tree = Profil(props.current)
      const effects = r.effects.splice(0); effects.forEach(run => run())
      await tick()
      if (!r.dirty && !effects.length) break
    }
    return tree
  }
  return { tegn, skift: next => { props.current = next } }
}
const udtryk = tree => {
  const alle = walk(tree)
  return {
    linje: alle.find(n => n.props?.['data-styrke-linje'] != null),
    html: text(tree),
  }
}
const dag = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)
const log = (athleteId, d, note = null) => ({
  athlete_id: athleteId, exercise_id: 'e1', note, weight: 150, reps_completed: 5, logged_at: dag(d), skipped: false,
  exercises: { name: 'Squat topsæt', sessions: { id: 's1', athlete_comment: null, weeks: { block_name: 'Opbygning' } } },
})
const smerteRaekker = id => [log(id, 1, 'ondt i ryggen'), log(id, 3), log(id, 8)]
const FEJL = 'Styrke og smerte kunne ikke hentes'
const opsaet = (...svar) => { service.calls.length = 0; service.responses = [...svar] }
const props = (id = 'w1') => ({ current: { ...baseProps(), a: { id, name: 'Atlet W', email: 'w@example.test' } } })

test('lykkedes laesning med smertenote: styrkelinjen vises som foer, ingen fejllinje', async () => {
  opsaet({ data: smerteRaekker('w1'), error: null })
  const m = monter(props()); const t = udtryk(await m.tegn())
  assert.ok(t.linje, 'styrkelinje')
  assert.match(t.linje.props['data-styrke-linje'], /smerte/)
  assert.ok(!t.html.includes(FEJL))
})

test('atlet uden logs: ingen styrkelinje og ingen fejllinje', async () => {
  opsaet({ data: [], error: null })
  const t = udtryk(await monter(props()).tegn())
  assert.ok(!t.linje); assert.ok(!t.html.includes(FEJL))
})

test('fejlet laesning ({ error }): coachen ser fejllinjen', async () => {
  opsaet({ data: null, error: { message: 'afvist' } })
  const t = udtryk(await monter(props()).tegn())
  assert.ok(t.html.includes(FEJL))
  assert.ok(!t.linje)
})

test('afvist laesning: coachen ser fejllinjen', async () => {
  opsaet(new Error('netvaerk'))
  const t = udtryk(await monter(props()).tegn())
  assert.ok(t.html.includes(FEJL))
})

test('data der ikke er en liste regnes som fejl', async () => {
  opsaet({ data: { nej: 1 }, error: null })
  assert.ok(udtryk(await monter(props()).tegn()).html.includes(FEJL))
})

test('skift af atlet viser aldrig forrige atlets styrkelinje, og en fejl for den nye atlet vises', async () => {
  opsaet({ data: smerteRaekker('w1'), error: null }, { data: null, error: { message: 'afvist' } })
  const p = props('w1'); const m = monter(p)
  assert.ok(udtryk(await m.tegn()).linje)
  m.skift({ ...p.current, a: { id: 'w2', name: 'Atlet X', email: 'x@example.test' } })
  const t = udtryk(await m.tegn())
  assert.ok(!t.linje, 'forrige atlets linje vises ikke')
  assert.ok(t.html.includes(FEJL))
})

test('ny lykket laesning fjerner fejllinjen', async () => {
  opsaet({ data: null, error: { message: 'afvist' } }, { data: smerteRaekker('w2'), error: null })
  const p = props('w1'); const m = monter(p)
  assert.ok(udtryk(await m.tegn()).html.includes(FEJL))
  m.skift({ ...p.current, a: { id: 'w2', name: 'Atlet X', email: 'x@example.test' } })
  const t = udtryk(await m.tegn())
  assert.ok(t.linje); assert.ok(!t.html.includes(FEJL))
})
