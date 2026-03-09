import { NextResponse } from 'next/server'
import { getRecentGuides } from '@/lib/guides'

export async function GET() {
  const guides = await getRecentGuides(12)
  return NextResponse.json({ guides })
}
