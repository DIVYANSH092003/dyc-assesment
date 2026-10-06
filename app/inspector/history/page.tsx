'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { AuthGate } from '@/components/auth-gate'
import { Badge, Card } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { ResultSummary } from '@/components/candidate/result-summary'
import { useQuizStore } from '@/components/quiz-store'
import { formatAuthorizationGrade, getAuthorizationGrade, getEvaluation } from '@/lib/evaluation'

export default function InspectorHistoryPage() {
  return (
    <AuthGate role="inspector">
      <InspectorHistory />
    </AuthGate>
  )
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function InspectorHistory() {
  const { attempts, currentUser, quizzes } = useQuizStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const mine = attempts.filter((attempt) => attempt.userId === currentUser?.id).sort((a, b) => b.submittedAt - a.submittedAt)
  const open = mine.find((attempt) => attempt.id === openId)
  const openQuiz = open ? quizzes.find((quiz) => quiz.id === open.quizId) : undefined

  if (open) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">{open.quizTitle}</h1>
            <p className="text-sm text-muted-foreground">Submitted {formatDate(open.submittedAt)}</p>
          </div>
          <Button variant="outline" onClick={() => setOpenId(null)}>Back</Button>
        </div>
        <ResultSummary attempt={open} quiz={openQuiz} user={currentUser ?? undefined} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">My inspector results</h1>
        <p className="text-sm text-muted-foreground">Every competency assessment you have completed.</p>
      </div>
      {mine.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground">You have not completed any inspector assessments yet.</p>
          <Button render={<Link href="/inspector" />} nativeButton={false} variant="outline" className="mt-4">Browse assessments</Button>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {mine.map((attempt) => (
              <li key={attempt.id}>
                <button type="button" onClick={() => setOpenId(attempt.id)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-secondary/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{attempt.quizTitle}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-heading text-sm font-bold">{getEvaluation(attempt.percentage).score.toFixed(1)}/10 · {formatAuthorizationGrade(getAuthorizationGrade(attempt.percentage, attempt.recordedGrade))}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
