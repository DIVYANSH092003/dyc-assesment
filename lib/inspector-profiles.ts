import type { SharedInspectorProfile } from './inspector-profile-shared'
import { createSupabaseAdminClient, throwStorageError } from './supabase-admin'

interface StoredInspectorProfile {
  id: string
  email: string
  profile: SharedInspectorProfile
}

export async function listInspectorProfiles() {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('inspector_profiles')
    .select('profile')
    .order('email', { ascending: true })
  if (error) throwStorageError(error)
  return data.map((row) => row.profile)
}

export async function saveInspectorProfiles(profiles: SharedInspectorProfile[]) {
  const supabase = createSupabaseAdminClient()
  const savedProfiles: SharedInspectorProfile[] = []

  for (const profile of profiles) {
    const { data: byId, error: idError } = await supabase
      .from('inspector_profiles')
      .select('id, email, profile')
      .eq('id', profile.id)
      .maybeSingle()
    if (idError) throwStorageError(idError)

    const { data: byEmail, error: emailError } = byId
      ? { data: null, error: null }
      : await supabase
        .from('inspector_profiles')
        .select('id, email, profile')
        .eq('email', profile.email)
        .maybeSingle()
    if (emailError) throwStorageError(emailError)

    const existing = (byId ?? byEmail) as StoredInspectorProfile | null
    const mergedProfile: SharedInspectorProfile = {
      ...profile,
      inspectorSignature: profile.inspectorSignature === undefined
        ? existing?.profile.inspectorSignature
        : profile.inspectorSignature,
    }
    const { error: saveError } = await supabase
      .from('inspector_profiles')
      .upsert({
        id: existing?.id ?? profile.id,
        email: profile.email,
        profile: mergedProfile,
      }, { onConflict: 'id' })
    if (saveError) throwStorageError(saveError)
    savedProfiles.push(mergedProfile)
  }

  return savedProfiles
}
