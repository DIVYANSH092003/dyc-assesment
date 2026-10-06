import { listInspectorProfiles, saveInspectorProfiles } from '@/lib/inspector-profiles'
import { toSharedInspectorProfile } from '@/lib/inspector-profile-shared'

export const runtime = 'nodejs'

export async function GET() {
  return Response.json({ profiles: await listInspectorProfiles() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { profile?: unknown; profiles?: unknown[] }
    const inputProfiles = body.profiles ?? (body.profile ? [body.profile] : [])
    const profiles = inputProfiles.map(toSharedInspectorProfile).filter((profile) => profile !== null)
    if (profiles.length === 0 || profiles.length !== inputProfiles.length) {
      return Response.json({ error: 'Provide valid inspector profiles.' }, { status: 400 })
    }
    const savedProfiles = await saveInspectorProfiles(profiles)
    return Response.json({ ok: true, profiles: savedProfiles })
  } catch {
    return Response.json({ error: 'Inspector information could not be synchronized.' }, { status: 400 })
  }
}