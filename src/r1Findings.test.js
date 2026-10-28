import test from 'node:test'
import assert from 'node:assert/strict'
import { app } from './coachRydHarness.mjs'

test('K-REB2 finding 1: existing coach loader links actual inbox and review modules', async () => {
  const load = await app()
  const Inbox = await load('IndbakkeView.jsx')
  const Review = await load('VideoReviewModal.jsx')
  assert.equal(typeof Inbox, 'function')
  assert.equal(typeof Review, 'function')
})

test('K-REB2 finding 2: reply loader imports actual athlete factory in native src layout', async () => {
  const { install } = await import('./vcSvarLoader.mjs')
  install()
  const { lavBeskederOgVaegt } = await import('./beskederOgVaegt.jsx')
  assert.equal(typeof lavBeskederOgVaegt, 'function')
})
