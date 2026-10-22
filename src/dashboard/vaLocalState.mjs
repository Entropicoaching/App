// VA-INT1: pure page state. No athlete, analysis, storage or transport values.
export const initialLocalVideoState = Object.freeze({ open: false, tool: 'session' })
export function localVideoTransition(state, action) {
  if (action === 'open') return { open: true, tool: 'session' }
  if (action === 'close') return { ...initialLocalVideoState }
  if (state.open && (action === 'session' || action === 'model' || action === 'fund'))
    return { open: true, tool: action }
  return state
}
