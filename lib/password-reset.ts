import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 15 * 60 * 1000
const DEV_FALLBACK_SECRET = 'local-dev-password-reset-secret'
const PLACEHOLDER_VALUES = new Set([
  'replace-with-a-long-random-secret',
  'your_resend_api_key_here',
  'your-verified-domain.com',
  'no-reply@your-verified-domain.com',
  'localhost',
])

function isPlaceholder(value?: string) {
  if (!value) return true
  const normalized = value.trim().toLowerCase()
  return normalized.length < 8 || PLACEHOLDER_VALUES.has(normalized) || normalized.includes('your_') || normalized.includes('your-') || normalized.includes('replace-with')
}

function secret() {
  const value = process.env.PASSWORD_RESET_SECRET?.trim()
  if (value && !isPlaceholder(value)) return value
  if (process.env.NODE_ENV !== 'production') return DEV_FALLBACK_SECRET
  throw new Error('PASSWORD_RESET_SECRET is not configured.')
}

export function createPasswordResetToken(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, expiresAt: Date.now() + TOKEN_TTL_MS })).toString('base64url')
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyPasswordResetToken(token: string, expectedEmail: string) {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false
  const expectedSignature = createHmac('sha256', secret()).update(payload).digest('base64url')
  const left = Buffer.from(signature)
  const right = Buffer.from(expectedSignature)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: string; expiresAt?: number }
    return parsed.email?.toLowerCase() === expectedEmail.toLowerCase() && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()
  } catch {
    return false
  }
}