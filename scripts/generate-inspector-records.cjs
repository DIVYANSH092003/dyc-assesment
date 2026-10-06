const fs = require('node:fs')
const path = require('node:path')
const XLSX = require('xlsx')

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character])
}

function slug(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return 'Not recorded in source register'
  const match = text.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,}|\d{1,2})[-/ ](\d{4})$/)
  if (!match) return text
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = /^\d+$/.test(match[2])
    ? Number(match[2]) - 1
    : months.findIndex((name) => name.toLowerCase() === match[2].slice(0, 3).toLowerCase())
  if (month < 0 || month > 11) return text
  return `${String(Number(match[1])).padStart(2, '0')} ${months[month]} ${match[3]}`
}

function readRecords(workbook, existingUsers, quizById) {
  const assignmentsByInspector = new Map()
  for (const user of existingUsers) {
    const assignmentsByTopic = new Map()
    for (const assignment of user.testAssignments ?? []) {
      const topicKey = String(assignment.scopeCategory ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
      const quiz = quizById.get(assignment.quizId)
      if (!topicKey || !quiz) {
        throw new Error(`An existing test assignment for ${user.name} is missing its category or quiz record.`)
      }
      if (assignmentsByTopic.has(topicKey)) {
        throw new Error(`More than one existing test assignment for ${user.name} matches category "${assignment.scopeCategory}".`)
      }
      assignmentsByTopic.set(topicKey, { ...assignment, quizTitle: quiz.title })
    }
    assignmentsByInspector.set(user.name.toLowerCase().replace(/\s+/g, ' '), assignmentsByTopic)
  }

  const inspectors = []
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false })
    const records = rows
      .filter((row) => String(row['Training Topic '] ?? row['Training Topic'] ?? '').trim())
      .map((row, index) => {
        const name = String(row['Surveyor Name'] ?? row.Inspector ?? sheetName).trim().replace(/\s+/g, ' ')
        const topic = String(row['Training Topic '] ?? row['Training Topic'] ?? row['Inspection Field / Specific Item'] ?? '').trim()
        const marks = String(row['CBT Marks obtained '] ?? row['CBT Marks obtained'] ?? '').trim()
        const total = String(row['CBT marks '] ?? row['CBT marks'] ?? '').trim()
        const grade = String(row['Recommended Authorization '] ?? row['Recommended Authorization'] ?? '').trim()
        if (!name || !topic || !marks || !total || !grade) {
          throw new Error(`Worksheet "${sheetName}" row ${index + 2} is missing the inspector, topic, marks, or recommended authorization.`)
        }
        const inspectorAssignments = assignmentsByInspector.get(name.toLowerCase().replace(/\s+/g, ' '))
        const topicKey = topic.toLowerCase().replace(/[^a-z0-9]+/g, '')
        const assignment = inspectorAssignments?.get(topicKey)
        if (!assignment) {
          throw new Error(`Worksheet "${sheetName}" row ${index + 2}: no matching already-assigned test was found for "${topic}".`)
        }
        return {
          name,
          topic,
          assignedTest: assignment.quizTitle,
          scope: String(row['IAF Scope'] ?? '').trim(),
          date: formatDate(row['CBT Date'] ?? assignment.assessmentDate),
          slot: String(row.__EMPTY_1 ?? assignment.scheduledSlot ?? '').trim(),
          duration: String(row['CBT Time'] ?? (assignment.durationMinutes ? `${assignment.durationMinutes} min` : '')).trim(),
          marks,
          total,
          grade,
        }
      })
    if (!records.length) continue
    inspectors.push({ name: records[0].name, records, sheetName })
  }
  if (!inspectors.length) throw new Error('No inspector assessment records were found in the workbook.')
  return inspectors
}

