'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, LoaderCircle, Mic, ShieldCheck, Video } from 'lucide-react'
import { Badge, Card } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

export async function saveProctoringRecording(attemptId: string, attemptToken: string, blob: Blob) {
  const contentType = blob.type.split(';', 1)[0] || 'video/webm'
  const signResponse = await fetch('/api/proctoring-recordings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sign-upload', attemptId, attemptToken, contentType }),
  })
  const signedUpload = await signResponse.json() as { path?: string; token?: string; error?: string }
  if (!signResponse.ok || !signedUpload.path || !signedUpload.token) {
    throw new Error(signedUpload.error ?? 'A secure upload link could not be created.')
  }

  const supabase = createSupabaseBrowserClient()
  const { error: uploadError } = await supabase.storage
    .from('inspector-recordings')
    .uploadToSignedUrl(signedUpload.path, signedUpload.token, blob, {
      contentType,
    })
  if (uploadError) throw new Error(uploadError.message)

  const completeResponse = await fetch('/api/proctoring-recordings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'complete', attemptId, attemptToken, path: signedUpload.path }),
  })
  const completion = await completeResponse.json() as { error?: string }
  if (!completeResponse.ok) {
    throw new Error(completion.error ?? 'The recording could not be linked to the assessment.')
  }
}

export function ProctoringIntro({
  onStart,
}: {
  onStart: (stream: MediaStream) => Promise<void>
}) {
  const [requesting, setRequesting] = useState(false)
  const [consented, setConsented] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function requestDevices() {
    setRequesting(true)
    setError(null)
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      await onStart(stream)
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())
      setError(error instanceof Error ? error.message : 'Camera and microphone access is required to start this supervised test. Check browser permissions and try again.')
      setRequesting(false)
    }
  }

  return (
    <Card className="flex flex-col gap-4 border-primary/30 bg-primary/5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-heading font-semibold">Supervised test</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your camera and microphone stay active during the assessment. The recording is uploaded to private storage for administrator review.
          </p>
        </div>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-md bg-card px-3 py-2"><Camera className="h-4 w-4 text-primary" /> Camera required</div>
        <div className="flex items-center gap-2 rounded-md bg-card px-3 py-2"><Mic className="h-4 w-4 text-primary" /> Microphone required</div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={consented}
          onChange={(event) => setConsented(event.target.checked)}
        />
        <span>I understand that this assessment is recorded using my camera and microphone and that the recording is stored for administrator review.</span>
      </label>
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button onClick={requestDevices} disabled={requesting || !consented}>
        {requesting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Checking devices...</> : 'Allow devices and start test'}
      </Button>
    </Card>
  )
}

export function ProctoringMonitor({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [stream])

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-destructive" />
          <span className="font-heading text-sm font-semibold">Supervision active</span>
        </div>
        <Badge tone="danger">Recording</Badge>
      </div>
      <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-lg bg-black object-cover" />
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-emerald-600" /> Camera on</span>
        <span className="flex items-center gap-1.5"><Mic className="h-3.5 w-3.5 text-emerald-600" /> Microphone on</span>
      </div>
    </Card>
  )
}
