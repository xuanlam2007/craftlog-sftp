import { NextRequest, NextResponse } from 'next/server'
import { databases, Query, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite-server'

// Delete all documents matching a query in parallel batches
async function deleteAllDocuments(collectionId: string, accountId: string) {
  try {
    let hasMore = true
    while (hasMore) {
      const response = await databases.listDocuments(
        DATABASE_ID,
        collectionId,
        [Query.equal('account_id', accountId), Query.limit(100)]
      )

      // Delete all documents in parallel (much faster)
      await Promise.all(
        response.documents.map(doc => 
          databases.deleteDocument(DATABASE_ID, collectionId, doc.$id).catch(() => {})
        )
      )

      hasMore = response.documents.length === 100
    }
  } catch {
    // Collection might not exist or have different schema - ignore
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: accountId } = await params

    // Clear all data for this account (ignores errors for missing collections)
    await deleteAllDocuments(COLLECTIONS.CHANGE_LOGS, accountId)
    await deleteAllDocuments(COLLECTIONS.CHANGED_FILES, accountId)
    
    // FILE_RECORDS may not exist anymore since we use in-memory baselines
    try {
      await deleteAllDocuments(COLLECTIONS.FILE_RECORDS, accountId)
    } catch {
      // Ignore
    }

    return NextResponse.json({
      success: true,
      message: 'Logs cleared successfully.',
    })
  } catch (error) {
    console.error('Reset failed:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to reset account data' },
      { status: 500 }
    )
  }
}