function styles() {
  return `
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; color: #20263a; font: 10pt Arial, sans-serif; background: #f4f6fa; }
    .document { max-width: 210mm; margin: 12px auto; }
    .page { position: relative; min-height: 273mm; margin: 0 auto 16px; padding: 12mm; background: #fff; border: 1px solid #d6dbe5; }
    .masthead { display: flex; align-items: center; gap: 12px; padding: 0 0 12px; border-bottom: 3px solid #e0aa3e; color: #0b114d; }
    .masthead img { width: 44px; height: 44px; object-fit: contain; }
    .brand { margin: 0; font-size: 17pt; font-weight: 800; letter-spacing: .6px; }
    .tagline { margin-top: 4px; color: #68748a; font-size: 7pt; letter-spacing: 1px; }
    .eyebrow { margin: 22px 0 6px; color: #9b7023; font-size: 8pt; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; }
    h1 { margin: 0; color: #11164f; font: 700 20pt Georgia, serif; }
    .subtitle { margin: 7px 0 18px; color: #5f6b80; font-size: 9pt; line-height: 1.5; }
    h2 { margin: 18px 0 0; padding: 8px 10px; background: #171747; color: #fff; font-size: 9pt; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #d7dbe4; }
    .field { display: grid; grid-template-columns: 42% 58%; gap: 8px; min-height: 29px; padding: 7px; border-bottom: 1px solid #e8eaf0; overflow-wrap: anywhere; }
    .field:nth-child(odd) { border-right: 1px solid #e8eaf0; }
    .field strong { color: #273149; }
    .field span { color: #4f5c72; }
    .score { margin-top: 18px; padding: 16px; border: 1px solid #d7dbe4; background: #f8f9fc; text-align: center; }
    .score strong { display: block; color: #10164f; font-size: 23pt; }
    .score span { display: block; margin-top: 5px; color: #68748a; font-size: 9pt; }
    .notice { margin-top: 18px; padding: 10px 12px; border-left: 3px solid #e0aa3e; color: #596579; font-size: 8pt; line-height: 1.55; }
    .footer { position: absolute; right: 12mm; bottom: 9mm; left: 12mm; padding-top: 7px; border-top: 1px solid #e0aa3e; color: #768197; font-size: 7pt; line-height: 1.5; }
    .certificate { display: flex; min-height: 249mm; flex-direction: column; justify-content: space-between; padding: 10mm; border: 4px double #12184e; text-align: center; }
    .certificate .masthead { justify-content: center; text-align: left; }
    .certificate .eyebrow { margin-top: 30px; }
    .certificate h1 { font-size: 24pt; text-transform: uppercase; }
    .certificate .award { margin: 28px 0 12px; color: #69758a; font-size: 10pt; letter-spacing: 1px; text-transform: uppercase; }
    .recipient { margin: 0 auto 10px; color: #10164f; font: 700 27pt Georgia, serif; overflow-wrap: anywhere; }
    .certificate .role { color: #9b7023; font-size: 9pt; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
    .certificate .topic { margin: 26px auto 15px; color: #10164f; font-size: 16pt; font-weight: 700; line-height: 1.4; }
    .certificate .metrics { display: grid; grid-template-columns: repeat(4, 1fr); margin: 20px 0; padding: 12px 0; border: 1px solid #dfe3eb; }
    .metric { padding: 0 7px; border-right: 1px solid #e5e8ee; }
    .metric:last-child { border-right: 0; }
    .metric strong { display: block; margin-bottom: 4px; color: #10164f; font-size: 13pt; }
    .metric span { color: #768197; font-size: 7pt; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
    .result-label { display: inline-block; padding: 7px 20px; border: 1px solid #a87922; color: #815c17; font-size: 9pt; font-weight: 800; letter-spacing: 1.4px; }
    .signature { display: flex; justify-content: space-between; gap: 20px; margin-top: 25px; }
    .signature div { width: 45%; padding-top: 8px; border-top: 1px solid #aeb6c4; color: #596579; font-size: 7pt; }
    .draft { margin-top: 18px; color: #7d8799; font-size: 7pt; line-height: 1.5; }
    .index { max-width: 900px; margin: 30px auto; padding: 24px; background: #fff; }
    .index li { margin: 10px 0; }
    .index a { color: #11164f; }
    @media print {
      body { background: #fff; }
      .document { max-width: none; margin: 0; }
      .page { height: 283mm; min-height: 283mm; margin: 0; overflow: hidden; border: 0; break-after: page; page-break-after: always; }
      .certificate { height: 259mm; min-height: 259mm; }
      .page:last-child { break-after: auto; page-break-after: auto; }
      .index { display: none; }
    }
  `
}

function field(label, value) {
  return `<div class="field"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value || 'Not recorded')}</span></div>`
}

