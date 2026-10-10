import type { ProctoringSession } from './types'
import { createSupabaseAdminClient, throwStorageError } from './supabase-admin'

const BUCKET = 'inspector-recordings'
const SIGNED_URL_SECONDS = 60 * 60
const LIVE_ATTEMPT_WINDOW_MS = 12 * 60 * 60 * 1000

export async function createProctoringUpload(input: {
  attemptId: string
  attemptToken: string
  contentType: string
}) {
  const extensionByType: Record<string, string> = {
    'video/webm': 'webm',
    'video/mp4': 'mp4',
  }
  const extension = extensionByType[input.contentType]
  if (!extension) throw new Error('The recording must be in WebM or MP4 format.')

  const supabase = createSupabaseAdminClient()
  const { data: attempt, error } = await supabase
    .from('inspector_attempts')
    .select('id, user_id, attempt_token, completed')
    .eq('id', input.attemptId)
    .eq('attempt_token', input.attemptToken)
    .maybeSingle()
  if (error) throwStorageError(error)
  if (!attempt || attempt.completed) throw new Error('The assessment attempt is invalid or already submitted.')

  const path = `${attempt.user_id}/${attempt.id}.${extension}`
  const { data, error: uploadError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true })
  if (uploadError) throwStorageError(uploadError)
  return { path, token: data.token }
}

export async function linkProctoringRecording(input: {
  attemptId: string
  attemptToken: string
  path: string
}) {
  const supabase = createSupabaseAdminClient()
  const { data: attempt, error: readError } = await supabase
    .from('inspector_attempts')
    .select('id, user_id, attempt_token')
    .eq('id', input.attemptId)
    .eq('attempt_token', input.attemptToken)
    .maybeSingle()
  if (readError) throwStorageError(readError)
  if (!attempt) throw new Error('The assessment attempt is invalid.')

  const expectedPath = [`${attempt.user_id}/${attempt.id}.webm`, `${attempt.user_id}/${attempt.id}.mp4`]
  if (!expectedPath.includes(input.path)) throw new Error('The recording path does not match this assessment attempt.')
  const separatorIndex = input.path.lastIndexOf('/')
  const directory = input.path.slice(0, separatorIndex)
  const filename = input.path.slice(separatorIndex + 1)
  const { data: objects, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(directory, { search: filename, limit: 1 })
  if (listError) throwStorageError(listError)
  if (!objects.some((object) => object.name === filename)) {
    throw new Error('The uploaded recording could not be found.')
  }

  const { error } = await supabase
    .from('inspector_attempts')
    .update({ recording_path: input.path })
    .eq('id', attempt.id)
    .eq('attempt_token', input.attemptToken)
  if (error) throwStorageError(error)
}

export async function listProctoringSessions(): Promise<ProctoringSession[]> {
  const supabase = createSupabaseAdminClient()
  const [recordings, liveAttempts] = await Promise.all([
    supabase
      .from('inspector_attempts')
      .select('id, user_id, quiz_id, submitted_at, completed, recording_path, data')
      .eq('completed', true)
      .not('recording_path', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(50),
    supabase
      .from('inspector_attempts')
      .select('id, user_id, quiz_id, submitted_at, completed, recording_path, data')
      .eq('completed', false)
      .gte('submitted_at', Date.now() - LIVE_ATTEMPT_WINDOW_MS)
      .order('submitted_at', { ascending: false })
      .limit(50),
  ])
  if (recordings.error) throwStorageError(recordings.error)
  if (liveAttempts.error) throwStorageError(liveAttempts.error)
  const data = [...(recordings.data ?? []), ...(liveAttempts.data ?? [])]
    .sort((first, second) => second.submitted_at - first.submitted_at)

  return data.map((row) => {
      const attempt = row.data as {
        quizTitle: string
        userName: string
        startedAt: number
      }
      return {
        id: row.id,
        attemptId: row.id,
        quizId: row.quiz_id,
        quizTitle: attempt.quizTitle,
        userId: row.user_id,
        userName: attempt.userName,
        startedAt: attempt.startedAt,
        endedAt: row.completed ? row.submitted_at : undefined,
        status: row.completed ? 'completed' : 'live',
        cameraGranted: true,
        microphoneGranted: true,
        recordingId: row.recording_path ? row.id : undefined,
      }
  })
}

export async function createProctoringPlaybackUrl(attemptId: string) {
  const supabase = createSupabaseAdminClient()
  const { data: attempt, error: readError } = await supabase
    .from('inspector_attempts')
    .select('recording_path')
    .eq('id', attemptId)
    .maybeSingle()
  if (readError) throwStorageError(readError)
  if (!attempt?.recording_path) throw new Error('No saved recording is available for this assessment.')

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(attempt.recording_path, SIGNED_URL_SECONDS)
  if (error) throwStorageError(error)
  return data.signedUrl
}

export async function deleteProctoringRecording(attemptId: string) {
  const supabase = createSupabaseAdminClient()
  const { data: attempt, error: readError } = await supabase
    .from('inspector_attempts')
    .select('recording_path')
    .eq('id', attemptId)
    .maybeSingle()
  if (readError) throwStorageError(readError)
  if (!attempt?.recording_path) throw new Error('No saved recording is available for this assessment.')

  const { error: deleteError } = await supabase.storage
    .from(BUCKET)
    .remove([attempt.recording_path])
  if (deleteError) throwStorageError(deleteError)

  const { error: updateError } = await supabase
    .from('inspector_attempts')
    .update({ recording_path: null })
    .eq('id', attemptId)
  if (updateError) throwStorageError(updateError)
}

export async function verifyRecordingAdmin(accessToken: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.auth.getUser(accessToken)
  if (error || !data.user) return false
  const allowedEmails = (process.env.SUPABASE_RECORDINGS_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
  return Boolean(data.user.email && allowedEmails.includes(data.user.email.toLowerCase()))
}
