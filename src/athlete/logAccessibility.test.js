import test from 'node:test'
import assert from 'node:assert/strict'
import { setAnnouncement, bindFirstSetFocus } from './logAccessibility.mjs'
const ex = [{ id: 'a', name: 'Bænkpres' }, { id: 'b', name: 'Dødløft' }, { id: 'c', name: 'Bænkpres' }]
const row = (id, n = 1) => ({ exercise_id: id, set_number: n, weight: 60, reps_completed: 5 })
const last = (id, n = 1) => ({ exerciseId: id, setNumber: n })
const initial = () => ({ last: null, text: '' })
test('F2: exercise changes with identical set, kg and reps', () => {
 let a = setAnnouncement(initial(), last('a'), [row('a')], ex)
 let b = setAnnouncement(a, last('b'), [row('a'), row('b')], ex)
 assert.match(a.text, /Bænkpres, sæt 1/); assert.match(b.text, /Dødløft, sæt 1/)
 assert.notEqual(a.text,b.text)
})
test('F2: each new approval changes text, also duplicate exercise names and repeats', () => {
 let s = initial(); const texts = new Set()
 for (const id of ['a','a','c','a']) {
  s = setAnnouncement(s,last(id),[row('a'),row('c')],ex)
  assert.match(s.text,/Bænkpres/); texts.add(s.text)
 }
 assert.equal(texts.size,4); assert.equal(s.count,4)
})
test('F2: rerender does not announce; mount history silent', () => {
 const l=last('a'); let s=setAnnouncement({last:l,text:''},l,[row('a')],ex)
 assert.equal(s.text,'')
 s=setAnnouncement(s,last('a',2),[row('a',2)],ex)
 assert.equal(setAnnouncement(s,s.last,[row('a',2)],ex).text,s.text)
 assert.equal(s.count,1)
})
test('F2: wait for row, skip excluded, undo clears, names survive completed session', () => {
 const l=last('a'); let s=setAnnouncement(initial(),l,[],ex)
 assert.equal(s.text,''); assert.equal(s.count,0)
 s=setAnnouncement(s,l,[{...row('a'),skipped:true}],[]); assert.equal(s.text,'')
 s=setAnnouncement(s,l,[row('a')],undefined); assert.match(s.text,/Bænkpres/)
 const before=s.text; s=setAnnouncement(s,null,[],[]); assert.equal(s.text,'')
 s=setAnnouncement(s,last('a'),[row('a')],[]); assert.notEqual(s.text,before)
 assert.match(s.text,/Bænkpres/)
})
class NodeFake {
 constructor(doc) { this.ownerDocument=doc; this.listeners=new Map(); this.isConnected=true }
 addEventListener(type,fn) { if(!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(fn) }
 removeEventListener(type,fn) { this.listeners.get(type)?.delete(fn) }
 emit(type,event) { for(const fn of this.listeners.get(type)||[]) fn(event) }
 focus() { this.ownerDocument.activeElement=this }
 contains(n) { return n===this || n===this.child }
}
function fixture() {
 const doc=new NodeFake(null); doc.ownerDocument=doc
 const dialog=new NodeFake(doc), close=new NodeFake(doc), trigger=new NodeFake(doc), body=new NodeFake(doc)
 dialog.child=close; let dismissed=0
 const cleanup=bindFirstSetFocus({dialog,close,trigger,dismiss:()=>dismissed++})
 return {doc,dialog,close,trigger,body,cleanup,get dismissed(){return dismissed}}
}
const key = (value,target,shiftKey=false) => ({key:value,target,shiftKey,prevented:0,stopped:0,preventDefault(){this.prevented++},stopPropagation(){this.stopped++}})
test('F3: Escape from body and Start; no duplicate dialog listener', () => {
 for(const from of ['body','close']) {
  const f=fixture(); f.doc.activeElement=f[from]
  const e=key('Escape',f[from]); f.doc.emit('keydown',e)
  assert.equal(f.dismissed,1); assert.equal(e.prevented,1); assert.equal(e.stopped,1)
  assert.equal(f.dialog.listeners.get('keydown'),undefined)
  f.cleanup()
 }
})
test('F3: start focus, both Tab directions, focus containment and cleanup', () => {
 const f=fixture(); assert.equal(f.doc.activeElement,f.close)
 for(const shift of [false,true]) {
  const e=key('Tab',f.body,shift); f.doc.emit('keydown',e)
  assert.equal(e.prevented,1); assert.equal(f.doc.activeElement,f.close)
 }
 f.doc.activeElement=f.body; f.doc.emit('focusin',{target:f.body}); assert.equal(f.doc.activeElement,f.close)
 f.doc.emit('keydown',key('Enter',f.close)); assert.equal(f.dismissed,0)
 f.cleanup(); assert.equal(f.doc.activeElement,f.trigger)
 for(const set of f.doc.listeners.values()) assert.equal(set.size,0)
 f.doc.emit('keydown',key('Escape',f.body)); assert.equal(f.dismissed,0)
})
test('F3: remount removes old listener; disconnected trigger is not focused', () => {
 const f=fixture(); f.trigger.isConnected=false; f.cleanup(); assert.equal(f.doc.activeElement,f.close)
 let calls=0
 const cleanup=bindFirstSetFocus({...f,dismiss:()=>calls++})
 f.doc.emit('keydown',key('Escape',f.body)); assert.equal(calls,1); assert.equal(f.dismissed,0)
 cleanup()
})
test('F1: synthetic DOM accessible names stay exact; descriptions carry context', () => {
 const descriptions=new Map([['instance-1','Bænkpres, sæt 2 af 4'],['instance-2','Dødløft, sæt 1 af 3']])
 const name = button => button.ariaLabel || button.textContent
 for(const id of descriptions.keys()) for(const label of ['Godkendt','Spring over']) {
  const button={textContent:label,ariaDescribedby:id,type:'button'}
  assert.equal(name(button),label); assert.match(descriptions.get(button.ariaDescribedby),/sæt \d af \d/)
 }
})

// Små inert-regelkildekopier, kun til syntetisk før/efter-modprøve.
function beforeAnnouncement(previous,last,logs=[]) {
 if(!last) return {last:null,text:''}
 const row=logs.find(log=>log.exercise_id===last.exerciseId && log.set_number===last.setNumber && !log.skipped)
 if(!row) return {last:previous.last,text:''}
 if(previous.last===last) return previous
 return {last,text:`Godkendt, sæt ${last.setNumber}. Loggen viser ${row.weight ?? 0} kg og ${row.reps_completed ?? 0} reps.`}
}
test('før/efter F2: pinned rule copy collides, candidate distinguishes',()=>{
 const a=beforeAnnouncement(initial(),last('a'),[row('a')])
 const b=beforeAnnouncement(a,last('b'),[row('b')])
 assert.equal(a.text,b.text)
 const fixedA=setAnnouncement(initial(),last('a'),[row('a')],ex)
 const fixedB=setAnnouncement(fixedA,last('b'),[row('b')],ex)
 assert.notEqual(fixedA.text,fixedB.text)
})

// APP-A11Y2: repo source bindings, read as inert text only.
import { readFileSync } from 'node:fs'
// Own pure static contract. Source strings are inert; JSX is never evaluated.
function inspectA11ySources(card, helper, overview, sheet) {
  const errors = []
  const check = (text, pattern, label) => { if (!pattern.test(text)) errors.push(label) }
  check(card, /<button\s+type="button"\s+ref=\{firstTrigger\}/, 'keyboard trigger')
  check(card, /return\s+bindFirstSetFocus\(\{\s*dialog:\s*firstDialog\.current,\s*trigger:\s*firstTrigger\.current,\s*close:\s*firstClose\.current,\s*dismiss:\s*\(\)\s*=>\s*setFoersteAaben\(false\)/, 'focus wiring')
  check(card, /ref=\{firstDialog\}\s+role="dialog"\s+aria-modal="true"\s+aria-label="Første sæt"/, 'dialog aria')
  check(card, /ref=\{firstClose\}/, 'close ref')
  check(card, /role="status"\s+aria-live="polite"\s+aria-atomic="true"/, 'live aria')
  check(card, /setAnnouncement\(announcementRef\.current,\s*lastLoggedSet,\s*exerciseLogs,\s*pas\?\.session\?\.exercises\)/, 'announcement wiring')
  check(card, /id=\{logContextId\}[\s\S]*?\{`\$\{view\.name\}, sæt \$\{saetNu\} af \$\{saetIAlt\}`\}/, 'description context')
  for (const label of ['Godkendt', 'Spring over']) {
    const buttons = card.match(/<button\b[\s\S]*?<\/button>/g) || []
    const button = buttons.find(b => b.endsWith('>' + label + '</button>') && b.includes('aria-describedby={logContextId}'))
    if (!button || !/type="button"/.test(button) || /aria-label\s*=/.test(button)) errors.push('exact name ' + label)
  }
  check(helper, /if\s*\(event\.key\s*===\s*'Escape'\)\s*\{\s*event\.preventDefault\(\)\s*event\.stopPropagation\(\)\s*dismiss\(\)/, 'Escape')
  check(helper, /else if\s*\(event\.key\s*===\s*'Tab'\)\s*\{\s*event\.preventDefault\(\)\s*close\.focus\(\)/, 'Tab')
  check(helper, /doc\.addEventListener\('keydown',\s*keydown\)/, 'keyboard listener')
  check(helper, /doc\.addEventListener\('focusin',\s*contain\)/, 'contain listener')
  check(helper, /doc\.removeEventListener\('keydown',\s*keydown\)/, 'keyboard cleanup')
  check(helper, /doc\.removeEventListener\('focusin',\s*contain\)/, 'contain cleanup')
  check(helper, /if\s*\(trigger\?\.isConnected\)\s*trigger\.focus\(\)/, 'restore focus')
  check(overview, /<button\s+ref=\{trigger\}\s+type="button"/, 'overview keyboard')
  check(overview, /aria-haspopup="dialog"\s+aria-expanded="false"\s+aria-controls=\{dialogId\}/, 'overview aria')
  check(overview, /<dialog\s+ref=\{dialog\}\s+id=\{dialogId\}[^>]*aria-labelledby=\{titleId\}/, 'native dialog')
  check(sheet, /const cancel\s*=\s*event\s*=>\s*\{\s*event\.preventDefault\(\);\s*hide\(\)\s*\}/, 'sheet Escape')
  check(sheet, /\[dialog,\s*'cancel',\s*cancel\]/, 'sheet cancel binding')
  return errors
}

const source = name => readFileSync(new URL(name, import.meta.url), 'utf8')
test('APP-A11Y2: keyboard, aria and Escape stay wired into both dialogs', () => {
 assert.deepEqual(inspectA11ySources(source('./DagensPasCard.jsx'), source('./logAccessibility.mjs'),
  source('./PasOverblik.jsx'), source('./pasOverblikDialog.mjs')), [])
})
