'use client'

import { useState } from 'react'
import { FileText, Pencil, Plus, Trash2, Video } from 'lucide-react'
import { AuthGate } from '@/components/auth-gate'
import { Badge, Card, Label, Select, TextArea, TextInput } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'
import { deleteTrainingFile, getTrainingFile, saveTrainingFile } from '@/components/training-storage'
import type { TrainingAssetType, TrainingResource } from '@/lib/types'

function makeResource(): TrainingResource {
  return { id: `training-${Date.now()}`, type: 'video', title: '', url: '', description: '', audience: 'inspector' }
}

const fileTypes = '.ppt,.pptx,.doc,.docx,.xls,.xlsx,.pdf,.mp4,.mp3'
const MAX_FILE_SIZE = 1024 * 1024 * 1024

function getResourceType(file: File): TrainingAssetType {
  if (file.type.startsWith('video/') || /\.mp4$/i.test(file.name)) return 'video'
  if (file.type.startsWith('audio/') || /\.mp3$/i.test(file.name)) return 'audio'
  return 'document'
}

export default function AdminTrainingPage() {
  return <AuthGate role="admin"><TrainingManager /></AuthGate>
}

function TrainingManager() {
  const { trainingResources, saveTrainingResource, deleteTrainingResource } = useQuizStore()
  const [draft, setDraft] = useState<TrainingResource | null>(null)
  const [error, setError] = useState('')

  function patch(value: Partial<TrainingResource>) {
    setDraft((current) => current ? { ...current, ...value } : current)
  }

  async function removeResource(resource: TrainingResource) {
    if (!window.confirm(`Delete ${resource.title}?`)) return
    if (resource.url.startsWith('training-file:')) await deleteTrainingFile(resource.url.slice('training-file:'.length))
    deleteTrainingResource(resource.id)
  }

  function save() {
    if (!draft?.title.trim() || !draft.url.trim()) {
      setError('Add a title and resource URL.')
      return
    }
    if (!draft.url.startsWith('data:')) {
      try { new URL(draft.url) } catch {
        setError('Enter a valid resource URL or choose a file.')
        return
      }
    }
    saveTrainingResource(draft)
    setDraft(null)
    setError('')
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setError('Files must be 1 GB or smaller.')
      event.target.value = ''
      return
    }
    try {
      const fileId = `training-file-${Date.now()}`
      await saveTrainingFile(fileId, file)
      await getTrainingFile(fileId)
      setDraft((current) => current ? {
        ...current,
        type: getResourceType(file),
        title: current.title || file.name.replace(/\.[^.]+$/, ''),
        url: `training-file:${fileId}`,
        fileName: file.name,
      } : current)
      setError('')
    } catch {
      setError('The file could not be stored. Check available browser storage and try again.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Training</h1>
          <p className="text-sm text-muted-foreground">Add videos, presentations, and documents for learners.</p>
        </div>
        <Button onClick={() => { setDraft(makeResource()); setError('') }} className="gap-2"><Plus className="h-4 w-4" /> Add resource</Button>
      </div>

      {draft && (
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between"><h2 className="font-heading text-lg font-semibold">{trainingResources.some((item) => item.id === draft.id) ? 'Edit resource' : 'New resource'}</h2><Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button></div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5"><Label>Resource type</Label><Select value={draft.type} onChange={(e) => patch({ type: e.target.value as TrainingAssetType })}><option value="video">Video / MP4</option><option value="audio">Audio / MP3</option><option value="document">PPT, Word, Excel, or PDF</option></Select></div>
            <div className="flex flex-col gap-1.5"><Label>Audience</Label><Select value={draft.audience} disabled><option value="inspector">Inspectors</option></Select></div>
          </div>
          <div className="flex flex-col gap-1.5"><Label>Title</Label><TextInput value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. DYC induction" /></div>
          <div className="flex flex-col gap-1.5"><Label>Upload file</Label><TextInput type="file" accept={fileTypes} onChange={handleFile} className="h-auto py-2" /><p className="text-xs text-muted-foreground">Supported: PowerPoint, Word, Excel, PDF, MP4, and MP3. Maximum 1 GB per file.</p></div>
          <div className="flex flex-col gap-1.5"><Label>Or use a resource URL</Label><TextInput type="url" value={draft.url.startsWith('data:') ? '' : draft.url} onChange={(e) => patch({ url: e.target.value, fileName: undefined })} placeholder="YouTube, Vimeo, Google Drive, or hosted file URL" />{draft.fileName && <p className="text-xs text-emerald-700">Selected file: {draft.fileName}</p>}</div>
          <div className="flex flex-col gap-1.5"><Label>Description (optional)</Label><TextArea value={draft.description ?? ''} onChange={(e) => patch({ description: e.target.value })} placeholder="What should learners focus on?" /></div>
          <Button onClick={save}>Save resource</Button>
        </Card>
      )}

      {trainingResources.length === 0 ? <Card className="py-16 text-center"><p className="text-sm text-muted-foreground">No inspector training resources yet.</p></Card> : <div className="grid gap-4 md:grid-cols-2">{trainingResources.map((item) => <Card key={item.id} className="flex flex-col gap-4"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3">{item.type === 'video' ? <Video className="mt-1 h-5 w-5 text-primary" /> : <FileText className="mt-1 h-5 w-5 text-primary" />}<div><h2 className="font-heading font-semibold">{item.title}</h2><p className="text-sm text-muted-foreground">{item.type === 'video' ? 'MP4 / video' : item.type === 'audio' ? 'MP3 / audio' : 'PPT, Word, Excel, or PDF'}</p>{item.fileName && <p className="text-xs text-muted-foreground">{item.fileName}</p>}</div></div><Badge>Inspectors</Badge></div>{item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}<div className="flex gap-2 border-t border-border pt-4"><Button variant="outline" size="sm" className="gap-1" onClick={() => { setDraft(item); setError('') }}><Pencil className="h-3.5 w-3.5" /> Edit</Button><Button variant="ghost" size="sm" className="ml-auto gap-1 text-destructive hover:text-destructive" onClick={() => removeResource(item)}><Trash2 className="h-3.5 w-3.5" /> Delete</Button></div></Card>)}</div>}
    </div>
  )
}