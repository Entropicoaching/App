// U8 del 3: Web Push uden pakker, kun WebCrypto (findes i Deno på Supabase og i Node).
// VAPID (RFC 8292): en ES256-signeret JWT til push-tjenesten.
// Indhold (RFC 8291, aes128gcm): krypteret til telefonens nøgle (p256dh) og hemmelighed (auth).
const enc = new TextEncoder()

export function b64urlEncode(bytes) {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function b64urlDecode(text) {
  const plain = String(text).replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(plain + '='.repeat((4 - plain.length % 4) % 4)), c => c.charCodeAt(0))
}
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of parts) { out.set(part, at); at += part.length }
  return out
}

// Nøgleparret fra scripts/u8-vapid-noegler.mjs: offentlig = 65 bytes (04 || x || y), privat = 32 bytes (d).
export async function importVapid({ publicKey, privateKey, crypto = globalThis.crypto }) {
  const pub = b64urlDecode(publicKey), d = b64urlDecode(privateKey)
  if (pub.length !== 65 || pub[0] !== 4 || d.length !== 32) throw Error('VAPID-nøglen har forkert form')
  const jwk = { kty: 'EC', crv: 'P-256', x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33)), d: b64urlEncode(d), ext: true }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  return { key, publicKey: b64urlEncode(pub) }
}

export async function vapidAuthorization({ endpoint, vapid, subject, nowSeconds, crypto = globalThis.crypto }) {
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: subject })))
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, vapid.key, enc.encode(`${header}.${claims}`))
  return `vapid t=${header}.${claims}.${b64urlEncode(new Uint8Array(signature))}, k=${vapid.publicKey}`
}

async function hkdf(crypto, salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

// Én post (rs 4096) med afslutningsbyte 2. salt og serverKeys kan gives i prøver.
export async function encryptPayload({ payload, p256dh, auth, crypto = globalThis.crypto, salt, serverKeys }) {
  const ua = b64urlDecode(p256dh), secret = b64urlDecode(auth)
  if (ua.length !== 65 || ua[0] !== 4 || secret.length !== 16) throw Error('Telefonens nøgle har forkert form')
  const server = serverKeys ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', server.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, server.privateKey, 256))
  const ikm = await hkdf(crypto, secret, shared, concat(enc.encode('WebPush: info\0'), ua, asPublic), 32)
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(crypto, s, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(crypto, s, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const plain = concat(enc.encode(payload), new Uint8Array([2]))
  if (plain.length + 16 > 4096) throw Error('Beskeden er for lang')
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain))
  const header = new Uint8Array(21 + asPublic.length)
  header.set(s, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, sealed)
}

// Sender én besked. Svarer { status, gone }: gone betyder, at telefonen har meldt sig fra (404/410).
export async function sendPush({ subscription, payload, vapid, subject, fetch: http = fetch, nowSeconds, crypto = globalThis.crypto, ttl = 86400 }) {
  const body = await encryptPayload({ payload, p256dh: subscription.p256dh, auth: subscription.auth, crypto })
  const authorization = await vapidAuthorization({ endpoint: subscription.endpoint, vapid, subject, nowSeconds, crypto })
  const response = await http(subscription.endpoint, { method: 'POST', body,
    headers: { Authorization: authorization, TTL: String(ttl), Urgency: 'normal',
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' },
    signal: AbortSignal.timeout(10000) })
  return { status: response.status, gone: response.status === 404 || response.status === 410 }
}
