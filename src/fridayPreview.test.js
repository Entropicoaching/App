import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { athleteFlags, coachFlags, queryFlags, storageFlags, screens,
  previewUrl, memoryStorage, isolatePreview, renderScreenList } from './fridayPreview.mjs'
import { buildPreviewSeed, ATHLETE, USER } from './fridayPreviewSeed.mjs'
import { createPreviewDatabase } from './fridayPreviewAdapter.mjs'
import { main, previewConfig } from '../scripts/friday-preview.mjs'
import { fridayTestEnabled } from './e2eTestFlags.mjs'
import { release3TestFlags } from './release3TestFlags.mjs'

const reactPlugin = () => ({ name: 'synthetic-react-plugin' })
test('import og standardkald er OFF uden at indlæse byggeren', async () => {
  let calls = 0
  const load = async () => { calls++; throw new Error('Må ikke indlæses') }
  assert.match(await main([],load), /^OFF:/)
  for (const args of [['--build'],['--build-preview','--serve'],['--build-preview=1']])
    await assert.rejects(main(args,load), /Brug kun/)
  assert.equal(calls,0)
})
test('eksplicit byggehandler får kun isoleret konfiguration via syntetisk bygger', async () => {
  const configs = []
  const root = resolve('synthetic-root')
  await main(['--build-preview'], async () => ({ reactPlugin, build: async config => configs.push(config) }), root)
  assert.equal(configs.length,1)
  const c = configs[0]
  assert.equal(c.configFile,false); assert.equal(c.envDir,false); assert.equal(c.publicDir,false)
  assert.equal(c.mode,'e2e'); assert.equal(c.build.emptyOutDir,false)
  assert.equal(c.build.outDir,resolve(root,'preview-friday-dist'))
  assert.equal(c.build.rollupOptions.input,resolve(root,'scripts/friday-preview.html'))
  for (const path of ['/repo/src/supabase.js','../supabase','./supabase.js','C:\\repo\\src\\supabase.js']) {
    assert.equal(c.resolve.alias[0].find.test(path),true)
    assert.equal(c.resolve.alias[0].replacement,resolve(root,'src/fridayPreviewAdapter.mjs'))
  }
  assert.equal(c.resolve.alias[0].find.test('./not-supabase.js'),false)
})
test('alle seksten skærme er lokale med entydige flag og 375 px', () => {
  assert.equal(screens.length,16); assert.equal(new Set(screens.map(s => s.id)).size,16)
  assert.equal(screens.filter(s => s.role === 'athlete').length,10)
  for (const screen of screens) {
    assert.equal(screen.width,375); assert.ok(screen.steps)
    const url = new URL(previewUrl(screen.id,'http://localhost:4173/scripts/friday-preview.html?appRel3=0&appRel3=0#old'))
    for (const [key,value] of Object.entries(queryFlags)) assert.deepEqual(url.searchParams.getAll(key),[value])
    assert.equal(url.hash,'')
    assert.equal(fridayTestEnabled('e2e',url.href),true)
    assert.equal(release3TestFlags('e2e',url.href).athlete.fremgangFokus,true)
  }
  for (const url of ['https://localhost/','http://example.test/','http://localhost.example.test/','http://user@localhost/','file:///preview'])
    assert.throws(() => previewUrl(screens[0].id,url), /Kun lokal/)
  assert.throws(() => previewUrl('unknown'),/Ukendt/)
})
test('pinnede gates forbliver OFF i produktion og uden eksplicit lokalt flag', () => {
  for (const href of ['', 'http://localhost/', 'http://localhost/?appE2E2=1&appE2E2=1', 'https://example.test/?appE2E2=1'])
    assert.equal(fridayTestEnabled('e2e',href),false)
  assert.equal(fridayTestEnabled('production',previewUrl(screens[0].id)),false)
  assert.deepEqual(release3TestFlags('production',previewUrl(screens[0].id)),{ athlete: {}, coach: {} })
  assert.equal(athleteFlags.kostValg[ATHLETE],true)
  assert.equal(athleteFlags.programUgeFoerst,true); assert.equal(coachFlags.coachFourWeeksEnabled,true)
})
test('DOM-listen indeholder seksten klikbare links med de rigtige roller', () => {
  const h = (tag,props,...children) => ({tag,props,children})
  const dom = renderScreenList(h)
  assert.equal(dom.tag,'nav'); assert.equal(dom.props['aria-label'],'Syntetiske skærme')
  assert.equal(dom.children.length,16)
  dom.children.forEach((node,i) => {
    assert.equal(node.tag,'a'); assert.equal(node.props.style.minHeight,44)
    assert.equal(new URL(node.props.href).searchParams.get('screen'),screens[i].id)
    assert.ok(node.children[0].includes(screens[i].title))
  })
})
test('syntetisk storage læser aldrig eksisterende lager og netværk blokeres', () => {
  const target = {}
  Object.defineProperty(target,'localStorage',{configurable:true,get() { throw new Error('Eksisterende lager må ikke læses') }})
  isolatePreview(target)
  for (const [key,value] of Object.entries(storageFlags)) assert.equal(target.localStorage.getItem(key),value)
  target.localStorage.setItem('private-key','local-only')
  assert.equal(target.sessionStorage.getItem('private-key'),null)
  for (const name of ['fetch','XMLHttpRequest','WebSocket','EventSource']) assert.throws(() => target[name](),/Netværk/)
  const separate = memoryStorage(); assert.equal(separate.getItem('private-key'),null)
  separate.setItem('x',2); assert.equal(separate.getItem('x'),'2'); separate.removeItem('x'); assert.equal(separate.length,0)
})
test('syntetisk seed er reproducerbar med historik og næste uge', async () => {
  const seed = buildPreviewSeed(new Date(2026,9,30,12))
  assert.deepEqual(seed,buildPreviewSeed(new Date(2026,9,30,12)))
  assert.equal(seed.weeks.at(-1).start_date,'2026-11-02')
  assert.equal(seed.athletes[0].user_id,USER)
  assert.equal(seed.exercise_logs.length,108)
  const db = createPreviewDatabase(seed)
  const {data,error} = await db.from('weeks').select('*,sessions(*,exercises(*))').eq('athlete_id',ATHLETE).order('week_number')
  assert.equal(error,null); assert.equal(data.length,6)
  assert.equal(data[0].sessions.length,3); assert.equal(data[0].sessions[0].exercises.length,3)
  const logs = await db.from('exercise_logs').select('*').gte('weight',80).order('logged_at',{ascending:false}).range(0,4)
  assert.equal(logs.data.length,5); assert.ok(logs.data.every(log => log.weight >= 80 && log.exercises.sessions.weeks))
  data[0].block_name = 'mutated'
  assert.equal((await db.from('weeks').select().eq('id',seed.weeks[0].id).single()).data.block_name,'Grundlag')
})
test('adapterens skriveveje og ukendte RPC fejler uden mutation', async () => {
  const seed = buildPreviewSeed(new Date(2026,9,30,12)), before = structuredClone(seed)
  const db = createPreviewDatabase(seed)
  for (const method of ['insert','upsert','update','delete']) {
    const result = await db.from('athletes')[method]({ name:'changed' }).eq('id',ATHLETE).select()
    assert.equal(result.error.code,'PREVIEW_ONLY')
  }
  assert.equal((await db.rpc('dangerous_write')).error.code,'PREVIEW_ONLY')
  assert.equal((await db.storage.from('video').upload()).error.code,'PREVIEW_ONLY')
  assert.deepEqual(seed,before)
  assert.equal((await db.from('athletes').select().single()).data.name,'Testatlet')
})
test('kodeflag omskrives kun i isoleret preview og tåler LF og CRLF', () => {
  const root = resolve('synthetic-root'), plugin = previewConfig(root,reactPlugin).plugins.find(plugin => plugin.name === 'friday-preview-only')
  const sources = [ ['dashboard/coachActions.mjs','COACH_ACTIONS_ENABLED'],
    ['dashboard/videoQueueFilter.mjs','VIDEO_QUEUE_FILTER_ENABLED'], ['vcForenkl4.mjs','DEFAULT_VIDEOCOACH_FORENKL4'] ]
  for (const [file,name] of sources) for (const eol of ['\n','\r\n']) {
    const code = `// baseline${eol}export const ${name} = false${eol}`
    assert.ok(plugin.transform(code,resolve(root,'src',file)).code.includes(`${name} = true`))
    assert.equal(plugin.transform(code,resolve(root,'other',file)),null)
    assert.throws(() => plugin.transform('changed',resolve(root,'src',file)),/Previewflag ændret/)
  }
})
