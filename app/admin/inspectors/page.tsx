'use client'

import { useState } from 'react'
import { AuthGate } from '@/components/auth-gate'
import { Badge, Card, Select } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'
import { ProctoringPanel } from '@/components/admin/proctoring-panel'
import type { ScopeSector } from '@/lib/types'

const scopeSectors: ScopeSector[] = [
  'NABCB IAF SCOPE 17',
  'NABCB IAF SCOPE 18',
  'NABCB IAF SCOPE 17 & 18',
  'NABCB IAF SCOPE 19',
  'NABCB IAF SCOPE 28',
  'Coating',
  'Other',
]

function normalizeScopeValue(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function matchesScopeSector(quizSector: string | undefined, selectedSector: string) {
  if (!quizSector) return true
  const normalizedQuizSector = normalizeScopeValue(quizSector)
  const normalizedSelectedSector = normalizeScopeValue(selectedSector)
  if (normalizedQuizSector === normalizedSelectedSector) return true

  const quizScopes = normalizedQuizSector.match(/nabcb iaf scope \d+/g)
  const selectedScopes = normalizedSelectedSector.match(/nabcb iaf scope \d+/g)
  return Boolean(quizScopes?.some((scope) => selectedScopes?.includes(scope)))
}

export default function AdminInspectorsPage() {
  return (
    <AuthGate role="admin">
      <InspectorInformation />
    </AuthGate>
  )
}

function InspectorInformation() {
  const { users, quizzes, trainingResources, updateUser } = useQuizStore()
  const [activeTab, setActiveTab] = useState<'information' | 'assignment' | 'monitoring'>('information')
  const people = users.filter((user) => user.role === 'inspector')
  const [selectedUserId, setSelectedUserId] = useState(people[0]?.id ?? '')
  const [selectedQuizId, setSelectedQuizId] = useState('')
  const [selectedTrainingId, setSelectedTrainingId] = useState('')
  const [conductedBy, setConductedBy] = useState('Technical Manager')
  const [evaluatorDesignation, setEvaluatorDesignation] = useState('')
  const initialUser = people[0]
  const [name, setName] = useState(initialUser?.name ?? '')
  const [inspectorId, setInspectorId] = useState(initialUser?.inspectorId ?? '')
  const [inspectorSignature, setInspectorSignature] = useState(initialUser?.inspectorSignature ?? '')
  const [designation, setDesignation] = useState(initialUser?.designation ?? '')
  const [department, setDepartment] = useState(initialUser?.department ?? '')
  const [location, setLocation] = useState(initialUser?.location ?? '')
  const [scopeSector, setScopeSector] = useState<ScopeSector | ''>(initialUser?.scopeSector ?? '')
  const [assessmentDate, setAssessmentDate] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const selectedUser = people.find((user) => user.id === selectedUserId)
  const availableScopeSectors = Array.from(new Set([
    ...scopeSectors,
    ...users.map((user) => user.scopeSector ?? ''),
    ...users.flatMap((user) => (user.testAssignments ?? []).map((assignment) => assignment.scopeSector ?? '')),
    ...quizzes.map((quiz) => quiz.scopeSector ?? ''),
  ].map((sector) => sector.trim()).filter(Boolean))).sort((first, second) => first.localeCompare(second))
  const availableTests = quizzes
    .filter(
      (quiz) => (quiz.targetRole ?? 'inspector') === selectedUser?.role
      && (!scopeSector || matchesScopeSector(quiz.scopeSector, scopeSector))
    )
    .sort((first, second) => first.title.localeCompare(second.title))

  function selectPerson(id: string) {
    const user = people.find((person) => person.id === id)
    setSelectedUserId(id)
    setSelectedQuizId('')
    setName(user?.name ?? '')
    setInspectorId(user?.inspectorId ?? '')
    setInspectorSignature(user?.inspectorSignature ?? '')
    setDesignation(user?.designation ?? '')
    setDepartment(user?.department ?? '')
    setLocation(user?.location ?? '')
    setScopeSector(user?.scopeSector ?? '')
    setAssessmentDate('')
    setMessage(null)
  }

  async function saveInformation() {
    if (!selectedUser || !name.trim() || !designation.trim()) {
      setMessage('Complete the inspector name and designation.')
      return
    }
    try {
      await updateUser(selectedUser.id, {
        name: name.trim(),
        inspectorId: inspectorId.trim() || undefined,
        inspectorSignature: inspectorSignature || null,
        designation: designation.trim(),
        department: department.trim() || undefined,
        location: location.trim() || undefined,
      })
      setMessage('Inspector information saved.')
    } catch (error) {
      setMessage(error instanceof Error ? `Inspector information could not be saved: ${error.message}` : 'Inspector information could not be saved.')
    }
  }

  function selectQuiz(id: string) {
    setSelectedQuizId(id)
    const assignment = selectedUser?.testAssignments?.find((item) => item.quizId === id)
    const quiz = quizzes.find((item) => item.id === id)
    if (assignment) {
      setAssessmentDate(assignment.assessmentDate ?? '')
      setScopeSector(assignment.scopeSector ?? quiz?.scopeSector ?? '')
    } else {
      setAssessmentDate('')
      setScopeSector(quiz?.scopeSector ?? scopeSector)
    }
  }

  async function assignTest() {
    if (!selectedUser || !selectedQuizId || !assessmentDate || !scopeSector) {
      setMessage('Select an inspector, scope sector, assessment date, and test.')
      return
    }
    if (!availableTests.some((quiz) => quiz.id === selectedQuizId)) {
      setMessage('That test is no longer available for the selected scope sector. Choose a test from the current list.')
      setSelectedQuizId('')
      return
    }
    const assignedQuizIds = Array.from(new Set([...(selectedUser.assignedQuizIds ?? []), selectedQuizId]))
    const testAssignments = [
      ...(selectedUser.testAssignments ?? []).filter((assignment) => assignment.quizId !== selectedQuizId),
      { quizId: selectedQuizId, conductedBy: conductedBy.trim() || 'Technical Manager', evaluatorDesignation: evaluatorDesignation.trim() || undefined, assignedAt: Date.now(), assessmentDate, scopeSector },
    ]
    try {
      await updateUser(selectedUser.id, { assignedQuizIds, testAssignments })
      setMessage('Test assigned successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? `Test assignment could not be saved: ${error.message}` : 'Test assignment could not be saved.')
    }
  }

  async function removeAssignment(quizId: string) {
    if (!selectedUser) return
    try {
      await updateUser(selectedUser.id, {
        assignedQuizIds: (selectedUser.assignedQuizIds ?? []).filter((id) => id !== quizId),
        testAssignments: (selectedUser.testAssignments ?? []).filter((assignment) => assignment.quizId !== quizId),
      })
      setMessage('Assignment removed.')
    } catch (error) {
      setMessage(error instanceof Error ? `Assignment could not be removed: ${error.message}` : 'Assignment could not be removed.')
    }
  }

  async function assignTraining() {
    if (!selectedUser || !selectedTrainingId) {
      setMessage('Select an inspector and a training resource first.')
      return
    }
    try {
      await updateUser(selectedUser.id, { assignedTrainingIds: Array.from(new Set([...(selectedUser.assignedTrainingIds ?? []), selectedTrainingId])) })
      setMessage('Training assigned successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? `Training assignment could not be saved: ${error.message}` : 'Training assignment could not be saved.')
    }
  }

  async function removeTrainingAssignment(trainingId: string) {
    if (!selectedUser) return
    try {
      await updateUser(selectedUser.id, { assignedTrainingIds: (selectedUser.assignedTrainingIds ?? []).filter((id) => id !== trainingId) })
      setMessage('Training assignment removed.')
    } catch (error) {
      setMessage(error instanceof Error ? `Training assignment could not be removed: ${error.message}` : 'Training assignment could not be removed.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Inspector information</h1>
        <p className="text-sm text-muted-foreground">
          Review information submitted before the test and assign a specific test to an inspector or user.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button type="button" onClick={() => setActiveTab('information')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'information' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
          Inspector information
        </button>
        <button type="button" onClick={() => setActiveTab('assignment')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'assignment' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
          Assign test
        </button>
        <button type="button" onClick={() => setActiveTab('monitoring')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'monitoring' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
          Live monitoring & footage
        </button>
      </div>

      {activeTab === 'monitoring' ? (
        <ProctoringPanel />
      ) : activeTab === 'information' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <Card className="flex flex-col gap-5">
            <div>
              <h2 className="font-heading text-lg font-semibold">Inspector information</h2>
              <p className="mt-1 text-sm text-muted-foreground">The Technical Manager can fill or update inspector information here.</p>
            </div>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Inspector or user</span><Select value={selectedUserId} onChange={(event) => selectPerson(event.target.value)}><option value="">Select a person</option>{people.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</Select></label>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Name</span><input className="h-11 rounded-xl border border-border bg-background px-3 text-sm" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Inspector ID</span><input className="h-11 rounded-xl border border-border bg-background px-3 text-sm" value={inspectorId} onChange={(event) => setInspectorId(event.target.value)} placeholder="Enter inspector ID" /></label>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Inspector signature</span>
                <input
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                      setMessage('Choose a PNG, JPEG, or WebP image for the inspector signature.')
                      event.target.value = ''
                      return
                    }
                    if (file.size > 1024 * 1024) {
                      setMessage('The inspector signature image must be 1 MB or smaller.')
                      event.target.value = ''
                      return
                    }
                    const reader = new FileReader()
                    reader.onload = () => {
                      if (typeof reader.result === 'string') {
                        setInspectorSignature(reader.result)
                        setMessage(null)
                      }
                    }
                    reader.onerror = () => setMessage('Unable to read the signature image. Please try another file.')
                    reader.readAsDataURL(file)
                  }}
                />
                <span className="text-xs text-muted-foreground">Upload a PNG, JPEG, or WebP image (maximum 1 MB). It will appear on this inspector&apos;s answer sheets.</span>
              </label>
              {inspectorSignature && (
                <div className="flex items-center gap-3">
                  <img src={inspectorSignature} alt="Inspector signature preview" className="max-h-16 max-w-48 border border-border bg-white p-2 object-contain" />
                  <Button type="button" variant="outline" onClick={() => setInspectorSignature('')}>Remove signature</Button>
                </div>
              )}
            </div>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Designation</span><input className="h-11 rounded-xl border border-border bg-background px-3 text-sm" value={designation} onChange={(event) => setDesignation(event.target.value)} /></label>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Department</span><input className="h-11 rounded-xl border border-border bg-background px-3 text-sm" value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Enter department" /></label>
            <label className="flex flex-col gap-1.5"><span className="text-sm font-semibold">Location</span><input className="h-11 rounded-xl border border-border bg-background px-3 text-sm" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Enter city or site" /></label>
            <Button onClick={saveInformation}>Save information</Button>
            {message && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
          </Card>
          {selectedUser ? <Card className="flex flex-col gap-3"><Badge tone="primary">{selectedUser.role}</Badge><h2 className="font-heading text-lg font-semibold">{selectedUser.name}</h2><p className="text-sm text-muted-foreground">{selectedUser.email}</p><p className="text-sm"><strong>Inspector ID:</strong> {selectedUser.inspectorId || 'Not provided'}</p></Card> : <Card className="py-12 text-center text-sm text-muted-foreground">Select a person to view their information.</Card>}
        </div>
      ) : (
      <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <Card className="flex flex-col gap-5">
          <div>
            <h2 className="font-heading text-lg font-semibold">Inspector assignment</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose the person and the test they should complete.</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Inspector or user</span>
            <Select value={selectedUserId} onChange={(event) => selectPerson(event.target.value)}>
              <option value="">Select a person</option>
              {people.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Scope sector</span>
            <input
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              list="assignment-scope-sectors"
              value={scopeSector}
              onChange={(event) => { setScopeSector(event.target.value); setSelectedQuizId('') }}
              placeholder="Select or type a scope sector"
            />
            <datalist id="assignment-scope-sectors">
              {availableScopeSectors.map((sector) => <option key={sector} value={sector} />)}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Date of Assessment</span>
            <input className="h-11 rounded-xl border border-border bg-background px-3 text-sm" type="date" value={assessmentDate} onChange={(event) => setAssessmentDate(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Test</span>
            <Select value={selectedQuizId} onChange={(event) => selectQuiz(event.target.value)} disabled={!scopeSector || !selectedUser}>
              <option value="">
                {!selectedUser
                  ? 'Select an inspector first'
                  : !scopeSector
                    ? 'Select a scope sector first'
                    : availableTests.length
                      ? 'Select a test for this scope sector'
                      : 'No tests available for this scope sector'}
              </option>
              {availableTests.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
            </Select>
            {scopeSector && availableTests.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {availableTests.length} {availableTests.length === 1 ? 'test' : 'tests'} available for this scope sector.
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Test Conducted by</span>
            <input className="h-11 rounded-xl border border-border bg-background px-3 text-sm" value={conductedBy} onChange={(event) => setConductedBy(event.target.value)} placeholder="Technical Manager" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Conductor Designation</span>
            <input className="h-11 rounded-xl border border-border bg-background px-3 text-sm" value={evaluatorDesignation} onChange={(event) => setEvaluatorDesignation(event.target.value)} placeholder="Technical Manager" />
          </label>
          <Button onClick={assignTest}>Assign test</Button>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Training</span>
            <div className="flex gap-2">
              <Select className="min-w-0 flex-1" value={selectedTrainingId} onChange={(event) => setSelectedTrainingId(event.target.value)}>
                <option value="">Select training resource</option>
                {trainingResources.map((resource) => <option key={resource.id} value={resource.id}>{resource.title}</option>)}
              </Select>
              <Button onClick={assignTraining}>Assign</Button>
            </div>
          </label>
          {message && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{message}</p>}
        </Card>

        {selectedUser ? (
          <Card className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone="primary">{selectedUser.role}</Badge>
                <h2 className="mt-2 font-heading text-lg font-semibold">{selectedUser.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              <p><strong>Inspector ID:</strong> {selectedUser.inspectorId || 'Not provided'}</p>
              <p><strong>Designation:</strong> {selectedUser.designation || 'Not provided'}</p>
              <p><strong>Assigned tests:</strong> {selectedUser.assignedQuizIds?.length ?? 0}</p>
            </div>
          </Card>
        ) : (
          <Card className="py-12 text-center text-sm text-muted-foreground">Select a person to view their information.</Card>
        )}
      </div>

      {selectedUser && (
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Assigned tests</h2>
              <p className="text-sm text-muted-foreground">Only these tests are shown when assignments exist.</p>
            </div>
            <Badge tone="neutral">{selectedUser.assignedQuizIds?.length ?? 0} assigned</Badge>
          </div>
          {(selectedUser.assignedQuizIds?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No tests assigned to this inspector.</p>
          ) : (
            <ul className="divide-y divide-border">
              {selectedUser.assignedQuizIds?.map((quizId) => {
                const quiz = quizzes.find((item) => item.id === quizId)
                if (!quiz) return null
                const assignment = selectedUser.testAssignments?.find((item) => item.quizId === quiz.id)
                return (
                  <li key={quiz.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0 text-sm font-medium">{quiz.title}<span className="block text-xs font-normal text-muted-foreground">{assignment?.scopeSector ?? selectedUser.scopeSector ?? 'Scope not set'}</span><span className="block text-xs font-normal text-muted-foreground">{assignment?.assessmentDate ?? 'Date not set'} · {assignment?.scheduledSlot ? `${assignment.scheduledSlot} · ` : ''}{assignment?.durationMinutes ?? quiz.durationMinutes} min</span><span className="block text-xs font-normal text-muted-foreground">Conducted by: {assignment?.conductedBy ?? 'Technical Manager'} · Conductor Designation: {assignment?.evaluatorDesignation ?? 'Not provided'}</span></span>
                    <Button variant="ghost" size="sm" onClick={() => removeAssignment(quiz.id)}>Remove</Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}
      {selectedUser && (
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Assigned training</h2>
              <p className="text-sm text-muted-foreground">Only these resources are visible to this inspector.</p>
            </div>
            <Badge tone="neutral">{selectedUser.assignedTrainingIds?.length ?? 0} assigned</Badge>
          </div>
          {(selectedUser.assignedTrainingIds?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No training assigned to this inspector.</p> : <ul className="divide-y divide-border">{selectedUser.assignedTrainingIds?.map((trainingId) => { const resource = trainingResources.find((item) => item.id === trainingId); if (!resource) return null; return <li key={resource.id} className="flex items-center justify-between gap-3 py-3"><span className="text-sm font-medium">{resource.title}</span><Button variant="ghost" size="sm" onClick={() => removeTrainingAssignment(resource.id)}>Remove</Button></li> })}</ul>}
        </Card>
      )}
      </>
      )}
    </div>
  )
}
