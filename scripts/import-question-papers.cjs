const fs = require('node:fs')
const path = require('node:path')
const mammoth = require('mammoth')

function createSlug(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function collectWordFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(folder, entry.name)
    if (entry.isDirectory()) return collectWordFiles(entryPath)
    return entry.isFile() && entry.name.toLowerCase().endsWith('.docx') && !entry.name.toLowerCase().startsWith('index_')
      ? [entryPath]
      : []
  })
}

function getScopeSector(sourceFolder, filePath) {
  const folders = [path.basename(sourceFolder), ...path.relative(sourceFolder, path.dirname(filePath)).split(path.sep)]
  if (folders.some((folder) => /^scope_17_18_/i.test(folder))) return 'NABCB IAF SCOPE 17 & 18'
  if (folders.some((folder) => /^scope_19_/i.test(folder))) return 'NABCB IAF SCOPE 19'
  if (folders.some((folder) => /^scope_28_/i.test(folder))) return 'NABCB IAF SCOPE 28'
  if (folders.some((folder) => /^coating$/i.test(folder))) return 'Coating'
  return undefined
}

function parseQuestions(text, quizId, fileName) {
  const questions = []
  let current = null

  function finishQuestion() {
    if (!current) return
    const questionNumber = questions.length + 1
    const questionId = `${quizId}-q${questionNumber}`
    const optionIndexes = new Map(current.options.map((option, index) => [option.letter, index]))
    const correctIndexes = current.correctLetters.map((letter) => optionIndexes.get(letter))
    if (!current.prompt.trim() || current.options.length < 2 || correctIndexes.length === 0 || correctIndexes.some((index) => index === undefined)) {
      throw new Error(`${fileName}: question ${questionNumber} is missing a prompt, options, or a valid correct answer.`)
    }

    const options = current.options.map((option) => ({
      id: `${questionId}-o${option.letter.toLowerCase()}`,
      text: option.text,
    }))
    questions.push({
      id: questionId,
      type: correctIndexes.length > 1 ? 'multi' : 'single',
      prompt: current.prompt.trim(),
      points: current.points,
      options,
      correct: correctIndexes.map((index) => options[index].id),
    })
    current = null
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const questionMatch = line.match(/^(?:question\s*\d*|q\s*\d*)\s*[:.)-]\s*(.+)$/i)
    const optionMatch = line.match(/^([A-H])\s*[.)\-:]\s*(.+)$/i)
    const answerMatch = line.match(/^(?:correct\s*answer|answer)\s*[:=-]\s*([A-H](?:\s*[,/&]\s*[A-H])*)/i)
    const pointsMatch = line.match(/^points?\s*[:=-]\s*(\d+)/i)

    if (questionMatch) {
      finishQuestion()
      current = { prompt: questionMatch[1].trim(), options: [], correctLetters: [], points: 1 }
    } else if (optionMatch && current) {
      current.options.push({ letter: optionMatch[1].toUpperCase(), text: optionMatch[2].trim() })
    } else if (answerMatch && current) {
      current.correctLetters = answerMatch[1].toUpperCase().match(/[A-H]/g) ?? []
    } else if (pointsMatch && current) {
      current.points = Math.max(1, Number(pointsMatch[1]))
    } else if (current && current.options.length === 0) {
      current.prompt = `${current.prompt} ${line}`.trim()
    }
  }

  finishQuestion()
  if (questions.length === 0) throw new Error(`${fileName}: no complete questions were found.`)
  return questions
}

async function main() {
  const sourceFolder = process.argv[2]
  if (!sourceFolder || !fs.existsSync(sourceFolder)) {
    throw new Error('Pass the folder containing the .docx question papers as the first argument.')
  }

  const files = collectWordFiles(sourceFolder)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  if (files.length === 0) throw new Error('No .docx question papers were found.')

  const quizzes = []
  for (const filePath of files) {
    const fileName = path.basename(filePath)
    const { value } = await mammoth.extractRawText({ path: filePath })
    const fileTitle = path.basename(fileName, path.extname(fileName))
    const documentTitle = value.match(/^\s*(?:title|tittle)\s*[:=]\s*(.+)$/im)?.[1]?.trim()
    const subject = value.match(/^\s*(?:commodity\s*\/\s*subject|subject)\s*[:=]\s*(.+)$/im)?.[1]?.trim()
    const paperNumber = fileTitle.match(/paper[_\s-]*(\d+)\s*$/i)?.[1]
    const title = documentTitle || (subject && paperNumber
      ? `${subject} - Paper ${paperNumber}`
      : fileTitle.replace(/^\d+\s+[A-Z]\s*-\s*/i, '').replace(/__/g, ' '))
    const category = subject || title.replace(/\s*[-–—]\s*Paper\s*\d+\s*$/i, '').trim()
    const id = `commodity-${createSlug(fileTitle)}`

    quizzes.push({
      id,
      title,
      description: `Inspector assessment for ${category}.`,
      category,
      scopeSector: getScopeSector(sourceFolder, filePath),
      durationMinutes: 30,
      passingScore: 50,
      targetRole: 'inspector',
      createdAt: Date.now(),
      questions: parseQuestions(value, id, fileName),
    })
  }

  const titles = new Set()
  for (const quiz of quizzes) {
    const normalizedTitle = quiz.title.toLowerCase()
    if (titles.has(normalizedTitle)) throw new Error(`Duplicate quiz title found: ${quiz.title}`)
    titles.add(normalizedTitle)
  }

  const outputPath = path.resolve(__dirname, '..', 'data', 'inspector-commodity-quizzes.json')
  const existingQuizzes = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : []
  const importedIds = new Set(quizzes.map((quiz) => quiz.id))
  const mergedQuizzes = [...existingQuizzes.filter((quiz) => !importedIds.has(quiz.id)), ...quizzes]
  fs.writeFileSync(outputPath, `${JSON.stringify(mergedQuizzes)}\n`, 'utf8')
  const questionCount = quizzes.reduce((total, quiz) => total + quiz.questions.length, 0)
  console.log(`Imported ${quizzes.length} Inspector quizzes with ${questionCount} questions; dataset now has ${mergedQuizzes.length} quizzes at ${outputPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})