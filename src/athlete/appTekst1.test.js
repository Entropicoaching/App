import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { writes, resetFake } from '../appRev2Fakes.mjs'

// APP-TEKST1: atletens tekster i Marcs stemme. De rigtige handlermoduler importeres;
// kun tjenestegrænsen er falsk (som i appRev2.test.js). JSX kan ikke importeres uden
// bygning, så dér læses kilden (linjeslut normaliseres) og tekststrengene kontrolleres.
registerHooks({ resolve(specifier, context, next) {
  if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier) || specifier.endsWith('/progressionState.js')) {
    return { url: new URL('../appRev2Fakes.mjs', import.meta.url).href, shortCircuit: true }
  }
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.js', context.parentURL)
    if (existsSync(url)) return { url: url.href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { lavSaetSkrivning } = await import('./saetSkrivning.js')
const { lavLaesninger } = await import('./laesninger.js')
const { fmtWeekRange } = await import('./ugeHjaelp.js')

const TANKESTREG = /[—–]/
const noop = () => {}
const kilde = navn => readFileSync(new URL('./' + navn, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('logSet og ret af sæt skriver ordentlige beskeder uden tankestreg og uden at skrive', async () => {
  resetFake()
  const beskeder = []
  const h = lavSaetSkrivning({ athlete: { id: 'a' }, exerciseLogs: [{ id: 'l', exercise_id: 'ex', set_number: 1, weight: 90, reps_completed: 5 }],
    logInputs: { ex_1: { weight: 'Infinity', rpe: '8' } }, setWriteRef: { current: {} }, setExerciseLogs: noop, setPendingSyncCount: noop,
    fetchExerciseLogs: noop, showFlash: (...v) => beskeder.push(v) })
  assert.equal(await h.logSet('ex', 1, 1, '5', 8), false)
  assert.equal(await h.updateLoggedSet('ex', 1, { weight: '12kg', reps: '5' }), false)
  assert.deepEqual(beskeder, [
    ['Skriv en gyldig vægt, hele reps og en RPE fra 0 til 10.', 'error'],
    ['Skriv en gyldig vægt og hele reps.', 'error'],
  ])
  assert.equal(writes.length, 0)
  for (const [tekst] of beskeder) assert.doesNotMatch(tekst, TANKESTREG)
})

test('et pas uden øvelser får samme rolige besked, uanset om det udfyldes eller springes over', async () => {
  resetFake()
  const beskeder = []
  const h = lavSaetSkrivning({ athlete: { id: 'a' }, exerciseLogs: [], setPendingSessionAction: noop, showFlash: (...v) => beskeder.push(v) })
  await h.autoCompleteSession({ id: 's', exercises: [] })
  await h.skipRemainingSets({ id: 's', exercises: [] })
  assert.deepEqual(beskeder, [['Der er ingen øvelser i passet.', 'error'], ['Der er ingen øvelser i passet.', 'error']])
  assert.equal(writes.length, 0)
})

test('paratheden afviser ugyldige svar med den nye besked og gemmer intet', async () => {
  resetFake()
  const fejl = []
  const h = lavLaesninger({ athlete: { id: 'a' }, readinessInput: { sleep: '7', energy: 3, motivation: 3, stress: 7, soreness: 3 },
    setSavingReadiness: noop, setReadinessError: e => fejl.push(e), setReadinessLog: noop })
  await h.saveReadiness()
  assert.ok(fejl.includes('Skriv gyldig søvn og hele svar fra 1 til 5.'))
  assert.equal(writes.length, 0)
})

test('ugeintervallet skrives med "til" og ikke med tankestreg', () => {
  const tekst = fmtWeekRange(new Date('2026-10-26T12:00:00'))
  assert.match(tekst, /^\S+ \S+ til \S+ \S+$/)
  assert.doesNotMatch(tekst, TANKESTREG)
  assert.equal(fmtWeekRange(null), null)
})

test('de omskrevne tekster står i kilden, og de gamle er væk', () => {
  const krav = {
    'BeskederTab.jsx': ['Til alt andet: status, spørgsmål og det, der ellers fylder.', 'Skriv til din coach', 'Har du sendt en video, dukker feedbacken op her'],
    'HjemTab.jsx': ['Nyd pausen og lad kroppen hvile.', 'Rekorderne kunne ikke hentes lige nu.', 'Det er ikke et forsøg, du har taget.'],
    'EnkelHjemTab.jsx': ['Nyd pausen og lad kroppen hvile.', 'Rekorderne kunne ikke hentes lige nu.', 'Det er ikke et forsøg, du har taget.'],
    'KostTab.jsx': ['Ofte brugt. Tryk for at logge', 'Ingen skabeloner endnu. Log et måltid og gem det som skabelon nedenfor.', '`Måltider, ${dateLabel(kostDate)}`'],
    'KostUge.jsx': ['{dateLabel(week.startDate)} til {dateLabel(week.endDate)}'],
    'ProgramTab.jsx': ['Skriv til din coach, hvis det varer ved.', "'Ikke gemt. Prøv igen'", '>Opvarmningssæt<'],
    'Ramme.jsx': ["label: '1 til 2 tilbage'", "label: '4 til 5 tilbage'"],
    'IkkeKoblet.jsx': ['så kobler coachen dig.'],
    'StaevnedagTab.jsx': ['Din coach har ikke lagt en forsøgsplan endnu.'],
    'Indlaeser.jsx': ['Dataene kunne ikke hentes. Tjek din forbindelse og prøv igen.'],
  }
  for (const [fil, strenge] of Object.entries(krav)) {
    const s = kilde(fil)
    for (const t of strenge) assert.ok(s.includes(t), `${fil}: mangler "${t}"`)
  }
  assert.doesNotMatch(kilde('IkkeKoblet.jsx'), /kobler han/)
  assert.doesNotMatch(kilde('HjemTab.jsx'), /Prøver igen i baggrunden/)
})

test('rekordfejlen lover ikke flere forsøg, end koden laver (udtømt retry)', async t => {
  resetFake()
  const { supabase } = await import('../appRev2Fakes.mjs')
  const original = supabase.from
  let rekordLaesninger = 0
  supabase.from = tabel => {
    if (tabel === 'personal_records') rekordLaesninger++
    const svar = tabel === 'personal_records' ? { data: null, error: { message: 'syntetisk' } }
      : tabel === 'athletes' ? { data: { id: 'a' }, error: null } : { data: [], error: null }
    const kaede = new Proxy({}, { get: (_, k) => (k === 'then' ? (res, rej) => Promise.resolve(svar).then(res, rej) : () => kaede) })
    return kaede
  }
  t.after(() => { supabase.from = original })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const prsFejl = []
  const params = new Proxy({
    session: { user: { id: 'u' } }, mountedRef: { current: true }, setPrsError: v => prsFejl.push(v),
  }, { get: (m, k) => (k in m ? m[k] : noop) })
  const h = lavLaesninger(params)
  await h.fetchAthlete()
  for (let i = 0; i < 12; i++) { t.mock.timers.tick(10000); await new Promise(r => setImmediate(r)) }
  // Første læsning plus tre genforsøg, derefter intet mere.
  assert.equal(rekordLaesninger, 4)
  assert.equal(prsFejl.at(-1), true)
  t.mock.timers.tick(60000)
  await new Promise(r => setImmediate(r))
  assert.equal(rekordLaesninger, 4)
  // Beskeden i begge hjemvisninger må derfor ikke love flere forsøg.
  for (const fil of ['HjemTab.jsx', 'EnkelHjemTab.jsx']) {
    const s = kilde(fil)
    assert.ok(s.includes('Rekorderne kunne ikke hentes lige nu.\n'), fil)
    assert.doesNotMatch(s, /Rekorderne kunne ikke hentes[^\n]*(prøver|igen|mere)/i, fil)
  }
})
// Tegnene, der må blive stående: tomme værdier ("—", "–") som kolonne- og feltmarkering,
// opslagsnøglerne "Dødløft — Konventionel/Sumo" (logik, ikke tekst), regex-klassen for
// rep-intervaller og forklaringslinjen i Kostuge, der peger på selve markeringen.
function tilladt(linje) {
  return /(?:'—'|'–'|>—<|\{'—'\}|\? '—' :|: '–'|\|\| '[—–]')/.test(linje)
    || /Dødløft — /.test(linje) || /\^\[[^\]]*\]\+\$\/\.test\(String/.test(linje)
    || /<caption>Registreringer og mål for hver dato\. — betyder/.test(linje)
}
test('ingen tankestreger i atletens synlige tekster', () => {
  const mappe = new URL('./', import.meta.url)
  const filer = readdirSync(mappe).filter(n => /\.(jsx|js|mjs)$/.test(n) && !/\.test\.|\.fake\.|\.loader\./.test(n))
  assert.ok(filer.length > 60)
  const rest = []
  for (const fil of filer) {
    // Blokkommentarer (også JSX-kommentarer over flere linjer) fjernes først, linjenumrene bevares.
    const uden = kilde(fil).replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''))
    uden.split('\n').forEach((l, i) => {
      if (/^\s*\/\//.test(l)) return
      const kode = l.replace(/\s\/\/ .*$/, '')
      if (TANKESTREG.test(kode) && !tilladt(kode)) rest.push(`${fil}:${i + 1}: ${kode.trim().slice(0, 80)}`)
    })
  }
  assert.deepEqual(rest, [])
})
