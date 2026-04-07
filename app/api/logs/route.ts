import { NextRequest, NextResponse } from 'next/server'
import { databases, Query, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')

    if (!accountId) {
      return NextResponse.json({ logs: [], total: 0 })
    }

    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.CHANGE_LOGS,
      [
        Query.equal('account_id', accountId),
        Query.orderDesc('detected_at'),
        Query.limit(500),
      ]
    )

    const logs = response.documents.map((doc) => ({
      $id: doc.$id,
      account_id: doc.account_id,
      file_path: doc.file_path,
      change_type: doc.change_type,
      detected_at: doc.detected_at,
      old_size: doc.old_size,
      new_size: doc.new_size,
      old_modified: doc.old_modified,
      new_modified: doc.new_modified,
    }))

    return NextResponse.json({
      logs,
      total: response.total,
    })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const errCode = (error as { code: number }).code
      // Handle missing collection, unauthorized, or schema errors gracefully
      if (errCode === 404 || errCode === 401 || errCode === 400) {
        return NextResponse.json({ 
          logs: [], 
          total: 0,
          setupRequired: true,
        })
      }
    }
    console.error('Failed to fetch logs:', error)
    return NextResponse.json({ logs: [], total: 0 })
  }
}
