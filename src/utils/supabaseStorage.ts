import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = (import.meta.env.SUPABASE_URL as string) || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = (import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string) || process.env.SUPABASE_SERVICE_ROLE_KEY
const DEFAULT_BUCKET = (import.meta.env.SUPABASE_BUCKET_NAME as string) || process.env.SUPABASE_BUCKET_NAME || 'public'

export function buildPublicUrl(bucket: string, path: string) {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL not configured')
  // Supabase public storage object URL
  return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`
}

// Create a Supabase client using the service role key (server-only)
export function createServiceClient() {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL not configured')
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not available in server environment')
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

export { DEFAULT_BUCKET }
