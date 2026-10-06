'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, FileUp, GripVertical, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Label, Select, TextArea, TextInput } from '@/components/ui-kit'
import { useQuizStore } from '@/components/quiz-store'
import type { Question, QuestionType, Quiz } from '@/lib/types'

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function blankQuestion(type: QuestionType = 'single'): Question {
  if (type === 'boolean') {
    return {
      id: uid('q'),
      type,
      prompt: '',
      points: 1,
      options: [
        { id: uid('o'), text: 'True' },
        { id: uid('o'), text: 'False' },
      ],
      correct: [],
    }
  }
  return {
    id: uid('q'),
    type,
    prompt: '',
    points: 1,
    options: [
      { id: uid('o'), text: '' },
      { id: uid('o'), text: '' },
    ],
    correct: [],
  }
}

function parseImportedQuestions(text: string): Question[] {
  const questions: Question[] = []
  let current: { prompt: string; options: string[]; correctLetters: string[]; points: number } | null = null

  function finishQuestion() {
    if (!current || !current.prompt || current.options.length < 2) return
    const correct = current.correctLetters
      .map((letter) => letter.charCodeAt(0) - 65)
      .filter((index) => index >= 0 && index < current!.options.length)
    if (correct.length === 0) return
    questions.push({
      id: uid('q'),
      type: correct.length > 1 ? 'multi' : 'single',
      prompt: current.prompt,
      points: current.points,
      options: current.options.map((option) => ({ id: uid('o'), text: option })),
      correct: [],
    })
    const question = questions[questions.length - 1]
    question.correct = correct.map((index) => question.options[index].id)
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const questionMatch = line.match(/^(?:question\s*\d*|q\s*\d*)\s*[:.)-]\s*(.+)$/i)
    const optionMatch = line.match(/^([A-H])\s*[.)\-:]\s*(.+)$/i)
    const answerMatch = line.match(/^(?:correct\s*answer|answer)\s*[:=-]\s*([A-H](?:\s*[,/&]\s*[A-H])*)/i)
    const pointsMatch = line.match(/^points?\s*[:=-]\s*(\d+)/i)

    if (questionMatch) {
      finishQuestion()
      current = { prompt: questionMatch[1].trim(), options: [], correctLetters: [], points: 1 }
    } else if (optionMatch && current) {
      current.options.push(optionMatch[2].trim())
    } else if (answerMatch && current) {
      current.correctLetters = answerMatch[1].toUpperCase().match(/[A-H]/g) ?? []
    } else if (pointsMatch && current) {
      current.points = Math.max(1, Number(pointsMatch[1]))
    } else if (current && current.options.length === 0) {
      current.prompt = `${current.prompt} ${line}`.trim()
    }
  }
  finishQuestion()
  return questions
}

const typeLabels: Record<QuestionType, string> = {
  single: 'Single choice',
  multi: 'Multiple choice',
  boolean: 'True / False',
}

