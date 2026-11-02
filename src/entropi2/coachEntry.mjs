// Entropi 2: én indgang for coachens skærme, så Dashboard kun har én ny import.
export { entropi2Enabled } from './flag.mjs'
export { loadEntropi2Styles } from './styles.mjs'
export { default as CoachScreen } from './coach/CoachScreen.mjs'
export { default as ConversationEntry } from './conversation/ConversationEntry.mjs'
export { useEntropi2ReadContext } from './coachReadContext.mjs'
export { useEntropi2CoachNutrition } from './coachNutritionRead.mjs'
export { COACH_NOTE_SIGNAL_ENABLED } from '../coachNoteSignal.js'
