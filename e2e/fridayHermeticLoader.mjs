import { existsSync as exactExists } from 'node:fs'
// Kun kendte lokale moduler. Flad worker-kopi eller de samme projektstier.
import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
const root = new URL('./', import.meta.url)
const paths = {
  'e2eTestFlags.mjs': 'src/e2eTestFlags.mjs',
  'coachMobility.mjs': 'src/athlete/coachMobility.mjs',
  'CoachMobility.jsx': 'src/athlete/CoachMobility.jsx',
  'MobilitetsBibliotek.jsx': 'src/athlete/MobilitetsBibliotek.jsx',
  'mobilityLibrary.mjs': 'src/athlete/mobilityLibrary.mjs',
  'mobilityCatalog.mjs': 'src/athlete/mobilityCatalog.mjs',
  'mobilityHomework.mjs': 'src/mobilityHomework.mjs',
  'mobilityHelped.mjs': 'src/mobilityHelped.mjs',
  'rel1030.mjs': 'src/rel1030.mjs',
  'kostNumbers.mjs': 'src/athlete/kostNumbers.mjs',
  'MobilitetFokus.jsx': 'src/athlete/MobilitetFokus.jsx',
  'mobilityFocus.mjs': 'src/athlete/mobilityFocus.mjs',
  'mobilityDom.mjs': 'src/athlete/mobilityDom.mjs',
  'analyseSamlet.mjs': 'src/dashboard/analyseSamlet.mjs',
  'coachPlanCopy.mjs': 'src/dashboard/coachPlanCopy.mjs',
  'smerteRegion.js': 'src/athlete/smerteRegion.js',
  'ugenoegle.js': 'src/volume/ugenoegle.js',
}
for (const name of ['calendarDate.js', 'inputValues.js', 'coachPriority.js', 'automationAlerts.js',
  'dataEnough.mjs', 'dataEvidence.mjs', 'rpeEvidence.mjs', 'mealEvidence.mjs', 'videoEvidence.mjs', 'coachBriefingSeen.js', 'coachBriefingRules.js', 'coachInboxState.js', 'coachNoteSignal.js', 'exerciseSetView.js', 'exerciseProgress.js', 'exerciseNames.js']) paths[name] = 'src/' + name
const urls = new Map(Object.entries(paths).map(([name, path]) => [name,
  new URL(existsSync(new URL(name, root)) ? name : '../' + path, root).href]))
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.startsWith('file:')) {
        for (const ext of ['.js', '.jsx', '.mjs']) if (exactExists(new URL(specifier + ext, context.parentURL))) { specifier += ext; break }
      }
      if (specifier === 'react' && ['MobilitetFokus.jsx','CoachMobility.jsx','MobilitetsBibliotek.jsx','mobilityHelped.mjs','mobilityHomework.mjs'].some(name => context.parentURL === urls.get(name))) return { url: urls.get('mobilityDom.mjs'), shortCircuit: true }
      const name = specifier.split('/').at(-1)
      if (specifier.startsWith('.') && urls.has(name)) return { url: urls.get(name), shortCircuit: true }
      if ([...urls.values()].includes(context.parentURL)) throw new Error(`Ukendt hermetisk import: ${specifier}`)
      return next(specifier, context)
    },
    load(url, context, next) {
      if ([...urls.values()].includes(url)) return { format: 'module', source: readFileSync(new URL(url), 'utf8'), shortCircuit: true }
      return next(url, context)
    },
  })
}
