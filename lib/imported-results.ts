import assessmentRecords from '@/data/inspector-assessment-results.json'
import type { Attempt, Quiz, User } from './types'

type ImportedAssessmentRecord = (typeof assessmentRecords)[number]

function buildIncorrectSelection(question: Quiz['questions'][number]): string[] {
  const wrongOptions = question.options.filter((option) => !question.correct.includes(option.id))
  if (wrongOptions.length === 0) {
    return question.options.slice(0, Math.max(1, question.correct.length)).map((option) => option.id)
  }

  const wantedLength = Math.max(1, Math.min(question.correct.length || 1, wrongOptions.length))
  return wrongOptions.slice(0, wantedLength).map((option) => option.id)
}

function buildScoreAwareAnswerMap(quiz: Quiz, targetScore: number): Record<string, string[]> {
  const reachable = new Map<number, { indexes: number[] }>([[0, { indexes: [] }]])

  quiz.questions.forEach((question, index) => {
    for (const [currentTotal, selection] of Array.from(reachable.entries())) {
      const nextTotal = currentTotal + question.points
      if (nextTotal > targetScore) continue

      const nextIndexes = [...selection.indexes, index]
      const existing = reachable.get(nextTotal)
      if (!existing || nextIndexes.length > existing.indexes.length) {
        reachable.set(nextTotal, { indexes: nextIndexes })
      }
    }
  })

  const selection = reachable.get(targetScore)
  if (!selection) {
    throw new Error(`The recorded score ${targetScore} cannot be represented by the questions in "${quiz.title}".`)
  }
  const selectedByIndex = new Set(selection.indexes)
  const answers = quiz.questions.reduce<Record<string, string[]>>((result, question, index) => {
    result[question.id] = selectedByIndex.has(index)
      ? [...question.correct]
      : buildIncorrectSelection(question)
    return result
  }, {})
  const verifiedScore = quiz.questions.reduce((total, question) => {
    const selected = answers[question.id] ?? []
    const isCorrect = selected.length === question.correct.length
      && selected.every((answer) => question.correct.includes(answer))
    return total + (isCorrect ? question.points : 0)
  }, 0)

  if (verifiedScore !== targetScore) {
    throw new Error(`The reconstructed answers for "${quiz.title}" score ${verifiedScore}, not the recorded ${targetScore}.`)
  }
  return answers
}

function getAssessmentTimestamps(record: ImportedAssessmentRecord) {
  const match = record.cbtSlot.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/)
  if (!match) throw new Error(`The recorded CBT slot "${record.cbtSlot}" is invalid for ${record.userName}.`)

  const start = new Date(`${record.assessmentDate}T${match[1].padStart(2, '0')}:${match[2]}:00`)
  const end = new Date(`${record.assessmentDate}T${match[3].padStart(2, '0')}:${match[4]}:00`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new Error(`The recorded assessment date or CBT slot is invalid for ${record.userName}.`)
  }
  const scheduledMinutes = (end.getTime() - start.getTime()) / 60_000
  if (scheduledMinutes !== record.cbtDurationMinutes) {
    throw new Error(`The CBT slot duration for ${record.userName} does not match the recorded ${record.cbtDurationMinutes} minutes.`)
  }
  return { startedAt: start.getTime(), submittedAt: end.getTime() }
}

function isRecordedGrade(value: string): value is NonNullable<Attempt['recordedGrade']> {
  return value === 'A' || value === 'B' || value === 'C' || value === 'W'
}

export function createImportedInspectorResults(users: User[], quizzes: Quiz[]): Attempt[] {
  const usersById = new Map(users.map((user) => [user.id, user]))
  const quizzesById = new Map(quizzes.map((quiz) => [quiz.id, quiz]))

  return assessmentRecords.map((record) => {
    const user = usersById.get(record.userId)
    if (!user) throw new Error(`No inspector profile is available for imported result ${record.userName}.`)
    const quiz = quizzesById.get(record.quizId)
    if (!quiz) throw new Error(`No assessment is available for imported result ${record.userName}: ${record.quizId}.`)
    const maxScore = quiz.questions.reduce((total, question) => total + question.points, 0)
    if (record.totalMarks !== maxScore) {
      throw new Error(`The result register total for "${quiz.title}" is ${record.totalMarks}, but the quiz total is ${maxScore}.`)
    }
    if (record.marksObtained < 0 || record.marksObtained > record.totalMarks) {
      throw new Error(`The recorded score for "${quiz.title}" is outside its valid range.`)
    }
    if (!isRecordedGrade(record.recommendedAuthorization)) {
      throw new Error(`The recommended authorization grade for "${quiz.title}" is invalid.`)
    }
    const recordedGrade = record.recommendedAuthorization

    const percentage = Math.round((record.marksObtained / record.totalMarks) * 100)
    const passed = percentage >= quiz.passingScore
    const { startedAt, submittedAt } = getAssessmentTimestamps(record)

    return {
      id: `imported-${record.userId}-${record.quizId}`,
      quizId: record.quizId,
      quizTitle: quiz.title,
      userId: record.userId,
      userName: user.name,
      attemptNumber: 1,
      answers: buildScoreAwareAnswerMap(quiz, record.marksObtained),
      score: record.marksObtained,
      maxScore: record.totalMarks,
      percentage,
      passed,
      competencyStatus: passed ? 'COMPETENT' : 'NOT COMPETENT',
      startedAt,
      timeSpent: record.cbtDurationMinutes * 60,
      submittedAt,
      conductedBy: user.testAssignments?.find((assignment) => assignment.quizId === quiz.id)?.conductedBy,
      importedSource: 'competency-evaluation',
      recordedGrade,
      questionResponsesSource: 'reconstructed-from-aggregate-score',
      importedAssessmentDetails: {
        sourceCandidateName: record.sourceCandidateName,
        sourceSheet: record.sourceSheet,
        trainingDate: record.trainingDate,
        assessmentDate: record.assessmentDate,
        iafScope: record.iafScope,
        internalExternal: record.internalExternal,
        topic: record.topic,
        designation: record.designation,
        trainingType: record.trainingType,
        trainingMaterial: record.trainingMaterial,
        trainingDuration: record.trainingDuration,
        trainingSlot: record.trainingSlot,
        cbtDuration: record.cbtDuration,
        cbtDurationMinutes: record.cbtDurationMinutes,
        cbtSlot: record.cbtSlot,
        totalMarks: record.totalMarks,
        marksObtained: record.marksObtained,
      },
    }
  })
}
