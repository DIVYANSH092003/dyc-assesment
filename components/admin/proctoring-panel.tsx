'use client'

import { useEffect, useState } from 'react'
import { Camera, CircleDot, Mic, Play, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge, Card } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { deleteProctoringRecording, getProctoringRecording } from '@/components/proctoring'
import type { ProctoringSession } from '@/lib/types'

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function Recording({ session, onDelete }: { session: ProctoringSession; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function playRecording() {
    if (!session.recordingId) return
    setLoading(true)
    setError(null)
    try {
      const blob = await getProctoringRecording(session.recordingId)
      if (!blob) setError('This footage is no longer available in browser storage.')
      else setUrl(URL.createObjectURL(blob))
    } catch {
      setError('The footage could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])

  if (url) return <div className="mt-3 flex flex-col gap-2"><video controls src={url} className="aspect-video w-full rounded-lg bg-black" /><Button variant="destructive" size="sm" className="w-fit gap-1" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /> Delete footage</Button></div>
  return (
    <div className="mt-3 flex flex-col gap-2"><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="gap-2" onClick={playRecording} disabled={loading}><Play className="h-3.5 w-3.5" /> {loading ? 'Loading recording...' : 'Play saved footage'}</Button><Button variant="destructive" size="sm" className="gap-1" onClick={onDelete} disabled={loading}><Trash2 className="h-3.5 w-3.5" /> Delete footage</Button></div>{error && <p className="text-xs text-destructive">{error}</p>}</div>
  )
}

export function ProctoringPanel({ sessions, onDelete }: { sessions: ProctoringSession[]; onDelete: (session: ProctoringSession) => void }) {
  const live = sessions.filter((session) => session.status === 'live')
  const recent = sessions.filter((session) => session.status !== 'live').slice(0, 8)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="font-heading text-2xl font-bold">{live.length}</p><p className="text-xs text-muted-foreground">Live supervised tests</p></Card>
        <Card><p className="font-heading text-2xl font-bold">{sessions.length}</p><p className="text-xs text-muted-foreground">Sessions recorded</p></Card>
        <Card><p className="font-heading text-2xl font-bold">{sessions.filter((session) => session.recordingId).length}</p><p className="text-xs text-muted-foreground">Saved footage</p></Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold">Live supervision</h2>
            <p className="text-sm text-muted-foreground">Device status updates as supervised tests are in progress.</p>
          </div>
          <Badge tone={live.length ? 'danger' : 'neutral'}><CircleDot className="mr-1 h-3 w-3" /> {live.length ? 'Live now' : 'No live tests'}</Badge>
        </div>
        {live.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No inspector is taking a supervised test right now.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {live.map((session) => <SessionCard key={session.id} session={session} />)}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="font-heading text-lg font-semibold">Saved supervision footage</h2>
          <p className="text-sm text-muted-foreground">Review recordings after a test has been submitted.</p>
        </div>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No completed supervised sessions yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {recent.map((session) => (
              <div key={session.id} className="rounded-lg border border-border p-4">
                <SessionCard session={session} compact />
                {session.recordingId ? <Recording session={session} onDelete={() => onDelete(session)} /> : <p className="mt-3 text-xs text-muted-foreground">No recording was saved.</p>}
              </div>
            ))}
          </div>
        )}
      </Card>
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
