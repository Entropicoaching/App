// ORDRE 456: bygger arbejdstraeet (grenen klar-til-push) mod e2e-mocken til
// DIST (temp, uden for repoet). Koersel: node outputs/456/byg-456.mjs
import { mkdirSync } from 'node:fs'
import { ROOT, BYG, DIST, byg } from './faelles-456.mjs'

mkdirSync(BYG, { recursive: true })
const t0 = Date.now()
byg(ROOT, DIST)
console.log(`bygget til ${DIST} paa ${Math.round((Date.now() - t0) / 1000)} s`)
