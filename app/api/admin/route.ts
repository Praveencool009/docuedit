import { NextRequest } from 'next/server'
import { getStats } from '@/lib/db'

export async function GET(req: NextRequest) {
  const password = req.nextUrl.searchParams.get('pwd')
  if (password !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const stats = getStats()
  return Response.json(stats)
}
