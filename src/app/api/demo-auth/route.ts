import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = process.env.DEMO_PASSWORD ?? ''
const COOKIE = 'foodeye_demo'
// Cookie valid for 7 days
const MAX_AGE = 60 * 60 * 24 * 7

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }))

  if (!PASSWORD) {
    // No password configured — grant access without checking
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE, '1', { httpOnly: true, sameSite: 'lax', maxAge: MAX_AGE })
    return res
  }

  if (password !== PASSWORD) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, '1', { httpOnly: true, sameSite: 'lax', maxAge: MAX_AGE })
  return res
}
