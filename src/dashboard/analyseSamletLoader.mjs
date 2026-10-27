import { existsSync as exactExists } from 'node:fs'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { jsx } from './analyseSamletJsx.mjs'
const root = new URL('./', import.meta.url)
const legacy = new Set(['../videoCoachBaselineProgress.js', '../videoCoachFeedbackQuality.js', '../videoCoachLabels.js', '../exerciseNames.js', '../exerciseSetView.js', '../dashboardShared.js', '../dashboardCharts.jsx', './AnalyseLokaltVaerktoej.jsx', './primaerKurve.js', '../danskDato.js', '../AthleteSilentFailNote.jsx'])
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      if (specifier === 'react') return { url: new URL('analyseSamletDom.mjs', root).href, shortCircuit: true }
      if (context.parentURL?.endsWith('/AnalyseTab.jsx') || context.parentURL?.endsWith('/input-373-370-AnalyseTab.jsx')) {
        if (legacy.has(specifier)) return { url: new URL('analyseSamletStubs.mjs', root).href, shortCircuit: true }
        if (specifier === './AnalyseSamletPrototype.jsx') return { url: new URL('AnalyseSamletPrototype.jsx', root).href, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.endsWith('/AnalyseSamletPrototype.jsx') || url.endsWith('/AnalyseSammenlign.jsx')) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
      if (url.endsWith('/AnalyseTab.jsx') || url.endsWith('/input-373-370-AnalyseTab.jsx')) return { format: 'module', source: `import { h as __h } from './analyseSamletDom.mjs';\n${jsx(readFileSync(new URL(url), 'utf8'))}`, shortCircuit: true }
      return next(url, context)
    },
  })
}
