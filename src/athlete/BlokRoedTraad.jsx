import { createElement } from 'react'
import { blokRoedTraad } from './blokRoedTraad.mjs'
import { renderBlokRoedTraad } from './blokRoedTraadView.mjs'

export default function BlokRoedTraad({ allWeeks, viewedWeekId }) {
  return renderBlokRoedTraad(createElement, blokRoedTraad(allWeeks, viewedWeekId))
}
