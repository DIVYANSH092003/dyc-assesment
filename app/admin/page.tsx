'use client'

import Link from 'next/link'
import {
  BookOpen,
  FileText,
  Plus,
  Search,
  TrendingUp,
  Users,
} from 'lucide-react'
import { AuthGate } from '@/components/auth-gate'
import { Badge, Card } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'
import { getEvaluation } from '@/lib/evaluation'
import { useState } from 'react'

export default function AdminDashboardPage() {
  return (
    <AuthGate role="admin">
      <Dashboard />
    </AuthGate>
  )
}

function Dashboard() {
  const { quizzes, attempts, users } = useQuizStore()
  const [inspectorSearch, setInspectorSearch] = useState('')

  const inspectorCount = users.filter((u) => u.role === 'inspector').length
  const passRate =
    attempts.length > 0
      ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100)
      : 0

  const stats = [
    { label: 'Total tests', value: quizzes.length, icon: BookOpen, hint: 'created' },
    { label: 'Attempts', value: attempts.length, icon: FileText, hint: 'all time' },
    { label: 'Inspectors', value: inspectorCount, icon: Users, hint: 'registered' },
    { label: 'Pass rate', value: `${passRate}%`, icon: TrendingUp, hint: 'across attempts' },
  ]

  const normalizedSearch = inspectorSearch.trim().toLowerCase()
  const matchingInspectorIds = new Set(users
    .filter((user) => user.role === 'inspector' && user.name.toLowerCase().includes(normalizedSearch))
    .map((user) => user.id))
  const recent = [...attempts]
    .filter((attempt) => !normalizedSearch || matchingInspectorIds.has(attempt.userId) || attempt.userName.toLowerCase().includes(normalizedSearch))
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, 6)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of inspector assessments and activity.
          </p>
        </div>
        <Button render={<Link href="/admin/quizzes/new" />} nativeButton={false} className="gap-2">
          <Plus className="h-4 w-4" />
            New test
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-2xl font-bold leading-none">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.label} · {s.hint}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold">Recent activity</h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input aria-label="Filter activity by inspector name" className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm sm:w-52" value={inspectorSearch} onChange={(event) => setInspectorSearch(event.target.value)} placeholder="Search inspector" />
              </label>
              <Link href="/admin/results" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
          </div>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {normalizedSearch ? `No recent activity found for "${inspectorSearch.trim()}".` : 'No attempts yet.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.userName}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.quizTitle}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{getEvaluation(a.percentage).score.toFixed(1)}/10 · {getEvaluation(a.percentage).grade}</span>
                    <Badge tone={a.passed ? 'success' : 'danger'}>
                      {a.passed ? 'Pass' : 'Fail'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-4 font-heading text-lg font-semibold">Your tests</h2>
          {quizzes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tests yet. Create your first one.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {quizzes.slice(0, 5).map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-2">
                  <Link
                    href={`/admin/quizzes/${q.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                  >
                    {q.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
