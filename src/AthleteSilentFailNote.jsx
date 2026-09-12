// ORDRE 131 · commit 3: "Marc får det at vide" — fejl der endte i stilhed hos
// atleten (G14/G15/G16, se RAPPORT-131.md) skal kunne ses i coachens
// atlet-visning. Selvstændig, lille komponent (henter selv sine data) netop
// så Dashboard.jsx kun skal ændre ÉT sted (import + denne ene rendering) —
// se grænsen i ORDRE-Bhishak.md. Ingen atletdata udover koderne og
// tidsstemplerne; ingen migration (genbruger video_analyses.session_context,
// samme felt som ordre 109 · commit 3).
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { summarizeSilentFailsForCoach } from './athleteSilentFailLog'

export default function AthleteSilentFailNote({ athleteId }) {
  const [note, setNote] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!athleteId) return undefined
    supabase.from('video_analyses')
      .select('session_context, created_at')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setNote(summarizeSilentFailsForCoach(data))
      })
    return () => { cancelled = true }
  }, [athleteId])

  if (!note) return null
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', color: '#c8923a', padding: '0.3rem 0' }}>
      {note}
    </div>
  )
}
