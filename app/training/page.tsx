'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FileText, Maximize2, Video, Volume2 } from 'lucide-react'
import { AuthGate } from '@/components/auth-gate'
import { Badge, Card } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'
import { getTrainingFile } from '@/components/training-storage'

function getVideoEmbedUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${url.pathname.slice(1).split('/')[0]}`
    }
    if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) {
      const videoId = url.searchParams.get('v')
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
      if (url.pathname.startsWith('/shorts/')) {
        return `https://www.youtube.com/embed/${url.pathname.split('/')[2]}`
      }
      if (url.pathname.startsWith('/embed/')) return value
    }
    if (url.hostname === 'vimeo.com') {
      const videoId = url.pathname.split('/').filter(Boolean)[0]
      if (videoId) return `https://player.vimeo.com/video/${videoId}`
    }
    if (url.hostname === 'drive.google.com') {
      const match = url.pathname.match(/\/file\/d\/([^/]+)/)
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
    }
  } catch {
    return null
  }
  return null
}

function TrainingVideo({ url, onComplete }: { url: string; onComplete: () => void }) {
  const embedUrl = getVideoEmbedUrl(url)
  if (embedUrl) {
    return (
      <iframe
        className="aspect-video w-full rounded-md bg-black"
        src={embedUrl}
        title="Training video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={onComplete}
      />
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <video className="aspect-video w-full rounded-md bg-black" controls controlsList="nodownload noplaybackrate" disablePictureInPicture src={url} onLoadedData={onComplete} onEnded={onComplete} onContextMenu={(event) => event.preventDefault()} />
    </div>
  )
}

function FullscreenFrame({ children, title }: { children: React.ReactNode; title: string }) {
  const frameRef = useRef<HTMLDivElement>(null)
  return <div ref={frameRef} className="training-fullscreen-frame relative overflow-hidden rounded-md border border-border bg-muted" onContextMenu={(event) => event.preventDefault()}>
    {children}
    <button type="button" title="View fullscreen" aria-label={`View ${title} fullscreen`} onClick={() => frameRef.current?.requestFullscreen()} className="absolute bottom-2 right-2 rounded-md bg-black/70 p-2 text-white hover:bg-black"><Maximize2 className="h-4 w-4" /></button>
  </div>
}

function TrainingResourceView({ type, url, title, onComplete }: { type: 'video' | 'audio' | 'document'; url: string; title: string; onComplete: () => void }) {
  const [source, setSource] = useState(url)
  const [mimeType, setMimeType] = useState('')
  const [fileName, setFileName] = useState('')
  const [loadingError, setLoadingError] = useState<string | null>(null)

  useEffect(() => {
    if (!url.startsWith('training-file:')) {
      setSource(url)
      setMimeType('')
      setFileName('')
      setLoadingError(null)
      return
    }
    let objectUrl: string | null = null
    setSource('')
    setLoadingError(null)
    getTrainingFile(url.slice('training-file:'.length)).then((file) => {
      objectUrl = URL.createObjectURL(file)
      setMimeType(file.type)
      setFileName(file instanceof File ? file.name : '')
      setSource(objectUrl)
    }).catch((error: unknown) => {
      setLoadingError(error instanceof Error ? error.message : 'This training file could not be opened.')
    })
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [url])

  if (loadingError) return <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-4 text-center text-sm text-destructive"><p>{loadingError}</p><p className="text-xs text-muted-foreground">Ask the administrator to upload this resource again from the Training page.</p></div>
  if (!source) return <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">Preparing secure viewer...</div>
  if (type === 'video') return <TrainingVideo url={source} onComplete={onComplete} />
  if (type === 'audio') return <div className="flex items-center gap-3 rounded-md border border-border bg-muted p-3"><Volume2 className="h-5 w-5 text-primary" /><audio className="w-full" controls controlsList="nodownload" src={source} onLoadedData={onComplete} onEnded={onComplete} onContextMenu={(event) => event.preventDefault()} /></div>

  const officeViewer = /^https?:\/\//i.test(source) && /\.(pptx?|docx?)($|\?)/i.test(source)
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(source)}`
    : source
  const isPdf = mimeType === 'application/pdf' || officeViewer.toLowerCase().includes('.pdf')
  const isOfficeBlob = source.startsWith('blob:') && !isPdf
  if (isOfficeBlob) return <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-5 text-center"><FileText className="h-8 w-8 text-amber-700" /><p className="font-semibold text-amber-950">{fileName || title}</p><p className="text-sm text-amber-900">This Office file is stored securely, but this browser cannot render a private Word, PowerPoint, or Excel file inside an embedded frame.</p><p className="text-xs text-amber-800">Ask the administrator to provide a hosted viewer link for this resource.</p></div>
  const documentSource = isPdf ? `${officeViewer}#toolbar=0&navpanes=0&scrollbar=0` : officeViewer
  return (
    <FullscreenFrame title={title}>
      <iframe className="h-[28rem] w-full bg-white" src={documentSource} title={title} onLoad={onComplete} sandbox={isPdf ? undefined : 'allow-scripts allow-same-origin'} />
      {isPdf && <div aria-hidden="true" className="pointer-events-auto absolute inset-x-0 bottom-0 h-12 bg-muted" />}
    </FullscreenFrame>
  )
}

export default function TrainingPage() {
  return (
    <AuthGate role="inspector">
      <TrainingLibrary />
    </AuthGate>
  )
}

function TrainingLibrary() {
  const { trainingResources, currentUser, completeTrainingResource } = useQuizStore()
  const sharedResources = trainingResources.filter(
    (item) => currentUser?.assignedTrainingIds?.includes(item.id),
  )
  const completedResources = currentUser?.trainingCompletedIds ?? []
  const allTrainingViewed = sharedResources.length === 0 || sharedResources.every((item) => completedResources.includes(item.id))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Training</h1>
        <p className="text-sm text-muted-foreground">
          Review the training resources assigned to your available assessments.
        </p>
      </div>

      {sharedResources.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground">No training resources are available right now.</p>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          <div>
            <Badge tone="accent">General training</Badge>
            <h2 className="mt-2 font-heading text-lg font-semibold">Training library</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {sharedResources.map((item) => {
              const viewed = completedResources.includes(item.id)
              return (
              <Card key={item.id} className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="rounded-md bg-secondary p-2 text-primary">
                    {item.type === 'video' ? <Video className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </span>
                  <div>
                    <p className="font-heading font-semibold">{item.title}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {item.type === 'video' ? 'Training video' : item.type === 'audio' ? 'Training audio' : 'Training document'}
                    </p>
                  </div>
                </div>
                {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                <TrainingResourceView type={item.type} url={item.url} title={item.title} onComplete={() => completeTrainingResource(item.id)} />
                <p className={`text-xs font-medium ${viewed ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                  {viewed ? 'Training completed' : 'Complete this resource by opening it and finishing playback where applicable.'}
                </p>
              </Card>
              )
            })}
          </div>
        </section>
      )}

      <Card className="flex flex-col gap-3">
        <div>
          <Badge tone="primary">Next step</Badge>
          <h2 className="mt-2 font-heading text-lg font-semibold">Ready for your assessment?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete your training first, then open an assessment from the tests tab.
          </p>
        </div>
        <Button
          render={allTrainingViewed ? <Link href="/inspector" /> : undefined}
          className="w-fit"
          disabled={!allTrainingViewed}
        >
          View available tests
        </Button>
      </Card>
    </div>
  )
}