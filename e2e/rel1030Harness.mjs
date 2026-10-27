import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { basename, posix } from 'node:path'
import { jsx } from './rel1030Jsx.mjs'
const paths = {
  'App.jsx': 'src/App.jsx', 'rel1030.mjs': 'src/rel1030.mjs',
  'coachRyd.mjs': 'src/coachRyd.mjs', 'coachWeekOverview.mjs': 'src/dashboard/coachWeekOverview.mjs',
  'analyseSamlet.mjs': 'src/dashboard/analyseSamlet.mjs', 'analyseSammenlign.mjs': 'src/dashboard/analyseSammenlign.mjs',
  'videoFeedbackPlayback.mjs': 'src/athlete/videoFeedbackPlayback.mjs', 'calendarDate.js': 'src/calendarDate.js',
  'kostNumbers.mjs': 'src/athlete/kostNumbers.mjs', 'release3TestFlags.mjs': 'src/release3TestFlags.mjs',
  'e2eTestFlags.mjs': 'src/e2eTestFlags.mjs',
}
const logicalByUrl = new Map(Object.entries(paths).map(([name, logical]) => [new URL(name, import.meta.url).href, logical]))
logicalByUrl.set(new URL('rel1030.test.js', import.meta.url).href, 'e2e/rel1030.test.js')
logicalByUrl.set(new URL('rel1030.review.test.js', import.meta.url).href, 'e2e/rel1030.review.test.js')
logicalByUrl.set(new URL('rel1030.fixes.test.js', import.meta.url).href, 'e2e/rel1030.fixes.test.js')
logicalByUrl.set(new URL('rel1030Baseline.txt', import.meta.url).href, 'src/App.jsx')
const stubs = ['supabase.js', 'Auth.jsx', 'SetNewPassword.jsx', 'ErrorBoundary.jsx',
  'videoCoachSubmission.js', 'LazyBoundary.jsx', 'roleCache.js', 'offlineSession.js']
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      const name = basename(specifier)
      if (specifier === './rel1030Runtime.mjs' || specifier === 'react' || stubs.includes(name)) return {url:new URL('./rel1030Runtime.mjs', import.meta.url).href, shortCircuit:true}
      if (specifier.startsWith('.') && paths[name]) {
        const parent = logicalByUrl.get(context.parentURL)
        if (parent && posix.normalize(posix.join(posix.dirname(parent), specifier)) !== paths[name]) throw Error('Wrong logical import: ' + parent + ' -> ' + specifier)
        const flat = new URL(name, import.meta.url)
        const target = existsSync(flat) ? flat : new URL('../' + paths[name], import.meta.url)
        logicalByUrl.set(target.href, paths[name])
        return {url:target.href, shortCircuit:true}
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.endsWith('/App.jsx') || url.endsWith('/rel1030Baseline.txt')) {
        return {format:'module', shortCircuit:true, source:
          "import { createElement as __create } from './rel1030Runtime.mjs'; const __h = (t,p,unused,...c) => __create(t,p,...c);\n" +
          jsx(readFileSync(new URL(url), 'utf8').replaceAll('import.meta.env.MODE', "'production'"))}
      }
      return next(url, context)
    },
  })
}
