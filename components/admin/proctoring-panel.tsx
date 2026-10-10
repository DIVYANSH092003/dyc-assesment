'use client'

import { useCallback, useEffect, useState } from 'react'
import { Camera, CircleDot, LoaderCircle, LogOut, Mic, Play, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge, Card } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { ProctoringSession } from '@/lib/types'

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function Recording({
  session,
  accessToken,
  onDelete,
}: {
  session: ProctoringSession
  accessToken: string
  onDelete: () => Promise<void>
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function playRecording() {
    if (!session.attemptId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/proctoring-recordings?attemptId=${encodeURIComponent(session.attemptId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error ?? 'The footage could not be loaded.')
      setUrl(result.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The footage could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function removeRecording() {
    if (!session.attemptId || !window.confirm(`Delete the monitoring footage for ${session.userName}?`)) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/proctoring-recordings', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: session.attemptId }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'The footage could not be deleted.')
      await onDelete()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The footage could not be deleted.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {url ? (
        <video controls src={url} className="aspect-video w-full rounded-lg bg-black" />
      ) : (
        <Button variant="outline" size="sm" className="w-fit gap-2" onClick={playRecording} disabled={loading}>
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {loading ? 'Loading recording...' : 'Play saved footage'}
        </Button>
      )}
      <Button variant="destructive" size="sm" className="w-fit gap-1" onClick={removeRecording} disabled={loading}>
        <Trash2 className="h-3.5 w-3.5" /> Delete footage
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function ProctoringPanel() {
  const [sessions, setSessions] = useState<ProctoringSession[]>([])
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const refreshSessions = useCallback(async () => {
    if (!accessToken) return
    const response = await fetch('/api/proctoring-recordings', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    const result = await response.json() as { sessions?: ProctoringSession[]; error?: string }
    if (!response.ok) throw new Error(result.error ?? 'Recording sessions could not be loaded.')
    setSessions(result.sessions ?? [])
    setLoaded(true)
  }, [accessToken])

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}
    try {
      const supabase = createSupabaseBrowserClient()
      void supabase.auth.getSession().then(({ data, error }) => {
        if (error) throw error
        if (active) setAccessToken(data.session?.access_token ?? null)
      }).catch((error: unknown) => {
        if (active) setAuthError(error instanceof Error ? error.message : 'Supabase Auth could not be initialized.')
      })
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setAccessToken(session?.access_token ?? null)
      })
      unsubscribe = () => data.subscription.unsubscribe()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Supabase Auth could not be initialized.')
    }
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!accessToken) {
      setSessions([])
      setLoaded(false)
      return
    }
    let active = true
    setLoading(true)
    refreshSessions().catch((error: unknown) => {
      if (active) setAuthError(error instanceof Error ? error.message : 'Recording sessions could not be loaded.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [accessToken, refreshSessions])

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setAuthError(null)
    setLoading(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setPassword('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Administrator sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    try {
      const { error } = await createSupabaseBrowserClient().auth.signOut()
      if (error) throw error
      setAuthError(null)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Administrator sign-out failed.')
    }
  }

  const live = sessions.filter((session) => session.status === 'live')
  const recent = sessions.filter((session) => session.status !== 'live').slice(0, 8)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">Secure recording access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with a Supabase Auth account whose email is allowlisted for recording review.
            </p>
          </div>
          {accessToken ? (
            <Button variant="outline" className="gap-2" onClick={signOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          ) : (
            <form onSubmit={signIn} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Administrator email
                <input type="email" autoComplete="username" className="h-9 rounded-md border border-border bg-background px-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Password
                <input type="password" autoComplete="current-password" className="h-9 rounded-md border border-border bg-background px-3 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
              <Button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
            </form>
          )}
        </div>
        {authError && <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{authError}</p>}
      </Card>

      {accessToken && <>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><p className="font-heading text-2xl font-bold">{live.length}</p><p className="text-xs text-muted-foreground">Live supervised tests</p></Card>
          <Card><p className="font-heading text-2xl font-bold">{sessions.length}</p><p className="text-xs text-muted-foreground">Sessions recorded</p></Card>
          <Card><p className="font-heading text-2xl font-bold">{sessions.filter((session) => session.recordingId).length}</p><p className="text-xs text-muted-foreground">Saved footage</p></Card>
        </div>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Live supervision</h2>
              <p className="text-sm text-muted-foreground">Active attempts are loaded from persistent storage.</p>
            </div>
            <Badge tone={live.length ? 'danger' : 'neutral'}><CircleDot className="mr-1 h-3 w-3" /> {live.length ? 'Live now' : 'No live tests'}</Badge>
          </div>
          {loading && !loaded ? <p className="py-8 text-center text-sm text-muted-foreground">Loading sessions...</p> : live.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No inspector is taking a supervised test right now.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">{live.map((session) => <SessionCard key={session.id} session={session} />)}</div>
          )}
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="font-heading text-lg font-semibold">Saved supervision footage</h2>
            <p className="text-sm text-muted-foreground">Playback links expire after one hour.</p>
          </div>
          {!loaded ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading recordings...</p>
          ) : recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No completed supervised sessions with saved footage.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {recent.map((session) => (
                <div key={session.id} className="rounded-lg border border-border p-4">
                  <SessionCard session={session} compact />
                  {session.recordingId ? (
                    <Recording session={session} accessToken={accessToken} onDelete={refreshSessions} />
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No recording was saved.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </>}
    </div>
  )
}

function SessionCard({ session, compact = false }: { session: ProctoringSession; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{session.userName}</p>
          <p className="text-sm text-muted-foreground">{session.quizTitle}</p>
        </div>
        <Badge tone={session.status === 'live' ? 'danger' : session.status === 'completed' ? 'success' : 'neutral'}>
          {session.status === 'live' ? 'Live' : session.status}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">Started {formatDate(session.startedAt)}{session.endedAt ? ` · Ended ${formatDate(session.endedAt)}` : ''}</p>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Camera className="h-3.5 w-3.5 text-emerald-600" /> Camera {session.cameraGranted ? 'on' : 'off'}</span>
        <span className="flex items-center gap-1"><Mic className="h-3.5 w-3.5 text-emerald-600" /> Microphone {session.microphoneGranted ? 'on' : 'off'}</span>
        {!compact && <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Supervised</span>}
      </div>
    </div>
  )
}
