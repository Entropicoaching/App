import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dsqgaxwgtcbqgphsofav.supabase.co'
const SUPABASE_KEY = 'sb_publishable_5pPmUgyjEHtrAQbGnEr5QA_dkBhZLNS'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)