export function QuizEditor({ existing }: { existing?: Quiz }) {
  const { saveQuiz, quizzes } = useQuizStore()
  const router = useRouter()
  const importInputRef = useRef<HTMLInputElement>(null)
  const existingCategories = Array.from(new Set(
    quizzes
      .filter((item) => item.id !== existing?.id)
      .map((item) => item.category.trim())
      .filter(Boolean),
  )).sort((first, second) => first.localeCompare(second))

  const [quiz, setQuiz] = useState<Quiz>(
    existing ?? {
      id: uid('quiz'),
      title: '',
      description: '',
      category: '',
      durationMinutes: 10,
      passingScore: 50,
      targetRole: 'inspector',
      questions: [blankQuestion()],
      createdAt: Date.now(),
    },
  )
  const [error, setError] = useState<string | null>(null)

  async function handleImport(file: File) {
    setError(null)
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setError('Please choose a Word .docx file.')
      return
    }
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
      const questions = parseImportedQuestions(result.value)
      if (questions.length === 0) {
        setError('No complete questions were found. Use Question, A/B/C options, and Correct Answer labels.')
        return
      }
      setQuiz((current) => ({ ...current, questions }))
    } catch {
      setError('The Word file could not be read. Please upload a valid .docx file.')
    }
  }

  function patch(p: Partial<Quiz>) {
    setQuiz((q) => ({ ...q, ...p }))
  }

  function patchQuestion(qid: string, p: Partial<Question>) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((qn) => (qn.id === qid ? { ...qn, ...p } : qn)),
    }))
  }

  function changeType(qid: string, type: QuestionType) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((qn) => {
        if (qn.id !== qid) return qn
        if (type === 'boolean') {
          return {
            ...qn,
            type,
            options: [
              { id: uid('o'), text: 'True' },
              { id: uid('o'), text: 'False' },
            ],
            correct: [],
          }
        }
        return { ...qn, type, correct: [] }
      }),
    }))
  }

  function addQuestion() {
    setQuiz((q) => ({ ...q, questions: [...q.questions, blankQuestion()] }))
  }

  function removeQuestion(qid: string) {
    setQuiz((q) => ({ ...q, questions: q.questions.filter((qn) => qn.id !== qid) }))
  }

  function addOption(qid: string) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((qn) =>
        qn.id === qid
          ? { ...qn, options: [...qn.options, { id: uid('o'), text: '' }] }
          : qn,
      ),
    }))
  }

  function removeOption(qid: string, oid: string) {
    setQuiz((q) => ({
      ...q,
      questions: q.questions.map((qn) =>
        qn.id === qid
          ? {
              ...qn,
              options: qn.options.filter((o) => o.id !== oid),
              correct: qn.correct.filter((c) => c !== oid),
            }
          : qn,
      ),
    }))
  }

  function toggleCorrect(qn: Question, oid: string) {
    if (qn.type === 'multi') {
      const next = qn.correct.includes(oid)
        ? qn.correct.filter((c) => c !== oid)
        : [...qn.correct, oid]
      patchQuestion(qn.id, { correct: next })
    } else {
      patchQuestion(qn.id, { correct: [oid] })
    }
  }

  function validate(): string | null {
    if (!quiz.title.trim()) return 'Please add a test title.'
    if (quiz.questions.length === 0) return 'Add at least one question.'
    for (const [i, qn] of quiz.questions.entries()) {
      if (!qn.prompt.trim()) return `Question ${i + 1} is missing its prompt.`
      if (qn.options.some((o) => !o.text.trim()))
        return `Question ${i + 1} has an empty answer option.`
      if (qn.correct.length === 0)
        return `Question ${i + 1} needs at least one correct answer.`
    }
    return null
  }

  function handleSave() {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    saveQuiz(quiz)
    router.push('/admin/quizzes')
  }

  const totalPoints = quiz.questions.reduce((s, q) => s + q.points, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {existing ? 'Edit test' : 'Create test'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} ·{' '}
            {totalPoints} point{totalPoints === 1 ? '' : 's'} total
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void handleImport(file)
              event.target.value = ''
            }}
          />
          <Button variant="outline" onClick={() => importInputRef.current?.click()} className="gap-2">
            <FileUp className="h-4 w-4" />
            Import Word test
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/quizzes')}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save test
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Word import format: <strong>Question 1: ...</strong>, options on separate lines as <strong>A. ...</strong>, then <strong>Correct Answer: A</strong>. Use one block per question.
      </p>

      {/* Test meta */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Test title</Label>
          <TextInput
            value={quiz.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="e.g. Frontend Developer Screening"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Description</Label>
          <TextArea
            value={quiz.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Short summary shown to inspectors before they start."
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:max-w-md">
          <Label>Scope sector</Label>
          <TextInput
            list="quiz-scope-sectors"
            value={quiz.scopeSector ?? ''}
            onChange={(e) => patch({ scopeSector: e.target.value.trim() || undefined })}
            placeholder="Select or type a scope sector"
          />
          <datalist id="quiz-scope-sectors">
            <option value="NABCB IAF SCOPE 17" />
            <option value="NABCB IAF SCOPE 18" />
            <option value="NABCB IAF SCOPE 17 & 18" />
            <option value="NABCB IAF SCOPE 19" />
            <option value="NABCB IAF SCOPE 28" />
            <option value="Coating" />
            <option value="Other" />
          </datalist>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Technical / scope category (shown on answer sheet)</Label>
            <TextInput
              list="quiz-category-options"
              value={quiz.category}
              onChange={(e) => patch({ category: e.target.value })}
              placeholder="Select or type a technical / scope category"
            />
            <datalist id="quiz-category-options">
              {existingCategories.map((category) => <option key={category} value={category} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Time limit (minutes)</Label>
            <TextInput
              type="number"
              min={1}
              value={quiz.durationMinutes}
              onChange={(e) => patch({ durationMinutes: Number(e.target.value) })}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Evaluation: 1–10 · A: 8–10 · B: 6–under 8 · C: 5–under 6 · W (Withdrawn): under 5</p>
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <Label>Assessment audience</Label>
          <Select
            value={quiz.targetRole ?? 'inspector'}
            onChange={(e) => patch({ targetRole: e.target.value as Quiz['targetRole'] })}
          >
            <option value="inspector">Inspectors</option>
          </Select>
        </div>
      </Card>

      {/* Questions */}
      <div className="flex flex-col gap-4">
        {quiz.questions.map((qn, index) => (
          <Card key={qn.id} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <GripVertical className="h-4 w-4" />
                <span className="font-heading text-sm font-semibold text-foreground">
                  Question {index + 1}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={qn.type}
                  onChange={(e) => changeType(qn.id, e.target.value as QuestionType)}
                  className="h-9 w-auto"
                >
                  {(['single', 'multi', 'boolean'] as QuestionType[]).map((t) => (
                    <option key={t} value={t}>
                      {typeLabels[t]}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQuestion(qn.id)}
                  aria-label="Remove question"
                  disabled={quiz.questions.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <TextArea
              value={qn.prompt}
              onChange={(e) => patchQuestion(qn.id, { prompt: e.target.value })}
              placeholder="Enter the question prompt"
              className="min-h-16"
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>
                  Answer options{' '}
                  <span className="font-normal text-muted-foreground">
                    (tap the circle to mark correct)
                  </span>
                </Label>
              </div>
              {qn.options.map((opt) => {
                const selected = qn.correct.includes(opt.id)
                return (
                  <div key={opt.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(qn, opt.id)}
                      aria-label="Mark correct"
                      className={`flex h-6 w-6 shrink-0 items-center justify-center border transition ${
                        qn.type === 'multi' ? 'rounded' : 'rounded-full'
                      } ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-card text-transparent hover:border-ring'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <TextInput
                      value={opt.text}
                      disabled={qn.type === 'boolean'}
                      onChange={(e) =>
                        patchQuestion(qn.id, {
                          options: qn.options.map((o) =>
                            o.id === opt.id ? { ...o, text: e.target.value } : o,
                          ),
                        })
                      }
                      placeholder="Option text"
                    />
                    {qn.type !== 'boolean' && qn.options.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(qn.id, opt.id)}
                        aria-label="Remove option"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                )
              })}
              {qn.type !== 'boolean' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-fit gap-1 text-primary"
                  onClick={() => addOption(qn.id)}
                >
                  <Plus className="h-4 w-4" />
                  Add option
                </Button>
              )}
            </div>

            <div className="flex w-32 flex-col gap-1.5">
              <Label>Points</Label>
              <TextInput
                type="number"
                min={1}
                value={qn.points}
                onChange={(e) =>
                  patchQuestion(qn.id, { points: Math.max(1, Number(e.target.value)) })
                }
              />
            </div>
          </Card>
        ))}

        <Button variant="outline" onClick={addQuestion} className="gap-2">
          <Plus className="h-4 w-4" />
          Add question
        </Button>
      </div>
    </div>
  )
}
