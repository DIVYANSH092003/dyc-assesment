import { listInspectorProfiles, saveInspectorProfiles } from '@/lib/inspector-profiles'
import { toSharedInspectorProfile } from '@/lib/inspector-profile-shared'
import { PersistentStorageError } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return Response.json({ profiles: await listInspectorProfiles() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const message = error instanceof PersistentStorageError
      ? error.message
      : 'Inspector profiles could not be loaded from persistent storage.'
    return Response.json({ error: message }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function PUT(request: Request) {
  let body: { profile?: unknown; profiles?: unknown[] }
  try {
    body = await request.json() as { profile?: unknown; profiles?: unknown[] }
  } catch {
    return Response.json({ error: 'The inspector profile request must contain valid JSON.' }, { status: 400 })
  }

  const inputProfiles = body.profiles ?? (body.profile ? [body.profile] : [])
  const profiles = inputProfiles.map(toSharedInspectorProfile).filter((profile) => profile !== null)
  if (profiles.length === 0 || profiles.length !== inputProfiles.length) {
    return Response.json({ error: 'Provide valid inspector profiles.' }, { status: 400 })
  }
  try {
    const savedProfiles = await saveInspectorProfiles(profiles)
    return Response.json({ ok: true, profiles: savedProfiles })
  } catch (error) {
    const message = error instanceof PersistentStorageError
      ? error.message
      : 'Inspector profiles could not be saved to persistent storage.'
    return Response.json({ error: message }, { status: 503 })
  }
}