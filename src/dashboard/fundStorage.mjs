// Small local persistence boundary. No storage access until an explicit action.
export const storageKey = 'va-k9-synthetic-review-v1'
export function emptyReview() {
  return { batch: null, answers: [], dirty: false, message: 'Indlæs syntetisk grundlag.' }
}
export function activate(api, batch, answers = []) {
  const clean = api.session(batch, answers)
  return { batch: clean.batch, answers: clean.answers, dirty: true,
    message: 'Grundlag indlæst i hukommelsen; ikke gemt lokalt.' }
}
export function editReview(state, clip_id, finding_id, decision, comment) {
  const answers = state.answers.filter(a => a.clip_id !== clip_id || a.finding_id !== finding_id)
  if (decision || comment) answers.push({ clip_id, finding_id, decision, comment })
  return { ...state, answers, dirty: true, message: 'Ændringer i hukommelsen; ikke gemt lokalt.' }
}
export function saveReview(api, getStorage, state) {
  try {
    if (!state.batch) throw new Error('missing batch')
    const text = api.encode(state.batch, state.answers)
    const storage = getStorage()
    storage.setItem(storageKey, text)
    if (storage.getItem(storageKey) !== text) throw new Error('readback mismatch')
    return { ...state, dirty: false, message: 'Gemt lokalt og læst tilbage i denne browser.' }
  } catch {
    return { ...state, dirty: true,
      message: 'IKKE GEMT: ugyldigt svar eller lokal lagring fejlede. Behold siden åben; ret svar eller eksportér.' }
  }
}
export function loadReview(api, getStorage, state) {
  try {
    const text = getStorage().getItem(storageKey)
    if (text === null) return { ...state, message: 'Ingen lokal gemning fundet. Aktuelt arbejde er bevaret.' }
    const clean = api.decode(text)
    return { batch: clean.batch, answers: clean.answers, dirty: false,
      message: 'Lokale svar valideret og indlæst. De erstatter det tidligere arbejde i visningen.' }
  } catch {
    return { ...state, message: 'Lokal indlæsning fejlede eller filen er ugyldig. Aktuelt arbejde er bevaret.' }
  }
}
