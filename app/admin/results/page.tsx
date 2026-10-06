'use client'

import { useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Download, Search } from 'lucide-react'
import { AnswerSheetDownload, createAnswerSheetHtml, getAssessmentTitle } from '@/components/answer-sheet-download'
import { CertificateDownload } from '@/components/certificate-download'
import { AuthGate } from '@/components/auth-gate'
import { Badge, Card, Select } from '@/components/ui-kit'
import { Button } from '@/components/ui/button'
import { useQuizStore } from '@/components/quiz-store'
import { getEvaluation } from '@/lib/evaluation'

export default function AdminResultsPage() {
  return (
    <AuthGate role="admin">
      <Results />
    </AuthGate>
  )
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function safeFilename(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').trim() || 'assessment'
}

function Results() {
  const { attempts, quizzes, users } = useQuizStore()
  const [inspectorSearch, setInspectorSearch] = useState('')
  const [quizFilter, setQuizFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [zipInspectorId, setZipInspectorId] = useState('')
  const [zipMessage, setZipMessage] = useState('')
  const [isCreatingZip, setIsCreatingZip] = useState(false)
  const inspectors = useMemo(
    () => users.filter((user) => user.role === 'inspector').sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  )
  const selectedInspector = inspectors.find((user) => user.id === zipInspectorId)
  const selectedInspectorAttempts = useMemo(
    () => attempts
      .filter((attempt) => attempt.userId === zipInspectorId || (
        attempt.importedSource === 'competency-evaluation'
        && selectedInspector !== undefined
        && (attempt.importedAssessmentDetails?.sourceCandidateName ?? attempt.userName).trim().toLocaleLowerCase()
          === selectedInspector.name.trim().toLocaleLowerCase()
      ))
      .sort((a, b) => a.submittedAt - b.submittedAt),
    [attempts, zipInspectorId, selectedInspector],
  )

  const filtered = useMemo(() => {
    return attempts
      .filter((a) => (quizFilter === 'all' ? true : a.quizId === quizFilter))
      .filter((attempt) => attempt.userName.toLowerCase().includes(inspectorSearch.trim().toLowerCase()))
      .filter((a) =>
        statusFilter === 'all'
          ? true
          : statusFilter === 'pass'
            ? a.passed
            : statusFilter === 'fail'
              ? !a.passed
              : false,
      )
      .sort((a, b) => b.submittedAt - a.submittedAt)
  }, [attempts, inspectorSearch, quizFilter, statusFilter])

  const avg =
    filtered.length > 0
      ? Math.round(filtered.reduce((s, a) => s + a.percentage, 0) / filtered.length)
      : 0
  const passCount = filtered.filter((a) => a.passed).length

  async function downloadInspectorZip() {
    const inspector = selectedInspector
    if (!inspector || selectedInspectorAttempts.length === 0) return

    setIsCreatingZip(true)
    setZipMessage('')
    try {
      const archive = new JSZip()
      const answerSheets = archive.folder('Assessment Records')
      if (!answerSheets) throw new Error('The assessment records folder could not be created.')

      let answerSheetCount = 0
      const rows = selectedInspectorAttempts.map((attempt) => {
        const evaluation = getEvaluation(attempt.percentage)
        const quiz = quizzes.find((item) => item.id === attempt.quizId)
        if (quiz) {
          const submittedDate = new Date(attempt.submittedAt).toISOString().slice(0, 10)
          const fileName = [
            submittedDate,
            safeFilename(getAssessmentTitle(quiz.title)),
            `attempt-${String(attempt.attemptNumber).padStart(2, '0')}`,
            safeFilename(attempt.id),
          ].join('_')
          answerSheets.file(`${fileName}.html`, createAnswerSheetHtml({
            attempt,
            attemptHistory: [attempt],
            quiz,
            user: inspector,
          }))
          answerSheetCount += 1
        }

        return [
          inspector.name,
          inspector.inspectorId ?? inspector.id,
          attempt.quizTitle,
          attempt.attemptNumber,
          `${attempt.score}/${attempt.maxScore}`,
          evaluation.score.toFixed(1),
          attempt.recordedGrade ?? evaluation.grade,
          `${attempt.percentage}%`,
          attempt.passed ? 'Pass' : 'Fail',
          formatTime(attempt.timeSpent),
          new Date(attempt.submittedAt).toISOString(),
          attempt.importedSource === 'competency-evaluation' ? 'Imported competency register' : 'Assessment platform',
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(',')
      })

      const header = [
        'Inspector',
        'Inspector ID',
        'Assessment',
        'Attempt',
        'Score',
        'Evaluation out of 10',
        'Grade',
        'Percentage',
        'Result',
        'Time',
        'Submitted',
        'Record source',
      ]
      archive.file('assessment-records.csv', [header.join(','), ...rows].join('\n'))

      const blob = await archive.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${safeFilename(inspector.name)}_assessment-records.zip`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setZipMessage(`Downloaded ${selectedInspectorAttempts.length} assessment record(s) and ${answerSheetCount} printable answer sheet(s).`)
    } catch (error) {
      setZipMessage(error instanceof Error ? `Unable to create the ZIP file: ${error.message}` : 'Unable to create the ZIP file.')
    } finally {
      setIsCreatingZip(false)
    }
  }

  function exportCsv() {
    const header = ['Inspector', 'Test', 'Score', 'Evaluation', 'Grade', 'Percentage', 'Result', 'Time', 'Submitted']
    const lines = filtered.map((a) =>
      [
        a.userName,
        a.quizTitle,
        `${a.score}/${a.maxScore}`,
        `${getEvaluation(a.percentage).score.toFixed(1)}/10`,
        a.recordedGrade ?? getEvaluation(a.percentage).grade,
        `${a.percentage}%`,
        a.passed ? 'Pass' : 'Fail',
        formatTime(a.timeSpent),
        new Date(a.submittedAt).toISOString(),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'dyc-results.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Results</h1>
          <p className="text-sm text-muted-foreground">
            Completed inspector attempts. Imported records use the supplied score and grade; reconstructed question responses are identified on the answer sheet.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" />
          Export completed results CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="font-heading text-2xl font-bold">{filtered.length}</p>
          <p className="text-xs text-muted-foreground">Completed attempts</p>
        </Card>
        <Card>
          <p className="font-heading text-2xl font-bold">{avg}%</p>
          <p className="text-xs text-muted-foreground">Average score</p>
        </Card>
        <Card>
          <p className="font-heading text-2xl font-bold">
            {passCount}/{filtered.length}
          </p>
          <p className="text-xs text-muted-foreground">Passed</p>
        </Card>
      </div>

      <Card className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex w-full flex-col gap-1.5 sm:w-72">
          <span className="text-sm font-semibold">Inspector-wise assessment records</span>
          <Select aria-label="Select an inspector for the assessment ZIP" value={zipInspectorId} onChange={(event) => {
            setZipInspectorId(event.target.value)
            setZipMessage('')
          }}>
            <option value="">Select an inspector</option>
            {inspectors.map((inspector) => (
              <option key={inspector.id} value={inspector.id}>{inspector.name}{inspector.inspectorId ? ` · ${inspector.inspectorId}` : ''}</option>
            ))}
          </Select>
          <span className="text-xs text-muted-foreground">ZIP includes an assessment CSV register and printable answer sheets.</span>
          {zipInspectorId && <span className="text-xs text-muted-foreground">{selectedInspectorAttempts.length} completed record(s); filters below do not limit this ZIP.</span>}
        </label>
        <div className="flex flex-col items-start gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => { void downloadInspectorZip() }}
            disabled={!zipInspectorId || selectedInspectorAttempts.length === 0 || isCreatingZip}
          >
            <Download className="h-4 w-4" />
            {isCreatingZip ? 'Creating ZIP...' : 'Download assessment ZIP'}
          </Button>
          {zipMessage && <p role="status" className="text-xs text-muted-foreground">{zipMessage}</p>}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Filter results by inspector name" className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm" value={inspectorSearch} onChange={(event) => setInspectorSearch(event.target.value)} placeholder="Search inspector" />
        </label>
        <div className="w-full sm:w-56">
          <Select value={quizFilter} onChange={(e) => setQuizFilter(e.target.value)}>
            <option value="all">All assessments</option>
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All results</option>
            <option value="pass">Passed only</option>
            <option value="fail">Failed only</option>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="py-16 text-center">
          <p className="text-sm text-muted-foreground">No completed attempts match these filters.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Inspector</th>
                <th className="px-5 py-3 font-medium">Assessment</th>
                <th className="px-5 py-3 font-medium">Score</th>
                <th className="px-5 py-3 font-medium">Result</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Submitted</th>
                <th className="px-5 py-3 font-medium">Answer sheet</th>
                <th className="px-5 py-3 font-medium">Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((a) => {
                const candidateName = (a.importedAssessmentDetails?.sourceCandidateName ?? a.userName)
                  .trim()
                  .toLocaleLowerCase()
                const attemptUser = users.find((user) => user.id === a.userId)
                  ?? (a.importedSource === 'competency-evaluation'
                    ? users.find((user) => user.role === 'inspector' && user.name.trim().toLocaleLowerCase() === candidateName)
                    : undefined)
                const quiz = quizzes.find((item) => item.id === a.quizId)

                return (
                  <tr key={a.id} className="hover:bg-secondary/40">
                    <td className="px-5 py-3 font-medium">{a.userName}</td>
                    <td className="px-5 py-3 text-muted-foreground">{a.quizTitle}</td>
                    <td className="px-5 py-3">
                      <span className="font-semibold">{getEvaluation(a.percentage).score.toFixed(1)}/10 · {a.recordedGrade ?? getEvaluation(a.percentage).grade}</span>
                      <span className="text-muted-foreground">
                        {' '}({a.percentage}% · {a.score}/{a.maxScore})
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={a.passed ? 'success' : 'danger'}>
                        {a.passed ? 'Pass' : 'Fail'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatTime(a.timeSpent)}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatDate(a.submittedAt)}
                    </td>
                    <td className="px-5 py-3">
                      {quiz && <AnswerSheetDownload attempt={a} attemptHistory={attempts.filter((item) => item.userId === a.userId && item.quizId === a.quizId)} quiz={quiz} user={attemptUser} />}
                    </td>
                    <td className="px-5 py-3">
                      <CertificateDownload
                        attempt={a}
                        role={attemptUser?.role ?? 'inspector'}
                        user={attemptUser}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
