import test from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { verifyMineData, verifyDevelopment, verifySleep, verifyUpload } from './antalTekstCases.mjs'

test('real React: count text in athlete data, including zero and one of one', () => verifyMineData(h, render))
test('real React: single observed week and strict development OFF', () => verifyDevelopment(h, render))
test('real React: raw one-hour value, decimal display and strict sleep OFF', () => verifySleep(h, render))
test('real React: single rep, numeric string, plural, range and unknown video set', () => verifyUpload(h, render))
