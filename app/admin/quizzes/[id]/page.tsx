'use client'

import { use } from 'react'
import Link from 'next/link'
import { AuthGate } from '@/components/auth-gate'
import { QuizEditor } from '@/components/admin/quiz-editor'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'

export default function EditQuizPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return (
    <AuthGate role="admin">
      <EditQuiz id={id} />
    </AuthGate>
  )
}

function EditQuiz({ id }: { id: string }) {
  const { quizzes } = useQuizStore()
  const quiz = quizzes.find((q) => q.id === id)

  if (!quiz) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Test not found.</p>
        <Button render={<Link href="/admin/quizzes" />} nativeButton={false} variant="outline" className="mt-4">
          Back to tests
        </Button>
      </div>
    )
  }

  return <QuizEditor existing={quiz} />
}
