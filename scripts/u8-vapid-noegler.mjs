// U8 (ordre 78): laver de to push-nøgler og cron-hemmeligheden til Supabase. Kun til Marc.
// Skriver intet til disk og intet til miljøet; værdierne vises kun her i terminalen.
// Kør: node scripts/u8-vapid-noegler.mjs   og indsæt de fire linjer under Edge Functions, Secrets.
import { generateKeyPairSync, randomBytes } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const pub = publicKey.export({ format: 'jwk' }), priv = privateKey.export({ format: 'jwk' })
const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')])
console.log('Indsæt disse fire under Supabase, Edge Functions, Secrets (navn = værdi):\n')
console.log(`VAPID_PUBLIC_KEY = ${raw.toString('base64url')}`)
console.log(`VAPID_PRIVATE_KEY = ${priv.d}`)
console.log('VAPID_SUBJECT = https://app.entropicoaching.dk')
console.log(`U8_CRON_SECRET = ${randomBytes(32).toString('base64url')}`)
console.log('\nU8_CRON_SECRET skal også bruges i cron-jobbet (headeren x-u8-cron). Gem ikke værdierne andre steder.')
