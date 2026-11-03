export const NOTE_CHOICES = Object.freeze(['Let', 'Tungt', 'Smerte', 'Teknik'])
export const NOTE_TEXT_LIMIT = 140

// Match textarea maxLength (UTF-16 units), without cutting a surrogate pair.
export function noteValue(value = {}) {
  let text = typeof value?.text === 'string' ? value.text.slice(0, NOTE_TEXT_LIMIT) : ''
  if (/[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1)
  return { choice: NOTE_CHOICES.includes(value?.choice) ? value.choice : '', text }
}

export function noteText(value) {
  const { choice, text } = noteValue(value)
  return [choice, text.trim()].filter(Boolean).join(': ')
}

// Use the existing onLogSet inputOverride.note contract. No save is triggered.
// Merge at approval time with the latest weight/reps/RPE input for this set.
export function withSetNote(input, value) {
  return { ...input, note: noteText(value) }
}
