import importedAssessmentRecords from '@/data/inspector-assessment-results.json'
import type { Attempt, Question, Quiz } from './types'
import { isPassingEvaluation } from './evaluation'
import { createSupabaseAdminClient, throwStorageError } from './supabase-admin'

interface AttemptStartResult {
  attemptId: string
  attemptNumber: number
  attemptToken: string
  errorCode?: string
  retakeAvailableAt?: number
}

export function scoreQuiz(quiz: Quiz, answers: Record<string, string[]>) {
  let score = 0
  let maxScore = 0
  for (const question of quiz.questions) {
    maxScore += question.points
    if (isCorrect(question, answers[question.id] ?? [])) score += question.points
  }
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  return { score, maxScore, percentage, passed: isPassingEvaluation(percentage) }
}

function isCorrect(question: Question, selected: string[]) {
  if (selected.length !== question.correct.length) return false
  const correct = new Set(question.correct)
  return selected.every((option) => correct.has(option))
}

export async function listAttempts(userId: string, quizId?: string) {
  const supabase = createSupabaseAdminClient()
  let query = supabase
    .from('inspector_attempts')
    .select('data')
    .eq('user_id', userId)
    .eq('completed', true)
    .order('submitted_at', { ascending: true })
  if (quizId) query = query.eq('quiz_id', quizId)

  const { data, error } = await query
  if (error) throwStorageError(error)
  return data.map((row) => row.data as unknown as Attempt)
}

export async function startInspectorAttempt(input: {
  userId: string
  userName: string
  quizId: string
  quizTitle: string
}) {
  const importedResults = importedAssessmentRecords.filter((record) =>
    record.userId === input.userId && record.quizId === input.quizId,
  )
  const importedPassed = importedResults.some((record) =>
    isPassingEvaluation(Math.round((record.marksObtained / record.totalMarks) * 100)),
  )
  const importedLatestCompletedAt = Math.max(
    ...importedResults.map((record) => new Date(`${record.assessmentDate}T12:00:00`).getTime()),
    0,
  )

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.rpc('start_inspector_attempt', {
    p_user_id: input.userId,
    p_user_name: input.userName,
    p_quiz_id: input.quizId,
    p_quiz_title: input.quizTitle,
    p_now_ms: Date.now(),
    p_imported_passed: importedPassed,
    p_imported_latest_completed_at: importedLatestCompletedAt,
  })
  if (error) throwStorageError(error)

  const result = data as unknown as AttemptStartResult
  if (result.errorCode === 'retake_not_available' && result.retakeAvailableAt) {
    throw new Error(`A retake is available on ${new Date(result.retakeAvailableAt).toLocaleDateString()}.`)
  }
  if (result.errorCode === 'already_competent') {
    throw new Error('This assessment is already marked COMPETENT. Retakes are not permitted.')
  }
  if (!result.attemptId || !result.attemptNumber || !result.attemptToken) {
    throw new Error('The assessment attempt could not be started.')
  }
  return {
    attemptId: result.attemptId,
    attemptNumber: result.attemptNumber,
    attemptToken: result.attemptToken,
  }
}

export async function submitInspectorAttempt(input: {
  attemptId: string
  attemptToken: string
  userId: string
  quiz: Quiz
  answers: Record<string, string[]>
  timeSpent: number
}) {
  const supabase = createSupabaseAdminClient()
  const { data: stored, error: readError } = await supabase
    .from('inspector_attempts')
    .select('data, completed')
    .eq('id', input.attemptId)
    .eq('user_id', input.userId)
    .eq('attempt_token', input.attemptToken)
    .maybeSingle()
  if (readError) throwStorageError(readError)
  if (!stored) throw new Error('The assessment attempt is invalid or belongs to another Inspector.')

  const existingAttempt = stored.data as unknown as Attempt
  if (stored.completed) return existingAttempt

  const result = scoreQuiz(input.quiz, input.answers)
  const attempt: Attempt = {
    ...existingAttempt,
    answers: input.answers,
    score: result.score,
    maxScore: result.maxScore,
    percentage: result.percentage,
    passed: result.passed,
    competencyStatus: result.passed ? 'COMPETENT' : 'NOT COMPETENT',
    submittedAt: Date.now(),
    timeSpent: Math.max(0, input.timeSpent),
  }

  const { data: updated, error: updateError } = await supabase
    .from('inspector_attempts')
    .update({
      data: attempt,
      completed: true,
      passed: attempt.passed,
      submitted_at: attempt.submittedAt,
    })
    .eq('id', input.attemptId)
    .eq('user_id', input.userId)
    .eq('attempt_token', input.attemptToken)
    .eq('completed', false)
    .select('data')
    .maybeSingle()
  if (updateError) throwStorageError(updateError)
  if (updated) return updated.data as unknown as Attempt

  const { data: current, error: currentError } = await supabase
    .from('inspector_attempts')
    .select('data, completed')
    .eq('id', input.attemptId)
    .eq('user_id', input.userId)
    .eq('attempt_token', input.attemptToken)
    .maybeSingle()
  if (currentError) throwStorageError(currentError)
  if (current?.completed) return current.data as unknown as Attempt
  throw new Error('The assessment attempt could not be submitted. Please try again.')
}
