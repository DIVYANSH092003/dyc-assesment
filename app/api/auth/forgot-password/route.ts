import { NextResponse } from 'next/server'
import { seedUsers } from '@/lib/sample-data'
import { createPasswordResetToken } from '@/lib/password-reset'

export async function POST(request: Request) {
  let email = ''
  try {
    email = String((await request.json()).email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter a valid admin email address.' }, { status: 400 })
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? seedUsers.find((user) => user.role === 'admin')?.email ?? '').trim().toLowerCase()
  if (!email || email !== adminEmail) {
    return NextResponse.json({ ok: false, error: 'Password recovery is available only for the Admin account.' }, { status: 403 })
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  const appUrl = process.env.APP_URL ?? new URL(request.url).origin

  const hasPlaceholderConfig = !apiKey || !from || apiKey.toLowerCase().includes('your_') || apiKey.toLowerCase().includes('replace') || from.toLowerCase().includes('your-') || from.toLowerCase().includes('your_') || from.toLowerCase().includes('replace')

  let token: string
  try {
    token = createPasswordResetToken(email)
  } catch {
    return NextResponse.json({ ok: false, error: 'Email recovery is not configured. Add PASSWORD_RESET_SECRET.' }, { status: 503 })
  }

  const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`

  if (hasPlaceholderConfig) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Password recovery requested without valid Resend config. Local dev fallback activated. Reset URL: ${resetUrl}`)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false, error: 'Email recovery is not configured. Add valid Resend environment variables.' }, { status: 503 })
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your DYC Global admin password',
      text: `Reset your DYC Global admin password: ${resetUrl}\n\nThis link expires in 15 minutes. If you did not request it, ignore this email.`,
      html: `<p>Reset your DYC Global admin password:</p><p><a href="${resetUrl}">Reset password</a></p><p>This link expires in 15 minutes. If you did not request it, ignore this email.</p>`,
    }),
  })

  if (!response.ok) return NextResponse.json({ ok: false, error: 'The recovery email could not be sent.' }, { status: 502 })
  return NextResponse.json({ ok: true })
}