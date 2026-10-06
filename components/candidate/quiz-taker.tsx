'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Clock } from 'lucide-react'
import { Badge, Card } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { ButtonLink } from '@/components/button-link'
import { useQuizStore } from '@/components/quiz-store'
import { ResultSummary } from '@/components/candidate/result-summary'
import type { Attempt, Quiz } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ProctoringIntro, ProctoringMonitor, saveProctoringRecording } from '@/components/proctoring'
import { formatAuthorizationGrade, getAuthorizationGrade, getEvaluation, getRetakeAvailableAt } from '@/lib/evaluation'

function formatClock(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function QuizTaker({ quiz }: { quiz: Quiz }) {
  const { beginAttempt, submitAttempt, currentUser, startProctoringSession, finishProctoringSession } = useQuizStore()
  const router = useRouter()

  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [secondsLeft, setSecondsLeft] = useState(quiz.durationMinutes * 60)
  const [result, setResult] = useState<Attempt | null>(null)
  const [attemptNumber, setAttemptNumber] = useState<number | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [attemptToken, setAttemptToken] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [proctoringSessionId, setProctoringSessionId] = useState<string | null>(null)
  const submittedRef = useRef(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])

  const totalSeconds = quiz.durationMinutes * 60
  const answeredCount = useMemo(
    () => quiz.questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length,
    [answers, quiz.questions],
  )
  const homePath = currentUser?.role === 'inspector' ? '/inspector' : '/dashboard'
  const historyPath = currentUser?.role === 'inspector' ? '/inspector/history' : '/dashboard/history'

  async function stopRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return null
    const recording = new Promise<Blob>((resolve) => {
      recorder.addEventListener('stop', () => resolve(new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'video/webm' })), { once: true })
    })
    recorder.stop()
    const blob = await recording
    recorderRef.current = null
    mediaStream?.getTracks().forEach((track) => track.stop())
    setMediaStream(null)
    return blob
  }

  async function doSubmit() {
    if (submittedRef.current) return
    submittedRef.current = true
    try {
      if (!attemptId || !attemptToken) throw new Error('The assessment attempt is not active. Please return to the test list and try again.')
      const timeSpent = totalSeconds - secondsLeft
      const attempt = await submitAttempt(quiz, answers, timeSpent, attemptId, attemptToken)
      const blob = await stopRecording()
      if (proctoringSessionId) {
        const recordingId = blob ? `recording-${proctoringSessionId}` : undefined
        if (blob && recordingId) await saveProctoringRecording(recordingId, blob)
        finishProctoringSession(proctoringSessionId, 'completed', attempt.id, recordingId)
      }
      setResult(attempt)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      submittedRef.current = false
      setSubmitError(error instanceof Error ? error.message : 'The assessment could not be submitted.')
    }
  }

  async function startTest(stream: MediaStream) {
    const reservation = await beginAttempt(quiz)
    setAttemptNumber(reservation.attemptNumber)
    setAttemptId(reservation.attemptId)
    setAttemptToken(reservation.attemptToken)
    const session = startProctoringSession(quiz, true, true)
    const recorder = new MediaRecorder(stream)
    recordingChunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data)
    }
    recorder.start(1000)
    recorderRef.current = recorder
    setMediaStream(stream)
    setProctoringSessionId(session.id)
    setStarted(true)
  }

  useEffect(() => () => {
    mediaStream?.getTracks().forEach((track) => track.stop())
  }, [mediaStream])

  // countdown
  useEffect(() => {
    if (!started || result) return
    if (secondsLeft <= 0) {
      doSubmit()
      return
    }
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, secondsLeft, result])

  function selectOption(qid: string, oid: string, multi: boolean) {
    setAnswers((prev) => {
      const cur = prev[qid] ?? []
      if (multi) {
        return {
          ...prev,
          [qid]: cur.includes(oid) ? cur.filter((c) => c !== oid) : [...cur, oid],
        }
      }
      return { ...prev, [qid]: [oid] }
    })
  }

  // Result view
  if (result) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {quiz.title} — Results
          </h1>
          <p className="text-sm text-muted-foreground">Your submission has been recorded.</p>
        </div>
        <p className="text-sm font-semibold">Attempt {result.attemptNumber} · Authorization grade {formatAuthorizationGrade(getAuthorizationGrade(result.percentage, result.recordedGrade))} · {result.competencyStatus ?? (result.passed ? 'COMPETENT' : 'NOT COMPETENT')}</p>
        {!result.passed && <p className="text-sm text-muted-foreground">You may retake this assessment from {new Date(getRetakeAvailableAt(result.submittedAt)).toLocaleDateString()}.</p>}
        <ResultSummary attempt={result} quiz={quiz} user={currentUser ?? undefined} />
        <div className="flex gap-2">
          <ButtonLink href={homePath} variant="outline">
            Back to tests
          </ButtonLink>
          <ButtonLink href={historyPath}>
            View all my results
          </ButtonLink>
        </div>
      </div>
    )
  }

  // Intro / start screen
  if (!started) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="flex flex-col gap-5">
          <div>
            <Badge tone="primary">{quiz.category || 'Assessment'}</Badge>
            <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-balance">
              {quiz.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{quiz.description}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 border-y border-border py-4 text-center">
            <div>
              <p className="font-heading text-xl font-bold">{quiz.questions.length}</p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </div>
            <div>
              <p className="font-heading text-xl font-bold">{quiz.durationMinutes}m</p>
              <p className="text-xs text-muted-foreground">Time limit</p>
            </div>
            <div>
              <p className="font-heading text-xl font-bold">5/10</p>
              <p className="text-xs text-muted-foreground">Passing evaluation</p>
            </div>
          </div>

          {attemptNumber && <p className="text-sm font-semibold">Attempt {attemptNumber}</p>}

          {submitError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{submitError}</p>}

          <div className="flex items-start gap-2 rounded-md bg-accent/15 px-3 py-2.5 text-sm text-accent-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              The timer starts as soon as you begin and the test auto-submits when time
              runs out. Make sure you can finish in one sitting.
            </span>
          </div>

          <ProctoringIntro onStart={startTest} />

          <div className="flex gap-2">
            <ButtonLink href="/dashboard" variant="outline">
              Cancel
            </ButtonLink>
          </div>
        </Card>
      </div>
    )
  }

  const lowTime = secondsLeft <= 30
  const progress = Math.round((answeredCount / quiz.questions.length) * 100)

  // Test-taking view
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-4">
        {quiz.questions.map((q, i) => {
          const selected = answers[q.id] ?? []
          const multi = q.type === 'multi'
          return (
            <Card key={q.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-heading text-sm font-semibold text-muted-foreground">
                  Question {i + 1} of {quiz.questions.length}
                </span>
                <div className="flex items-center gap-2">
                  {multi && <Badge tone="accent">Select all that apply</Badge>}
                  <Badge>{q.points} pt{q.points === 1 ? '' : 's'}</Badge>
                </div>
              </div>
              <p className="text-base font-medium text-pretty">{q.prompt}</p>
              <div className="flex flex-col gap-2">
                {q.options.map((o) => {
                  const isSel = selected.includes(o.id)
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => selectOption(q.id, o.id, multi)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition',
                        isSel
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border bg-card hover:border-ring/60 hover:bg-secondary/40',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center border text-primary-foreground',
                          multi ? 'rounded' : 'rounded-full',
                          isSel ? 'border-primary bg-primary' : 'border-input',
                        )}
                      >
                        {isSel && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span>{o.text}</span>
                    </button>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Sticky timer / submit panel */}
      <aside className="lg:sticky lg:top-24 lg:w-64 lg:shrink-0">
        <div className="flex flex-col gap-4">
        {mediaStream && <ProctoringMonitor stream={mediaStream} />}
        <Card className="flex flex-col gap-4">
          <div
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg py-3 font-heading text-2xl font-bold tabular-nums',
              lowTime ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-foreground',
            )}
          >
            <Clock className="h-5 w-5" />
            {formatClock(Math.max(0, secondsLeft))}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Answered</span>
              <span>
                {answeredCount}/{quiz.questions.length}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {confirmSubmit ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Submit now? You have {quiz.questions.length - answeredCount} unanswered.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setConfirmSubmit(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" className="flex-1" onClick={doSubmit}>
                  Submit
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setConfirmSubmit(true)}>Submit test</Button>
          )}
        </Card>
        </div>
      </aside>
    </div>
  )
}
