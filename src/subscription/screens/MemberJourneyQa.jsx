import { useMemo, useState } from 'react'
import { color, s } from '../theme.js'
import { Meta, TopBar } from '../ui.jsx'
import { memberJourneySessionToPilotSession } from '../pilotRepository.js'
import { createCustomerProgram, createProgramReviewPackage } from '../programReviewPackage.js'
import MemberJourney from './MemberJourney.jsx'

const QA_USER_ID = '00000000-0000-4000-8000-000000000019'
const QA_ASSIGNMENT_ID = '00000000-0000-4000-8000-000000000113'
const QA_PROGRAM_ID = '00000000-0000-4000-8000-000000000213'
const QA_ASSIGNMENT_KEY = 'entropi:sub:local-member-qa:assignment:v1'
const QA_SESSIONS_KEY = 'entropi:sub:local-member-qa:sessions:v1'

function loadQaAssignment() {
  try {
    const value = JSON.parse(window.localStorage.getItem(QA_ASSIGNMENT_KEY) || 'null')
    return value?.id === QA_ASSIGNMENT_ID && value?.program_id === QA_PROGRAM_ID ? value : null
  } catch {
    return null
  }
}

function loadQaSessions() {
  try {
    const value = JSON.parse(window.localStorage.getItem(QA_SESSIONS_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export default function MemberJourneyQa() {
  const [assignment, setAssignment] = useState(loadQaAssignment)
  const [sessions, setSessions] = useState(loadQaSessions)
  const program = useMemo(() => {
    if (!assignment) return null
    const source = assignment.match_input || {}
    const matchInput = {
      schemaVersion: source.schemaVersion,
      goal: source.goal,
      level: source.level,
      daysPerWeek: source.daysPerWeek,
      equipment: source.equipment,
      squatStyle: source.squatStyle,
      deadliftStyle: source.deadliftStyle,
    }
    const generated = createCustomerProgram(createProgramReviewPackage(matchInput))
    return generated ? { ...generated, id: QA_PROGRAM_ID } : null
  }, [assignment])

  const completeSetup = async ({ matchInput, baselineLoads }) => {
    const next = {
      id: QA_ASSIGNMENT_ID,
      program_id: QA_PROGRAM_ID,
      match_input: {
        ...matchInput,
        setupSchemaVersion: 1,
        baselinePolicyVersion: 1,
        baselines: baselineLoads,
      },
      baselineLoads,
    }
    try { window.localStorage.setItem(QA_ASSIGNMENT_KEY, JSON.stringify(next)) } catch { /* local QA stays usable without storage */ }
    setAssignment(next)
    return next
  }

  const persistSession = async entry => {
    const saved = memberJourneySessionToPilotSession(assignment, entry)
    if (!saved) return
    const next = [...sessions.filter(item => item.clientId !== saved.clientId), { ...saved, syncStatus: 'local-only' }]
    try { window.localStorage.setItem(QA_SESSIONS_KEY, JSON.stringify(next)) } catch { /* local QA stays usable without storage */ }
    setSessions(next)
  }

  return <div style={s.wrap}>
    <TopBar title="Entropi · lokal member-QA" right={<Meta style={{ color: color.accent }}>{sessions.length} pas gemt</Meta>} />
    <MemberJourney
      userId={QA_USER_ID}
      assignment={assignment}
      program={program}
      historySessions={sessions}
      onCompleteSetup={completeSetup}
      onPersistSession={persistSession}
      onLogout={() => {}}
      onRetry={() => {}}
    />
  </div>
}
