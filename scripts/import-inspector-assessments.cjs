const fs = require('node:fs')
const path = require('node:path')
const XLSX = require('xlsx')

const root = path.resolve(__dirname, '..')
const workbookPath = process.argv[2]
const schedulePath = process.argv[3]
const outputPath = process.argv[4] || path.join(root, 'data', 'inspector-assessment-results.json')
const usersPath = path.join(root, 'data', 'inspector-timetable-users.json')
const quizzesPath = path.join(root, 'data', 'inspector-commodity-quizzes.json')

const nameAliases = new Map([
  ['dipak kolambe', 'deepak kolambe'],
  ['s g azhagesan', 's g azhegasan'],
])

function normalize(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeTopic(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function requiredText(value, label, sheetName, rowNumber) {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: ${label} is missing.`)
  return text
}

function parseDate(value, label, sheetName, rowNumber) {
  const text = requiredText(value, label, sheetName, rowNumber)
  const match = text.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,}|\d{1,2})[-/ ](\d{4})$/)
  if (!match) {
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
    throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: "${text}" is not a supported ${label}.`)
  }

  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const month = /^\d+$/.test(match[2])
    ? Number(match[2]) - 1
    : months.indexOf(match[2].slice(0, 3).toLowerCase())
  if (month < 0 || month > 11) {
    throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: "${text}" has an invalid month.`)
  }
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`
}

function parsePositiveNumber(value, label, sheetName, rowNumber) {
  const number = Number(String(value ?? '').replace(/,/g, '').trim())
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: ${label} must be a positive number.`)
  }
  return number
}

function loadScheduleRecords(scheduleWorkbookPath, users) {
  if (!scheduleWorkbookPath) return new Map()
  if (!fs.existsSync(scheduleWorkbookPath)) {
    throw new Error(`Schedule workbook does not exist: ${scheduleWorkbookPath}`)
  }

  const workbook = XLSX.readFile(scheduleWorkbookPath, { cellDates: true })
  const worksheet = workbook.Sheets['CBT Assessment Register']
  if (!worksheet) throw new Error('The schedule workbook must contain a "CBT Assessment Register" sheet.')
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false })
  const headers = (matrix[0] ?? []).map((value) => String(value ?? '').trim())
  const column = (name) => headers.indexOf(name)
  const schedules = new Map()

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex]
    const sourceName = String(row[column('Inspector / Candidate')] ?? '').trim()
    const topic = String(row[column('Inspection Field / Specific Item')] ?? '').trim()
    if (!sourceName || !topic) continue

    const normalizedName = normalize(sourceName)
    const canonicalName = nameAliases.get(normalizedName) ?? normalizedName
    const user = users.find((item) => normalize(item.name) === canonicalName)
    if (!user) continue
    const key = `${user.id}:${normalizeTopic(topic)}`
    if (schedules.has(key)) throw new Error(`The schedule workbook repeats ${user.name} / "${topic}".`)
    const rowNumber = rowIndex + 1
    const dateText = String(row[column('CBT Assessment Date')] ?? '').trim()
    const plannedDateText = String(row[column('Planned Date')] ?? '').trim()
    schedules.set(key, {
      assessmentDate: dateText ? parseDate(dateText, 'CBT Assessment Date', 'CBT Assessment Register', rowNumber) : '',
      trainingDate: plannedDateText ? parseDate(plannedDateText, 'Planned Date', 'CBT Assessment Register', rowNumber) : '',
      cbtSlot: String(row[column('CBT Slot (30 min)')] ?? '').trim(),
      durationMinutes: Number(String(row[column('Duration (min)')] ?? '').trim()) || 0,
      trainingSlot: String(row[column('Training (as per plan)')] ?? '').trim(),
    })
  }
  return schedules
}

function main() {
  if (!workbookPath || !fs.existsSync(workbookPath)) {
    throw new Error('Usage: node scripts/import-inspector-assessments.cjs <results.xlsx> [schedule.xlsx] [output.json]')
  }

  const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'))
  const quizzes = JSON.parse(fs.readFileSync(quizzesPath, 'utf8'))
  const workbook = XLSX.readFile(workbookPath, { cellDates: true })
  const scheduleRecords = loadScheduleRecords(schedulePath, users)
  const records = []
  const seenAssignments = new Set()

  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: '',
      raw: false,
    })
    const headers = (matrix[0] ?? []).map((value) => String(value ?? '').trim())
    const column = (name) => headers.indexOf(name)
    const topicColumn = column('Training Topic')
    if (topicColumn < 0) continue

    for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex]
      const topic = String(row[topicColumn] ?? '').trim()
      if (!topic) continue
      const rowNumber = rowIndex + 1
      const candidateColumn = column('Surveyor Name')
      const candidateSourceName = requiredText(row[candidateColumn], 'Surveyor Name', sheetName, rowNumber)
      const normalizedName = normalize(candidateSourceName)
      const canonicalName = nameAliases.get(normalizedName) ?? normalizedName
      const user = users.find((item) => normalize(item.name) === canonicalName)
      if (!user) {
        throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: no inspector profile matches "${candidateSourceName}".`)
      }

      const matchingAssignments = (user.testAssignments ?? []).filter((assignment) =>
        normalizeTopic(assignment.scopeCategory) === normalizeTopic(topic),
      )
      if (matchingAssignments.length !== 1) {
        throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: expected one assigned quiz for "${topic}" and ${user.name}, found ${matchingAssignments.length}.`)
      }
      const assignment = matchingAssignments[0]
      const quiz = quizzes.find((item) => item.id === assignment.quizId)
      if (!quiz) throw new Error(`Assigned quiz "${assignment.quizId}" for ${user.name} is missing.`)

      const totalMarks = parsePositiveNumber(row[column('CBT marks')], 'CBT marks', sheetName, rowNumber)
      const marksObtained = Number(String(row[column('CBT Marks obtained')] ?? '').replace(/,/g, '').trim())
      if (!Number.isFinite(marksObtained) || marksObtained < 0 || marksObtained > totalMarks) {
        throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: CBT Marks obtained must be from 0 to ${totalMarks}.`)
      }
      const grade = requiredText(row[column('Recommended Authorization')], 'Recommended Authorization', sheetName, rowNumber).toUpperCase()
      if (!['A', 'B', 'C', 'W'].includes(grade)) {
        throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: unsupported authorization grade "${grade}".`)
      }
      const trainingDurationColumn = column('Duration of training')
      const cbtDurationColumn = column('CBT Time')
      const durationText = requiredText(row[cbtDurationColumn], 'CBT duration', sheetName, rowNumber)
      const durationMatch = durationText.match(/\d+/)
      if (!durationMatch) {
        throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: CBT duration "${durationText}" is invalid.`)
      }
      const trainingDuration = trainingDurationColumn >= 0 ? String(row[trainingDurationColumn] ?? '').trim() : ''
      const trainingSlot = trainingDurationColumn >= 0 ? String(row[trainingDurationColumn + 1] ?? '').trim() : ''
      const schedule = scheduleRecords.get(`${user.id}:${normalizeTopic(topic)}`)
      const workbookDate = String(row[column('CBT Date')] ?? '').trim()
      const scheduleDate = schedule?.assessmentDate
      if (workbookDate && scheduleDate && parseDate(workbookDate, 'CBT Date', sheetName, rowNumber) !== scheduleDate) {
        throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: CBT date does not match the schedule register for ${user.name} / "${topic}".`)
      }
      const workbookSlot = String(row[cbtDurationColumn + 1] ?? '').trim()
      if (workbookSlot && schedule?.cbtSlot && workbookSlot !== schedule.cbtSlot) {
        throw new Error(`Worksheet "${sheetName}" row ${rowNumber}: CBT slot does not match the schedule register for ${user.name} / "${topic}".`)
      }
      const cbtSlot = workbookSlot || schedule?.cbtSlot || assignment.scheduledSlot || ''
      const assessmentDateValue = workbookDate || scheduleDate || assignment.assessmentDate || user.assessmentDate
      const trainingDateValue = row[column('Training Date')] || schedule?.trainingDate || assessmentDateValue
      const key = `${user.id}:${assignment.quizId}`
      if (seenAssignments.has(key)) {
        throw new Error(`The workbook contains more than one result for ${user.name} and "${topic}".`)
      }
      seenAssignments.add(key)

      records.push({
        userId: user.id,
        userName: user.name,
        sourceCandidateName: candidateSourceName,
        quizId: quiz.id,
        quizTitle: quiz.title,
        assessmentDate: parseDate(assessmentDateValue, 'CBT Date', sheetName, rowNumber),
        trainingDate: parseDate(trainingDateValue, 'Training Date', sheetName, rowNumber),
        iafScope: requiredText(row[column('IAF Scope')], 'IAF Scope', sheetName, rowNumber),
        internalExternal: String(row[column('Internal / External')] ?? '').trim(),
        topic,
        designation: String(row[column('Designation')] ?? '').trim(),
        trainingType: String(row[column('Training Type')] ?? '').trim(),
        trainingMaterial: String(row[column('Training Material')] ?? '').trim(),
        trainingDuration,
        trainingSlot: trainingSlot || schedule?.trainingSlot || '',
        cbtDuration: durationText,
        cbtDurationMinutes: Number(durationMatch[0]) || schedule?.durationMinutes || 0,
        cbtSlot: requiredText(cbtSlot, 'CBT time slot', sheetName, rowNumber),
        totalMarks,
        marksObtained,
        recommendedAuthorization: grade,
        sourceSheet: sheetName.trim(),
      })
    }
  }

  if (records.length === 0) throw new Error('No scored inspector assessment rows were found in the workbook.')
  records.sort((a, b) =>
    a.assessmentDate.localeCompare(b.assessmentDate)
    || a.userName.localeCompare(b.userName)
    || a.topic.localeCompare(b.topic),
  )
  fs.writeFileSync(outputPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({
    records: records.length,
    inspectors: new Set(records.map((record) => record.userId)).size,
    outputPath,
  }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
