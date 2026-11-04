// Call for ONE descriptor from createAthleteExportFiles in a user gesture.
// Browser globals are resolved only at call time; import is inert (also when OFF).
// Runtime injection supports synthetic tests without opening a browser.
export function downloadAthleteExport(file, runtime = globalThis) {
  if (!file || !/^entropi-egne-(?:data\.json|(?:traening|kost|vaegt)\.csv)$/.test(file.filename) ||
      !['application/json;charset=utf-8', 'text/csv;charset=utf-8'].includes(file.type) ||
      typeof file.content !== 'string') throw new TypeError('Ugyldig eksportfil.')
  const { document, URL, Blob, setTimeout } = runtime
  if (!document?.body || typeof document.createElement !== 'function' ||
      typeof URL?.createObjectURL !== 'function' || typeof URL?.revokeObjectURL !== 'function' ||
      typeof Blob !== 'function' || typeof setTimeout !== 'function') {
    throw new Error('Download kræver en browser med lokal filunderstøttelse.')
  }
  const blob = new Blob([file.content], { type: file.type })
  const url = URL.createObjectURL(blob)
  let anchor
  let clicked = false
  try {
    anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.filename
    anchor.hidden = true
    document.body.appendChild(anchor)
    anchor.click()
    clicked = true
  } finally {
    try { anchor?.remove() } finally {
      // Defer revocation until the browser has consumed the click. If scheduling
      // fails, release synchronously. No persistent storage or network is used.
      try {
        if (clicked) setTimeout(() => URL.revokeObjectURL(url), 1000)
        else URL.revokeObjectURL(url)
      }
      catch { URL.revokeObjectURL(url) }
    }
  }
}
