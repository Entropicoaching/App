import { createRoot } from 'react-dom/client'
import PilotMobileChecklist from './screens/PilotMobileChecklist.jsx'
import { s } from './theme.js'
import { TopBar } from './ui.jsx'

createRoot(document.getElementById('root')).render(
  <div style={s.wrap}><TopBar title="Entropi" /><PilotMobileChecklist /></div>,
)
