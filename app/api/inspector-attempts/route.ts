import { listAttempts, startInspectorAttempt, submitInspectorAttempt } from '@/lib/inspector-attempts'
import { seedUsers } from '@/lib/sample-data'
import { PersistentStorageError } from '@/lib/supabase-admin'
import type { Quiz } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  if (!userId) return Response.json({ error: 'Inspector ID is required.' }, { status: 400 })
  try {
    return Response.json({ attempts: await listAttempts(userId, url.searchParams.get('quizId') ?? undefined) })
  } catch (error) {
    const message = error instanceof PersistentStorageError
      ? error.message
      : 'Assessment history could not be loaded from persistent storage.'
    return Response.json({ error: message }, { status: 503 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action?: 'start' | 'submit'
      userId?: string
      userName?: string
      quizId?: string
      quizTitle?: string
      attemptId?: string
      attemptToken?: string
      quiz?: Quiz
      answers?: Record<string, string[]>
      timeSpent?: number
    }
    if (body.action === 'start' && body.userId && body.userName && body.quizId && body.quizTitle) {
      const knownInspector = seedUsers.find((user) => user.id === body.userId && user.role === 'inspector')
      if (knownInspector && knownInspector.name !== body.userName) {
        return Response.json({ error: 'Inspector identity does not match the authenticated account.' }, { status: 403 })
      }
      return Response.json(await startInspectorAttempt({ userId: body.userId, userName: body.userName, quizId: body.quizId, quizTitle: body.quizTitle }))
    }
    if (body.action === 'submit' && body.userId && body.attemptId && body.attemptToken && body.quiz && body.answers) {
      return Response.json(await submitInspectorAttempt({ attemptId: body.attemptId, attemptToken: body.attemptToken, userId: body.userId, quiz: body.quiz, answers: body.answers, timeSpent: body.timeSpent ?? 0 }))
    }
    return Response.json({ error: 'Invalid inspector attempt request.' }, { status: 400 })
  } catch (error) {
    if (error instanceof PersistentStorageError) {
      return Response.json({ error: error.message }, { status: 503 })
    }
    return Response.json({ error: error instanceof Error ? error.message : 'The inspector attempt could not be processed.' }, { status: 409 })
  }
}