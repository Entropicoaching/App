import { createElement as h, useState } from 'react'
import { renderVideoRetentionPreview } from './VideoRetentionPreview.mjs'

// Local metadata only. No upload, persistence, storage client or deletion handler.
export default function VideoRetentionLocalPreview({ analyses, objects, athleteId }) {
  const [draft, setDraft] = useState('')
  const [localObjects, setLocalObjects] = useState(undefined)
  const [error, setError] = useState('')
  function calculate() {
    try {
      const parsed = JSON.parse(draft)
      if (!Array.isArray(parsed)) throw new TypeError('Expected inventory array')
      setLocalObjects(parsed)
      setError('')
    } catch {
      setLocalObjects(undefined)
      setError('Filoversigten skal være et JSON-array med metadata. Ret indholdet og beregn igen.')
    }
  }
  return h('div', null,
    h('details', null,
      h('summary', null, 'Beregn med lokal filoversigt'),
      h('p', null, 'Indsæt hele filoversigten for den valgte atlet som JSON. Brug bucket_id, name, created_at og metadata.size. Medtag både originaler og bevarede stillbilleder. Kun metadata bruges, og indholdet gemmes ikke.'),
      h('label', null, 'Lokal filoversigt (JSON)',
        h('textarea', { value: draft, rows: 6, spellCheck: false,
          style: { width: '100%', boxSizing: 'border-box' },
          onChange(event) {
            setDraft(event.target.value)
            setLocalObjects(undefined)
            setError('')
          } })),
      h('button', { type: 'button', onClick: calculate }, 'Beregn metadata-preview'),
      error ? h('p', { role: 'alert' }, error) : null),
    renderVideoRetentionPreview(h, { analyses, objects: error ? undefined : localObjects ?? objects,
      athleteId, now: new Date().toISOString() }))
}
