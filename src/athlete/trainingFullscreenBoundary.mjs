// Synthetic boundaries only. Any attempted database operation fails this test.
export const supabase = { from() { throw Error('Forbidden synthetic database access') } }
export const queueWrite = () => { throw Error('Forbidden synthetic queued network access') }
export const runGuardedWrite = () => { throw Error('Forbidden synthetic guarded network access') }
export const recordSilentFail = () => {}
export const parsePlannedRpe = () => null
export const logFrontendError = () => {}
export const erDeloadBlok = () => false
export const bygGrundlag = () => null
export const findRekord = () => null
export const rekordTekst = () => ''
export const ugensSaet = () => []
export const ugensOevelsesIds = () => new Set()
export const browserSaysOffline = () => true
export const seemsOffline = () => true
export const withSlowNetCutoff = () => { throw Error('Forbidden synthetic network access') }
