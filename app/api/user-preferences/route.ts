import { NextRequest, NextResponse } from 'next/server'
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '@/lib/appwrite-server'
import { cookies } from 'next/headers'

async function getCurrentUser() {
  const cookieStore = await cookies()
  const userIdCookie = cookieStore.get('appwrite-user-id')
  const userEmailCookie = cookieStore.get('appwrite-user-email')
  
  if (!userIdCookie || !userEmailCookie) return null

  return {
    $id: userIdCookie.value,
    email: decodeURIComponent(userEmailCookie.value)
  }
}

// GET - Get user preferences
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const prefs = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.USER_PREFERENCES,
      [Query.equal('user_id', user.$id), Query.limit(1)]
    )

    if (prefs.documents.length > 0) {
      return NextResponse.json({ preferences: prefs.documents[0] })
    }

    return NextResponse.json({ preferences: null })
  } catch (error) {
    console.error('Failed to fetch preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

// POST - Update user preferences
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { last_account_id } = body

    // Check if preferences exist
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.USER_PREFERENCES,
      [Query.equal('user_id', user.$id), Query.limit(1)]
    )

    let preferences
    if (existing.documents.length > 0) {
      preferences = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.USER_PREFERENCES,
        existing.documents[0].$id,
        { last_account_id }
      )
    } else {
      preferences = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.USER_PREFERENCES,
        ID.unique(),
        {
          user_id: user.$id,
          last_account_id
        }
      )
    }

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error('Failed to save preferences:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
