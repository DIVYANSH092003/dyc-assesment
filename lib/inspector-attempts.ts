import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import importedAssessmentRecords from '@/data/inspector-assessment-results.json'
import type { Attempt, Question, Quiz } from './types'
import { getRetakeAvailableAt, isPassingEvaluation } from './evaluation'

type StoredAttempt = Attempt & {
  completed: boolean
  attemptToken: string
}

interface AttemptLedger {
  attempts: StoredAttempt[]
}

const ledgerPath = path.join(process.cwd(), 'data', 'inspector-attempts.json')
let mutationQueue = Promise.resolve()

async function readLedger(): Promise<AttemptLedger> {
  try {
    return JSON.parse(await readFile(ledgerPath, 'utf8')) as AttemptLedger
  } catch {
    return { attempts: [] }
  }
}

async function writeLedger(ledger: AttemptLedger) {
  await mkdir(path.dirname(ledgerPath), { recursive: true })
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8')
}

function withMutation<T>(operation: () => Promise<T>) {
  const result = mutationQueue.then(operation, operation)
  mutationQueue = result.then(() => undefined, () => undefined)
  return result
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
  const ledger = await readLedger()
  return ledger.attempts.filter((attempt) => attempt.userId === userId && attempt.completed && (!quizId || attempt.quizId === quizId))
}

export async function startInspectorAttempt(input: {
  userId: string
  userName: string
  quizId: string
  quizTitle: string
}) {
  return withMutation(async () => {
    const ledger = await readLedger()
    const mine = ledger.attempts.filter((attempt) => attempt.userId === input.userId && attempt.quizId === input.quizId)
    const completed = mine.filter((attempt) => attempt.completed)
    const importedResults = importedAssessmentRecords.filter((record) =>
      record.userId === input.userId && record.quizId === input.quizId,
    )
    const importedPassed = importedResults.some((record) =>
      isPassingEvaluation(Math.round((record.marksObtained / record.totalMarks) * 100)),
    )
    const passed = importedPassed || completed.some((attempt) => attempt.passed || attempt.competencyStatus === 'COMPETENT')
    if (passed) throw new Error('This assessment is already marked COMPETENT. Retakes are not permitted.')
    const latestCompletedAt = Math.max(
      ...completed.map((attempt) => attempt.submittedAt),
      ...importedResults.map((record) => new Date(`${record.assessmentDate}T12:00:00`).getTime()),
      0,
    )
    const retakeAvailableAt = latestCompletedAt > 0 ? getRetakeAvailableAt(latestCompletedAt) : null
    if (retakeAvailableAt !== null && Date.now() < retakeAvailableAt) {
      throw new Error(`A retake is available on ${new Date(retakeAvailableAt).toLocaleDateString()}.`)
    }

    const pending = mine.find((attempt) => !attempt.completed)
    if (pending) return { attemptId: pending.id, attemptNumber: pending.attemptNumber, attemptToken: pending.attemptToken }

    const attemptNumber = Math.max(0, ...mine.map((attempt) => attempt.attemptNumber)) + 1
    const startedAt = Date.now()
    const attempt: StoredAttempt = {
      id: `a-${startedAt}-${Math.random().toString(36).slice(2, 8)}`,
      quizId: input.quizId,
      quizTitle: input.quizTitle,
      userId: input.userId,
      userName: input.userName,
      attemptNumber,
      answers: {},
      score: 0,
      maxScore: 0,
      percentage: 0,
      passed: false,
      startedAt,
      timeSpent: 0,
      submittedAt: startedAt,
      completed: false,
      attemptToken: crypto.randomUUID(),
    }
    ledger.attempts.push(attempt)
    await writeLedger(ledger)
    return { attemptId: attempt.id, attemptNumber, attemptToken: attempt.attemptToken }
  })
}

export async function submitInspectorAttempt(input: {
  attemptId: string
  attemptToken: string
  userId: string
  quiz: Quiz
  answers: Record<string, string[]>
  timeSpent: number
}) {
  return withMutation(async () => {
    const ledger = await readLedger()
    const attempt = ledger.attempts.find((item) => item.id === input.attemptId && item.userId === input.userId)
    if (!attempt || attempt.attemptToken !== input.attemptToken) throw new Error('The assessment attempt is invalid or belongs to another Inspector.')
    if (attempt.completed) return attempt

    const result = scoreQuiz(input.quiz, input.answers)
    attempt.answers = input.answers
    attempt.score = result.score
    attempt.maxScore = result.maxScore
    attempt.percentage = result.percentage
    attempt.passed = result.passed
    attempt.competencyStatus = result.passed ? 'COMPETENT' : 'NOT COMPETENT'
    attempt.submittedAt = Date.now()
    attempt.timeSpent = Math.max(0, input.timeSpent)
    attempt.completed = true
    await writeLedger(ledger)
    return attempt
  })
}