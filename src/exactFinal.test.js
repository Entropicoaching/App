import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {helper,draw} from './rebaseHarness.mjs'
import {nodes} from './coachRyd2Harness.mjs'

test('exact finale: patch applies to verified pinned bytes in synthetic FS', { skip: 'Old producer metadata unavailable; replaced by root samlet5Patch.test.js against a10e1041' },()=>{
  const root=new URL('./',import.meta.url)
  const read=name=>readFileSync(new URL(name,root))
  const input=JSON.parse(read('INPUT-MANIFEST.json')).files
  const source=JSON.parse(read('input-1739-SOURCE.json')).files
  const map=JSON.parse(read('FILKORT.json')).files
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
  const patch=read('PAKKE.diff').toString('utf8')
  const sections=patch.split(/(?=^diff --git )/m).filter(Boolean)
  let applied=0
  for(const section of sections) {
    const path=section.match(/^diff --git a\/(\S+) b\/(\S+)/)
    assert.ok(path);assert.equal(path[1],path[2])
    const [name]=Object.entries(map).find(([,v])=>v.path===path[1])||[]
    assert.ok(name,path[1])
    const pinned=source.find(x=>x.path===path[1])
    let original=Buffer.alloc(0)
    if(pinned) {
      const copy=Object.keys(input).find(k=>Number(k.split('-')[1])>=891&&k.split('-').slice(2).join('-')===pinned.copy)
      assert.ok(copy);original=read(copy)
      assert.equal(sha(original),pinned.sha256)
      assert.equal(original.length,pinned.bytes)
    } else assert.match(section,/^new file mode 100644$/m)
    const lines=original.toString('utf8').match(/[^\n]*\n|[^\n]+$/g)||[]
    const output=[];let cursor=0
    for(const block of section.split(/(?=^@@ )/m).slice(1)) {
      const [header,...body]=block.match(/[^\n]*\n|[^\n]+$/g)
      const start=Math.max(0,Number(header.match(/^@@ -(\d+)/)[1])-1)
      assert.ok(start>=cursor);output.push(...lines.slice(cursor,start));cursor=start
      for(const line of body) {
        if(line[0]===' '||line[0]==='-') {assert.equal(lines[cursor++],line.slice(1),path[1])}
        if(line[0]===' '||line[0]==='+') output.push(line.slice(1))
      }
    }
    output.push(...lines.slice(cursor))
    assert.deepEqual(Buffer.from(output.join('')),read(name),name)
    applied++
  }
  assert.equal(applied,Object.values(map).filter(x=>['candidate','test-support'].includes(x.role)).length)
})

test('exact finale: actual imported handlers retain release and explicit flag behavior',()=>{
  assert.equal(helper.coachRydEnabled('?rel1030=1'),true)
  assert.equal(helper.coachRydEnabled('?coachRyd=1'),true)
  assert.equal(helper.coachRydEnabled(''),false)
  for(const search of ['?rel1030=1','?coachRyd=1','?rel1030=1&coachRyd=1']) {
    const {tree,entry}=draw(search,375)
    assert.equal(entry,'inbox')
    const inbox=nodes(tree).find(n=>n.type==='LazyBoundary'&&n.props.label==='Indbakke')
    assert.equal(inbox.props.componentProps.calendarTasks.props.tasksOnly,true)
  }
})
