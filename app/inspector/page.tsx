'use client'

import Link from 'next/link'
import { AuthGate } from '@/components/auth-gate'
import { Card } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'
import { getEvaluation, getRetakeAvailableAt } from '@/lib/evaluation'

export default function InspectorDashboardPage() {
  return (
    <AuthGate role="inspector">
      <InspectorTests />
    </AuthGate>
  )
}

function InspectorTests() {
  const { quizzes, attempts, currentUser, trainingResources } = useQuizStore()
  const training = trainingResources.filter(
    (item) => currentUser?.assignedTrainingIds?.includes(item.id),
  )
  const completedTraining = currentUser?.trainingCompletedIds ?? []
  const trainingComplete = training.length === 0 || training.every((item) => completedTraining.includes(item.id))
  const available = quizzes.filter(
    (quiz) => (quiz.targetRole ?? 'inspector') === 'inspector' &&
      currentUser?.assignedQuizIds?.includes(quiz.id),
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Welcome, {currentUser?.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Complete your assigned inspector competency assessments and review your results.
        </p>
      </div>

      {!trainingComplete ? (
        <Card className="border-amber-200 bg-amber-50 py-8">
          <h2 className="font-heading text-lg font-semibold text-amber-950">Complete training before starting an assessment</h2>
          <p className="mt-2 text-sm text-amber-900">Open every assigned training resource in the reader. Video and audio resources must finish playing before your assessments are unlocked.</p>
          <Button render={<Link href="/training" />} nativeButton={false} className="mt-4 w-fit">Open training</Button>
        </Card>
      ) : available.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No inspector assessments are available right now. Please check back later.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {available.map((quiz) => {
            const mine = attempts.filter((attempt) => attempt.quizId === quiz.id && attempt.userId === currentUser?.id)
            const latest = [...mine].sort((a, b) => b.submittedAt - a.submittedAt)[0]
            const passed = mine.some((attempt) => attempt.passed || attempt.competencyStatus === 'COMPETENT')
            const retakeAvailableAt = latest && !latest.passed ? getRetakeAvailableAt(latest.submittedAt) : null
            const waitingForRetake = retakeAvailableAt !== null && Date.now() < retakeAvailableAt
            const locked = passed || waitingForRetake
            const evaluation = latest ? getEvaluation(latest.percentage) : null
            return (
              <Card key={quiz.id} className="flex flex-col gap-4">
                <div>
                  <h3 className="font-heading text-base font-semibold leading-snug text-balance">{quiz.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{latest && evaluation ? `Evaluation: ${evaluation.score.toFixed(1)}/10 · Grade ${evaluation.grade}` : 'Evaluation: Not attempted'}</p>
                  {latest && <p className="mt-1 text-sm font-semibold">Attempt {latest.attemptNumber} · {latest.passed ? 'Competent' : 'Not competent'}</p>}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">{passed ? 'COMPETENT · Retakes not permitted' : waitingForRetake && retakeAvailableAt ? `Retake available ${new Date(retakeAvailableAt).toLocaleDateString()}` : latest ? 'Retake available' : 'Evaluation scale: 1–10'}</span>
                  {!locked && <Button render={<Link href={`/quiz/${quiz.id}`} />} nativeButton={false} size="sm">{mine.length ? 'Retake' : 'Start test'}</Button>}
                  {passed && <span className="text-xs font-semibold text-emerald-700">Complete</span>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
