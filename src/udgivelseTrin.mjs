// APP-TRIN1: Marc sets UDGIVELSE_TRIN = 1 before push to enable step 1.
// Default remains 0 until Marc takes that action.
export const UDGIVELSE_TRIN = 0

// Only appData2 participates. Existing explicit URL opt-in is preserved at step 0.
export function trin1AppData2(search = '', trin = UDGIVELSE_TRIN) {
  return trin === 1 || new URLSearchParams(search).get('appData2') === '1'
}
