import { useState } from 'react'
import { intensityExplanation } from './intensityExplanation.mjs'

export default function IntensityExplanation({ intensity }) {
  const [open, setOpen] = useState(false)
  const explanation = intensityExplanation(intensity)
  if (!explanation) return intensity
  return <span style={{ display: 'inline-block', maxWidth: '100%', textTransform: 'none', letterSpacing: 'normal' }}>
    <button type="button" aria-expanded={open} aria-label={`Forklaring af ${intensity}`}
      onClick={() => setOpen(value => !value)}
      style={{ font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid currentColor', borderRadius: 4, minHeight: 44, padding: '0.4rem 0.6rem', cursor: 'pointer', maxWidth: '100%' }}>{intensity}</button>
    {open && <span style={{ display: 'block', color: '#edeae2', fontSize: '0.78rem', lineHeight: 1.5, marginTop: '0.4rem', overflowWrap: 'anywhere' }}>{explanation}</span>}
  </span>
}
