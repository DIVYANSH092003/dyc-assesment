export type Role = 'admin' | 'inspector' | 'tc_qa'

export type ScopeSector = 'NABCB IAF SCOPE 17' | 'NABCB IAF SCOPE 18' | 'NABCB IAF SCOPE 17 & 18' | 'NABCB IAF SCOPE 19' | 'NABCB IAF SCOPE 28' | 'Coating' | 'Other'
export type Scope17Category = string
export type Scope18Category = string
export type Scope19Category = string
export type Scope28Category = string

export interface TestAssignment {
  quizId: string
  conductedBy: string
  evaluatorDesignation?: string
  assignedAt: number
  assessmentDate?: string
  durationMinutes?: number
  scopeSector?: ScopeSector
  scopeCategory?: string
  scheduledSlot?: string
}

export interface User {
  id: string
  name: string
  email: string
  password: string
  role: Role
  inspectorId?: string
  inspectorSignature?: string | null
  designation?: string
  department?: string
  location?: string
  informationDate?: string
  assessmentDate?: string
  scopeSector?: ScopeSector
  scope17Category?: Scope17Category
  scope18Category?: Scope18Category
  scope19Category?: Scope19Category
  scope28Category?: Scope28Category
  assignedQuizIds?: string[]
  assignedTrainingIds?: string[]
  trainingCompletedIds?: string[]
  testAssignments?: TestAssignment[]
}

export type QuestionType = 'single' | 'multi' | 'boolean'

export interface Option {
  id: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  prompt: string
  options: Option[]
  /** ids of correct options (single/boolean have exactly one) */
  correct: string[]
  points: number
}

export type TrainingAssetType = 'video' | 'audio' | 'document'

export interface TrainingAsset {
  id: string
  type: TrainingAssetType
  title: string
  url: string
  fileName?: string
  description?: string
}

export interface TrainingResource extends TrainingAsset {
  audience: 'inspector'
}

export interface Quiz {
  id: string
  title: string
  description: string
  category: string
  scopeSector?: ScopeSector
  /** total time limit in minutes */
  durationMinutes: number
  /** passing score as a percentage 0-100 */
  passingScore: number
  /** role that can take this assessment */
  targetRole?: 'inspector'
  questions: Question[]
  createdAt: number
}

export interface Attempt {
  id: string
  quizId: string
  quizTitle: string
  userId: string
  userName: string
  attemptNumber: number
  /** map of questionId -> selected option ids */
  answers: Record<string, string[]>
  score: number
  maxScore: number
  percentage: number
  passed: boolean
  competencyStatus?: 'COMPETENT' | 'NOT COMPETENT'
  startedAt?: number
  /** seconds spent */
  timeSpent: number
  submittedAt: number
  conductedBy?: string
  importedSource?: 'competency-evaluation'
  recordedGrade?: 'A' | 'B' | 'C' | 'W'
  questionResponsesSource?: 'reconstructed-from-aggregate-score'
  importedAssessmentDetails?: {
    sourceCandidateName: string
    sourceSheet: string
    trainingDate: string
    assessmentDate: string
    iafScope: string
    internalExternal: string
    topic: string
    designation: string
    trainingType: string
    trainingMaterial: string
    trainingDuration: string
    trainingSlot: string
    cbtDuration: string
    cbtDurationMinutes: number
    cbtSlot: string
    totalMarks: number
    marksObtained: number
  }
}

export type ProctoringStatus = 'live' | 'completed' | 'interrupted'

export interface ProctoringSession {
  id: string
  quizId: string
  quizTitle: string
  userId: string
  userName: string
  startedAt: number
  endedAt?: number
  status: ProctoringStatus
  cameraGranted: boolean
  microphoneGranted: boolean
  recordingId?: string
  attemptId?: string
}
