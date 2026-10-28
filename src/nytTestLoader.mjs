import { registerHooks } from 'node:module'
export function install() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react') return { url: new URL('./nytTestDom.mjs', import.meta.url).href, shortCircuit: true }
      if (context.parentURL?.endsWith('/nytBaseNavigation.mjs')) {
        if (specifier === '../weekDates') return { url: 'data:text/javascript,export function nextWeekStartDate(){throw Error("Unexpected plan operation")}', shortCircuit: true }
        if (specifier === '../coachPriority') return { url: 'data:text/javascript,export function coachPriorityTaskContext(){throw Error("Unexpected priority operation")}', shortCircuit: true }
      }
      return next(specifier, context)
    },
  })
}
