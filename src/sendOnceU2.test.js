// U2 (ordre 50): dobbelte beskeder på den gamle beskedvej (bruges, når
// Entropi 2 er slået fra). To tryk i samme øjeblik må kun give én række.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sendOnce } from './sendOnce.mjs'

test('dobbelttryk: to afsendelser i samme øjeblik skriver kun én række', async () => {
  const rows = []
  let release
  const write = () => new Promise(resolve => { release = () => { rows.push('række'); resolve(true) } })
  const first = sendOnce('syntetisk-atlet:besked', write)
  const second = sendOnce('syntetisk-atlet:besked', write)
  assert.equal(await second, false)
  release()
  assert.equal(await first, true)
  assert.deepEqual(rows, ['række'])
  // Når den første er afgjort, kan næste besked sendes.
  assert.equal(await sendOnce('syntetisk-atlet:besked', async () => true), true)
})

test('dobbelttryk: en fejlet skrivning frigiver nøglen, så atleten kan prøve igen', async () => {
  await assert.rejects(sendOnce('syntetisk-atlet:teknik', async () => { throw Error('syntetisk netfejl') }))
  assert.equal(await sendOnce('syntetisk-atlet:teknik', async () => true), true)
})

test('dobbelttryk: atletens og coachens gamle beskedvej sender gennem sendOnce', () => {
  const athlete = readFileSync(new URL('./athlete/beskederOgVaegt.jsx', import.meta.url), 'utf8')
  assert.match(athlete, /sendOnce\(`\$\{athlete\.id\}:\$\{msgTrack\}`/)
  assert.match(athlete, /sendOnce\(`\$\{athlete\.id\}:uge:\$\{ugeNr\}`/)
  const coach = readFileSync(new URL('./dashboard/indbakkeHandlinger.js', import.meta.url), 'utf8')
  assert.match(coach, /sendOnce\(`coach:\$\{athleteId\}:\$\{coachMsgTrack\}`/)
})
