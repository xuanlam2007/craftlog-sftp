import { NextResponse } from 'next/server'
import { Client, Databases } from 'node-appwrite'

export async function POST() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
  const apiKey = process.env.APPWRITE_API_KEY

  if (!endpoint || !projectId || !apiKey) {
    return NextResponse.json({
      error: 'Missing environment variables',
      details: {
        endpoint: endpoint ? 'Set' : 'Missing',
        projectId: projectId ? 'Set' : 'Missing',
        apiKey: apiKey ? 'Set' : 'Missing',
      }
    }, { status: 400 })
  }

  const client = new Client()
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey)

  const databases = new Databases(client)

  const DATABASE_ID = 'sftp_monitor'
  const COLLECTIONS = {
    SNAPSHOTS: 'snapshots',
    FILE_RECORDS: 'file_records',
    CHANGE_LOGS: 'change_logs',
    CHANGED_FILES: 'changed_files',
    SETTINGS: 'settings',
  }

  const results: string[] = []

  try {
    // Create database
    try {
      await databases.create(DATABASE_ID, 'SFTP Monitor')
      results.push('Created database: sftp_monitor')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const errCode = (error as { code: number }).code
        if (errCode === 409) {
          results.push('Database already exists: sftp_monitor')
        } else if (errCode === 401) {
          return NextResponse.json({
            error: 'API Key Permission Error',
            message: 'Your API key does not have permission to create databases. Please update your API key in Appwrite Console to include ALL scopes, or at minimum: databases.read, databases.write, collections.read, collections.write, attributes.read, attributes.write, documents.read, documents.write.',
            instructions: [
              '1. Go to Appwrite Console > Settings > API Keys',
              '2. Edit your API key or create a new one',
              '3. Select ALL scopes (or the specific ones listed above)',
              '4. Copy the new API key',
              '5. Update APPWRITE_API_KEY in v0 Settings > Vars',
              '6. Try Setup again'
            ]
          }, { status: 401 })
        } else {
          throw error
        }
      } else {
        throw error
      }
    }

    // Helper to wait for attribute to be available
    const waitForAttribute = () => new Promise(resolve => setTimeout(resolve, 1000))

    // Create snapshots collection
    try {
      await databases.createCollection(DATABASE_ID, COLLECTIONS.SNAPSHOTS, 'Snapshots')
      results.push('Created collection: snapshots')
      
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SNAPSHOTS, 'createdAt', 64, true)
      await waitForAttribute()
      await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.SNAPSHOTS, 'totalFiles', true)
      results.push('  - Added attributes to snapshots')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
        results.push('Collection already exists: snapshots')
      } else {
        throw error
      }
    }

    // Create file_records collection
    try {
      await databases.createCollection(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'File Records')
      results.push('Created collection: file_records')
      
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'snapshotId', 64, true)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'path', 2048, true)
      await waitForAttribute()
      await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'size', true)
      await waitForAttribute()
      await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'modifyTime', true)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'type', 16, true)
      results.push('  - Added attributes to file_records')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
        results.push('Collection already exists: file_records')
      } else {
        throw error
      }
    }

    // Create change_logs collection
    try {
      await databases.createCollection(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'Change Logs')
      results.push('Created collection: change_logs')
      
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'path', 2048, true)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'changeType', 16, true)
      await waitForAttribute()
      await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'oldSize', false)
      await waitForAttribute()
      await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'newSize', false)
      await waitForAttribute()
      await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'oldModifyTime', false)
      await waitForAttribute()
      await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'newModifyTime', false)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'detectedAt', 64, true)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'snapshotId', 64, true)
      results.push('  - Added attributes to change_logs')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
        results.push('Collection already exists: change_logs')
      } else {
        throw error
      }
    }

    // Create changed_files collection
    try {
      await databases.createCollection(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'Changed Files')
      results.push('Created collection: changed_files')
      
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'path', 2048, true)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'firstDetectedAt', 64, true)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'lastDetectedAt', 64, true)
      await waitForAttribute()
      await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'changeCount', true)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'lastChangeType', 16, true)
      results.push('  - Added attributes to changed_files')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
        results.push('Collection already exists: changed_files')
      } else {
        throw error
      }
    }

    // Create settings collection
    try {
      await databases.createCollection(DATABASE_ID, COLLECTIONS.SETTINGS, 'Settings')
      results.push('Created collection: settings')
      
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'host', 256, true)
      await waitForAttribute()
      await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'port', true)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'username', 256, true)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'password', 512, true)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'basePath', 1024, false)
      await waitForAttribute()
      await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'ignoredFolders', 4096, false)
      results.push('  - Added attributes to settings')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
        results.push('Collection already exists: settings')
      } else {
        throw error
      }
    }

    results.push('')
    results.push('Setup complete!')
    results.push('')
    results.push('IMPORTANT: Set collection permissions in Appwrite Console:')
    results.push('1. Go to Databases > sftp_monitor')
    results.push('2. For each collection, go to Settings > Permissions')
    results.push('3. Add "Any" with Read and Write access')

    return NextResponse.json({ success: true, results })
  } catch (error: unknown) {
    console.error('Setup failed:', error)
    return NextResponse.json({
      error: 'Setup failed',
      message: error instanceof Error ? error.message : String(error),
      results
    }, { status: 500 })
  }
}
