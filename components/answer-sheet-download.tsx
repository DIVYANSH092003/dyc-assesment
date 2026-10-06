'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Attempt, Quiz, User } from '@/lib/types'
import { getEvaluation } from '@/lib/evaluation'

export function getAssessmentTitle(title: string) {
  return title.replace(/\s*[-–—]?\s+paper\s+[123]\s*$/i, '').trim()
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character)
}

export function createAnswerSheetHtml({
  attempt,
  quiz,
  user,
  attemptHistory = [attempt],
  origin = typeof window === 'undefined' ? '' : window.location.origin,
}: {
  attempt: Attempt
  quiz: Quiz
  user?: User
  attemptHistory?: Attempt[]
  origin?: string
}) {
  const history = [...attemptHistory].sort((a, b) => a.attemptNumber - b.attemptNumber)
  const finalAttempt = history[history.length - 1] ?? attempt
  const assessmentTitle = getAssessmentTitle(quiz.title)
  const testAssignment = user?.testAssignments?.find((assignment) => assignment.quizId === quiz.id)
  const importedDetails = finalAttempt.importedAssessmentDetails
  const scheduledAssessmentDate = importedDetails?.assessmentDate ?? testAssignment?.assessmentDate ?? user?.assessmentDate
  const formatDate = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleDateString('en-GB') : ''
  const formatImportedDate = (date?: string) => date
    ? new Date(`${date}T00:00:00`).toLocaleDateString('en-GB')
    : ''
  const assessmentDate = scheduledAssessmentDate
    ? formatImportedDate(scheduledAssessmentDate)
    : formatDate(finalAttempt.submittedAt)
  const formatDateTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleString('en-GB') : ''
  const finalStatus = finalAttempt.competencyStatus ?? (finalAttempt.passed ? 'COMPETENT' : 'IN PROGRESS')
  const evaluation = getEvaluation(finalAttempt.percentage)
  const displayGrade = finalAttempt.recordedGrade ?? evaluation.grade
  const competencyLabel = finalAttempt.passed ? `${finalStatus} (Grade ${displayGrade})` : finalStatus
  const inspectorCategory = testAssignment?.scopeCategory ?? user?.scope17Category ?? user?.scope18Category ?? user?.scope19Category ?? user?.scope28Category
  const inspectorScope = importedDetails?.iafScope ?? testAssignment?.scopeSector ?? user?.scopeSector ?? ''
  const reconstructedResponses = finalAttempt.questionResponsesSource === 'reconstructed-from-aggregate-score'
  const correctCount = quiz.questions.filter((question) => {
    const selected = finalAttempt.answers[question.id] ?? []
    return selected.length === question.correct.length && selected.every((answer) => question.correct.includes(answer))
  }).length
  const attemptedCount = quiz.questions.filter((question) => (finalAttempt.answers[question.id] ?? []).length > 0).length
  const incorrectCount = attemptedCount - correctCount
  const totalMarks = quiz.questions.reduce((total, question) => total + question.points, 0)
  const logoSrc = origin ? new URL('/dyc-logo.svg', origin).href : '/dyc-logo.svg'
  const inspectorSignatureSrc = user?.inspectorSignature
    ? user.inspectorSignature.startsWith('data:') || user.inspectorSignature.startsWith('http')
      ? user.inspectorSignature
      : origin ? new URL(user.inspectorSignature, origin).href : user.inspectorSignature
    : ''
  const field = (label: string, value: string) => value.trim()
    ? `<div class="field"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`
    : ''
  const section = (number: number, title: string, body: string) => body
    ? `<section class="form-section"><h2><b>${number}.</b> ${escapeHtml(title)}</h2><div class="section-body">${body}</div></section>`
    : ''
  const summary = (label: string, value: string) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
  const questionRows = quiz.questions.map((question, index) => {
    const selected = finalAttempt.answers[question.id] ?? []
    const isAnswered = selected.length > 0
    const isCorrect = isAnswered && selected.length === question.correct.length && selected.every((answer) => question.correct.includes(answer))
    const optionText = (optionIds: string[]) => question.options
      .map((option, optionIndex) => optionIds.includes(option.id) ? `${String.fromCharCode(65 + optionIndex)}) ${escapeHtml(option.text)}` : null)
      .filter(Boolean)
      .join('<br>') || 'Not answered'
    const choices = question.options.map((option, optionIndex) => `${String.fromCharCode(65 + optionIndex)}) ${escapeHtml(option.text)}`).join('<br>')
    const hasDerivedAnswerSet = Object.keys(finalAttempt.answers ?? {}).length > 0
    const result = hasDerivedAnswerSet ? (isCorrect ? 'Correct' : isAnswered ? 'Incorrect' : 'Not attempted') : (isCorrect ? 'Correct' : isAnswered ? 'Incorrect' : 'Not attempted')
    const correctAnswer = optionText(question.correct)
    const candidateAnswer = hasDerivedAnswerSet ? optionText(selected) : ''
    return `<tr><td>${index + 1}</td><td>${escapeHtml(question.prompt)}<small>${question.points} mark${question.points === 1 ? '' : 's'}</small></td><td>${choices}</td><td>${correctAnswer}</td><td>${candidateAnswer}</td><td class="result">${result}</td><td>${escapeHtml(quiz.category)}</td></tr>`
  }).join('')

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Competency Assessment - ${escapeHtml(finalAttempt.userName)} - ${escapeHtml(assessmentTitle)}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; @bottom-right { content: 'Page ' counter(page) ' of ' counter(pages); color: #596579; font-size: 8px; } }
  * { box-sizing: border-box; }
  body { margin: 0; color: #20263a; font-family: Arial, sans-serif; font-size: 9px; }
  .watermark { position: fixed; z-index: 0; top: 50%; left: 50%; width: 100mm; opacity: .025; pointer-events: none; transform: translate(-50%, -50%); }
  .masthead, main { position: relative; z-index: 1; }
  .masthead { display: grid; grid-template-columns: 1fr 1.35fr; align-items: stretch; min-height: 59px; border: 1px solid #171747; border-top: 3px solid #08085c; border-bottom: 2px solid #f2bd24; background: #fff; }
  .brand { display: flex; align-items: center; gap: 7px; padding: 6px 8px; color: #08085c; font-size: 15px; font-weight: 800; line-height: 1; }
  .brand img { width: 31px; height: 31px; object-fit: contain; }
  .brand small { display: block; margin-top: 4px; color: #596579; font-size: 5.5px; font-weight: 700; letter-spacing: .3px; }
  .document-title { display: flex; flex-direction: column; justify-content: center; padding: 6px 8px; border-left: 1px solid #d8dce5; border-right: 1px solid #d8dce5; text-align: center; color: #08085c; font-size: 10px; font-weight: 800; line-height: 1.35; }
  .document-title small { display: block; margin-top: 4px; color: #596579; font-size: 7px; font-weight: 600; }
  .form-section { margin-top: 5px; overflow: hidden; border: 1px solid #cbd0dc; border-radius: 2px; background: #fff; break-inside: avoid; }
  .form-section > h2 { margin: 0; padding: 4px 6px; border-bottom: 1px solid #d8dce5; background: #f1f2f7; color: #171747; font-size: 8.5px; line-height: 1.2; }
  .form-section > h2 b { display: inline-block; min-width: 14px; margin-right: 3px; color: #08085c; }
  .section-body { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .field { display: grid; grid-template-columns: minmax(90px, 42%) minmax(0, 1fr); gap: 4px; min-height: 17px; padding: 3px 5px; border-top: 1px solid #e6e8ee; line-height: 1.25; }
  .field:nth-child(odd) { border-right: 1px solid #e6e8ee; }
  .field strong { font-weight: 600; }
  .field span { overflow-wrap: anywhere; }
  .section-body.single { display: block; }
  .section-body.single .field { border-right: 0; }
  .section-body:has(> .score-grid), .section-body:has(> table) { display: block; }
  .score-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .score-grid > div { display: flex; flex-direction: column; gap: 3px; min-height: 32px; padding: 5px 6px; border-top: 1px solid #e6e8ee; border-right: 1px solid #e6e8ee; }
  .score-grid > div:nth-child(4n) { border-right: 0; }
  .score-grid span { color: #596579; font-size: 7px; }
  .score-grid strong { color: #171747; font-size: 9px; }
  .status-pass { background: #e5f3e9; color: #185b32; }
  .status-fail { background: #f9e8e7; color: #8b2525; }
  .checks { grid-column: 1 / -1; padding: 5px 6px; line-height: 1.8; }
  .signature { grid-column: 1 / -1; min-height: 28px; border-top: 1px solid #e6e8ee; }
  .signature span { display: inline-block; min-width: 42%; padding: 5px; }
  .signature span + span { border-left: 1px solid #e1e7ec; }
  .inspector-signature { display: flex; align-items: end; gap: 8px; min-height: 34px; padding: 5px; border-top: 1px solid #e6e8ee; }
  .inspector-signature img { max-width: 120px; max-height: 38px; object-fit: contain; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7px; }
  th, td { padding: 4px 3px; border: 1px solid #d4d7e0; text-align: left; vertical-align: top; overflow-wrap: anywhere; line-height: 1.3; }
  th { background: #171747; color: #fff; font-size: 6.5px; }
  tbody tr:nth-child(even) { background: #f7f7fa; }
  tbody tr { break-inside: avoid; }
  td small { display: block; margin-top: 2px; color: #596579; }
  td.result { font-weight: 700; }
  td.pass { color: #18733c; }
  td.fail { color: #a22b2b; }
  .question-table .form-section { break-inside: auto; }
  .question-table thead { display: table-header-group; }
  .footer { margin-top: 6px; padding-top: 4px; border-top: 1px solid #f2bd24; color: #596579; font-size: 7px; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  @media screen { body { max-width: 210mm; margin: 16px auto; } }
</style>
</head>
<body>
<img class="watermark" src="${logoSrc}" alt="">
<header class="masthead">
  <div class="brand"><img src="${logoSrc}" alt=""><span>DYC GLOBAL<small>Ensuring Sustainable Excellence</small></span></div>
  <div class="document-title">TECHNICAL COMPETENCY ASSESSMENT<small>QUESTION-WISE ANSWER SHEET (SCOPE-SPECIFIC)</small></div>
</header>
<main>
${section(1, 'Candidate Details', [
  field('Full Name', user?.name ?? finalAttempt.userName),
  field('Employee / Inspector ID', user?.inspectorId ?? ''),
  field('Inspector Designation', user?.designation ?? importedDetails?.designation ?? ''),
  field('Department', user?.department ?? ''),
  field('Location', user?.location ?? ''),
].join(''))}
${section(2, 'Assessment Details', [
  field('Title of Assessment', assessmentTitle),
  field('Assessment Date', assessmentDate),
  field('Training Date', formatImportedDate(importedDetails?.trainingDate)),
  field('Training Time Slot', importedDetails?.trainingSlot ?? ''),
  field('Training Type', 'Self taken on internal virtual training module'),
  field('Training Material', 'PPT, Videos as per Training module'),
  field('Internal / External', 'Internal'),
  field('Start Time', formatDateTime(finalAttempt.startedAt)),
  field('End Time', formatDateTime(finalAttempt.submittedAt)),
  field('CBT Time Slot', importedDetails?.cbtSlot ?? testAssignment?.scheduledSlot ?? ''),
  field('CBT Duration', importedDetails?.cbtDuration ?? `${testAssignment?.durationMinutes ?? quiz.durationMinutes} min`),
  field('Assessment Time Limit', `${testAssignment?.durationMinutes ?? quiz.durationMinutes} min`),
  field('Attempt No.', String(finalAttempt.attemptNumber)),
].join(''))}
${section(3, 'Scope & Competency Details', [
  field('IAF Scope', inspectorScope),
  field('Technical Category', importedDetails?.topic ?? inspectorCategory ?? quiz.category),
].join(''))}
${section(4, 'Applicable Codes / Standards / Specifications', field('Applicable references', 'As per accredited scope, latest editions of applicable codes and standards.'))}
${section(5, 'Assessment Rules & Passing Criteria', `<div class="score-grid">${summary('Total Questions', String(quiz.questions.length))}${summary('Total Marks', String(totalMarks))}${summary('Minimum Passing Criteria', `${quiz.passingScore}%`)}${summary('Negative Marking', 'No')}</div>`)}
${section(6, 'Competency Area-wise Performance Summary', `<table><thead><tr><th>Competency Area</th><th>Total Questions</th><th>Correct</th><th>Incorrect</th><th>Not Attempted</th><th>Accuracy</th></tr></thead><tbody><tr><td>${escapeHtml(quiz.category)}</td><td>${quiz.questions.length}</td><td>${correctCount}</td><td>${incorrectCount}</td><td>${quiz.questions.length - attemptedCount}</td><td>${quiz.questions.length ? Math.round((correctCount / quiz.questions.length) * 100) : 0}%</td></tr></tbody></table>`)}
${section(7, 'Overall Result', `<div class="score-grid">${summary('Total Questions', String(quiz.questions.length))}${summary('Correct Answers', String(correctCount))}${summary('Incorrect Answers', String(incorrectCount))}${summary('Not Attempted', String(quiz.questions.length - attemptedCount))}${summary('Score', `${finalAttempt.score} / ${finalAttempt.maxScore}`)}${summary('Percentage', `${finalAttempt.percentage}%`)}${summary('Recorded Authorization Grade', displayGrade)}<div class="${finalAttempt.passed ? 'status-pass' : 'status-fail'}"><span>Result / Competency Status</span><strong>${escapeHtml(competencyLabel)}</strong></div></div>`)}
${section(8, 'Authorization Recommendation', field('Recommended authorization grade', displayGrade || 'Not recorded'))}
<div class="question-table">${section(9, reconstructedResponses ? 'Question-wise Reconstructed Response Map' : 'Question-wise Answer Sheet', `<table><thead><tr><th style="width:4%">Q. No.</th><th style="width:19%">Question</th><th style="width:20%">Options</th><th style="width:15%">Correct Answer</th><th style="width:15%">Candidate Answer</th><th style="width:9%">Result</th><th style="width:18%">Competency Area</th></tr></thead><tbody>${questionRows}</tbody></table>` )}</div>
${section(10, 'Candidate Acknowledgment', `<div class="checks">${reconstructedResponses ? 'Candidate acknowledgment should be completed only after the reconstructed question responses have been checked against the original CBT answer record.' : 'I confirm that I have taken the assessment and the answers shown above correctly represent my attempt.'}</div>${inspectorSignatureSrc ? `<div class="inspector-signature"><strong>Inspector Signature:</strong><img src="${escapeHtml(inspectorSignatureSrc)}" alt="Inspector signature"><span>${escapeHtml(user?.name ?? finalAttempt.userName)}</span></div>` : ''}`) }
<div class="footer">Generated by DYC Global Assessment Platform · Assessment ${escapeHtml(quiz.id)} · Attempt ${escapeHtml(finalAttempt.id)}${history.length > 1 ? ` · ${history.length} recorded attempts` : ''}${reconstructedResponses ? ` · Reconstructed response map based on source score ${finalAttempt.score}/${finalAttempt.maxScore}${importedDetails?.sourceSheet ? `; source sheet ${escapeHtml(importedDetails.sourceSheet)}` : ''}` : ''}</div>
</main>
</body>
</html>`

  return html
}

export function AnswerSheetDownload({
  attempt,
  quiz,
  user,
  attemptHistory = [attempt],
}: {
  attempt: Attempt
  quiz: Quiz
  user?: User
  attemptHistory?: Attempt[]
}) {
  function downloadAnswerSheet() {
    const html = createAnswerSheetHtml({ attempt, quiz, user, attemptHistory })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const printWindow = window.open(url, '_blank')
    if (!printWindow) {
      URL.revokeObjectURL(url)
      return
    }
    printWindow.addEventListener('load', () => {
      printWindow.focus()
      printWindow.print()
      URL.revokeObjectURL(url)
    }, { once: true })
  }

  return (
    <Button type="button" variant="default" size="sm" className="gap-2 shadow-sm" onClick={downloadAnswerSheet}>
      <Download className="h-4 w-4" />
      Save answer sheet as PDF
    </Button>
  )
}