function assessmentPages(record, index, logo) {
  const code = `${slug(record.name)}-${String(index + 1).padStart(2, '0')}`
  const identity = `<div class="masthead"><img src="${logo}" alt="DYC Global"><div><p class="brand">DYC GLOBAL</p><div class="tagline">ENSURING SUSTAINABLE EXCELLENCE</div></div></div>`
  const score = Number(record.marks.replace(/,/g, ''))
  const total = Number(record.total.replace(/,/g, ''))
  const percentage = Number.isFinite(score) && Number.isFinite(total) && total > 0
    ? `${Math.round((score / total) * 100)}%`
    : 'Not calculated'

  return `
    <section class="page">
      ${identity}
      <p class="eyebrow">Assessment register record · ${escapeHtml(code)}</p>
      <h1>CBT Assessment Marks Sheet</h1>
      <p class="subtitle">Recorded assessment result for the inspector/surveyor named below. Scores and recommendation are transcribed from the provided assessment register.</p>
      <h2>Inspector and assessment details</h2>
      <div class="grid">
        ${field('Inspector / Surveyor', record.name)}
        ${field('IAF Scope', record.scope)}
        ${field('Assigned test', record.assignedTest)}
        ${field('CBT assessment date', record.date)}
        ${field('CBT time slot', record.slot)}
        ${field('CBT duration', record.duration)}
      </div>
      <h2>Recorded outcome</h2>
      <div class="score"><strong>${escapeHtml(record.marks)} / ${escapeHtml(record.total)}</strong><span>Marks obtained / total CBT marks · ${escapeHtml(percentage)}</span></div>
      <div class="grid">
        ${field('Recommended authorization grade', record.grade)}
        ${field('Record reference', code)}
      </div>
      <div class="notice"><strong>Answer detail limitation:</strong> The source register contains aggregate marks and a recommended authorization grade, but does not include the selected answers, question-level marks, or an answer key. This document is therefore a marks/result sheet and does not claim to reproduce the candidate&apos;s individual answers.</div>
      <div class="footer">DYC Global · Transcribed from the provided assessment register · Record ${escapeHtml(code)}</div>
    </section>
    <section class="page">
      <div class="certificate">
        <div>
          ${identity}
          <p class="eyebrow">DYC Global · Assessment record</p>
          <h1>CBT Assessment Result Certificate</h1>
          <p class="award">This assessment result record is presented for</p>
          <p class="recipient">${escapeHtml(record.name)}</p>
          <p class="role">Inspector / Surveyor</p>
          <p class="topic">${escapeHtml(record.assignedTest)}</p>
          <p class="subtitle">Assessment topic: ${escapeHtml(record.topic)}</p>
          <p class="subtitle">${escapeHtml(record.scope)}</p>
          <div class="metrics">
            <div class="metric"><strong>${escapeHtml(record.marks)} / ${escapeHtml(record.total)}</strong><span>Marks</span></div>
            <div class="metric"><strong>${escapeHtml(percentage)}</strong><span>Score</span></div>
            <div class="metric"><strong>${escapeHtml(record.grade)}</strong><span>Recommended grade</span></div>
            <div class="metric"><strong>${escapeHtml(record.date)}</strong><span>Assessment date</span></div>
          </div>
          <span class="result-label">REGISTERED ASSESSMENT RESULT</span>
          <p class="draft">Record copy generated from the provided register. This is not an independently verified qualification or authorization certificate; signature and approval have not been supplied.</p>
        </div>
        <div>
          <div class="signature"><div>Assessment authority / authorized signatory</div><div>Date and seal</div></div>
          <div class="footer">Record ${escapeHtml(code)} · CBT time: ${escapeHtml(record.slot || 'Not recorded')} · Duration: ${escapeHtml(record.duration || 'Not recorded')}</div>
        </div>
      </div>
    </section>
  `
}

function makeInspectorHtml(inspector, logo) {
  const pages = inspector.records.map((record, index) => assessmentPages(record, index, logo)).join('\\n')
  const css = styles()
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Assessment records - ${escapeHtml(inspector.name)}</title><style>${css}</style></head>
<body><main class="document">${pages}</main></body></html>`
}

function makeIndex(inspectors) {
  const rows = inspectors.map((inspector) => `<li><a href="${escapeHtml(slug(inspector.name))}.html">${escapeHtml(inspector.name)}</a> — ${inspector.records.length} assessment records</li>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DYC inspector assessment records</title><style>${styles()}</style></head><body><main class="index"><h1>Inspector assessment documents</h1><p>Open an inspector file and use the browser print command to save it as PDF. Each assessment has a marks sheet followed by a result certificate.</p><p><strong>Important:</strong> The source register does not provide question-level responses. The generated marks sheet reports only the recorded aggregate score and recommendation.</p><ul>${rows}</ul></main></body></html>`
}

function main() {
  const workbookPath = process.argv[2]
  const outputDir = process.argv[3] || path.resolve(__dirname, '..', 'generated', 'inspector-records')
  if (!workbookPath || !fs.existsSync(workbookPath)) {
    throw new Error('Usage: node scripts/generate-inspector-records.cjs <register.xlsx> [output-directory]')
  }

  const workbook = XLSX.readFile(workbookPath, { cellDates: true })
  const usersPath = path.resolve(__dirname, '..', 'data', 'inspector-timetable-users.json')
  const quizzesPath = path.resolve(__dirname, '..', 'data', 'inspector-commodity-quizzes.json')
  const existingUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'))
  const quizzes = JSON.parse(fs.readFileSync(quizzesPath, 'utf8'))
  const inspectors = readRecords(workbook, existingUsers, new Map(quizzes.map((quiz) => [quiz.id, quiz])))
  const logoPath = path.resolve(__dirname, '..', 'public', 'dyc-logo.svg')
  const logo = `data:image/svg+xml;base64,${fs.readFileSync(logoPath).toString('base64')}`
  fs.mkdirSync(outputDir, { recursive: true })

  for (const inspector of inspectors) {
    const outputPath = path.join(outputDir, `${slug(inspector.name)}.html`)
    fs.writeFileSync(outputPath, makeInspectorHtml(inspector, logo), 'utf8')
  }
  fs.writeFileSync(path.join(outputDir, 'index.html'), makeIndex(inspectors), 'utf8')
  const totalRecords = inspectors.reduce((total, inspector) => total + inspector.records.length, 0)
  console.log(JSON.stringify({
    inspectors: inspectors.length,
    assessments: totalRecords,
    answerMarkSheets: totalRecords,
    resultCertificates: totalRecords,
    outputDirectory: outputDir,
    inspectorsWithMissingAssessmentDates: inspectors.filter((inspector) =>
      inspector.records.some((record) => record.date === 'Not recorded in source register'),
    ).map((inspector) => inspector.name),
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
