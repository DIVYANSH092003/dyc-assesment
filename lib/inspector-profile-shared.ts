import type { User } from './types'

export type SharedInspectorProfile = Omit<User, 'password'>

export function toSharedInspectorProfile(value: unknown): SharedInspectorProfile | null {
  if (!value || typeof value !== 'object') return null
  const profile = value as Partial<User>
  if (profile.role !== 'inspector' || typeof profile.id !== 'string' || typeof profile.name !== 'string' || typeof profile.email !== 'string') return null

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: 'inspector',
    inspectorId: profile.inspectorId,
    inspectorSignature: profile.inspectorSignature,
    designation: profile.designation,
    department: profile.department,
    location: profile.location,
    informationDate: profile.informationDate,
    assessmentDate: profile.assessmentDate,
    scopeSector: profile.scopeSector,
    scope17Category: profile.scope17Category,
    scope18Category: profile.scope18Category,
    scope19Category: profile.scope19Category,
    scope28Category: profile.scope28Category,
    assignedQuizIds: profile.assignedQuizIds,
    assignedTrainingIds: profile.assignedTrainingIds,
    trainingCompletedIds: profile.trainingCompletedIds,
    testAssignments: profile.testAssignments,
  }
}