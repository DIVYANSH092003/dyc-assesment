import { NextResponse } from 'next/server'
import { seedUsers } from '@/lib/sample-data'
import { verifyPasswordResetToken } from '@/lib/password-reset'

export async function POST(request: Request) {
  let token = ''
  let password = ''
  try {
    const body = await request.json()
    token = String(body.token ?? '')
    password = String(body.password ?? '')
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid reset request.' }, { status: 400 })
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? seedUsers.find((user) => user.role === 'admin')?.email ?? '').trim().toLowerCase()
  if (!verifyPasswordResetToken(token, adminEmail)) return NextResponse.json({ ok: false, error: 'This reset link is invalid or expired.' }, { status: 400 })
  if (password.trim().length < 6) return NextResponse.json({ ok: false, error: 'Password must be at least 6 characters.' }, { status: 400 })
  return NextResponse.json({ ok: true })
}