const registerHooks = (...args) => registryHooks(import.meta.url)(...args)
import './coachWeekTestLoader.mjs'
import { registryHooks, registryRecipe } from '../testModuleRegistry.mjs'
import { readFileSync } from 'node:fs'
import { jsx } from './rebaseJsx.mjs'
const root = new URL('./',import.meta.url)
const page = new URL('ForsideView.jsx',root).href
const dom = new URL('rebaseDom.mjs',root).href
const clauses = registryRecipe(import.meta.url, 'clauses')
const actual = registryRecipe(import.meta.url, 'actual')
const values = {
 s:'{}', videoCoachMeasurementSummary:'() => null', coachInboxLine:'() => null', currentWeekNo:'weeks => weeks[0]?.week_number ?? null',
 dataEnoughEnabled:'() => false', roligeAtleter:'() => []', roligLinje:'() => null',
 validCoachScope:'() => false', CoachMeetSoon:'() => null', initials:'name => name.slice(0,2)', dageSiden:'() => 1', holidayInfo:'() => null',
}
export function resolve(specifier,context,next) {
 if (context.parentURL !== page) return next(specifier,context)
 if (specifier === dom) return {url:dom,shortCircuit:true}
 if (specifier === 'react') return {url:dom,shortCircuit:true}
 if (actual[specifier]) return {url:new URL(actual[specifier],root).href,shortCircuit:true}
 const names=clauses[specifier]
 if (!names) throw Error('Unpinned Forside dependency: '+specifier)
 const source=names.map(name=>name==='default' ? 'export default function Stub(){return null}' :
  `export const ${name} = ${values[name] || "() => { throw Error('Unexpected Forside helper') }"}`).join('\n')
 return {url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true}
}
registerHooks({resolve,load(url,context,next) {
 if(url===page) return {format:'module',source:`import { __h } from '${dom}';\n`+jsx(readFileSync(new URL(url),'utf8')),shortCircuit:true}
 return next(url,context)
}})
