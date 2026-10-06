'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Attempt, ProctoringSession, Question, Quiz, TrainingResource, User } from '@/lib/types'
import { isPassingEvaluation } from '@/lib/evaluation'
import { toSharedInspectorProfile, type SharedInspectorProfile } from '@/lib/inspector-profile-shared'
import { seedAttempts, seedQuizzes, seedUsers } from '@/lib/sample-data'
import { createImportedInspectorResults } from '@/lib/imported-results'
import { deleteProctoringRecording } from '@/components/proctoring'
import commodityQuizData from '@/data/inspector-commodity-quizzes.json'
import inspectorTimetableData from '@/data/inspector-timetable-users.json'

const STORAGE_KEY = 'dyc-quiz-state-v3'
const LEGACY_STORAGE_KEYS = ['dyc-quiz-state-v2', 'dyc-quiz-state-v1']
const CANONICAL_ADMIN = seedUsers.find((user) => user.role === 'admin') as User
const commodityQuizzes = commodityQuizData as unknown as Quiz[]
const commodityQuizIds = new Set(commodityQuizzes.map((quiz) => quiz.id))
const commodityQuizById = new Map(commodityQuizzes.map((quiz) => [quiz.id, quiz]))
const timetableInspectors = inspectorTimetableData as unknown as User[]
const TIMETABLE_IMPORT_VERSION = 2
const importedInspectorResults = createImportedInspectorResults(timetableInspectors, commodityQuizzes)

function mergePersistedQuizzes(savedQuizzes: Quiz[], removedIds: string[] = []) {
  const removedCommodityQuizIds = new Set(removedIds)
  const savedCommodityQuizzes = new Map(savedQuizzes
    .filter((quiz) => commodityQuizIds.has(quiz.id))
    .map((quiz) => [quiz.id, quiz]))
  const userQuizzes = savedQuizzes.filter((quiz) => !commodityQuizIds.has(quiz.id))
  const availableCommodityQuizzes = commodityQuizzes
    .filter((quiz) => !removedCommodityQuizIds.has(quiz.id))
    .map((quiz) => {
      const savedQuiz = savedCommodityQuizzes.get(quiz.id)
      if (!savedQuiz) return quiz
      return {
        ...quiz,
        ...savedQuiz,
        scopeSector: quiz.scopeSector === 'Coating' && savedQuiz.scopeSector === 'Other'
          ? quiz.scopeSector
          : savedQuiz.scopeSector ?? quiz.scopeSector,
      }
    })
  return [...userQuizzes, ...availableCommodityQuizzes]
}

interface PersistedState {
  users: User[]
  quizzes: Quiz[]
  inspectorTimetableImportVersion?: number
  removedCommodityQuizIds?: string[]
  trainingResources?: TrainingResource[]
  attempts: Attempt[]
  proctoringSessions?: ProctoringSession[]
  currentUserId: string | null
}

