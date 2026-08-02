import { createRoot } from 'react-dom/client'
import ProgramMatchPreview from './screens/ProgramMatchPreview.jsx'
import { s } from './theme.js'
import { TopBar } from './ui.jsx'

const exampleInput = {
  schemaVersion: 4,
  goal: 'general-strength',
  level: 'oevet',
  daysPerWeek: 2,
  equipment: 'gym',
  squatStyle: 'high-bar',
  deadliftStyle: 'conventional',
  updatedAt: null,
}

createRoot(document.getElementById('root')).render(
  <div style={s.wrap}>
    <TopBar title="Entropi" />
    <ProgramMatchPreview userId="local-program-preview" initialInput={exampleInput} onBack={() => {}} />
  </div>
)
