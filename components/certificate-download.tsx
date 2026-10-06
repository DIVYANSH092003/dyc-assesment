'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Attempt, Role, User } from '@/lib/types'
import { formatAuthorizationGrade, getAuthorizationGrade, getEvaluation } from '@/lib/evaluation'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character)
}

export function CertificateDownload({
  attempt,
  role = 'inspector',
  user,
}: {
  attempt: Attempt
  role?: Role
  user?: User
}) {
  if (!attempt.passed && attempt.competencyStatus !== 'NOT COMPETENT') return null

  function downloadCertificate() {
    const submitted = new Date(attempt.submittedAt).toLocaleDateString('en-GB')
    const status = attempt.passed ? 'COMPETENT' : 'NOT COMPETENT'
    const evaluation = getEvaluation(attempt.percentage)
    const grade = formatAuthorizationGrade(getAuthorizationGrade(attempt.percentage, attempt.recordedGrade))
    const roleName = role === 'inspector' ? 'Inspector' : role === 'admin' ? 'Administrator' : 'TM / QA'
    const logoSrc = new URL('/dyc-logo.svg', window.location.origin).href
    const category = user?.scope17Category ?? user?.scope18Category ?? user?.scope19Category ?? user?.scope28Category
    const profileDetails = [
      user?.inspectorId ? `Inspector ID: ${user.inspectorId}` : '',
      user?.designation,
      user?.scopeSector,
      category,
    ].filter(Boolean).join(' · ')
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Inspector Assessment Certificate - ${escapeHtml(attempt.userName)} - DYC Global</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { width: 210mm; height: 297mm; margin: 0; }
  body { background: #f8f9fa; color: #0b114d; font-family: Arial, Helvetica, sans-serif; }
  .certificate { width: 210mm; height: 297mm; padding: 13mm; background: #fff; overflow: hidden; }
  .outer { width: 100%; height: 100%; padding: 5px; border: 3px solid #0b114d; }
  .inner { position: relative; display: flex; width: 100%; height: 100%; flex-direction: column; align-items: center; justify-content: space-between; padding: 14mm 12mm 9mm; border: 1px solid #e0aa3e; text-align: center; background: linear-gradient(135deg, #fff 0%, #fafbfe 100%); }
  .corner { position: absolute; width: 22px; height: 22px; border-color: #e0aa3e; border-style: solid; }
  .tl { top: -2px; left: -2px; border-width: 3px 0 0 3px; }
  .tr { top: -2px; right: -2px; border-width: 3px 3px 0 0; }
  .bl { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; }
  .br { right: -2px; bottom: -2px; border-width: 0 3px 3px 0; }
  .watermark { position: absolute; top: 50%; left: 50%; width: 105mm; opacity: .045; transform: translate(-50%, -50%); }
  .content { position: relative; z-index: 1; width: 100%; }
  .brand { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 15mm; }
  .logo { width: 21mm; height: 21mm; object-fit: contain; }
  .brand-name { margin: 0; color: #0b114d; font-size: 22px; font-weight: 800; letter-spacing: 1px; text-align: left; }
  .tagline { margin-top: 5px; color: #b17d21; font-size: 7px; font-weight: 700; letter-spacing: 1.6px; text-align: left; }
  .eyebrow { margin: 0 0 7px; color: #8c6828; font-size: 9px; font-weight: 700; letter-spacing: 2.6px; text-transform: uppercase; }
  h1 { margin: 0; color: #0b114d; font-family: Georgia, 'Times New Roman', serif; font-size: 25px; line-height: 1.3; text-transform: uppercase; }
  .rule { display: flex; width: 62%; align-items: center; gap: 9px; margin: 12px auto 0; }
  .rule span { height: 1px; flex: 1; background: linear-gradient(90deg, transparent, #e0aa3e, transparent); }
  .diamond { width: 7px; height: 7px; background: #e0aa3e; transform: rotate(45deg); }
  .award { margin: 0 0 10px; color: #53627a; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; }
  .name { display: inline-block; max-width: 100%; margin: 0 0 5px; padding: 0 8px 6px; border-bottom: 2px solid #e0aa3e; color: #0b114d; font-family: Georgia, 'Times New Roman', serif; font-size: 29px; font-weight: 700; overflow-wrap: anywhere; }
  .role { margin: 4px 0 8px; color: #8c6828; font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
  .profile { max-width: 100%; margin: 0 auto 12px; color: #53627a; font-size: 8px; line-height: 1.6; }
  .completion { max-width: 125mm; margin: 0 auto 7px; color: #53627a; font-size: 10px; line-height: 1.6; }
  .assessment { max-width: 135mm; margin: 0 auto 13px; color: #0b114d; font-size: 18px; font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; }
  .metrics { display: grid; width: 100%; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; margin: 0 auto 13px; padding: 10px 4px; border: 1px solid #eaedf2; background: #fff; }
  .metric { min-width: 0; padding: 0 4px; border-right: 1px solid #f0f2f5; }
  .metric:last-child { border-right: 0; }
  .value { margin-bottom: 4px; color: #0b114d; font-size: 14px; font-weight: 800; overflow-wrap: anywhere; }
  .label { color: #78849a; font-size: 6px; font-weight: 700; letter-spacing: .7px; text-transform: uppercase; }
  .status { display: inline-block; padding: 6px 20px; border: 1.5px solid ${attempt.passed ? '#2b8650' : '#b54343'}; border-radius: 20px; background: ${attempt.passed ? 'rgba(43,134,80,.08)' : 'rgba(181,67,67,.08)'}; color: ${attempt.passed ? '#2b8650' : '#b54343'}; font-size: 9px; font-weight: 800; letter-spacing: 2px; }
  .footer { width: 100%; }
  .signatures { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin-bottom: 13px; }
  .sign { width: 38%; }
  .sign-line { padding-top: 6px; border-top: 1px solid #b0b8c5; color: #0b114d; font-size: 7px; font-weight: 800; letter-spacing: .7px; text-transform: uppercase; }
  .sign-sub { margin-top: 3px; color: #78849a; font-size: 6px; }
  .meta { padding-top: 7px; border-top: 1px solid #f0f2f5; color: #8c96a6; font-size: 6px; line-height: 1.6; overflow-wrap: anywhere; }
  .meta strong { color: #53627a; }
  @media screen { body { margin: 12px auto; box-shadow: 0 3px 18px #0002; } }
  @media print { body { background: #fff; } }
</style>
</head>
<body>
  <main class="certificate"><div class="outer"><div class="inner">
    <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
    <img class="watermark" src="${logoSrc}" alt="">
    <header class="content">
      <div class="brand"><img class="logo" src="${logoSrc}" alt="DYC Global"><div><p class="brand-name">DYC GLOBAL</p><div class="tagline">ENSURING SUSTAINABLE EXCELLENCE</div></div></div>
      <p class="eyebrow">${attempt.importedSource === 'competency-evaluation' ? 'DYC Global · Recorded CBT result' : 'DYC Global Assessment Platform'}</p>
      <h1>Assessment Result Certificate</h1>
      <div class="rule"><span></span><i class="diamond"></i><span></span></div>
    </header>
    <section class="content">
      <p class="award">Assessment result recorded for</p>
      <p class="name">${escapeHtml(user?.name ?? attempt.userName)}</p>
      <p class="role">${escapeHtml(roleName)}</p>
      ${profileDetails ? `<p class="profile">${escapeHtml(profileDetails)}</p>` : ''}
      <p class="completion">${attempt.importedSource === 'competency-evaluation'
        ? 'This certificate transcribes the score and recommended grade in the supplied CBT results register. It is an assessment result record and does not itself grant or change inspector authorization.'
        : attempt.passed
          ? 'for successfully completing the formal inspection competency assessment'
          : 'for completing the formal inspection competency assessment'}</p>
      <p class="assessment">${escapeHtml(attempt.quizTitle)}</p>
      <div class="metrics">
        <div class="metric"><div class="value">${attempt.percentage}%</div><div class="label">Score</div></div>
        <div class="metric"><div class="value">${evaluation.score.toFixed(1)} / 10</div><div class="label">Authorization grade (${grade})</div></div>
        <div class="metric"><div class="value">${attempt.score} / ${attempt.maxScore}</div><div class="label">Points</div></div>
        <div class="metric"><div class="value">${escapeHtml(submitted)}</div><div class="label">Date Completed</div></div>
      </div>
      <div class="status">${attempt.passed ? '✓ ' : ''}${status}</div>
    </section>
    <footer class="content footer">
      <div class="signatures">
        <div class="sign"><div class="sign-line">Head of Assessment</div><div class="sign-sub">DYC Global Certification Board</div></div>
        <div class="sign"><div class="sign-line">Authorized Signatory</div><div class="sign-sub">DYC Global Private Limited</div></div>
      </div>
      <div class="meta">Generated by <strong>DYC Global Assessment Platform</strong> &nbsp;·&nbsp; Record ID: <strong>${escapeHtml(attempt.id)}</strong> &nbsp;·&nbsp; Assessment: <strong>${escapeHtml(attempt.quizTitle)}</strong>${attempt.importedAssessmentDetails ? ` &nbsp;·&nbsp; Source: <strong>${escapeHtml(attempt.importedAssessmentDetails.sourceSheet)}</strong>` : ''}</div>
    </footer>
  </div></div>
</body>
</html>`

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
    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={downloadCertificate}>
      <Download className="h-4 w-4" />
      Save certificate as PDF
    </Button>
  )
}
