import { NextRequest, NextResponse } from 'next/server'
import { databases, Query, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')

    if (!accountId) {
      return NextResponse.json({ files: [], total: 0 })
    }

    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.CHANGED_FILES,
      [
        Query.equal('account_id', accountId),
        Query.orderDesc('last_detected'),
        Query.limit(1000),
      ]
    )

    const files = response.documents.map((doc) => ({
      $id: doc.$id,
      account_id: doc.account_id,
      file_path: doc.file_path,
      first_detected: doc.first_detected,
      last_detected: doc.last_detected,
      change_count: doc.change_count,
    }))

    return NextResponse.json({
      files,
      total: response.total,
    })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const errCode = (error as { code: number }).code
      if (errCode === 404 || errCode === 401 || errCode === 400) {
        return NextResponse.json({ 
          files: [], 
          total: 0,
          setupRequired: true,
        })
      }
    }
    console.error('Failed to fetch changed files:', error)
    return NextResponse.json({ files: [], total: 0 })
  }
}
