import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { jsx } from './nytTestJsx.mjs'
const read = name => readFileSync(new URL(name, import.meta.url), 'utf8')

test('exact final views pass the JSX adapter and use the tested card and handler factories', () => {
  for (const name of ['AthleteView.jsx', 'Dashboard.jsx']) {
    const source = read(name)
    const translated = jsx(source)
    assert.ok(translated.includes('NytIAppen'))
    assert.equal((source.match(/<NytIAppen /g) || []).length, 1)
    assert.match(source, /profileId=\{session\?\.user\?\.id\}/)
    assert.match(source, /search=\{typeof window === 'undefined' \? '' : window.location.search\}/)
  }
  assert.match(read('AthleteView.jsx'), /onNavigate=\{nytAthleteNavigation\(\{ setTab, setMsgTrack, setMobilityMode \}\)\}/)
  assert.match(read('AthleteView.jsx'), /role === 'athlete' && !coachAthleteId && !onExitPreview/)
  assert.match(read('Dashboard.jsx'), /onNavigate=\{nytCoachNavigation\(\{ setView, setSelectedAthlete, openProfile \}\)\}/)
  assert.match(read('Dashboard.jsx'), /athletes\.filter\(athlete => !hiddenAthleteIds\.has\(athlete.id\)\)/)
})
