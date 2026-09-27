// ORDRE 464: bygger main (arbejdstraeet paa kritik-464 = main e5089f7 + kun
// outputs/docs) mod e2e-mocken til DIST (temp, uden for repoet).
// Koersel: node outputs/kritik-464/byg-464.mjs
import { mkdirSync } from 'node:fs'
import { ROOT, BYG, DIST, byg } from './faelles-464.mjs'

mkdirSync(BYG, { recursive: true })
const t0 = Date.now()
byg(ROOT, DIST)
console.log(`bygget til ${DIST} paa ${Math.round((Date.now() - t0) / 1000)} s`)
