import { assertRestMobilityEdge } from './restMobilityEdges.mjs'
import { withHvileBaseline } from './hvileBaseline.mjs'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './prog2Jsx.mjs'
const names = ['restMobility.mjs', 'coachMobility.mjs', 'mobilityFocus.mjs', 'mobilityCatalog.mjs', 'mobilityHomework.mjs', 'RestDays.jsx','restDays.mjs','IntensityExplanation.jsx','intensityExplanation.mjs','programBlockOverview.mjs','mealEvidence.mjs','videoEvidence.mjs','vcForenkl4.mjs','ProgramTab.jsx','CountdownRing.jsx','prog2Baseline.txt','inputValues.js','restTimer.js','repsPrescription.js','fixedRepsEntry.js','exerciseSetView.js','exerciseNames.js','athleteShared.js','saetSmerte.js','smerteRegion.js','calendarDate.js','kostNumbers.mjs','rpeEvidence.mjs','udgivelseTrin.mjs', 'dataEnough.mjs','ugeHjaelp.js','coachFremgang.js','dataEvidence.mjs','exerciseProgress.js','coachBriefingRules.js','ugenoegle.js','programNaesteUge.mjs']
const nativePaths = {"mobilityHomework.mjs": "../mobilityHomework.mjs", "mealEvidence.mjs": "../mealEvidence.mjs", "videoEvidence.mjs": "../videoEvidence.mjs", "vcForenkl4.mjs": "../vcForenkl4.mjs", "inputValues.js": "../inputValues.js", "restTimer.js": "../restTimer.js", "repsPrescription.js": "../repsPrescription.js", "fixedRepsEntry.js": "../fixedRepsEntry.js", "exerciseSetView.js": "../exerciseSetView.js", "exerciseNames.js": "../exerciseNames.js", "athleteShared.js": "../athleteShared.js", "saetSmerte.js": "../saetSmerte.js", "calendarDate.js": "../calendarDate.js", "rpeEvidence.mjs": "../rpeEvidence.mjs", "udgivelseTrin.mjs": "../udgivelseTrin.mjs", "dataEnough.mjs": "../dataEnough.mjs", "coachFremgang.js": "../coachFremgang.js", "dataEvidence.mjs": "../dataEvidence.mjs", "exerciseProgress.js": "../exerciseProgress.js", "coachBriefingRules.js": "../coachBriefingRules.js", "ugenoegle.js": "../volume/ugenoegle.js"}
const urls = new Map(names.map(name => {
  const flat = new URL(name, import.meta.url)
  return [name, (existsSync(flat) ? flat : new URL(nativePaths[name] || name, import.meta.url)).href]
}))
const dom = new URL('./prog2Dom.mjs', import.meta.url).href
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if ([...urls.values()].includes(context.parentURL)) assertRestMobilityEdge(specifier, context.parentURL, new URL('./', import.meta.url))
      const restName = specifier.split('/').at(-1)
      if (['RestDays.jsx', 'restDays.mjs'].includes(restName) && specifier !== './' + restName) throw new Error('Unapproved synthetic dependency: ' + specifier)
      if (urls.has(specifier.split('/').at(-1)) && (context.parentURL === import.meta.url || [...urls.values()].includes(context.parentURL))) {
        return { url: urls.get(specifier.split('/').at(-1)), shortCircuit: true }
      }
      if ([...urls.values()].includes(context.parentURL)) {
        if (specifier === './prog2Dom.mjs' || specifier === 'react' || specifier === '../supabase') return { url: dom, shortCircuit: true }
        throw new Error(`Unapproved synthetic dependency: ${specifier}`)
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (urls.get('prog2Baseline.txt') === url || (url.endsWith('.jsx') && [...urls.values()].includes(url))) {
        let source = readFileSync(new URL(url), 'utf8')
        if (url === urls.get('prog2Baseline.txt')) source = withHvileBaseline(source)
        return { format: 'module', shortCircuit: true, source: `import { h as __h } from './prog2Dom.mjs';\n${jsx(source)}` }
      }
      return next(url, context)
    },
  })
}
install()
export const { default: Program } = await import('./ProgramTab.jsx')
export const { default: Baseline } = await import('./prog2Baseline.txt')
export const helpers = await import('./ugeHjaelp.js')
export const model = await import('./programNaesteUge.mjs')
