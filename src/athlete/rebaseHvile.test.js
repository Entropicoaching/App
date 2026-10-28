import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

for (const loaderName of ['forenkl6Loader.mjs', 'vaerd5Loader.mjs']) {
  test(`${loaderName}: real new modules load and unrelated imports remain rejected`, async () => {
    const { install } = await import('./' + loaderName)
    const loader = install()
    const probe = registerHooks({
      resolve(specifier, context, next) {
        if (specifier.startsWith('hvile-probe:')) {
          return next(specifier.slice('hvile-probe:'.length), {
            ...context, parentURL: new URL('./ProgramTab.jsx', import.meta.url).href,
          })
        }
        return next(specifier, context)
      },
    })
    try {
      const component = await import('hvile-probe:./RestDays.jsx')
      const model = await import('hvile-probe:./restDays.mjs')
      assert.equal(typeof component.default, 'function')
      assert.equal(model.restDays({ sessions: [] }).length, 7)
      for (const name of ['./Unknown.jsx', './unknown.mjs', '../RestDays.jsx', './other/RestDays.jsx', '../restDays.mjs']) {
        await assert.rejects(import('hvile-probe:' + name), /Unapproved synthetic dependency/)
      }
    } finally { probe.deregister(); loader.deregister() }
  })
}
