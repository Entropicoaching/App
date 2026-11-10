import test from 'node:test'
import assert from 'node:assert/strict'
import * as app from './videoUploadRetry.mjs'
import { ui } from './uploadRetryFakes.mjs'

const store = value => () => ({ getItem: () => value })

test('U4 1: ét flag i appen; enhedens vc_upload_retry_v1 vinder over standardværdien', () => {
  assert.equal(typeof app.DEFAULT_VC_UPLOAD_RETRY, 'boolean')
  assert.equal(app.videoUploadRetryEnabled(store('1')), true)
  assert.equal(app.videoUploadRetryEnabled(store('0')), false)
  assert.equal(app.videoUploadRetryEnabled(store(null)), app.DEFAULT_VC_UPLOAD_RETRY)
  assert.equal(app.videoUploadRetryEnabled(() => { throw Error('blocked') }), app.DEFAULT_VC_UPLOAD_RETRY)
})

test('U4 1: appen bærer flaget til videosiden i adressen', () => {
  const url = 'videocoach.html?mode=athlete&bridge=athlete-v1&v=1'
  assert.equal(app.withUploadRetryFlag(url, true), url + '&uploadRetry=1')
  assert.equal(app.withUploadRetryFlag('videocoach.html', true), 'videocoach.html?uploadRetry=1')
  assert.equal(app.withUploadRetryFlag(url, false), url)
})

test('U4 1: videosiden læser adressen; enheden kan slukke eller tænde', () => {
  assert.equal(ui.uploadRetryEnabled(store(null), '?mode=athlete&uploadRetry=1'), true)
  assert.equal(ui.uploadRetryEnabled(() => { throw Error('blocked') }, '?uploadRetry=1'), true)
  assert.equal(ui.uploadRetryEnabled(store('0'), '?uploadRetry=1'), false)
  assert.equal(ui.uploadRetryEnabled(store('1'), '?mode=athlete'), true)
  assert.equal(ui.uploadRetryEnabled(store(null), '?mode=athlete'), false)
})
