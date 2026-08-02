// Skal for abonnementsprototypen.
//
// Bevidst uden router: 1:1-portalen har ingen router, og prototypen skal ikke
// introducere en afhængighed for fem skærme. Navigation er tilstand her.

import { useState } from 'react'
import { color, s } from './theme'
import { Button, Label, Meta, TabBar, TopBar } from './ui'
import Onboarding from './screens/Onboarding'
import Today from './screens/Today'
import LogSession from './screens/LogSession'
import History from './screens/History'
import Profile from './screens/Profile'
import { getProgram, getSession } from './programs'
import { completeSession, sessionTotals, startSession } from './trainingLog'
import {
  clearAll,
  clearDraft,
  loadDraft,
  loadProfile,
  loadSessions,
  saveDraft,
  saveProfile,
  saveSessions,
} from './storage'
import { isTier } from './entitlements'

export default function SubscriptionApp() {
  // Læses én gang ved mount via lazy initializers — ikke i en effect, så der
  // hverken er et tomt første render eller en ekstra rendering. Alt herefter
  // skrives igennem til localStorage med det samme, så en genindlæsning
  // aldrig koster logget arbejde.
  const [profile, setProfile] = useState(loadProfile)
  const [sessions, setSessions] = useState(loadSessions)
  const [draft, setDraft] = useState(loadDraft)
  const [view, setView] = useState('today') // today | history | profile | log | done
  const [finished, setFinished] = useState(null)

  if (!profile) {
    return (
      <Onboarding
        onCreate={created => {
          saveProfile(created)
          setProfile(created)
          setView('today')
        }}
      />
    )
  }

  const program = getProgram(profile.programId)

  const startTraining = dayId => {
    const next = startSession(program, dayId)
    saveDraft(next)
    setDraft(next)
    setView('log')
  }

  const updateDraft = next => {
    saveDraft(next)
    setDraft(next)
  }

  const finishTraining = () => {
    const done = completeSession(draft)
    const nextSessions = [...sessions, done]
    saveSessions(nextSessions)
    clearDraft()
    setSessions(nextSessions)
    setDraft(null)
    setFinished(done)
    setView('done')
  }

  if (view === 'log' && draft) {
    return (
      <LogSession
        draft={draft}
        sessions={sessions}
        onChange={updateDraft}
        onFinish={finishTraining}
        onCancel={() => setView('today')}
      />
    )
  }

  if (view === 'done' && finished) {
    const totals = sessionTotals(finished)
    const day = getSession(finished.programId, finished.dayId)
    return (
      <div style={s.wrap}>
        <TopBar title="Entropi" />
        <div style={{ ...s.page, paddingTop: '2rem' }}>
          <Label>Pas gemt</Label>
          <h1 style={s.h1}>{day ? day.name : 'Træning'} er færdigt.</h1>
          <p style={{ ...s.body, marginBottom: '1.5rem' }}>
            {totals.sets} sæt · {totals.volume} kg samlet. Det ligger nu i din historik.
          </p>
          <Button onClick={() => { setFinished(null); setView('history') }} style={{ marginBottom: '0.6rem' }}>
            Se historik
          </Button>
          <Button variant="ghost" onClick={() => { setFinished(null); setView('today') }}>
            Tilbage til i dag
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <TopBar
        title="Entropi"
        right={<Meta style={{ color: color.dim }}>{program.name}</Meta>}
      />

      {view === 'today' && (
        <Today
          profile={profile}
          sessions={sessions}
          draft={draft}
          onStart={startTraining}
          onResume={() => setView('log')}
        />
      )}

      {view === 'history' && <History profile={profile} sessions={sessions} />}

      {view === 'profile' && (
        <Profile
          profile={profile}
          sessions={sessions}
          onSetEntitlement={tier => {
            if (!isTier(tier)) return
            const next = { ...profile, entitlement: tier }
            saveProfile(next)
            setProfile(next)
          }}
          onReset={() => {
            clearAll()
            setProfile(null)
            setSessions([])
            setDraft(null)
            setFinished(null)
            setView('today')
          }}
        />
      )}

      <TabBar tab={view} onChange={setView} />
    </div>
  )
}
