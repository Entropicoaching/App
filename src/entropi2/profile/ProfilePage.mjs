import { createElement as h, useEffect, useRef, useState } from 'react'
import Profile from './Profile.mjs'
import { profileStyles as s } from './profileStyles.mjs'
import { ExportPanel } from '../eksport/ExportPanel.mjs'
import { ProfileGoals } from './ProfileGoals.mjs'

// Uses the host's existing topbar slot; no changes to the shared account menu.
export function ProfileMenu({ enabled, onOpen, summaryRef } = {}) {
  if (enabled !== true) return null
  return h('button', { type: 'button', ref: summaryRef,
    style: { ...s.button, width: 'auto', minHeight: 44, minWidth: 44,
      padding: '8px 6px', fontSize: 14, boxSizing: 'border-box', margin: 0, cursor: 'pointer' },
    onClick: () => onOpen?.() }, 'Mig')
}

export function ProfilePage(props = {}) {
  if (props.enabled !== true) return null
  if (!props.ownerId || props.athlete?.user_id !== props.ownerId) return null
  return h(ActiveProfilePage, props)
}

function ActiveProfilePage(props) {
  const live = useRef(props); live.current = props
  const root = useRef(null)
  useEffect(() => { root.current?.focus() }, [])
  const [active, setActive] = useState(true)
  useEffect(() => { live.current = props; return () => { live.current = { enabled: false } } }, [props])
  if (props.enabled !== true || !props.ownerId || props.athlete?.user_id !== props.ownerId) return null
  const close = () => { live.current = { enabled: false }; setActive(false); props.onClose() }
  const getScope = () => {
    const current = live.current
    return { enabled: current.enabled, athleteId: current.athlete?.id,
      athleteUserId: current.athlete?.user_id, ownerId: current.ownerId }
  }
  return h('section', { 'aria-label': 'Profil og dataeksport', tabIndex: -1, ref: root },
    h('button', { type: 'button', style: s.button, onClick: close }, 'Tilbage'),
    h(Profile, { enabled: true, athlete: props.athlete, visKost: props.visKost, hideLogout: true, hideGoal: true },
      active && h(ProfileGoals, { enabled: true, athlete: props.athlete, ownerId: props.ownerId, client: props.client,
        getScope }),
      h('p', { style: s.label }, 'Log ud findes i kontomenuen ⋯.'),
      active && h(ExportPanel, { enabled: true, client: props.client, getScope })))
}