interface QuizContextValue {
  ready: boolean
  currentUser: User | null
  users: User[]
  quizzes: Quiz[]
  trainingResources: TrainingResource[]
  attempts: Attempt[]
  proctoringSessions: ProctoringSession[]
  login: (email: string, password: string) => { ok: boolean; error?: string }
  resetAdminPassword: (password: string) => { ok: boolean; error?: string }
  createAccount: (name: string, email: string, password: string, role: 'inspector' | 'tc_qa') => { ok: boolean; error?: string }
  updateUser: (id: string, updates: Partial<User>) => void
  deleteUser: (id: string) => { ok: boolean; error?: string }
  changeUserPassword: (id: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  saveQuiz: (quiz: Quiz) => void
  saveTrainingResource: (resource: TrainingResource) => void
  deleteTrainingResource: (id: string) => void
  completeTrainingResource: (id: string) => void
  deleteQuiz: (id: string) => void
  beginAttempt: (quiz: Quiz) => Promise<{ attemptId: string; attemptNumber: number; attemptToken: string }>
  submitAttempt: (quiz: Quiz, answers: Record<string, string[]>, timeSpent: number, attemptId: string, attemptToken: string) => Promise<Attempt>
  startProctoringSession: (quiz: Quiz, cameraGranted: boolean, microphoneGranted: boolean) => ProctoringSession
  finishProctoringSession: (id: string, status: 'completed' | 'interrupted', attemptId?: string, recordingId?: string) => void
  deleteProctoringSession: (id: string) => Promise<{ ok: boolean; error?: string }>
}

const QuizContext = createContext<QuizContextValue | null>(null)

function mergeTimetableInspectors(users: User[]) {
  const mergedUsers = [...users]
  for (const importedInspector of timetableInspectors) {
    const existingIndex = mergedUsers.findIndex((user) => user.email.toLowerCase() === importedInspector.email.toLowerCase())
    if (existingIndex === -1) {
      mergedUsers.push(importedInspector)
      continue
    }

    const existing = mergedUsers[existingIndex]
    const importedQuizIds = new Set(importedInspector.assignedQuizIds ?? [])
    mergedUsers[existingIndex] = {
      ...existing,
      name: importedInspector.name,
      email: importedInspector.email,
      password: importedInspector.password,
      role: 'inspector',
      assessmentDate: importedInspector.assessmentDate,
      scopeSector: importedInspector.scopeSector,
      scope17Category: importedInspector.scope17Category ?? existing.scope17Category,
      scope18Category: importedInspector.scope18Category ?? existing.scope18Category,
      scope19Category: importedInspector.scope19Category ?? existing.scope19Category,
      scope28Category: importedInspector.scope28Category ?? existing.scope28Category,
      assignedQuizIds: Array.from(new Set([...(existing.assignedQuizIds ?? []), ...(importedInspector.assignedQuizIds ?? [])])),
      testAssignments: [
        ...(existing.testAssignments ?? []).filter((assignment) => !importedQuizIds.has(assignment.quizId)),
        ...(importedInspector.testAssignments ?? []),
      ],
    }
  }
  return mergedUsers
}

function mergeSharedInspectorProfiles(users: User[], profiles: SharedInspectorProfile[]) {
  let changed = false
  const mergedUsers = users.map((user) => {
    if (user.role !== 'inspector') return user
    const profile = profiles.find((saved) => saved.id === user.id || saved.email.toLowerCase() === user.email.toLowerCase())
    if (!profile || JSON.stringify(toSharedInspectorProfile(user)) === JSON.stringify(profile)) return user
    changed = true
    return { ...user, ...profile, password: user.password }
  })
  return changed ? mergedUsers : users
}

function scoreQuiz(quiz: Quiz, answers: Record<string, string[]>) {
  let score = 0
  let maxScore = 0
  for (const q of quiz.questions) {
    maxScore += q.points
    const selected = answers[q.id] ?? []
    if (isCorrect(q, selected)) score += q.points
  }
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  return { score, maxScore, percentage, passed: isPassingEvaluation(percentage) }
}

export function isCorrect(question: Question, selected: string[]) {
  const correct = question.correct
  if (selected.length !== correct.length) return false
  const set = new Set(correct)
  return selected.every((s) => set.has(s))
}

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [inspectorTimetableImportVersion, setInspectorTimetableImportVersion] = useState(0)
  const [users, setUsers] = useState<User[]>(seedUsers)
  const [quizzes, setQuizzes] = useState<Quiz[]>(() => [...seedQuizzes, ...commodityQuizzes])
  const [trainingResources, setTrainingResources] = useState<TrainingResource[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([...importedInspectorResults, ...seedAttempts])
  const [proctoringSessions, setProctoringSessions] = useState<ProctoringSession[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // hydrate from localStorage
  useEffect(() => {
    try {
      const storedState = localStorage.getItem(STORAGE_KEY)
      const legacyState = LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
      const raw = storedState ?? legacyState
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState
        const normalizedUsers = (parsed.users ?? []).map((user) => {
            const isParagTechnicalManager = user.name.trim().toLowerCase() === 'parag wadekar' && user.role !== 'inspector'
            return user.role === ('tc' as User['role']) || user.role === ('qa' as User['role']) || isParagTechnicalManager
              ? { ...user, role: 'tc_qa' as const }
              : user
          })
        const savedUsers = normalizedUsers.filter((user) => user.role !== 'admin')
        const hydratedUsers = [
          CANONICAL_ADMIN,
          ...seedUsers.filter((user) => user.role !== 'admin').map((user) => normalizedUsers.find((savedUser) => savedUser.id === user.id || savedUser.email.toLowerCase() === user.email.toLowerCase()) ?? user),
          ...savedUsers.filter((savedUser) => !seedUsers.some((seedUser) => seedUser.id === savedUser.id || seedUser.email.toLowerCase() === savedUser.email.toLowerCase())),
        ]
        const importedVersion = parsed.inspectorTimetableImportVersion ?? 0
        setUsers(importedVersion < TIMETABLE_IMPORT_VERSION ? mergeTimetableInspectors(hydratedUsers) : hydratedUsers)
        setInspectorTimetableImportVersion(Math.max(importedVersion, TIMETABLE_IMPORT_VERSION))
        if (parsed.quizzes) setQuizzes(mergePersistedQuizzes(parsed.quizzes, parsed.removedCommodityQuizIds))
        if (parsed.trainingResources) setTrainingResources(parsed.trainingResources)
        if (parsed.attempts) {
          const savedAttempts = storedState ? parsed.attempts : []
          setAttempts([
            ...importedInspectorResults,
            ...savedAttempts.filter((attempt) => !importedInspectorResults.some((imported) => imported.id === attempt.id)),
          ])
        }
        if (parsed.proctoringSessions) setProctoringSessions(parsed.proctoringSessions)
        setCurrentUserId(parsed.currentUserId ?? null)
      } else {
        setUsers(mergeTimetableInspectors(seedUsers))
        setInspectorTimetableImportVersion(TIMETABLE_IMPORT_VERSION)
      }
    } catch {
      // ignore corrupted storage
      setUsers(mergeTimetableInspectors(seedUsers))
      setInspectorTimetableImportVersion(TIMETABLE_IMPORT_VERSION)
    }
    setReady(true)
  }, [])

  // persist
  useEffect(() => {
    if (!ready) return
    const savedQuizzes = quizzes.filter((quiz) => {
      const bundledQuiz = commodityQuizById.get(quiz.id)
      return !bundledQuiz || JSON.stringify(quiz) !== JSON.stringify(bundledQuiz)
    })
    const visibleQuizIds = new Set(quizzes.map((quiz) => quiz.id))
    const removedCommodityQuizIds = commodityQuizzes.filter((quiz) => !visibleQuizIds.has(quiz.id)).map((quiz) => quiz.id)
    const state: PersistedState = { users, quizzes: savedQuizzes, removedCommodityQuizIds, inspectorTimetableImportVersion, trainingResources, attempts, proctoringSessions, currentUserId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
  }, [ready, users, quizzes, inspectorTimetableImportVersion, trainingResources, attempts, proctoringSessions, currentUserId])

  useEffect(() => {
    function syncFromOtherTab(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        const parsed = JSON.parse(event.newValue) as PersistedState
        if (parsed.users) {
          const nextUsers = parsed.users
          setUsers((current) => JSON.stringify(current) === JSON.stringify(nextUsers) ? current : nextUsers)
        }
        if (parsed.quizzes) {
          const nextQuizzes = mergePersistedQuizzes(parsed.quizzes, parsed.removedCommodityQuizIds)
          setQuizzes((current) => JSON.stringify(current) === JSON.stringify(nextQuizzes) ? current : nextQuizzes)
        }
        if (parsed.attempts) {
          const nextAttempts = parsed.attempts
          setAttempts((current) => JSON.stringify(current) === JSON.stringify(nextAttempts) ? current : nextAttempts)
        }
        if (parsed.proctoringSessions) {
          const nextSessions = parsed.proctoringSessions
          setProctoringSessions((current) => JSON.stringify(current) === JSON.stringify(nextSessions) ? current : nextSessions)
        }
      } catch {
        // ignore malformed cross-tab updates
      }
    }
    window.addEventListener('storage', syncFromOtherTab)
    return () => window.removeEventListener('storage', syncFromOtherTab)
  }, [])

  useEffect(() => {
    if (!ready) return
    let active = true
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)

    async function syncProfiles() {
      try {
        if (isLocalHost) {
          const profiles = users.filter((user) => user.role === 'inspector').map(toSharedInspectorProfile).filter((profile) => profile !== null)
          if (profiles.length > 0) {
            const response = await fetch('/api/inspector-profiles', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ profiles }),
            })
            if (!response.ok) throw new Error('Inspector profiles could not be synchronized.')
          }
          return
        }

        const response = await fetch('/api/inspector-profiles', { cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json() as { profiles?: SharedInspectorProfile[] }
        if (active && payload.profiles) {
          setUsers((current) => mergeSharedInspectorProfiles(current, payload.profiles ?? []))
        }
      } catch {
        // Keep local profile data available when shared storage is temporarily offline.
      }
    }

    void syncProfiles()
    const intervalId = isLocalHost ? undefined : window.setInterval(() => void syncProfiles(), 5000)
    return () => {
      active = false
      if (intervalId !== undefined) window.clearInterval(intervalId)
    }
  }, [ready])

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? null,
    [users, currentUserId],
  )

  useEffect(() => {
    if (!ready || currentUser?.role !== 'inspector') return
    fetch(`/api/inspector-attempts?userId=${encodeURIComponent(currentUser.id)}`)
      .then((response) => response.ok ? response.json() as Promise<{ attempts: Attempt[] }> : Promise.reject(new Error('Unable to sync assessment history.')))
      .then(({ attempts: serverAttempts }) => {
        setAttempts((previous) => [
          ...serverAttempts,
          ...previous.filter((attempt) => !serverAttempts.some((serverAttempt) => serverAttempt.id === attempt.id)),
        ])
      })
      .catch(() => undefined)
  }, [ready, currentUser?.id, currentUser?.role])

  const login = useCallback(
    (email: string, password: string) => {
      const user = users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
      )
      if (!user) return { ok: false, error: 'No account found with that email.' }
      if (user.password !== password) return { ok: false, error: 'Incorrect password.' }
      setCurrentUserId(user.id)
      return { ok: true }
    },
    [users],
  )

  const resetAdminPassword = useCallback((password: string) => {
    if (password.trim().length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
    setUsers((prev) => prev.map((user) => user.id === CANONICAL_ADMIN.id ? { ...user, password } : user))
    return { ok: true }
  }, [])

  const createAccount = useCallback(
    (name: string, email: string, password: string, role: 'inspector' | 'tc_qa') => {
      if (currentUser?.role !== 'admin') return { ok: false, error: 'Only Admin can create accounts.' }
      const normalizedEmail = email.trim().toLowerCase()
      if (!name.trim() || !normalizedEmail || !password) return { ok: false, error: 'Complete all account fields.' }
      if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
        return { ok: false, error: 'An account with that email already exists.' }
      }
      const user: User = { id: `u-${Date.now()}`, name: name.trim(), email: email.trim(), password, role }
      setUsers((prev) => [...prev, user])
      return { ok: true }
    },
    [currentUser, users],
  )

  const updateUser = useCallback((id: string, updates: Partial<User>) => {
    const user = users.find((item) => item.id === id)
    if (user?.role === 'inspector') {
      const profile = toSharedInspectorProfile({ ...user, ...updates })
      if (profile) {
        void fetch('/api/inspector-profiles', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        }).catch(() => undefined)
      }
    }
    setUsers((prev) => prev.map((user) => user.id === id ? { ...user, ...updates } : user))
  }, [users])

  const deleteUser = useCallback((id: string) => {
    if (currentUser?.role !== 'admin') return { ok: false, error: 'Only Admin can delete accounts.' }
    if (id === currentUser.id) return { ok: false, error: 'The Admin account cannot be deleted.' }
    setUsers((prev) => prev.filter((user) => user.id !== id))
    return { ok: true }
  }, [currentUser])

  const changeUserPassword = useCallback((id: string, password: string) => {
    if (currentUser?.role !== 'admin') return { ok: false, error: 'Only Admin can change account passwords.' }
    if (password.trim().length < 6) return { ok: false, error: 'Password must be at least 6 characters.' }
    setUsers((prev) => prev.map((user) => user.id === id ? { ...user, password } : user))
    return { ok: true }
  }, [currentUser])

  const logout = useCallback(() => setCurrentUserId(null), [])

  const saveQuiz = useCallback((quiz: Quiz) => {
    setQuizzes((prev) => {
      const idx = prev.findIndex((q) => q.id === quiz.id)
      if (idx === -1) return [quiz, ...prev]
      const next = [...prev]
      next[idx] = quiz
      return next
    })
  }, [])

  const saveTrainingResource = useCallback((resource: TrainingResource) => {
    setTrainingResources((prev) => {
      const idx = prev.findIndex((item) => item.id === resource.id)
      if (idx === -1) return [resource, ...prev]
      const next = [...prev]
      next[idx] = resource
      return next
    })
  }, [])

  const deleteTrainingResource = useCallback((id: string) => {
    setTrainingResources((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const completeTrainingResource = useCallback((id: string) => {
    if (currentUser?.role !== 'inspector') return
    setUsers((prev) => prev.map((user) => user.id === currentUser.id
      ? { ...user, trainingCompletedIds: Array.from(new Set([...(user.trainingCompletedIds ?? []), id])) }
      : user,
    ))
  }, [currentUser])

  const deleteQuiz = useCallback((id: string) => {
    setQuizzes((prev) => prev.filter((q) => q.id !== id))
    setAttempts((prev) => prev.filter((a) => a.quizId !== id))
  }, [])

  const beginAttempt = useCallback(async (quiz: Quiz) => {
    if (!currentUser || currentUser.role !== 'inspector') throw new Error('Only an Inspector can start this assessment.')
    const response = await fetch('/api/inspector-attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', userId: currentUser.id, userName: currentUser.name, quizId: quiz.id, quizTitle: quiz.title }),
    })
    const payload = await response.json() as { error?: string; attemptId?: string; attemptNumber?: number; attemptToken?: string }
    if (!response.ok || !payload.attemptId || !payload.attemptNumber || !payload.attemptToken) throw new Error(payload.error ?? 'The assessment could not be started.')
    return { attemptId: payload.attemptId, attemptNumber: payload.attemptNumber, attemptToken: payload.attemptToken }
  }, [currentUser])

  const submitAttempt = useCallback(async (quiz: Quiz, answers: Record<string, string[]>, timeSpent: number, attemptId: string, attemptToken: string) => {
    if (!currentUserId) throw new Error('Your Inspector session has expired. Please sign in again.')
    const response = await fetch('/api/inspector-attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'submit', userId: currentUserId, attemptId, attemptToken, quiz, answers, timeSpent }),
    })
    const payload = await response.json() as Attempt | { error?: string }
    if (!response.ok || !('id' in payload)) throw new Error(('error' in payload && payload.error) || 'The assessment could not be submitted.')
    setAttempts((previous) => [payload, ...previous.filter((attempt) => attempt.id !== payload.id)])
    return payload
  }, [currentUserId])

  const startProctoringSession = useCallback(
    (quiz: Quiz, cameraGranted: boolean, microphoneGranted: boolean) => {
      const session: ProctoringSession = {
        id: `proctor-${Date.now()}`,
        quizId: quiz.id,
        quizTitle: quiz.title,
        userId: currentUserId ?? 'unknown',
        userName: currentUser?.name ?? 'Unknown',
        startedAt: Date.now(),
        status: 'live',
        cameraGranted,
        microphoneGranted,
      }
      setProctoringSessions((prev) => [session, ...prev])
      return session
    },
    [currentUser, currentUserId],
  )

  const finishProctoringSession = useCallback(
    (id: string, status: 'completed' | 'interrupted', attemptId?: string, recordingId?: string) => {
      setProctoringSessions((prev) => prev.map((session) => session.id === id
        ? { ...session, status, endedAt: Date.now(), attemptId, recordingId }
        : session,
      ))
    },
    [],
  )

  const deleteProctoringSession = useCallback(async (id: string) => {
    if (currentUser?.role !== 'admin') return { ok: false, error: 'Only Admin can delete monitoring footage.' }
    const session = proctoringSessions.find((item) => item.id === id)
    if (!session) return { ok: false, error: 'The monitoring session no longer exists.' }
    try {
      if (session.recordingId) await deleteProctoringRecording(session.recordingId)
    } catch {
      return { ok: false, error: 'The footage could not be deleted from browser storage.' }
    }
    setProctoringSessions((prev) => prev.filter((session) => session.id !== id))
    return { ok: true }
  }, [currentUser, proctoringSessions])

  const value: QuizContextValue = {
    ready,
    currentUser,
    users,
    quizzes,
    trainingResources,
    attempts,
    proctoringSessions,
    login,
    resetAdminPassword,
    createAccount,
    updateUser,
    deleteUser,
    changeUserPassword,
    logout,
    saveQuiz,
    saveTrainingResource,
    deleteTrainingResource,
    completeTrainingResource,
    deleteQuiz,
    beginAttempt,
    submitAttempt,
    startProctoringSession,
    finishProctoringSession,
    deleteProctoringSession,
  }

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>
}

export function useQuizStore() {
  const ctx = useContext(QuizContext)
  if (!ctx) throw new Error('useQuizStore must be used within QuizProvider')
  return ctx
}
