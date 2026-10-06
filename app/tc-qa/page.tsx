'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardCheck, FileBarChart, FileSearch, LockKeyhole, LogOut, MessageSquare, UserRound } from 'lucide-react'
import { AnswerSheetDownload } from '@/components/answer-sheet-download'
import { AuthGate } from '@/components/auth-gate'
import { CertificateDownload } from '@/components/certificate-download'
import { Badge, Card, Select } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'
import { getEvaluation } from '@/lib/evaluation'

const actions = [
  { id: 'assessment-review', label: 'Assessment Review', icon: FileSearch },
  { id: 'candidate-results', label: 'Inspector Results', icon: ClipboardCheck },
  { id: 'pending-approvals', label: 'Pending Approvals', icon: MessageSquare },
  { id: 'certificate-verification', label: 'Certificate Verification', icon: FileBarChart },
  { id: 'reports', label: 'Assessment Reports', icon: FileBarChart },
  { id: 'remarks', label: 'Remarks / Observations', icon: MessageSquare },
]

export default function TcQaDashboardPage() {
  return <AuthGate role="tc_qa"><Dashboard /></AuthGate>
}

function Dashboard() {
  const { attempts, currentUser, logout, users, quizzes } = useQuizStore()
  const router = useRouter()
  const people = users.filter((user) => user.role === 'inspector')
  const [selectedUserId, setSelectedUserId] = useState(people[0]?.id ?? '')
  const selectedUser = people.find((user) => user.id === selectedUserId)
  const selectedAttempts = attempts.filter((attempt) => attempt.userId === selectedUserId)
  const inspectorMetrics = people.map((user) => {
    const userAttempts = attempts.filter((attempt) => attempt.userId === user.id)
    const average = userAttempts.length ? Math.round(userAttempts.reduce((total, attempt) => total + attempt.percentage, 0) / userAttempts.length) : 0
    return { user, attempts: userAttempts.length, average, passed: userAttempts.filter((attempt) => attempt.passed).length }
  }).sort((a, b) => b.average - a.average)
  const examCounts = useMemo(() => quizzes.map((quiz) => ({ title: quiz.title, count: attempts.filter((attempt) => attempt.quizId === quiz.id).length })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count), [attempts, quizzes])
  const maxExamAttempts = Math.max(...examCounts.map((item) => item.count), 1)
  const approved = attempts.filter((attempt) => attempt.passed).length
  const rejected = attempts.filter((attempt) => !attempt.passed).length
  const stats = [['Inspection Users', people.length], ['Giving Tests', attempts.length], ['Passed', approved], ['Failed', rejected]]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-semibold text-primary">Technical Manager / Quality Assurance</p>
        <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight">TM / QA Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Monitor inspections, review results, and download assessment records.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => <Card key={label}><p className="font-heading text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></Card>)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map(({ id, label, icon: Icon }) => <Link key={id} href={`#${id}`} className="group"><Card className="flex items-center gap-3 transition-colors group-hover:border-primary"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><span className="text-sm font-semibold">{label}</span></Card></Link>)}
      </div>

      <section id="inspector-analytics" className="scroll-mt-24 space-y-4">
        <div><h2 className="font-heading text-lg font-semibold">Inspector analytics</h2><p className="text-sm text-muted-foreground">Compare scores across inspectors and review an individual exam history.</p></div>
        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <Card>
            <div className="flex items-center justify-between gap-3"><div><h3 className="font-heading font-semibold">Average score by inspector</h3><p className="mt-1 text-xs text-muted-foreground">Click a bar to open that inspector&apos;s attempts.</p></div><Badge tone="primary">{people.length} inspectors</Badge></div>
            <div className="mt-5 space-y-4">{inspectorMetrics.length === 0 ? <p className="text-sm text-muted-foreground">No inspector accounts yet.</p> : inspectorMetrics.map(({ user, attempts: attemptCount, average, passed }) => <button key={user.id} type="button" onClick={() => setSelectedUserId(user.id)} className={`w-full text-left ${selectedUserId === user.id ? 'rounded-lg bg-primary/5 p-2 -m-2' : ''}`}><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-medium">{user.name}</span><span className="text-xs text-muted-foreground">{average}% avg · {passed}/{attemptCount} passed</span></div><div className="h-3 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${average >= 60 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${average}%` }} /></div></button>)}</div>
          </Card>
          <Card>
            <h3 className="font-heading font-semibold">Attempts by exam</h3><p className="mt-1 text-xs text-muted-foreground">Completed attempts grouped by assessment.</p>
            <div className="mt-5 space-y-4">{examCounts.length === 0 ? <p className="text-sm text-muted-foreground">No completed exams yet.</p> : examCounts.map((item) => <div key={item.title}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate">{item.title}</span><span className="font-semibold">{item.count}</span></div><div className="h-3 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${(item.count / maxExamAttempts) * 100}%` }} /></div></div>)}</div>
          </Card>
        </div>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-heading font-semibold">Inspector attempt detail</h3><p className="mt-1 text-xs text-muted-foreground">Review exam, score, result, time, and submission date.</p></div><Select className="w-full sm:w-64" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}><option value="">Select inspector</option>{people.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</Select></div>
          {selectedAttempts.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">No attempts recorded for this inspector.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="pb-3 font-medium">Exam</th><th className="pb-3 font-medium">Evaluation</th><th className="pb-3 font-medium">Outcome</th><th className="pb-3 font-medium">Time</th><th className="pb-3 font-medium">Submitted</th></tr></thead><tbody className="divide-y divide-border">{selectedAttempts.map((attempt) => <tr key={attempt.id}><td className="py-3 font-medium">{attempt.quizTitle}</td><td className="py-3">{getEvaluation(attempt.percentage).score.toFixed(1)}/10 · Grade {getEvaluation(attempt.percentage).grade} <span className="text-xs text-muted-foreground">({attempt.percentage}% · {attempt.score}/{attempt.maxScore})</span></td><td className="py-3"><Badge tone={attempt.passed ? 'success' : 'danger'}>{attempt.passed ? 'Passed' : 'Failed'}</Badge></td><td className="py-3 text-muted-foreground">{Math.floor(attempt.timeSpent / 60)}m {attempt.timeSpent % 60}s</td><td className="py-3 text-muted-foreground">{new Date(attempt.submittedAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
        </Card>
      </section>

      <Card id="assessment-review" className="scroll-mt-24">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-heading text-lg font-semibold">Assessment Review</h2><p className="text-sm text-muted-foreground">Recent inspector assessments requiring technical review.</p></div><Badge tone="primary">{attempts.length} records</Badge></div>
        <div id="candidate-results" className="mt-4 divide-y divide-border">
          {attempts.length === 0 ? <p className="py-6 text-sm text-muted-foreground">No inspector assessments yet.</p> : attempts.map((attempt) => <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{attempt.userName}</p><p className="text-xs text-muted-foreground">{attempt.quizTitle}</p></div><div className="flex items-center gap-3"><span className="text-sm font-semibold">{getEvaluation(attempt.percentage).score.toFixed(1)}/10 · {getEvaluation(attempt.percentage).grade}</span><Badge tone={attempt.passed ? 'success' : 'danger'}>{attempt.passed ? 'Approved' : 'Rejected'}</Badge></div></div>)}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="pending-approvals" className="scroll-mt-24"><h2 className="font-heading text-lg font-semibold">Pending Approvals</h2><p className="mt-2 text-sm text-muted-foreground">Review completed assessments above before approving certificates.</p></Card>
        <Card id="certificate-verification" className="scroll-mt-24"><h2 className="font-heading text-lg font-semibold">Certificate Verification</h2><p className="mt-2 text-sm text-muted-foreground">Certificate verification records will appear here after approval.</p></Card>
        <Card id="reports" className="scroll-mt-24"><h2 className="font-heading text-lg font-semibold">Assessment Reports</h2><p className="mt-2 text-sm text-muted-foreground">{attempts.length} assessment reports available for review.</p></Card>
        <Card id="remarks" className="scroll-mt-24"><h2 className="font-heading text-lg font-semibold">Remarks / Observations</h2><textarea className="mt-3 min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Add review remarks or observations..." /></Card>
      </div>

      <Card id="downloads" className="scroll-mt-24 overflow-x-auto p-0"><div className="border-b border-border px-5 py-4"><h2 className="font-heading text-lg font-semibold">Assessment records</h2><p className="text-sm text-muted-foreground">Download answer sheets and certificates for completed tests.</p></div>{attempts.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No completed assessments yet.</p> : <table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-5 py-3 font-medium">Inspection user</th><th className="px-5 py-3 font-medium">Assessment</th><th className="px-5 py-3 font-medium">Result</th><th className="px-5 py-3 font-medium">Downloads</th></tr></thead><tbody className="divide-y divide-border">{attempts.map((attempt) => { const quiz = quizzes.find((item) => item.id === attempt.quizId); const candidateName = (attempt.importedAssessmentDetails?.sourceCandidateName ?? attempt.userName).trim().toLocaleLowerCase(); const user = users.find((item) => item.id === attempt.userId) ?? (attempt.importedSource === 'competency-evaluation' ? users.find((item) => item.role === 'inspector' && item.name.trim().toLocaleLowerCase() === candidateName) : undefined); return <tr key={attempt.id}><td className="px-5 py-3 font-medium">{attempt.userName}</td><td className="px-5 py-3 text-muted-foreground">{attempt.quizTitle}</td><td className="px-5 py-3"><Badge tone={attempt.passed ? 'success' : 'danger'}>{attempt.passed ? 'Passed' : 'Failed'}</Badge></td><td className="flex gap-2 px-5 py-3">{quiz && <AnswerSheetDownload attempt={attempt} quiz={quiz} user={user} />}<CertificateDownload attempt={attempt} role={user?.role ?? 'inspector'} user={user} /></td></tr> })}</tbody></table>}</Card>

      <div className="flex flex-wrap gap-3 border-t border-border pt-5"><Button variant="outline" className="gap-2"><UserRound className="h-4 w-4" /> Profile</Button><Button variant="outline" className="gap-2"><LockKeyhole className="h-4 w-4" /> Change Password</Button><Button variant="outline" className="gap-2" onClick={() => { logout(); router.push('/') }}><LogOut className="h-4 w-4" /> Logout</Button></div>
      <p className="text-xs text-muted-foreground">Signed in as {currentUser?.name}</p>
    </div>
  )
}