import { NextResponse } from 'next/server'

const USAGE_COOKIE = 'foodeye_usage'

/** 使用カウンターをリセットする（管理者用） */
export async function POST() {
  const res = NextResponse.json({ ok: true, message: '使用カウンターをリセットしました' })
  res.cookies.set(USAGE_COOKIE, '', { maxAge: 0 })
  return res
}
