const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const XLSX = require('xlsx')

const reservedEmails = new Set([
  'itsupport@dycgpl.com',
  'inspector@dycglobal.com',
  'tcqa@dycglobal.com',
])

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function slug(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function emailForName(name, usedEmails) {
  const parts = name.trim().split(/\s+/)
  const first = slug(parts[0])
  const last = slug(parts[parts.length - 1])
  const localPart = [first, last].filter(Boolean).join('.') || 'inspector'
  let email = `${localPart}@dycgpl.com`
  let suffix = 2
  while (usedEmails.has(email)) email = `${localPart}${suffix++}@dycgpl.com`
  usedEmails.add(email)
  return email
}

function assessmentDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,}|\d{1,2})[-/ ](\d{4})$/)
  if (!match) return ''
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const month = /^\d+$/.test(match[2]) ? Number(match[2]) : months.indexOf(match[2].slice(0, 3).toLowerCase()) + 1
  const day = Number(match[1])
  const year = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function parseDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value ?? '').trim()
  if (!text) return 0
  const minuteMatch = text.match(/(\d+)\s*min/i)
  if (minuteMatch) return Number(minuteMatch[1])
  const rangeMatch = text.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/)
  if (rangeMatch) {
    const [start, end] = rangeMatch.slice(1)
    const parse = (time) => {
      const [hours, minutes] = time.split(':').map(Number)
      return hours * 60 + minutes
    }
    return Math.max(0, parse(end) - parse(start))
  }
  return 0
}

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

function parseSlot(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return text.replace(/\s+/g, ' ')
}

function rowsForWorkbook(workbook) {
  const byPerson = workbook.Sheets['By Person']
  if (byPerson) return { rows: XLSX.utils.sheet_to_json(byPerson, { defval: '', raw: false }), origin: 'by-person' }

  const inspectorSheets = workbook.SheetNames
    .filter((name) => name && !/^sheet\s*\d+$/i.test(name))
    .map((sheetName) => ({
      sheetName,
      rows: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false }),
    }))
  const rows = inspectorSheets.flatMap(({ sheetName, rows }) => rows
    .map((row) => ({ ...row, __sheetName: sheetName })))
  return { rows, origin: 'per-inspector-sheet' }
}

