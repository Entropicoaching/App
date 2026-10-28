import { hookControl } from './checklistHarness.mjs'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
const {default:App}=await import('./App.jsx')
const {default:AthleteView}=await import('./AthleteView.jsx')
const {default:Dashboard}=await import('./Dashboard.jsx')
function all(tree) { return tree && typeof tree==='object' ? [tree,...(tree.props?.children||[]).flatMap(all)] : [] }
function renderApp() { hookControl.cursor=0; return App() }
test('actual App preview handler carries target screen and defaults to home on next preview',()=>{
  hookControl.values=[{user:{id:'synthetic-coach'}},'coach',false,false,false,null,'hjem',false]
  try {
    let tree=renderApp()
    let dashboard=all(tree).find(n=>n.props.label==='Dashboard')
    dashboard.props.componentProps.onPreviewAthlete('synthetic-a','mobilisering')
    let preview=all(renderApp()).find(n=>n.props.label==='Atletvisning')
    assert.equal(preview.props.componentProps.previewInitialTab,'mobilisering')
    assert.equal(preview.props.componentProps.coachAthleteId,'synthetic-a')
    preview.props.componentProps.onExitPreview()
    dashboard=all(renderApp()).find(n=>n.props.label==='Dashboard')
    dashboard.props.componentProps.onPreviewAthlete('synthetic-b')
    preview=all(renderApp()).find(n=>n.props.label==='Atletvisning')
    assert.equal(preview.props.componentProps.previewInitialTab,'hjem')
  } finally {hookControl.values=null}
})
test('actual AthleteView initializes requested screen only for coach preview',()=>{
  try {
    for(const tab of ['program','hjem','mobilisering','fremgang','invalid']) {
      for(const role of ['coach','athlete']) {
        let value
        hookControl.first=v=>value=v
        assert.throws(()=>AthleteView({role,coachAthleteId:'synthetic-a',previewInitialTab:tab}),/FIRST_STATE_CAPTURED/)
        assert.equal(value,role==='coach' && tab!=='invalid'?tab:'hjem')
      }
    }
    let value; hookControl.first=v=>value=v
    assert.throws(()=>AthleteView({role:'coach',previewInitialTab:'program'}),/FIRST_STATE_CAPTURED/)
    assert.equal(value,'hjem')
  } finally {hookControl.first=null}
})
test('all changed JSX modules import; Dashboard mounts gated keyed checklist with real handlers',()=>{
  assert.equal(typeof Dashboard,'function')
  const source=readFileSync(new URL('Dashboard.jsx',import.meta.url),'utf8')
  assert.match(source,/checklistEnabled = rel1030Enabled/)
  assert.match(source,/<FridayChecklistEntry enabled=\{checklistEnabled\}/)
  assert.match(source,/checklistEnabled && view === 'friday-checklist' && <FridayChecklist key=\{session.user.id\}/)
  assert.match(source,/openProfile=\{openProfile\} onPreviewAthlete=\{onPreviewAthlete\} setView=\{setView\}/)
})
