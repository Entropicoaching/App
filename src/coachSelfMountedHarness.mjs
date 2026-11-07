import assert from 'node:assert/strict'
import {createElement as h,act,StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {sessionReactDocument} from './entropi2/session/sessionQuickSetReactDom.mjs'
import {fixture,session,dual,foreign} from './coachSelfMountedFixture.mjs'
const tick=()=>new Promise(r=>setImmediate(r))
export async function setup(t, App,{legacy=null,strict=true,cached=false,pauseRole=null,values:extra=[],roleError=null,storageUnavailable=false,mobile=false,pendingSession=null}={}) {
 const doc=sessionReactDocument(),host=doc.createElement('div');doc.body.append(host)
 const ce=doc.createElement;doc.createElement=tag=>{const n=ce(tag);if(tag==='select')Object.defineProperty(n,'options',{get:()=>n.children.filter(c=>c.tagName==='OPTION')});return n}
 const values=new Map(extra);if(legacy)values.set('entropi_my_athlete_id',legacy);if(cached)values.set('entropi_role_guess_'+session.user.id,'coach')
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(storageUnavailable&&k.startsWith('entropi_coach_self'))throw Error('Synthetic storage unavailable');values.set(k,String(v))},removeItem:k=>values.delete(k)}
 const timers=new Map(),events=new Map()
 const win=Object.assign(doc.defaultView,{innerWidth:mobile?400:1200,location:{search:'',href:'https://synthetic.invalid/',pathname:'/'},scrollTo(){},addEventListener(n,f){if(!events.has(n))events.set(n,new Set());events.get(n).add(f)},removeEventListener(n,f){events.get(n)?.delete(f)}})
 const repl={window:win,document:doc,localStorage:storage,sessionStorage:storage,navigator:{onLine:true},IS_REACT_ACT_ENVIRONMENT:true,fetch:()=>{throw Error('Network forbidden')},setTimeout(fn,ms){const k={};timers.set(k,{fn,ms});return k},clearTimeout:k=>timers.delete(k),requestAnimationFrame:()=>({}),cancelAnimationFrame(){},setInterval:()=>({}),clearInterval(){}}
 Object.assign(win,{setInterval:repl.setInterval,clearInterval:repl.clearInterval})
 const originals=new Map(Object.keys(repl).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const[k,value]of Object.entries(repl))Object.defineProperty(globalThis,k,{configurable:true,writable:true,value})
 Object.assign(fixture,{captured:{},calls:[],rows:[{...dual,onboarding_completed_at:'2026-01-01'},foreign],authSession:session,role:'coach',pauseRole,roleError,queue:null,cleanNav:true,pendingSession,athleteRead:null})
 const root=createRoot(host)
 t.after(async()=>{await act(async()=>root.unmount());for(const[k,d]of originals){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}})
 const settle=async()=>act(async()=>{for(let i=0;i<8;i++){for(const[k,v]of [...timers])if(v.ms===0){timers.delete(k);v.fn()}await tick()}})
 const click=async n=>{assert.ok(n,'Expected mounted action: '+host.textContent);await act(async()=>{host.dispatch('click',{type:'click',target:n,button:0,bubbles:true,stopPropagation(){}});await tick()});await settle()}
 const button=label=>host.querySelectorAll('button').find(n=>n.textContent.trim().endsWith(label))
 const choose=()=>[...host.querySelectorAll('button'),...host.querySelectorAll('div')].find(n=>n.textContent===dual.name)
 await act(async()=>{root.render(strict?h(StrictMode,null,h(App)):h(App));await tick()});await settle()
 return {host,root,values,storage,click,button,choose,settle,timers}
}
