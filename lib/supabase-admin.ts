import { createClient } from '@supabase/supabase-js'

export class PersistentStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PersistentStorageError'
  }
}

export function createSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRoleKey) {
    throw new PersistentStorageError('Persistent storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function throwStorageError(error: { message: string }): never {
  throw new PersistentStorageError(error.message)
}
