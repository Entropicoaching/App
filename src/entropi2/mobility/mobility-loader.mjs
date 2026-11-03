import { registerHooks } from 'node:module'

// Closed exact public contracts; no generic basename fallback or backend stub.
const edges = {
  'mobility-model.mjs': {
    './mobility-recommendation.mjs': 'mobility-recommendation.mjs',
    '../../athlete/nextTrainingHome.mjs': 'public-nextTrainingHome.mjs',
    '../../nextSet.js': 'public-nextSet.mjs', '../../calendarDate.js': 'public-calendarDate.mjs',
    '../../athlete/kostNumbers.mjs': 'public-kostNumbers.mjs',
    '../../athlete/mobilityBeforeSession.mjs': 'public-mobilityBeforeSession.mjs',
    '../../athlete/mobilityCatalog.mjs': 'public-mobilityCatalog.mjs',
    '../../athlete/mobilityFocus.mjs': 'public-mobilityFocus.mjs',
    '../../athlete/coachMobility.mjs': 'public-coachMobility.mjs',
    '../../mobilityHomework.mjs': 'public-mobilityHomework.mjs',
  },
  'mobility-screen.mjs': { './mobility-model.mjs': 'mobility-model.mjs', './mobilityDone.mjs': 'mobilityDone.mjs' },
  'mobilityDone.mjs': {},
  'mobility-recommendation.mjs': {
    '../../athlete/mobilityCatalog.mjs': 'public-mobilityCatalog.mjs',
    '../../athlete/mobilityFocus.mjs': 'public-mobilityFocus.mjs',
    '../../exerciseNames.js': 'public-exerciseNames.mjs', '../../warmup.js': 'public-warmup.mjs',
  },
  'Mobility.mjs': { react: 'synthetic-react.mjs', './mobility-screen.mjs': 'mobility-screen.mjs' },
  'public-nextTrainingHome.mjs': {
    '../calendarDate.js': 'public-calendarDate.mjs', './kostNumbers.mjs': 'public-kostNumbers.mjs',
    '../nextSet.js': 'public-nextSet.mjs', '../exerciseSetView.js': 'public-exerciseSetView.mjs',
  },
  'public-calendarDate.mjs': { './athlete/kostNumbers.mjs': 'public-kostNumbers.mjs' },
  'public-exerciseSetView.mjs': { './exerciseNames.js': 'public-exerciseNames.mjs' },
  'public-mobilityBeforeSession.mjs': {
    react: 'synthetic-react.mjs', './mobilityCatalog.mjs': 'public-mobilityCatalog.mjs',
    './mobilityLibrary.mjs': 'public-mobilityLibrary.mjs', '../exerciseNames.js': 'public-exerciseNames.mjs',
    '../warmup.js': 'public-warmup.mjs',
  },
  'public-coachMobility.mjs': { './mobilityFocus.mjs': 'public-mobilityFocus.mjs' },
  'public-mobilityHomework.mjs': { react: 'synthetic-react.mjs', './athlete/mobilityCatalog.mjs': 'public-mobilityCatalog.mjs' },
  'public-nextSet.mjs': {}, 'public-kostNumbers.mjs': {}, 'public-exerciseNames.mjs': {},
  'public-mobilityCatalog.mjs': {}, 'public-mobilityFocus.mjs': {},
  'public-mobilityLibrary.mjs': {}, 'public-warmup.mjs': {}, 'synthetic-react.mjs': {},
}
const urls = new Map(Object.keys(edges).map(name => [new URL(name, import.meta.url).href, edges[name]]))
export function install() {
  return registerHooks({ resolve(specifier, context, next) {
    const allowed = urls.get(context.parentURL)
    if (allowed) {
      if (!Object.hasOwn(allowed, specifier)) throw Error('Closed synthetic import: ' + specifier)
      return { url: new URL(allowed[specifier], import.meta.url).href, shortCircuit: true }
    }
    return next(specifier, context)
  } })
}
