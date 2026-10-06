export type EvaluationGrade = 'A' | 'B' | 'C' | 'Fail'

export function getEvaluation(percentage: number) {
  const score = percentage / 10
  const grade: EvaluationGrade = score >= 8 ? 'A' : score >= 6 ? 'B' : score >= 5 ? 'C' : 'Fail'
  return { score, grade }
}

export function isPassingEvaluation(percentage: number) {
  return percentage >= 50
}

export function getRetakeAvailableAt(timestamp: number) {
  const date = new Date(timestamp)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + 3)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return date.getTime()
}