import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './analyseSamletJsx.mjs'
const root = new URL('./', import.meta.url)
// Explicit locations support the flat hermetic copy and the original app tree.
const flat = existsSync(new URL('dataEnough.mjs', root))
const parentModules = new Set(['rel1030.mjs','VideoRetentionLocalPreview.mjs','VideoRetentionPreview.mjs','videoRetention.mjs','udgivelseTrin.mjs', 'dataEnough.mjs','dataEvidence.mjs','calendarDate.js','rpeEvidence.mjs','exerciseProgress.js','exerciseSetView.js','exerciseNames.js','inputValues.js','coachRyd.mjs','dashboardShared.js','videoCoachLabels.js','videoCoachFeedbackQuality.js','videoCoachBaselineProgress.js'])
const location = name => flat ? name : name === 'kostNumbers.mjs' ? '../athlete/kostNumbers.mjs' : name === 'ugenoegle.js' ? '../volume/ugenoegle.js' : parentModules.has(name) ? '../'+name : name
const originals = new Set(['AnalyseTab.jsx'])
const actual = new Set(['rel1030.mjs','VideoRetentionLocalPreview.mjs','VideoRetentionPreview.mjs','videoRetention.mjs','dashboardShared.js','videoCoachLabels.js','videoCoachFeedbackQuality.js','videoCoachBaselineProgress.js','analyseConclusion.mjs','udgivelseTrin.mjs', 'dataEnough.mjs','dataEvidence.mjs','calendarDate.js','kostNumbers.mjs','rpeEvidence.mjs','exerciseProgress.js','exerciseSetView.js','exerciseNames.js','inputValues.js','ugenoegle.js','coachRyd.mjs','AnalyseSamletPrototype.jsx','analyseSamlet.mjs','AnalyseSammenlign.jsx','analyseSammenlign.mjs'])
const legacy = new Set(['../dashboardCharts.jsx','./AnalyseLokaltVaerktoej.jsx','./primaerKurve.js','../danskDato.js','../AthleteSilentFailNote.jsx'])
export function install() {
 return registerHooks({
  resolve(specifier, context, next) {
   const parent = context.parentURL && new URL(context.parentURL)
   if (!parent || parent.protocol !== 'file:' || ![root.href, ...(!flat ? [new URL('../',root).href,new URL('../athlete/',root).href,new URL('../volume/',root).href] : [])].includes(new URL('./', parent).href)) throw Error('Closed loader parent: '+specifier)
   const parentName = parent.pathname.split('/').at(-1)
   if (specifier === 'react') return {url: new URL('analyseSamletDom.mjs',root).href,shortCircuit:true}
   if (originals.has(parentName) && legacy.has(specifier)) return {url:new URL('analyseSamletStubs.mjs',root).href,shortCircuit:true}
   if (specifier.startsWith('.')) {
    const name = specifier.split('/').at(-1)
    if ((actual.has(name) && (specifier === './'+name || specifier === '../'+name || specifier === './athlete/kostNumbers.mjs' || specifier === './volume/ugenoegle.js' || specifier === '../athlete/kostNumbers.mjs')) ||
      (specifier === './'+name && (originals.has(name) || ['analyseSamletDom.mjs','analyseSamletStubs.mjs'].includes(name)))) {
     return {url:new URL(location(name),root).href,shortCircuit:true}
    }
    throw Error('Closed loader import: '+specifier+' from '+parentName)
   }
   if (specifier === 'node:test' || specifier === 'node:assert/strict' || specifier === 'node:fs' || specifier === 'node:crypto') return next(specifier,context)
   throw Error('Closed loader import: '+specifier)
  },
  load(url,context,next) {
   if (!url.startsWith(flat ? root.href : new URL('../',root).href)) {
    if (url.startsWith('node:')) return next(url,context)
    throw Error('Closed loader URL: '+url)
   }
   const name = new URL(url).pathname.split('/').at(-1)
   if (originals.has(name)) return {format:'module',source:`import { h as __h } from './analyseSamletDom.mjs';\n${jsx(readFileSync(new URL(url),'utf8'))}`,shortCircuit:true}
   if (['AnalyseSamletPrototype.jsx','AnalyseSammenlign.jsx'].includes(name)) return {format:'module',source:readFileSync(new URL(url),'utf8'),shortCircuit:true}
   return next(url,context)
  }
 })
}
