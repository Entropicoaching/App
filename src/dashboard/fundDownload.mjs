// Small injectable DOM boundary; caller must validate and retain the JSON first.
export function downloadReview(text, doc, urls, BlobType, defer) {
  let url, link
  try {
    url = urls.createObjectURL(new BlobType([text], { type: 'application/json' }))
    link = doc.createElement('a')
    link.href = url
    link.download = 'VA-K9-svar.json'
    doc.body.appendChild(link)
    link.click()
    return 'Fileksport startet; kontrollér browserens download. JSON kan også kopieres nedenfor. Lokal lagringsstatus er uændret.'
  } catch {
    return 'Download fejlede. Kopiér JSON nedenfor til en lokal fil. Lokal lagringsstatus er uændret.'
  } finally {
    if (link) {
      try { link.remove() } catch { /* Download result stays honest. */ }
    }
    if (url) defer(() => urls.revokeObjectURL(url), 1000)
  }
}
