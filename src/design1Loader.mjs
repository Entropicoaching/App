import { registerHooks } from 'node:module'
const runtime = new URL('./design1Dom.mjs', import.meta.url).href
const views = new Set(['./dashboard/ProgramOverblikView.mjs', './dashboard/Indbakke2View.mjs', './athlete/WarmupLadderView.mjs'].map(path => new URL(path, import.meta.url).href))
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && views.has(context.parentURL)) return { url: runtime, shortCircuit: true }
  return next(specifier, context)
} })
