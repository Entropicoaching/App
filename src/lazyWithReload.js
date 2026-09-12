import { lazy } from 'react'

// Efter en deploy får JS-filerne nye hash-navne. En bruger med en åben/cachet
// gammel side prøver at hente det GAMLE filnavn → "Failed to fetch dynamically
// imported module" → fejlskærm. Vi fanger det og genindlæser siden ÉN gang (så
// den friske index.html + nye chunks hentes). En sessionStorage-nøgle pr. modul
// forhindrer uendelig reload-løkke hvis fejlen er ægte.
export function lazyWithReload(factory, key) {
  const flag = `reloaded_chunk_${key}`
  return lazy(() =>
    factory()
      .then(mod => { sessionStorage.removeItem(flag); return mod })
      .catch(err => {
        // Kun reload på ægte chunk-hentefejl (ikke fx en runtime-fejl i modulet).
        const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(err?.message || '')
        if (isChunkError && !sessionStorage.getItem(flag)) {
          sessionStorage.setItem(flag, '1')
          window.location.reload()
          return new Promise(() => {}) // hæng indtil reload sker
        }
        throw err
      })
  )
}
