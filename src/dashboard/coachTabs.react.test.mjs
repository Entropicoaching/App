// Real React SSR, using actual changed components; synthetic service/unchanged child seams only.
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installCoachTabsFixture } from './coachTabsFixture.mjs'
import { coachTabsCases } from './coachTabs.cases.mjs'
installCoachTabsFixture({realReact:true})
await coachTabsCases(test, (Component, props) => renderToStaticMarkup(createElement(Component, props)))
