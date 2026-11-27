// ORDRE 2441v (2437 tilfælde c): sendingen viser fremgang, så et langsomt net ikke ligner en frossen side.
// Modulet prøves i public/vcSendFremgang.test.mjs, klienten i videolager/klient.test.js; her er sendvejens
// kobling: appen sender upload-progress, videosiden tager imod den, og 2399v's tekster og tider er urørte.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const laes = sti => readFileSync(new URL(sti, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('2441v: appen giver lagerets målte fremgang videre som upload-progress, højst én gang i sekundet', () => {
  const bro = laes('./athlete/useVideoCoachBro.js')
  const start = bro.indexOf('const sendFremgang = '), slut = bro.indexOf('const lagerSvar = lager', start)
  assert.ok(start > 0 && slut > start, 'sendFremgang står før lagerkaldet')
  const fn = bro.slice(start, slut)
  assert.match(fn, /if \(loaded < total && nu - sidstSendt < 1000\) return/, 'højst én gang i sekundet, den sidste altid')
  assert.match(fn, /type: `\$\{ATHLETE_VIDEOCOACH_PREFIX\}:upload-progress`,\n\s*requestId: message\.requestId, loaded, total \}, event\.origin\)/)
  assert.match(bro, /uploadTilVideolager\(\{[^}]*signal: controller\.signal,\n\s*onProgress: sendFremgang \}\)/, 'kun lagerets PUT måles; reserven giver ingen tal')
})

test('2441v: videosiden viser fremgangen under sendingen og standser uret ved alle udfald', () => {
  const html = laes('../public/videocoach.html')
  const start = html.indexOf('async function vcAthleteUploadAndGo()'), slut = html.indexOf('\n}\n', start)
  const fn = html.slice(start, slut)
  assert.match(fn, /say\(`Sender video \(\$\{mb\} MB\)\. Bliv på skærmen, til den er sendt\.`\);/, 'starttekst urørt')
  assert.match(fn, /const fremgang = vcSendFremgang \? vcSendFremgang\(\{ total: file\.size, vis: say \}\) : null;/)
  assert.match(fn, /onProgress: fremgang \? fremgang\.onProgress : null,/)
  assert.equal(fn.match(/fremgang\?\.stop\(\);/g)?.length, 2, 'uret standses ved succes og ved fejl')
  // Iframen tager imod appens besked, kun mens sendingen venter.
  assert.match(html, /if \(msg\.type === `\$\{VC_V3_MESSAGE_PREFIX\}:upload-progress`\) \{\n\s*const pending = vcV3UploadPending\.get\(msg\.requestId\);\n\s*if \(pending && typeof pending\.onProgress === 'function'\) pending\.onProgress\(\{ loaded: msg\.loaded, total: msg\.total \}\);/)
  assert.match(html, /vcV3UploadPending\.set\(requestId, \{ resolve, reject, timer, onProgress \}\);/)
  assert.match(html, /import \{ createSendFremgang \} from '\.\/vcSendFremgang\.mjs';/)
  assert.match(html, /\nvcSendFremgang = createSendFremgang;/)
})

test('2441v: tider, genforsøg, Prøv igen og 10-minutters-teksten fra 2399v er urørte', () => {
  const html = laes('../public/videocoach.html')
  const start = html.indexOf('function vcV3RequestUploadAndGoRaw('), slut = html.indexOf('\n}\n', start)
  const fn = html.slice(start, slut)
  assert.match(fn, /}, 10 \* 60 \* 1000\);/)
  assert.match(fn, /Appen har ikke bekræftet sendingen inden for 10 minutter\. Videoen sendes muligvis stadig på et langsomt net\. Vent et par minutter, før du trykker Prøv igen/)
  assert.match(html, /function vcV3RequestUploadAndGo\(options\) \{\n\s*return vcUploadRetry\n\s*\? vcUploadRetry\.run\(\(\) => vcV3RequestUploadAndGoRaw\(options\)\)/)
  const retry = laes('../public/vcUploadRetry.mjs')
  assert.match(retry, /button\.textContent = 'Prøv igen'/)
  assert.match(retry, /show\('Sender video\. Bliv på skærmen, til den er sendt\.'\)/)
})
