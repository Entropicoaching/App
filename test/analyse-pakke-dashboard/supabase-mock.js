// Test-only transport. Production src/supabase.js is never loaded or read.
import { AuthClient } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'
import { StorageClient } from '@supabase/storage-js'

const url = 'http://127.0.0.1:8996'
const auth = new AuthClient({ url: `${url}/auth/v1`, autoRefreshToken: false, persistSession: false, detectSessionInUrl: false })
const localFetch = async (input, init = {}) => {
  if (new URL(String(input)).origin !== url) throw new Error('Non-local mock transport')
  const { data: { session } } = await auth.getSession()
  return fetch(input, { ...init, headers: { ...init.headers, Authorization: `Bearer ${session?.access_token || ''}` } })
}
const rest = new PostgrestClient(`${url}/rest/v1`, { fetch: localFetch })
export const supabase = {
  auth,
  from: (...args) => rest.from(...args),
  rpc: (...args) => rest.rpc(...args),
  storage: new StorageClient(`${url}/storage/v1`, {}, localFetch),
  channel: () => ({ on() { return this }, subscribe() { return this } }),
  removeChannel: async () => {},
}
export const withRetry = async fn => fn()
export const queueWrite = async fn => fn()
export const isPasswordRecoveryUrl = () => false
export const signOutHard = async () => auth.signOut()
export const createAbortableUploadClient = () => { throw new Error('Upload outside this proof') }
