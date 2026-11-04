// Optional owner state for a later screen integration. No data access or effects.
export const initialVolumeState = Object.freeze({
  volumeLogs: null, volumeLoading: true, volumeError: false,
})

export function volumeReadReducer(state, event) {
  switch (event.type) {
    case 'start': return { ...initialVolumeState }
    case 'success':
      // Malformed reads are failures, never a successful empty history.
      if (Array.isArray(event.logs)) {
        return { volumeLogs: event.logs, volumeLoading: false, volumeError: false }
      }
      return { volumeLogs: null, volumeLoading: false, volumeError: true }
    case 'error': return { volumeLogs: null, volumeLoading: false, volumeError: true }
    default: return state
  }
}
