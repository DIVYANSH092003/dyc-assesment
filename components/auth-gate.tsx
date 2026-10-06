'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { useQuizStore } from '@/components/quiz-store'
import type { Role } from '@/lib/types'

export function AuthGate({
  role,
  children,
}: {
  role: Role | Role[]
  children: React.ReactNode
}) {
  const { ready, currentUser } = useQuizStore()
  const router = useRouter()

  useEffect(() => {
    if (!ready) return
    if (!currentUser) {
      router.replace('/')
    } else if (Array.isArray(role) ? !role.includes(currentUser.role) : currentUser.role !== role) {
      router.replace(
        currentUser.role === 'admin'
          ? '/admin'
          : currentUser.role === 'inspector'
            ? '/inspector'
            : '/tc-qa',
      )
    }
  }, [ready, currentUser, role, router])

  const hasAccess = currentUser && (Array.isArray(role) ? role.includes(currentUser.role) : currentUser.role === role)

  if (!ready || !hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
