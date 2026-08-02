import { createRoot } from 'react-dom/client'
import PilotFeedbackReview from './screens/PilotFeedbackReview.jsx'
import { s } from './theme.js'
import { TopBar } from './ui.jsx'

createRoot(document.getElementById('root')).render(<div style={s.wrap}><TopBar title="Entropi" /><PilotFeedbackReview /></div>)
