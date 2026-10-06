'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'

function ResetPasswordForm() {
  const params = useSearchParams()
  const router = useRouter()
  const { resetAdminPassword } = useQuizStore()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirmation) { setError('Passwords do not match.'); return }
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.get('token'), password }),
    })
    const result = await response.json() as { ok?: boolean; error?: string }
    if (!response.ok || !result.ok) { setError(result.error ?? 'Unable to reset password.'); return }
    const storeResult = resetAdminPassword(password)
    if (!storeResult.ok) { setError(storeResult.error ?? 'Unable to reset password.'); return }
    setComplete(true)
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f5f6fa] px-5 py-10 text-[#182238]">
    <section className="w-full max-w-[436px] rounded-2xl bg-white p-7 shadow-sm sm:p-9">
      {complete ? <>
        <h1 className="font-heading text-[27px] font-bold leading-tight">Password updated</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your Admin password has been reset. You can sign in now.</p>
        <Button onClick={() => router.push('/')} className="mt-7 h-12 w-full gap-2 rounded-xl bg-[#1c2f60] font-bold hover:bg-[#263d75]">Back to sign in <ArrowRight className="h-4 w-4" /></Button>
      </> : <>
        <h1 className="font-heading text-[27px] font-bold leading-tight">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">This link can reset the Admin account only.</p>
        <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">New password</span><input className="h-11 rounded-xl border border-[#d9e1f0] bg-[#edf3ff] px-3.5 text-sm outline-none focus:border-[#2d8acb]" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Confirm password</span><input className="h-11 rounded-xl border border-[#d9e1f0] bg-[#edf3ff] px-3.5 text-sm outline-none focus:border-[#2d8acb]" type="password" minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="mt-2 h-12 w-full gap-2 rounded-xl bg-[#1c2f60] font-bold hover:bg-[#263d75]">Reset Admin password <ArrowRight className="h-4 w-4" /></Button>
        </form>
      </>}
    </section>
  </main>
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="min-h-screen bg-[#f5f6fa]" />}><ResetPasswordForm /></Suspense>
}