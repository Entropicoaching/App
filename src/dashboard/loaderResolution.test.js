import test from 'node:test'
import assert from 'node:assert/strict'
import { createHooks, install } from './coachPlanLoader.mjs'
import { mount, button, nodes } from './coachPlanDom.mjs'
const guard=install()
const {default:Program}=await import('./ProgramTab.jsx')
const {DEFAULT_PROGRAM_COPY}=await import('./programCopy.js')
guard.deregister()
test('integration: coachPlan loader imports real PR7 controls with default OFF', () => {
  assert.equal(DEFAULT_PROGRAM_COPY,false)
  const w={id:'w',athlete_id:'a',week_number:1,sessions:[]}
  const p={weeks:[w],selectedAthlete:{id:'a'},athleteLogs:[],assignEdits:{},
    programShownWeeks:()=>[w],programActiveStart:()=>1,programCopyEnabled:true}
  const app=mount(Program,p)
  button(app.render(),'Kopiér med progression').props.onClick({stopPropagation(){}})
  assert.equal(nodes(app.render(),n=>n.type==='form'&&n.props['aria-label']==='Kopiér med progression').length,1)
})
test('FS: case sensitive and case insensitive resolution retain complete filenames in flat and nested copies', () => {
  for (const flat of [true,false]) for (const insensitive of [false,true]) {
    const root=new URL('file:///synthetic/src/dashboard/')
    const hooks=createHooks(root,flat)
    const files=new Map(['CoachPlanCopy.jsx','coachPlanCopy.mjs','ProgramCopyOptions.jsx','programCopy.js'].map(n=>{
      const url=new URL(n,root).href
      return [insensitive?url.toLowerCase():url,url]
    }))
    const next=(specifier,context)=>{
      const url=new URL(specifier,context.parentURL).href
      const found=files.get(insensitive?url.toLowerCase():url)
      assert.ok(found,`Missing synthetic file: ${url}`)
      return {url:found}
    }
    for (const parent of ['ProgramTab.jsx','PROGRAMTAB.JSX']) {
      for (const name of ['CoachPlanCopy.jsx','coachPlanCopy.mjs','ProgramCopyOptions.jsx','programCopy.js']) {
        for (const spelling of [name,name.toUpperCase(),name.toLowerCase()]) {
          const result=hooks.resolve('./'+spelling,{parentURL:new URL(parent,root).href},next)
          assert.equal(result.url,new URL(name,root).href)
          assert.ok(files.has(insensitive?result.url.toLowerCase():result.url))
        }
      }
    }
    assert.notEqual(hooks.resolve('./CoachPlanCopy.jsx',{parentURL:new URL('ProgramTab.jsx',root).href},next).url,
      hooks.resolve('./coachPlanCopy.mjs',{parentURL:new URL('ProgramTab.jsx',root).href},next).url)
  }
})
