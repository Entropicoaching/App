const f = globalThis.__optagBridge;
export const useEffect = effect => f.effects.push(effect);
export const supabase = {};
export const createAbortableUploadClient = signal => ({ storage: { from: bucket => ({
  upload: async (path, file, options) => { f.uploads.push({ signal, bucket, path, file, options }); return f.upload ? f.upload(signal, path, file) : {}; }
}) } });
export const sanitizeVideoCoachFeedbackEvidence = x => x;
export const recordSilentFail = () => {};
export const attachPendingSilentFails = x => x;
export const clearPendingSilentFails = () => {};
export const markUploadInflight = () => {};
export const clearUploadInflight = () => {};
export const takeStaleUploadInflight = () => false;
export const flushVideoCoachDraftQueue = async () => ({ remaining: 0 });
export const isRetryableVideoCoachError = () => false;
export const queueVideoCoachDraft = () => false;
export const saveVideoCoachDraft = async (_, row) => { f.rows.push(row); return f.save ? f.save(row) : { data: { id: 'synthetic' } }; };
export const ATHLETE_VIDEOCOACH_PREFIX = 'test:vc';
export const ATHLETE_VIDEOCOACH_QUEUE_CHANGED = 'test:queue';
export const validateAthleteVideoCoachRow = () => null;
