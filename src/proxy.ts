import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PASSWORD = process.env.DEMO_PASSWORD ?? ''
const COOKIE = 'foodeye_demo'

export function proxy(req: NextRequest) {
  // No password configured → allow all
  if (!PASSWORD) return NextResponse.next()

  const { pathname } = req.nextUrl

  // Always allow the demo-login page and its auth API
  if (pathname === '/demo-login' || pathname === '/api/demo-auth') {
    return NextResponse.next()
  }

  // Cookie present and valid → pass through
  if (req.cookies.get(COOKIE)?.value === '1') {
    return NextResponse.next()
  }

  // API routes: return 401 instead of redirect
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Page routes: redirect to demo-login
  const url = req.nextUrl.clone()
  url.pathname = '/demo-login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)',
  ],
}
