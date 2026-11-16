// ORDRE 1537b · videolager på Cloudflare R2: signering af adresser. Rene funktioner
// (kun WebCrypto), så de kan prøves i Node og køre i en Worker uden pakker.
const enc = new TextEncoder()
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')

async function hmac(key, text) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(text))
}

async function sha256Hex(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

function sameText(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// RFC 3986, som SigV4 kræver: alt undtagen A-Z a-z 0-9 - _ . ~ kodes.
const rfc3986 = text => encodeURIComponent(text).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const encodePath = path => path.split('/').map(rfc3986).join('/')

// Worker-vejen (lokalt og som reserve): Workeren signerer en adresse til sig selv.
// `claims` er små tekstværdier (op, exp, ct, len); nøglen er objektets sti i bucket'en.
function blobSigningText(key, claims) {
  return [key, ...Object.keys(claims).sort().map(name => `${name}=${claims[name]}`)].join('\n')
}

export async function signBlobUrl(origin, key, claims, secret) {
  const sig = hex(await hmac(secret, blobSigningText(key, claims)))
  const query = new URLSearchParams({ ...claims, sig })
  return `${origin}/blob/${encodePath(key)}?${query}`
}

// Returnerer claims, hvis signaturen passer og adressen ikke er udløbet; ellers null.
export async function verifyBlobUrl(url, secret, nowSeconds) {
  const u = new URL(url)
  if (!u.pathname.startsWith('/blob/')) return null
  let key
  try { key = decodeURIComponent(u.pathname.slice('/blob/'.length)) } catch { return null }
  const claims = Object.fromEntries(u.searchParams)
  const sig = claims.sig || ''
  delete claims.sig
  const expected = hex(await hmac(secret, blobSigningText(key, claims)))
  if (!sameText(sig, expected)) return null
  if (!(Number(claims.exp) > nowSeconds)) return null
  return { key, ...claims }
}

// S3-vejen (R2 i drift): forhåndssigneret adresse efter AWS Signature V4 (query).
// `headers` er de hoveder, klienten SKAL sende præcis sådan (fx content-type).
export async function presignS3Url({ method, host, path, accessKeyId, secretAccessKey, region = 'auto',
  expiresSeconds, now = new Date(), headers = {} }) {
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const day = amzDate.slice(0, 8)
  const scope = `${day}/${region}/s3/aws4_request`
  const signed = { host, ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])) }
  const names = Object.keys(signed).sort()
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKeyId}/${scope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresSeconds)],
    ['X-Amz-SignedHeaders', names.join(';')],
  ].map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`).sort().join('&')
  const canonical = [method, encodePath(path), query, ...names.map(n => `${n}:${signed[n]}`), '', names.join(';'), 'UNSIGNED-PAYLOAD'].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonical)].join('\n')
  let key = await hmac(`AWS4${secretAccessKey}`, day)
  for (const part of [region, 's3', 'aws4_request']) key = await hmac(key, part)
  const signature = hex(await hmac(key, toSign))
  return `https://${host}${encodePath(path)}?${query}&X-Amz-Signature=${signature}`
}
