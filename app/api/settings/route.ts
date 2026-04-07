import { NextResponse } from 'next/server'
import { databases, ID, Query, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite-server'

export async function GET() {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.SETTINGS,
      [Query.limit(1)]
    )

    if (response.documents.length > 0) {
      const settings = response.documents[0]
      return NextResponse.json({
        success: true,
        settings: {
          host: settings.host,
          port: settings.port,
          username: settings.username,
          password: settings.password,
          basePath: settings.basePath,
          ignoredPaths: settings.ignoredPaths ?? [],
        },
      })
    }

    return NextResponse.json({ success: true, settings: null })
  } catch (error: unknown) {
    // Collection might not exist yet or no permissions - return null settings
    if (error && typeof error === 'object' && 'code' in error) {
      const errCode = (error as { code: number }).code
      // 404 = collection doesn't exist, 401 = no permission (likely collection not set up)
      if (errCode === 404 || errCode === 401) {
        return NextResponse.json({ 
          success: true, 
          settings: null,
          setupRequired: errCode === 401
        })
      }
    }
    console.error('Failed to get settings:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to load settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { host, port, username, password, basePath, ignoredPaths } = body

    // Check if settings already exist
    let existingId: string | null = null
    try {
      const existing = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.SETTINGS,
        [Query.limit(1)]
      )
      if (existing.documents.length > 0) {
        existingId = existing.documents[0].$id
      }
    } catch {
      // Collection might not exist yet
    }

    const settingsData = {
      host,
      port,
      username,
      password,
      basePath,
      ignoredPaths,
    }

    if (existingId) {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.SETTINGS,
        existingId,
        settingsData
      )
    } else {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.SETTINGS,
        ID.unique(),
        settingsData
      )
    }

    return NextResponse.json({ success: true, message: 'Settings saved' })
  } catch (error) {
    console.error('Failed to save settings:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to save settings. Make sure the Appwrite collections are created.' },
      { status: 500 }
    )
  }
}
