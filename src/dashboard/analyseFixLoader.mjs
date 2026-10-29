import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './analyseSamletJsx.mjs'
const root = new URL('./', import.meta.url)
const flat = existsSync(new URL('dataEvidence.mjs', root))
const legacy = new Set(['../videoCoachBaselineProgress.js', '../videoCoachFeedbackQuality.js', '../videoCoachLabels.js', '../exerciseNames.js', '../exerciseSetView.js', '../dashboardShared.js', '../dashboardCharts.jsx', './AnalyseLokaltVaerktoej.jsx', './primaerKurve.js', '../danskDato.js', '../AthleteSilentFailNote.jsx'])
const edges = {
  'analyseConclusionMessage.mjs': ['react', './analyseConclusion.mjs'],
  'AnalyseTab.jsx': ['../VideoRetentionLocalPreview.mjs', './analyseConclusion.mjs', './analyseConclusionMessage.mjs', './analyseSamletDom.mjs', '../dataEvidence.mjs', '../dataEnough.mjs', '../coachRyd.mjs', './AnalyseSammenlign.jsx', './analyseSammenlign.mjs', './AnalyseSamletPrototype.jsx', './analyseSamlet.mjs'],
  'VideoRetentionLocalPreview.mjs': ['react', './VideoRetentionPreview.mjs'],
  'VideoRetentionPreview.mjs': ['./videoRetention.mjs'],
  'videoRetention.mjs': [],
  'rel1030.mjs': [],
  'analyseConclusion.mjs': ['../rel1030.mjs', 'react', '../dataEvidence.mjs', '../dataEnough.mjs', '../exerciseProgress.js', '../exerciseSetView.js'],
  'dataEvidence.mjs': ['./dataEnough.mjs', './exerciseProgress.js', './exerciseSetView.js'],
  'udgivelseTrin.mjs': [],
  'dataEnough.mjs': ['./udgivelseTrin.mjs', './calendarDate.js', './rpeEvidence.mjs'],
  'exerciseProgress.js': ['./dataEnough.mjs', './inputValues.js', './calendarDate.js', './exerciseSetView.js', './exerciseNames.js', './volume/ugenoegle.js'],
  'exerciseSetView.js': ['./exerciseNames.js'],
  'inputValues.js': ['./athlete/kostNumbers.mjs'],
  'calendarDate.js': ['./athlete/kostNumbers.mjs'],
  'ugenoegle.js': ['../athlete/kostNumbers.mjs'],
  'rpeEvidence.mjs': ['./dataEnough.mjs'],
  'analyseSammenlign.mjs': ['./analyseSamlet.mjs'],
  'AnalyseSamletPrototype.jsx': ['react', './analyseSamlet.mjs'],
  'AnalyseSammenlign.jsx': ['react', './analyseSammenlign.mjs'],
  'coachRyd.mjs': ['react'],
  'analyseFixStubs.mjs': ['react'],
}
const basename = value => value.slice(value.lastIndexOf('/') + 1)
export function install({ before = false } = {}) {
  return registerHooks({
    resolve(specifier, context, next) {
      const parent = context.parentURL && basename(context.parentURL)
      if (['analyseFix.test.js', 'analyseFixReview.test.js'].includes(parent) && ['../dataEvidence.mjs', '../dataEnough.mjs'].includes(specifier)) return { url: new URL(flat ? basename(specifier) : specifier, root).href, shortCircuit: true }
      if (parent === 'AnalyseTab.jsx' && legacy.has(specifier)) return { url: new URL('analyseFixStubs.mjs', root).href, shortCircuit: true }
      if (Object.hasOwn(edges, parent || '')) {
        if (!edges[parent].includes(specifier)) throw Error('Forbidden import: ' + parent + ' -> ' + specifier)
        const url = specifier === 'react' ? new URL('analyseSamletDom.mjs', root) : flat ? new URL(basename(specifier), root) : new URL(specifier, context.parentURL)
        return { url: url.href, shortCircuit: true }
      }
      // Dependency-free leaves cannot acquire new imports silently.
      if (['exerciseNames.js', 'kostNumbers.mjs', 'analyseSamlet.mjs', 'analyseSamletDom.mjs', 'analyseSamletJsx.mjs'].includes(parent)) throw Error('Forbidden leaf import: ' + specifier)
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url === new URL('AnalyseTab.jsx', root).href) {
        let source = readFileSync(new URL(url), 'utf8')
        if (before) {
          const fixed = 'liftEvidence(athleteLogs, label).rows.map(p => ({ y: p.e1rm, label: p.dag })) : ls.actualData'
          if (source.split(fixed).length !== 2) throw Error('Expected exactly one observed fix')
          source = source.replace(fixed, 'observed.map(p => ({ y: p.e1rm, label: p.dag })) : ls.actualData')
        }
        return { format: 'module', source: `import { h as __h } from './analyseSamletDom.mjs';\n${jsx(source)}`, shortCircuit: true }
      }
      if (['AnalyseSamletPrototype.jsx', 'AnalyseSammenlign.jsx'].some(name => url === new URL(name, root).href)) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
      return next(url, context)
    },
  })
}
