'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Info, Mail, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'

type SignInRole = 'admin' | 'inspector' | 'tc_qa'

export default function LoginPage() {
  const { ready, currentUser, login } = useQuizStore()
  const router = useRouter()
  const [role, setRole] = useState<SignInRole>('inspector')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [recoverySent, setRecoverySent] = useState(false)

  useEffect(() => {
    if (ready && currentUser) {
      router.replace(
        currentUser.role === 'admin'
          ? '/admin'
          : currentUser.role === 'inspector'
            ? '/inspector'
            : '/tc-qa',
      )
    }
  }, [ready, currentUser, router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const result = login(email, password)
    if (!result.ok) setError(result.error ?? 'Something went wrong.')
  }

  function handleRecovery(e: React.FormEvent) {
    e.preventDefault()
    setRecoveryError(null)
    void fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: recoveryEmail }),
    }).then(async (response) => {
      const result = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !result.ok) {
        setRecoveryError(result.error ?? 'Unable to send recovery instructions.')
        return
      }
      setRecoverySent(true)
    }).catch(() => setRecoveryError('Unable to contact the recovery service.'))
  }

  return (
    <main className="min-h-screen bg-[#f5f6fa] text-[#182238]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(470px,49%)_1fr]">
        <aside className="order-2 relative flex min-h-[560px] flex-col overflow-hidden bg-[#0c1838] px-7 py-7 text-white sm:px-14 sm:py-8 lg:order-2 lg:min-h-screen">
          <div className="pointer-events-none absolute inset-0 opacity-80 [background-image:linear-gradient(135deg,transparent_0%,rgba(73,101,158,.12)_48%,transparent_49%),linear-gradient(35deg,transparent_0%,rgba(5,12,37,.55)_46%,transparent_47%)] [background-size:220px_220px,280px_280px]" />
          <div className="relative -mx-7 -mt-7 flex items-center justify-end gap-3 border-b border-white/10 bg-[#12234a]/90 px-7 py-6 sm:-mx-14 sm:-mt-8 sm:px-14">
            <p className="font-heading text-[18px] font-extrabold tracking-[-0.045em] text-white sm:text-[20px]">DYC GLOBAL</p>
            <img src="/dyc-logo.svg" alt="DYC Global" className="h-11 w-11" />
          </div>

          <div className="relative flex flex-1 flex-col justify-between pt-8 sm:pt-10">
            <div>
            <h2 className="max-w-[540px] font-heading text-[29px] font-bold leading-[1.08] sm:text-[34px]">
              Training and Computer-Based Testing for <span className="text-[#f3bd42]">Inspector Competency Assessment</span>
            </h2>
            <p className="mt-5 max-w-[500px] text-sm leading-6 text-[#b6c0d5] sm:text-[15px]">
              Supervised training, competency assessments, and quality review for empanelled inspectors.
            </p>
            </div>
            <p className="flex items-center gap-2 text-[11px] text-[#aeb9d0]"><Settings className="h-4 w-4 rounded-full bg-white/10 p-0.5" /> © 2026 DYC Global Private Limited. Internal use only.</p>
          </div>
        </aside>

        <section className="order-1 flex items-center justify-center bg-[#f8f8fc] px-5 py-10 sm:px-8 lg:order-1">
          <div className="w-full max-w-[436px]">
        <div className="mb-5 flex justify-end">
          <span className="rounded-full bg-[#edf0f6] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#7b8495]">
            Secure session
          </span>
        </div>

        {showRecovery ? (
          <>
            <button
              type="button"
              onClick={() => {
                setShowRecovery(false)
                setRecoverySent(false)
              }}
              className="mb-6 flex items-center gap-1.5 text-sm font-semibold text-[#7b8495] hover:text-[#182238]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </button>
            <h1 className="font-heading text-[27px] font-bold leading-tight tracking-tight">Forgot password?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Admin password recovery is delivered by email.</p>

            {recoverySent ? (
              <div className="mt-7 rounded-xl border border-[#d8e8dc] bg-[#f1faf3] p-4 text-sm leading-5 text-[#397047]">
                <div className="flex items-center gap-2 font-bold"><Mail className="h-4 w-4" /> Recovery request received</div>
                <p className="mt-2">If an account exists for {recoveryEmail}, recovery instructions will be sent shortly. Check your inbox and spam folder.</p>
              </div>
            ) : (
              <form onSubmit={handleRecovery} className="mt-7 flex flex-col gap-4">
                <Field label="Email address" value={recoveryEmail} onChange={setRecoveryEmail} type="email" placeholder="you@dycglobal.com" required />
                {recoveryError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{recoveryError}</p>}
                <Button type="submit" className="mt-2 h-12 w-full gap-2 rounded-xl bg-[#182b52] font-bold hover:bg-[#213966]">
                  Send recovery instructions <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="font-heading text-[27px] font-bold leading-tight tracking-tight text-[#111b31]">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your credentials to access the assessment platform.
            </p>

        <div className="mt-7 grid grid-cols-3 gap-1 rounded-full border border-[#aab4c2] bg-transparent p-0.5">
          {(['admin', 'inspector', 'tc_qa'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRole(item)}
                className={`h-8 rounded-full text-xs font-semibold capitalize transition sm:text-sm ${
                role === item ? 'bg-[#2d8acb] text-white shadow-sm' : 'text-[#707989] hover:text-[#182238]'
              }`}
            >
              {item === 'tc_qa' ? 'TM / QA' : item}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <Field
            label={role === 'inspector' ? 'Inspector ID or Email' : 'Email'}
            value={email}
            onChange={setEmail}
            type={role === 'inspector' ? 'text' : 'email'}
            placeholder={role === 'inspector' ? 'DYC-INSP-0042 or you@dycglobal.com' : 'you@dycglobal.com'}
            required
          />
          <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" required />


          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          {role === 'admin' && (
            <button type="button" onClick={() => { setRecoveryEmail(email); setShowRecovery(true) }} className="self-end text-sm font-semibold text-[#b28345] hover:text-[#8d652e]">
              Forgot password?
            </button>
          )}

          <Button type="submit" className="mt-2 h-12 w-full gap-2 rounded-xl bg-[#1c2f60] font-bold hover:bg-[#263d75]">
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">Accounts are created by an administrator.</p>

        <div className="mt-5 flex gap-2 rounded-xl border border-[#eadfbf] bg-[#fff9eb] px-3.5 py-3 text-xs leading-4 text-[#887242]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#aa9561]" />
          <span>This device and location will be logged with your attempt for MR-35 test-record traceability.</span>
        </div>
          </>
        )}
          </div>
        </section>
      </div>
    </main>
  )
}

function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <input
        className="h-11 rounded-xl border border-[#d9e1f0] bg-[#edf3ff] px-3.5 text-sm outline-none transition placeholder:text-[#aab1bd] focus:border-[#2d8acb] focus:bg-white focus:ring-2 focus:ring-[#2d8acb]/15"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        required={required}
      />
    </label>
  )
}
