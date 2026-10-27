import { createElement } from 'react'
import { renderBlockComparison } from './blokFremgang.mjs'

export default function BlokFremgang(props) {
  return renderBlockComparison(createElement, props)
}
