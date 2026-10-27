import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { jsx } from './rel3Jsx.mjs'

// Eksplicitte offentlige moduler. Ukendte imports fejler normalt.
const paths = {
  'nextTrainingHome.mjs': 'athlete/nextTrainingHome.mjs', 'kostNumbers.mjs': 'athlete/kostNumbers.mjs',
  'fremgangFokusModel.mjs': 'athlete/fremgangFokusModel.mjs', 'rekorder.js': 'athlete/rekorder.js',
  'staevnedagPlan.mjs': 'athlete/staevnedagPlan.mjs', 'staevnedagFocus.mjs': 'athlete/staevnedagFocus.mjs',
  'coachTemplateMessages.mjs': 'dashboard/coachTemplateMessages.mjs',
  'CoachTemplateMessage.jsx': 'dashboard/CoachTemplateMessage.jsx',
  'fremgangFokus.mjs': 'athlete/fremgangFokus.mjs', 'MeetDayPlanner.jsx': 'athlete/MeetDayPlanner.jsx',
  'ugenoegle.js': 'volume/ugenoegle.js',
}
const rootModules = ['calendarDate.js', 'inputValues.js', 'nextSet.js', 'exerciseSetView.js',
  'exerciseNames.js', 'exerciseProgress.js', 'dataEnough.mjs', 'rpeEvidence.mjs', 'coachRyd.mjs', 'release3TestFlags.mjs']
for (const name of rootModules) paths[name] = name
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react') return { url: new URL('./rel3Dom.mjs', import.meta.url).href, shortCircuit: true }
      const name = basename(specifier)
      if (['FremgangTab.jsx', 'EnkelFremgangTab.jsx', 'athleteShared.js'].includes(name)) {
        return { url: new URL('./rel3Stubs.mjs', import.meta.url).href, shortCircuit: true }
      }
      if (specifier.startsWith('.') && paths[name]) {
        const flat = new URL(name, import.meta.url)
        const url = existsSync(flat) ? flat : new URL('../src/' + paths[name], import.meta.url)
        return { url: url.href, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.endsWith('/MeetDayPlanner.jsx')) return { format: 'module', shortCircuit: true,
        source: "import { createElement as __create } from 'react'; const __h = (type, props, unused, ...children) => __create(type, props, ...children);\n" + jsx(readFileSync(new URL(url), 'utf8')) }
      // Denne faktiske komponent bruger createElement og indeholder ingen JSX.
      if (url.endsWith('/CoachTemplateMessage.jsx')) return next(url, { ...context, format: 'module' })
      return next(url, context)
    },
  })
}
