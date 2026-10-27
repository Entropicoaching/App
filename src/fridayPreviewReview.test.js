import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { previewConfig } from '../scripts/friday-preview.mjs'
import { renderNav, DEFAULT_ENKEL_PROTOTYPE } from './athlete/enkelPrototype.mjs'
import { createPreviewDatabase } from './fridayPreviewAdapter.mjs'
import { buildPreviewSeed } from './fridayPreviewSeed.mjs'

test('modprøve: rigtig pinnet navigation udfører handleren uden storage eller backend', () => {
  const calls = [], h = (tag,props,...children) => ({tag,props,children})
  const tree = renderNav(h,{route:'traening',go:key => calls.push(key)})
  assert.equal(DEFAULT_ENKEL_PROTOTYPE,false)
  assert.equal(tree.children.length,4)
  tree.children.forEach(node => node.props.onClick())
  assert.deepEqual(calls,['hjem','fremgang','beskeder','mere'])
})
test('modprøve: eksakte pinnede kodeflag kan transformeres med begge linjeslut', async () => {
  const plugin = previewConfig(resolve('synthetic-root'),() => ({name:'fake-react'})).plugins.find(plugin => plugin.name === 'friday-preview-only')
  for (const [file,name] of [['dashboard/coachActions.mjs','COACH_ACTIONS_ENABLED'],
    ['dashboard/videoQueueFilter.mjs','VIDEO_QUEUE_FILTER_ENABLED'],['vcForenkl4.mjs','DEFAULT_VIDEOCOACH_FORENKL4']]) {
    const original = await readFile(new URL(import.meta.resolve('./'+file)),'utf8')
    for (const eol of ['\n','\r\n']) {
      const code = original.replace(/\r?\n/g,eol)
      const result = plugin.transform(code,resolve('synthetic-root','src',file))
      assert.ok(result.code.includes(`export const ${name} = true`))
      assert.ok(code.includes(`export const ${name} = false`))
    }
  }
})
test('modprøve: relationer fra alle læseveje er defensive kopier', async () => {
  const db = createPreviewDatabase(buildPreviewSeed(new Date(2026,9,30,12)))
  const exercise = (await db.from('exercises').select().single()).data
  exercise.sessions.weeks.block_name = 'corrupt'
  assert.equal((await db.from('exercises').select().single()).data.sessions.weeks.block_name,'Grundlag')
  assert.equal((await db.from('not_a_table').select()).error.code,'PREVIEW_ONLY')
  assert.equal((await db.from('weeks').select().or('invalid')).error.code,'PREVIEW_ONLY')
  assert.equal((await db.from('weeks').select().not('id','ilike','x')).error.code,'PREVIEW_ONLY')
})
test('modprøve: ordre, tomme resultater og null-filtre', async () => {
  const db = createPreviewDatabase({ weeks:[{id:'a',n:2,v:null},{id:'b',n:1,v:'x'}] })
  assert.deepEqual((await db.from('weeks').select().order('n').limit(1)).data.map(x => x.id),['b'])
  assert.equal((await db.from('weeks').select().is('v',null).single()).data.id,'a')
  assert.equal((await db.from('weeks').select().eq('id','absent').maybeSingle()).data,null)
})
