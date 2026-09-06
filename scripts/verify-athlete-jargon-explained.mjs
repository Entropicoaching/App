// ORDRE 70 — fund F17/F18 fra ordre 41: "TDEE" og de to beskedspor ("Besked" /
// "Teknik & løft") vises uden forklaring i atlet-visningen. Under gennemgangen
// fandt jeg to mere af samme slags, aldrig nævnt i ordren, men i samme
// kategori (fagord/forkortelse uden forklaring, mødt i uge 1-2): "e1RM" i
// Program-fanens styrkeudviklings-graf, og "PR" i PR-toasten (kun forklaret
// ved at skrive ordet ud i stedet for forkortelsen — jf. RPE, der allerede
// havde sin egen infoknap fra tidligere, se ordre 41's fund F19).
//
// Ligesom resten af repoets scripts/verify-*.mjs er der ingen DOM/React-
// testopsætning her — forklaringerne verificeres ved tekstmatch mod selve
// kildekoden.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const athleteView = readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')

// --- F17: TDEE har en linje i atletens eget sprog, ved siden af tallet -----
assert.match(
  athleteView,
  /Det din krop cirka bruger på en dag, regnet af dine egne vejninger og din kost\./,
  'TDEE skal have en kort forklaring på dansk, uden en separat hjælpeside',
)

// --- e1RM (fundet under gennemgangen, samme kategori som F17) --------------
assert.match(
  athleteView,
  /e1RM er et regnestykke ud fra din vægt og dine reps/,
  'e1RM i styrkeudviklings-grafen skal have en kort forklaring',
)

// --- PR-toasten skriver ordet ud i stedet for forkortelsen ------------------
assert.match(athleteView, /Ny personlig rekord \(vægt\)/, 'PR-toasten skal skrive "personlig rekord" ud i stedet for forkortelsen')
assert.match(athleteView, /Ny personlig rekord \(reps\)/, 'PR-toasten skal skrive "personlig rekord" ud i stedet for forkortelsen')

// --- Ingen udråbstegn i de tekster denne ordre rører ------------------------
assert.ok(
  !/personlig rekord \([^)]+\)\}? på \{prToast\.name\}!/.test(athleteView),
  'PR-toasten må ikke ende på udråbstegn (ordrens tekstregel)',
)

// --- F18: de to beskedspor har hver en linje der siger hvad de er til ------
assert.match(
  athleteView,
  /Til spørgsmål om teknik og løft, og til coachens videofeedback\./,
  '"Teknik & løft"-sporet skal forklare hvad det er til',
)
assert.match(
  athleteView,
  /Til alt andet — status, spørgsmål og det der ellers fylder\./,
  '"Beskeder"-sporet skal forklare hvad det er til',
)

// De to spor er reelt forskellige (forskelligt category-felt ved afsendelse,
// og teknik-sporet fletter coachens delte videofeedback ind) — så løsningen
// er forklaring, ikke sammenlægning. Se RAPPORT.md for begrundelsen.
assert.match(
  athleteView,
  /category:\s*msgTrack/,
  'Beskeder skal stadig gemmes med det spor de blev sendt fra (bekræfter at sporene er reelt forskellige, ikke kun en UI-opdeling)',
)

console.log('TDEE, e1RM og PR-toasten har hver en kort forklaring på dansk, og de to beskedspor forklarer hvad de er til.')
