import { useState } from 'react'
import { loadCoachSvar, saveCoachSvarEnabled, saveCoachSvarTemplates, saveCoachSvarSeenNotes, validTemplate } from './coachSvar.js'

export function useCoachSvar(coachId, showFlash) {
  const [saved, setSaved] = useState(() => ({ coachId, ...loadCoachSvar(coachId) }))
  // Et kontoskift må aldrig vise den forrige coachs skabeloner eller set-status.
  const current = saved.coachId === coachId ? saved : { coachId, ...loadCoachSvar(coachId) }
  function persist(part, value, save) {
    if (!save(coachId, value)) {
      showFlash('Kunne ikke gemme lokalt. Prøv igen.', 'error')
      return false
    }
    setSaved({ ...current, [part]: value })
    return true
  }
  return {
    ...current,
    setEnabled: value => persist('enabled', value, saveCoachSvarEnabled),
    addTemplate(text) {
      const clean = text.trim()
      if (!validTemplate(clean)) {
        showFlash('Skriv et svar på højst 500 tegn.', 'error')
        return
      }
      if (current.templates.includes(clean)) {
        showFlash('Svaret er allerede gemt.', 'info')
        return
      }
      if (persist('templates', [...current.templates, clean], saveCoachSvarTemplates)) showFlash('Hurtigt svar gemt.', 'success')
    },
    removeTemplate: text => persist('templates', current.templates.filter(value => value !== text), saveCoachSvarTemplates),
    markNoteSeen(item) {
      if (!current.enabled || !item.noteKey) return
      if (persist('seenNotes', [...new Set([...current.seenNotes, item.noteKey])], saveCoachSvarSeenNotes)) showFlash('Markeret som set.', 'success')
    },
  }
}
