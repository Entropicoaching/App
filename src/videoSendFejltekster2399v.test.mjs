// ORDRE 2399v (fund 2, 3 og 4 i plan\2367v\TJEK.md): coach-send siger den rigtige fejl.
// Browserprøven ligger i e2e/video-send-2367v.spec.mjs (tilfælde a, f og g).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { videoSendCoachLoginReason, videoSendLoginAfvist, videoUploadNetfejl, videoUploadReserveFejl, VIDEO_UPLOAD_NETFEJL } from './videoCoachUpload.js'

const coach = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const egenAtlet = { id: 'x', coach_id: coach, user_id: other }
const LOGIN = /^Du er logget ind som coach, og video kan kun sendes fra atletens eget login \(/

test('2399v fund 2: coachen får kun login-teksten ved 401, 403 eller RLS', () => {
  const netTekst = 'Video kunne ikke uploades: Forbindelsen blev afbrudt. Prøv igen'
  assert.equal(videoSendCoachLoginReason(netTekst, egenAtlet, coach, { message: 'Forbindelsen blev afbrudt. Prøv igen' }), netTekst)
  assert.equal(videoSendCoachLoginReason(netTekst, egenAtlet, coach, { message: 'Failed to fetch', name: 'StorageUnknownError' }), netTekst)
  assert.equal(videoSendCoachLoginReason('Video kunne ikke uploades: Videolageret svarede ikke', egenAtlet, coach, { message: 'Videolageret svarede ikke', status: 500 }),
    'Video kunne ikke uploades: Videolageret svarede ikke')
  assert.match(videoSendCoachLoginReason('Video kunne ikke uploades: Log ind igen', egenAtlet, coach, { message: 'Log ind igen', status: 401 }), LOGIN)
  assert.match(videoSendCoachLoginReason('Video kunne ikke uploades: afvist', egenAtlet, coach, { message: 'afvist', status: 403 }), LOGIN)
  // Supabase Storage: HTTP 400 med statusCode "403" i kroppen.
  assert.match(videoSendCoachLoginReason('Video kunne ikke uploades: new row violates row-level security policy', egenAtlet, coach,
    { message: 'new row violates row-level security policy', status: 400, statusCode: '403' }), LOGIN)
  // Postgres RLS på rækken (saveVideoCoachDraft).
  assert.match(videoSendCoachLoginReason('new row violates row-level security policy for table "video_analyses"', egenAtlet, coach,
    { message: 'new row violates row-level security policy for table "video_analyses"', code: '42501' }), LOGIN)
  // Uden fejlobjekt (ordre 1890v's kald) afgør teksten det.
  assert.match(videoSendCoachLoginReason('Video kunne ikke uploades: new row violates row-level security policy', egenAtlet, coach), LOGIN)
  assert.equal(videoSendCoachLoginReason(netTekst, egenAtlet, coach), netTekst)
  // Atletens eget login får aldrig login-teksten.
  assert.equal(videoSendCoachLoginReason('Video kunne ikke uploades: afvist', egenAtlet, other, { status: 403 }), 'Video kunne ikke uploades: afvist')
  assert.equal(videoSendLoginAfvist(null, ''), false)
  assert.equal(videoSendLoginAfvist({ message: 'Du kan kun sende video for dig selv eller en atlet, du coacher', status: 403 }), true)
})

test('2399v fund 3: reservens engelske netfejl bliver til lagerets danske tekst', () => {
  assert.equal(videoUploadNetfejl({ message: 'Failed to fetch', name: 'StorageUnknownError' }), true)
  assert.equal(videoUploadNetfejl({ message: 'NetworkError when attempting to fetch resource.' }), true)
  assert.equal(videoUploadNetfejl({ message: 'Load failed' }), true)
  assert.equal(videoUploadNetfejl({ message: 'new row violates row-level security policy', status: 400, statusCode: '403' }), false)
  assert.equal(videoUploadNetfejl({ message: 'The resource already exists', statusCode: '409' }), false)
  assert.equal(videoUploadNetfejl(null), false)
  const lager = { message: 'Forbindelsen blev afbrudt. Prøv igen' }
  const reserve = { message: 'Failed to fetch', name: 'StorageUnknownError' }
  assert.equal(videoUploadReserveFejl(reserve, lager).message, 'Forbindelsen blev afbrudt. Prøv igen')
  assert.equal(videoUploadReserveFejl(reserve, { message: 'Videolageret svarede ikke', status: 500 }).message, VIDEO_UPLOAD_NETFEJL)
  assert.equal(videoUploadReserveFejl(reserve, null).message, VIDEO_UPLOAD_NETFEJL)
  const rls = { message: 'new row violates row-level security policy', status: 400, statusCode: '403' }
  assert.equal(videoUploadReserveFejl(rls, lager), rls, 'en rigtig afvisning beholder sin egen tekst')
  const dublet = { message: 'The resource already exists', statusCode: '409' }
  assert.equal(videoUploadReserveFejl(dublet, lager), dublet)
  assert.equal(videoUploadReserveFejl(null, lager), null)
  // Et kastet TypeError fra fetch beholder status (ingen) og får dansk tekst.
  const kastet = videoUploadReserveFejl(new TypeError('Failed to fetch'), lager)
  assert.equal(kastet.message, 'Forbindelsen blev afbrudt. Prøv igen')
  assert.doesNotMatch(kastet.message, /fetch/i)
})

test('2399v: sendvejen i appen giver fejlobjektet med til begge tekster og oversætter reserven', () => {
  const bro = readFileSync(new URL('./athlete/useVideoCoachBro.js', import.meta.url), 'utf8')
  assert.equal(bro.match(/reply\(\{ ok: false, error: coachLoginReason\([^\n]*, (upload|saved)\.error\) \}\)/g)?.length, 2, 'upload og række med fejlobjekt')
  assert.match(bro, /upload = \{ \.\.\.upload, error: videoUploadReserveFejl\(upload\.error, lagerFejl\) \}/)
  assert.match(bro, /lagerFejl = lagerSvar\?\.error \?\? null/)
})

test('2399v fund 4: efter 10 minutter siger videosiden, at videoen muligvis stadig sendes; tiden er uændret', () => {
  const html = readFileSync(new URL('../public/videocoach.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const start = html.indexOf('function vcV3RequestUploadAndGoRaw(')
  const end = html.indexOf('\n}\n', start)
  assert.ok(start > 0 && end > start, 'vcV3RequestUploadAndGoRaw findes')
  const fn = html.slice(start, end)
  assert.match(fn, /}, 10 \* 60 \* 1000\);/, 'grænsen er stadig 10 minutter')
  assert.match(fn, /vcV3UploadPending\.delete\(requestId\);/, 'logikken er uændret')
  const tekst = fn.match(/reject\(new Error\('([^']+)'\)\);\n\s*\}, 10 \* 60 \* 1000\);/)?.[1] || ''
  assert.match(tekst, /10 minutter/)
  assert.match(tekst, /muligvis stadig/)
  assert.match(tekst, /Vent .* før du trykker Prøv igen/)
  assert.doesNotMatch(tekst, /[–—]/, 'ingen tankestreger')
  assert.ok(!html.includes("'Appen svarede ikke inden for 10 minutter'"), 'den gamle tekst er væk')
})
