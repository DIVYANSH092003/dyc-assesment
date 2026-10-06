'use client'

import { useState } from 'react'
import { KeyRound, Trash2 } from 'lucide-react'
import { AuthGate } from '@/components/auth-gate'
import { Badge, Card, Select } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'

export default function AdminUsersPage() {
  return (
    <AuthGate role="admin">
      <AccountManagement />
    </AuthGate>
  )
}

function AccountManagement() {
  const { users, createAccount, deleteUser, changeUserPassword } = useQuizStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'inspector' | 'tc_qa'>('inspector')
  const [message, setMessage] = useState<string | null>(null)
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = createAccount(name, email, password, role)
    if (!result.ok) {
      setMessage(result.error ?? 'Unable to create account.')
      return
    }
    setName('')
    setEmail('')
    setPassword('')
    const roleLabel = role === 'inspector' ? 'Inspector' : 'TM/QA'
    setMessage(`${roleLabel} account created successfully.`)
  }

  const accounts = users.filter((user) => user.role === 'inspector' || user.role === 'tc_qa')

  function resetPassword(id: string) {
    const result = changeUserPassword(id, newPassword)
    setMessage(result.ok ? 'Password changed successfully.' : result.error ?? 'Unable to change password.')
    if (result.ok) {
      setPasswordUserId(null)
      setNewPassword('')
    }
  }

  function removeAccount(id: string, accountName: string) {
    if (!window.confirm(`Delete ${accountName}'s account? This cannot be undone.`)) return
    const result = deleteUser(id)
    setMessage(result.ok ? `${accountName}'s account deleted.` : result.error ?? 'Unable to delete account.')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">Only Admin can create Inspector and TM/QA login accounts.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card>
          <h2 className="font-heading text-lg font-semibold">Create account</h2>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Account type</span><Select value={role} onChange={(event) => setRole(event.target.value as 'inspector' | 'tc_qa')}><option value="inspector">Inspector</option><option value="tc_qa">TM / QA</option></Select></label>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Full name</span><input className="h-11 rounded-xl border border-border bg-background px-3 text-sm" value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Email</span><input type="email" className="h-11 rounded-xl border border-border bg-background px-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Temporary password</span><input type="password" minLength={6} className="h-11 rounded-xl border border-border bg-background px-3 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <Button type="submit">Create account</Button>
            {message && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
          </form>
        </Card>

        <Card className="p-0">
          <div className="border-b border-border px-5 py-4"><h2 className="font-heading text-lg font-semibold">Managed accounts</h2></div>
          <ul className="divide-y divide-border">
            {accounts.map((user) => <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-sm font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div><div className="flex items-center gap-2"><Badge tone="neutral">{user.role}</Badge><Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setPasswordUserId(passwordUserId === user.id ? null : user.id); setNewPassword('') }}><KeyRound className="h-3.5 w-3.5" /> Password</Button><Button variant="outline" size="sm" aria-label={`Delete ${user.name}`} onClick={() => removeAccount(user.id, user.name)}><Trash2 className="h-3.5 w-3.5" /></Button></div>{passwordUserId === user.id && <div className="flex w-full gap-2"><input type="password" minLength={6} placeholder="New password (6+ characters)" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><Button size="sm" onClick={() => resetPassword(user.id)}>Save</Button></div>}</li>)}
          </ul>
        </Card>
      </div>
    </div>
  )
}