function main() {
  const workbookPath = process.argv[2]
  if (!workbookPath || !fs.existsSync(workbookPath)) {
    throw new Error('Pass the timetable .xlsx file path as the first argument.')
  }

  const workbook = XLSX.readFile(workbookPath, { cellDates: true })
  const { rows, origin } = rowsForWorkbook(workbook)
  if (!rows.length) throw new Error('The workbook does not contain any rows to import.')

  const slotHeader = Object.keys(rows[0] ?? {}).find((header) => /^CBT Slot\s*\((\d+)\s*min\)$/i.test(header))
  const slotDurationMinutes = Number(slotHeader?.match(/\((\d+)\s*min\)/i)?.[1] ?? 0)
  const commodityPath = path.resolve(__dirname, '..', 'data', 'inspector-commodity-quizzes.json')
  const quizzes = JSON.parse(fs.readFileSync(commodityPath, 'utf8'))
  const quizzesByCategory = new Map()
  for (const quiz of quizzes) {
    const key = normalize(quiz.category)
    const variants = quizzesByCategory.get(key) ?? []
    variants.push(quiz)
    quizzesByCategory.set(key, variants)
  }
  const usedEmails = new Set(reservedEmails)
  const inspectors = new Map()
  const paperCounts = { 1: 0, 2: 0, 3: 0 }

  for (const [index, row] of rows.entries()) {
    const name = normalizeName(row.Inspector ?? row['Surveyor Name'] ?? row.__sheetName ?? '')
    const item = String(row['Inspection Field / Specific Item'] ?? row['Training Topic '] ?? row['Training Topic'] ?? '').trim()
    const scopeText = String(row['IAF Scope'] ?? '').trim()
    const scopeMatch = scopeText.match(/IAF\s*(17|18|19|28)\b/i) || String(row['IAF Scope'] ?? '').match(/\b(17|18|19|28)\b/)
    const date = assessmentDate(row['CBT Date'] ?? row['Training Date'])
    const durationMinutes = Number(row.Min) || parseDuration(row['CBT Time'] || row['Duration of training '] || row['Duration of training']) || slotDurationMinutes
    const scheduledSlot = String(row['CBT Slot (30 min)'] ?? row['__EMPTY_1'] ?? row['__EMPTY'] ?? '').trim() || parseSlot(row['CBT Time'] || row['Duration of training '])

    if (origin === 'by-person') {
      if (!name || !item || !scopeMatch || !date || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || !scheduledSlot) {
        throw new Error(`By Person row ${index + 2} is missing a required name, item, scope, date, slot, or duration.`)
      }
    } else {
      if (!name || !item || !scopeMatch || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
        continue
      }
    }

    const scopeSector = `NABCB IAF SCOPE ${scopeMatch[1]}`
    const variants = quizzesByCategory.get(normalize(item)) ?? []
    if (variants.length === 0) {
      throw new Error(`Could not map "${item}" to a quiz category. Check the category names against inspector-commodity-quizzes.json.`)
    }
    const variant = variants[crypto.randomInt(variants.length)]
    const paperMatch = variant.title.match(/paper\s*(1|2|3)\s*$/i)
    if (!paperMatch) throw new Error(`Could not identify the paper number for "${variant.title}".`)
    paperCounts[paperMatch[1]] += 1

    let inspector = inspectors.get(name)
    if (!inspector) {
      inspector = {
        id: `u-${slug(name)}`,
        name,
        email: emailForName(name, usedEmails),
        password: '123456',
        role: 'inspector',
        assessmentDate: date || undefined,
        scopeSector,
        assignedQuizIds: [],
        testAssignments: [],
      }
      inspectors.set(name, inspector)
    }
    if (!inspector.assessmentDate && date) inspector.assessmentDate = date

    const assignment = {
      quizId: variant.id,
      conductedBy: 'Technical Manager',
      assignedAt: Date.now(),
      ...(date ? { assessmentDate: date } : {}),
      durationMinutes,
      scopeSector,
      scopeCategory: item,
      ...(scheduledSlot ? { scheduledSlot } : {}),
    }
    if (inspector.assignedQuizIds.includes(variant.id)) {
      throw new Error(`${name} appears more than once for the same selected quiz (${variant.title}).`)
    }
    inspector.assignedQuizIds.push(variant.id)
    inspector.testAssignments.push(assignment)

    const categoryField = `scope${scopeMatch[1]}Category`
    if (!inspector[categoryField]) inspector[categoryField] = item
  }

  const accounts = [...inspectors.values()]
  if (accounts.length === 0) throw new Error('The timetable contains no inspector assessments.')
  const assignmentCount = accounts.reduce((total, inspector) => total + inspector.testAssignments.length, 0)
  if (origin === 'by-person' && assignmentCount !== rows.length) throw new Error('Not every timetable row produced exactly one assignment.')

  const outputPath = path.resolve(__dirname, '..', 'data', 'inspector-timetable-users.json')
  fs.writeFileSync(outputPath, `${JSON.stringify(accounts)}\n`, 'utf8')
  const credentialsPath = path.resolve(__dirname, '..', 'data', 'inspector-accounts.csv')
  const credentialRows = [
    ['Inspector', 'Email', 'Password', 'Assigned tests'].map(csvCell).join(','),
    ...accounts.map((inspector) => [inspector.name, inspector.email, inspector.password, String(inspector.assignedQuizIds.length)].map(csvCell).join(',')),
  ]
  fs.writeFileSync(credentialsPath, `${credentialRows.join('\r\n')}\r\n`, 'utf8')
  console.log(JSON.stringify({ source: origin, inspectors: accounts.length, assignments: assignmentCount, durationMinutes: [...new Set(accounts.flatMap((inspector) => inspector.testAssignments.map((assignment) => assignment.durationMinutes)))], randomPaperCounts: paperCounts, usersOutput: outputPath, credentialsOutput: credentialsPath }, null, 2))
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}