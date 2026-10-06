'use client'

import { AuthGate } from '@/components/auth-gate'
import { QuizEditor } from '@/components/admin/quiz-editor'

export default function NewQuizPage() {
  return (
    <AuthGate role="admin">
      <QuizEditor />
    </AuthGate>
  )
}
