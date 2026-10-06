'use client'

import { Check, X } from 'lucide-react'
import { CertificateDownload } from '@/components/certificate-download'
import { Badge, Card } from '@/components/ui-kit'
import { isCorrect } from '@/components/quiz-store'
import type { Attempt, Quiz, Role, User } from '@/lib/types'
import { formatAuthorizationGrade, getAuthorizationGrade, getEvaluation } from '@/lib/evaluation'

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function ResultSummary({
  attempt,
  quiz,
  showAnswers = true,
  role = 'inspector',
  user,
}: {
  attempt: Attempt
  quiz?: Quiz
  showAnswers?: boolean
  role?: Role
  user?: User
}) {
  const evaluation = getEvaluation(attempt.percentage)
  return (
    <div className="flex flex-col gap-6">
      <Card
        className={`flex flex-col items-center gap-2 py-8 text-center ${
          attempt.passed ? 'border-emerald-200 bg-emerald-50/50' : 'border-destructive/30 bg-destructive/5'
        }`}
      >
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-full ${
            attempt.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {attempt.passed ? <Check className="h-8 w-8" /> : <X className="h-8 w-8" />}
        </span>
        <p className="font-heading text-4xl font-bold">{evaluation.score.toFixed(1)}/10</p>
        <p className="font-semibold">Authorization grade {formatAuthorizationGrade(getAuthorizationGrade(attempt.percentage, attempt.recordedGrade))}</p>
        <p className="text-sm text-muted-foreground">
          {attempt.percentage}% · {attempt.score} of {attempt.maxScore} points · {formatTime(attempt.timeSpent)}
        </p>
        <Badge tone={attempt.passed ? 'success' : 'danger'} className="mt-1">
          {attempt.passed ? 'Passed' : 'Not passed'}
        </Badge>
        <div className="flex flex-wrap justify-center gap-2">
          <CertificateDownload attempt={attempt} role={role} user={user} />
        </div>
      </Card>

      {showAnswers && quiz && (
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-lg font-semibold">Answer review</h2>
          {quiz.questions.map((q, i) => {
            const selected = attempt.answers[q.id] ?? []
            const correct = isCorrect(q, selected)
            return (
              <Card key={q.id} className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
                      correct ? 'bg-emerald-600' : 'bg-destructive'
                    }`}
                  >
                    {correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </span>
                  <p className="text-sm font-medium">
                    {i + 1}. {q.prompt}
                  </p>
                </div>
                <ul className="flex flex-col gap-1.5 pl-7">
                  {q.options.map((o) => {
                    const isSel = selected.includes(o.id)
                    const isRight = q.correct.includes(o.id)
                    return (
                      <li
                        key={o.id}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                          isRight
                            ? 'bg-emerald-50 text-emerald-800'
                            : isSel
                              ? 'bg-destructive/10 text-destructive'
                              : 'text-muted-foreground'
                        }`}
                      >
                        <span className="flex-1">{o.text}</span>
                        {isRight && <Badge tone="success">Correct</Badge>}
                        {isSel && !isRight && <Badge tone="danger">Your answer</Badge>}
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
