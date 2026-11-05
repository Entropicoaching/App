import { createElement as h, useState } from 'react'
import { homeCheckInScope } from './homeCheckInModel.mjs'
import { draftKey, loadDraft } from '../checkin/weeklyDraft.mjs'
import WeeklyCheckIn from '../checkin/WeeklyCheckIn.mjs'
import { friendlyReminders } from '../paamindelser/reminderRules.mjs'
import { homeStyles as s } from './homeStyles.mjs'

export default function HomeCheckIn(props = {}) {
  const scope = homeCheckInScope(props)
  if (!scope) return null
  return h(ScopedCheckIn, { key: scope.key, ...scope, athleteId: props.athleteId, storage: props.storage })
}

function ScopedCheckIn({ today, weekStart, minuteOfDay, athleteId, storage }) {
  const [open, setOpen] = useState(false)
  const [snapshot, setSnapshot] = useState(() => ({ ...loadDraft(draftKey(athleteId, weekStart), storage), storage }))
  if (snapshot.storage !== storage) {
    setSnapshot({ ...loadDraft(draftKey(athleteId, weekStart), storage), storage })
    return null
  }
  const reminder = friendlyReminders({ enabled: true, today, minuteOfDay,
    localCheckin: { complete: true, status: snapshot.status, weekStart } })[0]
  const localStatus = snapshot.status === 'saved' ? 'Lokal kladde gemt'
    : snapshot.status === 'unavailable' ? 'Lokal status ukendt' : null
  return h('details', { style: s.card, 'data-home-checkin': '', onToggle: event => {
    setOpen(event.currentTarget.open)
    setSnapshot({ ...loadDraft(draftKey(athleteId, weekStart), storage), storage })
  } },
  h('summary', { style: { ...s.text, cursor: 'pointer', minHeight: 48 }, 'data-home-reminder': !open && reminder ? '' : undefined },
    !open && localStatus ? `Ugentligt check-in · ${localStatus}`
      : !open && reminder ? `${reminder.title} Åbn check-in` : 'Ugentligt check-in'),
  h(WeeklyCheckIn, { enabled: true, athleteId, weekStart, storage, showHeading: false }))
}
