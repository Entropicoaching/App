import { createElement } from 'react'
import { renderCoachNote } from '../videoCoachNote.mjs'

export default function VideoCoachNote({ notes = [], athleteId, sessionId }) {
  return renderCoachNote(createElement, notes, { athlete_id: athleteId, session_id: sessionId })
}
