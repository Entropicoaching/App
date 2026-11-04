// Suggestions are deliberately small; the athlete chooses what is true.
export function athleteQuestion(thread = []) {
  const messages = thread.filter(item => item.kind === 'message')
  const last = messages.at(-1)
  return last?.value.sender_role === 'coach' && last.value.content.includes('?') ? last : null
}

export function athleteAnswers(question) {
  if (!question) return []
  const text = question.value.content.trim()
  if (/^(har|er|kan|vil|skal|må|fik|gik|var|havde|kunne|føles)(?=\s|[?.,!]|$)/iu.test(text))
    return ['Ja', 'Nej', 'Jeg er i tvivl']
  return ['Jeg har brug for hjælp', 'Jeg vender tilbage']
}

export function athleteAnswerContent(question, answer) {
  if (!athleteAnswers(question).includes(answer)) throw Error('Vælg et af de viste svar.')
  const text = question.value.content.trim()
  return `Svar på: ${text.slice(0, 240)}${text.length > 240 ? '…' : ''}\n${answer}`
}

export function athleteSetContent(set, note) {
  if (typeof set !== 'string' || !set.trim() || set.trim().length > 160
    || typeof note !== 'string' || !note.trim() || note.trim().length > 240)
    throw Error('Beskriv sættet på højst 160 tegn og skriv en note på højst 240 tegn.')
  return `Fra passet · ${set.trim()}\n${note.trim()}`
}
