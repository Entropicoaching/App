export async function resolve(specifier, context, next) {
  if (['../supabase', '../supabase.js'].includes(specifier)) return { url: new URL('./trainingFullscreenBoundary.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier === 'react') return { url: new URL('./trainingFullscreenFake.mjs', import.meta.url).href, shortCircuit: true }
  if (/\/saetSkrivning\.js$/.test(context.parentURL || '') &&
      ['../supabase.js', '../athleteWriteGuard.js', '../athleteSilentFailLog.js', '../exerciseProgress.js', './rekorder.js', '../offlineSession.js'].includes(specifier)) {
    return { url: new URL('./trainingFullscreenBoundary.mjs', import.meta.url).href, shortCircuit: true }
  }
  return next(specifier, context)
}
