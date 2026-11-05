import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { verifyBoundaryViews } from './setBoundaryViewCases.mjs'

// For Dhurva's installed application suite. No loader or React mock here.
test('real React SSR: set-boundary ready, empty, error, manual, blocked and OFF views', () => {
  verifyBoundaryViews(createElement, renderToStaticMarkup)
})
