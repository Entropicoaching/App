// U6 del 2: "Skriv" på coachens forside lægger udkastet i den samtale, der åbnes for
// netop den atlet. Kun i hukommelsen, kun for én atlet og kun i 10 minutter.
// Udkastet lægges i feltet med samtalens eksisterende draft(); intet sendes, og
// en tekst, coachen allerede har skrevet, overskrives aldrig.
export const DRAFT_TTL_MS = 10 * 60 * 1000
let pending = null

export function offerCoachDraft({ athleteId, text } = {}, now = Date.now()) {
  pending = typeof athleteId === 'string' && athleteId && typeof text === 'string' && text.trim()
    ? { athleteId, text, at: now } : null
  return pending !== null
}

export function takeCoachDraft(athleteId, now = Date.now()) {
  if (!pending || now - pending.at > DRAFT_TTL_MS) { pending = null; return null }
  if (pending.athleteId !== athleteId) return null
  const { text } = pending
  pending = null
  return text
}

export function hasCoachDraft(athleteId, now = Date.now()) {
  return !!pending && pending.athleteId === athleteId && now - pending.at <= DRAFT_TTL_MS
}

// Venter, til samtalen for atleten er hentet, og lægger så udkastet i et tomt felt.
export function applyCoachDraft(controller, athleteId, now = () => Date.now()) {
  if (!controller || typeof controller.subscribe !== 'function' || !hasCoachDraft(athleteId, now())) return () => {}
  let done = false, unsubscribe = null
  const stop = () => { done = true; unsubscribe?.() }
  unsubscribe = controller.subscribe(snapshot => {
    if (done || !snapshot?.available || !snapshot.loaded || snapshot.athleteId !== athleteId) return
    done = true
    queueMicrotask(() => unsubscribe?.())
    const text = takeCoachDraft(athleteId, now())
    if (text && !String(snapshot.draft ?? '').trim()) controller.draft(text)
  })
  if (done) unsubscribe?.()
  return stop
}
