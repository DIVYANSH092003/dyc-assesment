'use client'

import Link from 'next/link'
import { Clock, HelpCircle, Target } from 'lucide-react'
import { Badge, Card } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'
import { formatAuthorizationGrade, getAuthorizationGrade, getEvaluation, getRetakeAvailableAt } from '@/lib/evaluation'

export function InspectorDashboard() {
  const { quizzes, attempts, currentUser } = useQuizStore()

  if (!currentUser) return null

  const available = quizzes.filter(
    (quiz) => quiz.targetRole === 'inspector' && currentUser.assignedQuizIds?.includes(quiz.id),
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
          <div>
            <Badge tone="primary">Inspector information</Badge>
            <p className="mt-2 text-sm font-semibold">{currentUser.name} · {currentUser.designation}</p>
            <p className="text-xs text-muted-foreground">{currentUser.scopeSector} · {currentUser.informationDate}</p>
            {currentUser.scopeSector === 'NABCB IAF SCOPE 17' && currentUser.scope17Category && (
              <p className="mt-1 text-xs text-muted-foreground">Category: {currentUser.scope17Category}</p>
            )}
            {currentUser.scopeSector === 'NABCB IAF SCOPE 18' && currentUser.scope18Category && (
              <p className="mt-1 text-xs text-muted-foreground">Category: {currentUser.scope18Category}</p>
            )}
            {currentUser.scopeSector === 'NABCB IAF SCOPE 19' && currentUser.scope19Category && (
              <p className="mt-1 text-xs text-muted-foreground">Category: {currentUser.scope19Category}</p>
            )}
            {currentUser.scopeSector === 'NABCB IAF SCOPE 28' && currentUser.scope28Category && (
              <p className="mt-1 text-xs text-muted-foreground">Category: {currentUser.scope28Category}</p>
            )}
          </div>
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Welcome, {currentUser?.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose an assessment below to begin. You can review your results afterward.
        </p>
      </div>

      {available.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No assessments are available right now. Please check back later.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {available.map((quiz) => {
            const mine = attempts.filter(
              (attempt) => attempt.quizId === quiz.id && attempt.userId === currentUser?.id,
            )
            const latest = [...mine].sort((a, b) => b.submittedAt - a.submittedAt)[0]
            const passed = mine.some((attempt) => attempt.passed || attempt.competencyStatus === 'COMPETENT')
            const retakeAvailableAt = latest && !latest.passed ? getRetakeAvailableAt(latest.submittedAt) : null
            const waitingForRetake = retakeAvailableAt !== null && Date.now() < retakeAvailableAt
            const evaluation = latest ? getEvaluation(latest.percentage) : null

            return (
              <Card key={quiz.id} className="flex flex-col gap-4">
                <div>
                  <Badge tone="primary">{quiz.category || 'Assessment'}</Badge>
                  <h3 className="mt-2 font-heading text-base font-semibold leading-snug text-balance">
                    {quiz.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {quiz.description || 'No description.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <HelpCircle className="h-3.5 w-3.5" /> {quiz.questions.length} Q
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {quiz.durationMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" /> 5/10 to pass
                  </span>
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">
                    {passed ? `Grade ${evaluation?.grade} · Competent` : waitingForRetake && retakeAvailableAt ? `Retake available ${new Date(retakeAvailableAt).toLocaleDateString()}` : evaluation ? `Authorization grade ${formatAuthorizationGrade(getAuthorizationGrade(evaluation.score * 10))} · ${evaluation.score.toFixed(1)}/10` : 'Not attempted'}
                  </span>
                  {!passed && !waitingForRetake && <Button render={<Link href={`/quiz/${quiz.id}`} />} nativeButton={false} size="sm">{mine.length ? 'Retake' : 'Start test'}</Button>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
