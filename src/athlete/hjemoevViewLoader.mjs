import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './hjemoevJsx.mjs'
const view=new URL('../AthleteView.jsx',import.meta.url).href
const runtime=new URL('./hjemoevViewRuntime.mjs',import.meta.url).href
const source=readFileSync(new URL(view),'utf8')
const actual=new Set(['./athlete/hjemoevKompakt.mjs','./mobilityHomework.mjs','./mobilityAdherence.mjs','./athlete/enkelPrototype.mjs','./athlete/kostValg.mjs','./athlete/readinessShortcut.mjs'])
const stubs=new Map()
// Explicit imports of this pinned component form the closed synthetic boundary.
for(const [,bindings,spec] of source.matchAll(/^import ([\s\S]*?) from '([^']+)'/gm)) {
 if(actual.has(spec)||spec==='react') continue
 const named=bindings.match(/\{([^}]+)\}/)?.[1].split(',').map(x=>x.trim()).filter(Boolean)||[]
 const names=named.map(x=>x.split(/\s+as\s+/)[0])
 let code='export default function SyntheticBoundary(){return null};'
 for(const name of names) {
  if(!/^[A-Za-z_$][\w$]*$/.test(name)) throw Error('Invalid stub export')
  const value=name==='s'?'{}':name==='today'?"()=>'2026-10-30'":'()=>({})'
  code+=`export const ${name}=${value};`
 }
 stubs.set(spec,code)
}
export const stateNames=[...source.matchAll(/const \[([A-Za-z][\w]*),[^\]]+\] = useState\(/g)].map(x=>x[1])
export function installView() {
 return registerHooks({
  resolve(spec,context,next) {
   if(context.parentURL!==view)return next(spec,context)
   if(spec==='react'||spec===runtime)return {url:runtime,shortCircuit:true}
   if(actual.has(spec))return next(spec,context)
   if(stubs.has(spec))return {url:'homework-view-stub:'+encodeURIComponent(spec),shortCircuit:true}
   throw Error('Unlisted View import: '+spec)
  },
  load(url,context,next) {
   if(url.startsWith('homework-view-stub:'))return {format:'module',shortCircuit:true,source:stubs.get(decodeURIComponent(url.slice(19)))}
   if(url===view)return {format:'module',shortCircuit:true,source:`import {createElement as __create} from ${JSON.stringify(runtime)};const __h=(t,p,_,...c)=>__create(t,p,...c);\n`+jsx(source)}
   return next(url,context)
  },
 })
}
