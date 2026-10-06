'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Brand } from '@/components/brand'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const { currentUser, logout } = useQuizStore()
  const router = useRouter()
  const pathname = usePathname()

  const links =
    currentUser?.role === 'admin'
      ? [
          { href: '/admin', label: 'Dashboard' },
          { href: '/admin/training', label: 'Training' },
          { href: '/admin/quizzes', label: 'Tests' },
          { href: '/admin/results', label: 'Results' },
          { href: '/admin/inspectors', label: 'Live monitoring' },
          { href: '/admin/users', label: 'Accounts' },
        ]
        : currentUser?.role === 'tc_qa'
          ? [
              { href: '/tc-qa', label: 'Dashboard' },
              { href: '/tc-qa#assessment-review', label: 'Assessment Review' },
              { href: '/tc-qa#assessment-review', label: 'Assessment Results' },
              { href: '/tc-qa#reports', label: 'Assessment Reports' },
            ]
          : [
          { href: '/training', label: 'Training' },
          { href: '/inspector', label: 'Available Tests' },
          { href: '/inspector/history', label: 'My Results' },
        ]

  function handleLogout() {
    logout()
    router.push('/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Brand />
          <nav className="hidden min-w-0 items-center gap-1 md:flex">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== '/admin' &&
                  link.href !== '/dashboard' &&
                  pathname.startsWith(link.href))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="hidden max-w-[180px] text-right sm:block">
              <p className="truncate text-sm font-medium leading-none">{currentUser.name}</p>
              <p className="truncate text-xs text-muted-foreground">{currentUser.role === 'tc_qa' ? 'TM / QA' : currentUser.role}</p>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
