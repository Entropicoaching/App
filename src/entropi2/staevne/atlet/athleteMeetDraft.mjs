import { emptyResults, validResults } from './athleteMeetModel.mjs'

const PREFIX = 'entropi2:staevne:atlet:v1:'
const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128

export function draftKey(athleteId, meetId, planRevision) {
  if (![athleteId, meetId, planRevision].every(id)) return null
  try { return PREFIX + [athleteId, meetId, planRevision].map(encodeURIComponent).join(':') }
  catch { return null }
}

function validKey(key) {
  if (typeof key !== 'string' || !key.startsWith(PREFIX)) return false
  try {
    const parts = key.slice(PREFIX.length).split(':').map(decodeURIComponent)
    return parts.length === 3 && draftKey(...parts) === key
  } catch { return false }
}

const validFingerprint = fingerprint => typeof fingerprint === 'string' && fingerprint.length > 0 && fingerprint.length <= 20000
const storageFor = supplied => supplied === undefined ? globalThis.localStorage : supplied
const clean = results => Object.fromEntries(['squat', 'bench', 'deadlift'].map(lift => [lift, [...results[lift]]]))
const fresh = status => ({ status, results: emptyResults() })

// No storage access at import time. Reads and writes are limited to one exact key.
export function loadDraft(key, fingerprint, supplied) {
  if (!validKey(key) || !validFingerprint(fingerprint)) return fresh('unavailable')
  try {
    const raw = storageFor(supplied).getItem(key)
    if (raw === null) return fresh('empty')
    if (typeof raw !== 'string' || raw.length > 50000) return fresh('unavailable')
    const value = JSON.parse(raw)
    if (value?.version !== 1 || !validResults(value.results) || !validFingerprint(value.plan)) return fresh('unavailable')
    if (value.plan !== fingerprint) return fresh('changed')
    return { status: 'saved', results: clean(value.results) }
  } catch { return fresh('unavailable') }
}

export function saveDraft(key, fingerprint, results, supplied) {
  if (!validKey(key) || !validFingerprint(fingerprint) || !validResults(results)) return false
  try {
    storageFor(supplied).setItem(key, JSON.stringify({ version: 1, plan: fingerprint, results: clean(results) }))
    return true
  } catch { return false }
}

export function clearDraft(key, supplied) {
  if (!validKey(key)) return false
  try { storageFor(supplied).removeItem(key); return true }
  catch { return false }
}
