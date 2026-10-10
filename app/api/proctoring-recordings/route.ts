import {
  createProctoringPlaybackUrl,
  createProctoringUpload,
  deleteProctoringRecording,
  linkProctoringRecording,
  listProctoringSessions,
  verifyRecordingAdmin,
} from '@/lib/proctoring-recordings'
import { PersistentStorageError } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

function storageError(error: unknown) {
  if (error instanceof PersistentStorageError) {
    return Response.json({ error: error.message }, { status: 503 })
  }
  return Response.json(
    { error: error instanceof Error ? error.message : 'The recording request could not be processed.' },
    { status: 400 },
  )
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get('authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!accessToken) return false
  return verifyRecordingAdmin(accessToken)
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return Response.json({ error: 'A Supabase-authenticated administrator is required.' }, { status: 401 })
    }
    const attemptId = new URL(request.url).searchParams.get('attemptId')
    if (attemptId) {
      return Response.json({ url: await createProctoringPlaybackUrl(attemptId) }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }
    return Response.json({ sessions: await listProctoringSessions() }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return storageError(error)
  }
}

export async function POST(request: Request) {
  let body: {
    action?: 'sign-upload' | 'complete'
    attemptId?: string
    attemptToken?: string
    contentType?: string
    path?: string
  }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ error: 'The recording request must contain valid JSON.' }, { status: 400 })
  }

  if (!body.attemptId || !body.attemptToken) {
    return Response.json({ error: 'An active assessment attempt is required.' }, { status: 400 })
  }
  try {
    if (body.action === 'sign-upload') {
      return Response.json(await createProctoringUpload({
        attemptId: body.attemptId,
        attemptToken: body.attemptToken,
        contentType: body.contentType ?? '',
      }), { headers: { 'Cache-Control': 'no-store' } })
    }
    if (body.action === 'complete') {
      if (!body.path) return Response.json({ error: 'The uploaded recording path is required.' }, { status: 400 })
      await linkProctoringRecording({
        attemptId: body.attemptId,
        attemptToken: body.attemptToken,
        path: body.path,
      })
      return Response.json({ ok: true })
    }
    return Response.json({ error: 'Invalid recording action.' }, { status: 400 })
  } catch (error) {
    return storageError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return Response.json({ error: 'A Supabase-authenticated administrator is required.' }, { status: 401 })
    }
    const body = await request.json() as { attemptId?: string }
    if (!body.attemptId) return Response.json({ error: 'An assessment attempt is required.' }, { status: 400 })
    await deleteProctoringRecording(body.attemptId)
    return Response.json({ ok: true })
  } catch (error) {
    return storageError(error)
  }
}
