import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { jsx } from './contactJsx.mjs'

// Syntax-only JSX translation; React and its renderer resolve normally, without stubs.
let React, renderToStaticMarkup, Indlaeser
let unavailable = false
try {
  React = await import('react')
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/package '(react|react-dom)'/.test(error.message)) throw error
  unavailable = true
}
if (!unavailable) {
  const target = new URL('./Indlaeser.jsx', import.meta.url).href
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (context.parentURL === target && specifier === '../athleteShared') return {
        url: new URL('../athleteShared.js', import.meta.url).href, shortCircuit: true,
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url === target) return { format: 'module', shortCircuit: true,
        source: `import { createElement, Fragment } from 'react';
          const __h = (tag, props, _key, ...children) => createElement(tag || Fragment, props, ...children);
          ${jsx(readFileSync(new URL(url), 'utf8'))}` }
      return next(url, context)
    },
  })
  try { ({ default: Indlaeser } = await import('./Indlaeser.jsx')) }
  finally { hooks.deregister() }
}
const options = { skip: unavailable ? 'Real React/react-dom unavailable in pinned public copy; integration gate' : false }

test('real React: startup read labels keep loading and error separate and preserve the supplied back button', options, () => {
  const render = props => renderToStaticMarkup(React.createElement(Indlaeser, props))
  const loading = render({})
  assert.match(loading, /Henter dataene…/)
  assert.doesNotMatch(loading, /Hent igen|kunne ikke hentes/)
  const error = render({ loadError: true })
  assert.match(error, />Hent igen<\/button>/)
  assert.doesNotMatch(error, /Henter dataene…/)
  const backBtn = React.createElement('button', { type: 'button' }, 'Tilbage')
  assert.match(render({ backBtn }), /Tilbage/)
  const withBack = render({ loadError: true, backBtn })
  assert.match(withBack, /Tilbage/)
  assert.doesNotMatch(withBack, /Hent igen/)
})
