import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { spawnSync } from 'node:child_process'
import { app, nodes, text } from './dashboard/vcQueueHarness.mjs'
import { jsx } from './dashboard/vcQueueJsx.mjs'

const raw = readFileSync(new URL('./dashboard/IndbakkeView.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const imports = "import VideoStorageUsage from './VideoStorageUsage.jsx'\nimport { VIDEO_STORAGE_USAGE_ENABLED } from './videoStorageUsage.mjs'\n"
const block = '      {VIDEO_STORAGE_USAGE_ENABLED === true && (\n        <VideoStorageUsage items={coachPriorityItems} hiddenAthleteIds={hiddenAthleteIds}\n          stale={Boolean(videoReviewQueueError || inboxRefreshing)} />\n      )}\n\n'
const base = raw.replace(imports, '').replace(block, '')
let baseline = false
registerHooks({ load(url, context, next) {
  const result = next(url, context)
  if (baseline && url.startsWith('vc-queue-') && url.endsWith('/IndbakkeView.jsx')) {
    return { ...result, source: result.source.slice(0, result.source.indexOf('\n') + 1) + jsx(base) }
  }
  return result
} })
const norm = tree => Array.isArray(tree) ? tree.map(norm) : tree && typeof tree === 'object'
  ? { type: String(tree.type), props: Object.fromEntries(Object.entries(tree.props || {}).filter(([k]) => k !== 'children').map(([k,v]) => [k, typeof v === 'function' ? 'handler' : v])), children: norm(tree.children) } : tree
function fixture() {
  const athlete = {id:'synthetic-a',name:'Synthetic athlete'}
  const video = {id:'synthetic-v',lift:'squat',video_path:'synthetic.mp4',created_at:new Date().toISOString(), session_context:{video_size_bytes:700000000}}
  const item = {kind:'video',key:'synthetic-v',athlete,video,title:'Synthetic video',label:'Video',detail:'Synthetic detail'}
  const calls = []
  return { calls, item, props: { athletes:[athlete], hiddenAthleteIds:new Set(),coachPriorityItems:[item],latestByTrack:{},unreadByTrack:{},inboxRefreshStatus:{kind:'success'},videoQueueFilters:{athleteId:'',lift:''},setVideoQueueFilters(){},openCoachPriorityItem:(...a)=>calls.push(a),refreshCoachInbox:()=>calls.push('refresh') } }
}
test('exact716d43b8 union: only the ordered imports and status block change the inbox', () => {
  assert.equal(createHash('sha256').update(base).digest('hex'),'c2d21c5159ce6185d85fa9e19476a56ba65a4b5d02d790056854f3243b7b249b')
  assert.equal(raw.split(imports).length,2)
  assert.equal(raw.split(block).length,2)
})
test('actual inbox OFF matches exact base DOM for both queue flags and strict opt-in', async () => {
  for (const filter of [false,true]) for (const wait of [false,true]) for (const flag of [undefined,false,'true',1]) {
    const f=fixture()
    baseline=false
    const current=await app(filter,wait,flag)
    const actual=current.render(f.props)
    baseline=true
    let reference
    try { reference=await app(filter,wait,flag) } finally { baseline=false }
    assert.deepEqual(norm(actual),norm(reference.render(f.props)))
    assert.equal(nodes(actual).filter(n=>n.props?.['data-video-storage-usage']).length,0)
  }
})
test('ON preserves wait/filter handlers and reports unknown/stale sizes without extra access', async () => {
  for (const filter of [false,true]) for (const wait of [false,true]) {
    const f=fixture(), view=await app(filter,wait,true)
    let tree=view.render(f.props)
    const status=nodes(tree).filter(n=>Object.hasOwn(n.props || {},'data-video-storage-usage'))
    assert.equal(status.length,1)
    assert.equal(status[0].props.role,'status')
    assert.match(text(status[0]),/Varsel:/)
    const target=nodes(tree).find(n=>n.type==='button' && text(n).includes('Synthetic video'))
    assert.ok(target)
    target.props.onClick()
    assert.deepEqual(f.calls,[[f.item,'inbox']])
    f.props.videoReviewQueueError='synthetic failure'
    f.item.video.session_context={}
    tree=view.render(f.props)
    const message=text(nodes(tree).find(n=>Object.hasOwn(n.props || {},'data-video-storage-usage')))
    assert.match(message,/ukendt/)
    assert.match(message,/kan være forældede/)
  }
})
const loaders = [
  ['coachRyd','./coachRydHarness.mjs',"await load('VideoStorageUsage.jsx')",''],
  ['coachRyd2','./coachRyd2Harness.mjs',"await load('VideoStorageUsage.jsx')",''],
  ['coachNote','./coachNoteTestHelpers.mjs',"await load('src/dashboard/VideoStorageUsage.jsx')",''],
  ['coachSaveNext','./dashboard/coachSaveNextHarness.mjs',"await load('src/dashboard/VideoStorageUsage.jsx')",''],
]
for (const [name,path,entry] of loaders) test(`${name}: ordered graph imports; injected unknown dependency fails closed`, () => {
  const prelude=`import {app} from '${path}'; const load=await app();`
  const options={cwd:import.meta.dirname,encoding:'utf8'}
  const ok=spawnSync(process.execPath,['--input-type=module','-e',prelude+entry],options)
  assert.equal(ok.status,0,ok.stderr)
  const poison=`import {registerHooks} from 'node:module'; registerHooks({load(url,c,next){const r=next(url,c);return url.endsWith('/videoStorageUsage.mjs')?{...r,source:"import './not-ordered.mjs';\\n"+r.source}:r}});`
  const bad=spawnSync(process.execPath,['--input-type=module','-e',prelude+poison+entry],options)
  assert.notEqual(bad.status,0)
  assert.match(bad.stderr,/not-ordered|Unapproved|Blocked|Forbidden/)
  assert.doesNotMatch(bad.stderr,/SyntaxError/)
})
test('queue loader rejects unknown and host imports',async()=>{
  const view=await app()
  for(const name of ['not-ordered.mjs','node:fs','../VideoStorageUsage.jsx']) {
    await assert.rejects(view.load(name),/Forbidden dependency/)
  }
})

test('vcSvar: storage graph imports and rejects injected host dependency',()=>{
 const setup="import {install} from './vcSvarLoader.mjs'; install();"
 const entry="await import('./dashboard/VideoStorageUsage.jsx')"
 const options={cwd:import.meta.dirname,encoding:'utf8'}
 const ok=spawnSync(process.execPath,['--input-type=module','-e',setup+entry],options)
 assert.equal(ok.status,0,ok.stderr)
 const poison=`import {registerHooks} from 'node:module'; registerHooks({load(url,c,next){const r=next(url,c);return url.endsWith('/videoStorageUsage.mjs')?{...r,source:"import 'node:fs';\\n"+r.source}:r}});`
 const bad=spawnSync(process.execPath,['--input-type=module','-e',setup+poison+entry],options)
 assert.notEqual(bad.status,0)
 assert.match(bad.stderr,/Unapproved storage dependency: node:fs/)
})
