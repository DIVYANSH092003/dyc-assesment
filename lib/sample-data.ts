import type { Attempt, Quiz, User } from './types'

export const seedUsers: User[] = [
  {
    id: 'u-admin',
    name: 'DYC Global Admin',
    email: 'itsupport@dycgpl.com',
    password: 'Dycgbl@2026',
    role: 'admin',
  },
  {
    id: 'u-inspector-1',
    name: 'Arjun Mehta',
    email: 'inspector@dycglobal.com',
    password: 'inspect123',
    role: 'inspector',
  },
  {
    id: 'u-tc-qa-1',
    name: 'Neha Kapoor',
    email: 'tcqa@dycglobal.com',
    password: 'review123',
    role: 'tc_qa',
  },
]

export const seedQuizzes: Quiz[] = [
  {
    id: 'q-onboarding',
    title: 'Company Onboarding & Policies',
    description:
      'Assessment covering DYC Global core values, workplace policies, and code of conduct for new joiners.',
    category: 'HR & Compliance',
    durationMinutes: 10,
    passingScore: 50,
    targetRole: 'inspector',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    questions: [
      {
        id: 'oq1',
        type: 'single',
        prompt: 'What is the standard notice period for confirmed employees at DYC Global?',
        points: 1,
        options: [
          { id: 'oq1a', text: '15 days' },
          { id: 'oq1b', text: '30 days' },
          { id: 'oq1c', text: '60 days' },
          { id: 'oq1d', text: '90 days' },
        ],
        correct: ['oq1c'],
      },
      {
        id: 'oq2',
        type: 'boolean',
        prompt: 'Sharing your login credentials with a colleague is permitted during busy periods.',
        points: 1,
        options: [
          { id: 'oq2a', text: 'True' },
          { id: 'oq2b', text: 'False' },
        ],
        correct: ['oq2b'],
      },
      {
        id: 'oq3',
        type: 'multi',
        prompt: 'Which of the following are considered confidential company information? (Select all that apply)',
        points: 2,
        options: [
          { id: 'oq3a', text: 'Client contact lists' },
          { id: 'oq3b', text: 'Internal salary data' },
          { id: 'oq3c', text: 'Publicly published press releases' },
          { id: 'oq3d', text: 'Unreleased product roadmaps' },
        ],
        correct: ['oq3a', 'oq3b', 'oq3d'],
      },
    ],
  },
  {
    id: 'q-aptitude',
    title: 'General Aptitude Test',
    description:
      'Logical reasoning and quantitative aptitude assessment for inspector competency.',
    category: 'Recruitment',
    durationMinutes: 15,
    passingScore: 50,
    targetRole: 'inspector',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    questions: [
      {
        id: 'aq1',
        type: 'single',
        prompt: 'If a train travels 60 km in 45 minutes, what is its speed in km/h?',
        points: 1,
        options: [
          { id: 'aq1a', text: '70 km/h' },
          { id: 'aq1b', text: '80 km/h' },
          { id: 'aq1c', text: '75 km/h' },
          { id: 'aq1d', text: '90 km/h' },
        ],
        correct: ['aq1b'],
      },
      {
        id: 'aq2',
        type: 'single',
        prompt: 'Find the next number in the series: 2, 6, 12, 20, 30, ?',
        points: 1,
        options: [
          { id: 'aq2a', text: '40' },
          { id: 'aq2b', text: '42' },
          { id: 'aq2c', text: '44' },
          { id: 'aq2d', text: '46' },
        ],
        correct: ['aq2b'],
      },
      {
        id: 'aq3',
        type: 'boolean',
        prompt: 'All squares are rectangles.',
        points: 1,
        options: [
          { id: 'aq3a', text: 'True' },
          { id: 'aq3b', text: 'False' },
        ],
        correct: ['aq3a'],
      },
    ],
  },
]

export const seedAttempts: Attempt[] = []
