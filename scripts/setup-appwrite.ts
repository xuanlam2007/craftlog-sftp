import { Client, Databases, ID } from 'node-appwrite'

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
const apiKey = process.env.APPWRITE_API_KEY

if (!endpoint || !projectId || !apiKey) {
  console.error('Missing environment variables:')
  console.error('- NEXT_PUBLIC_APPWRITE_ENDPOINT:', endpoint ? 'Set' : 'Missing')
  console.error('- NEXT_PUBLIC_APPWRITE_PROJECT_ID:', projectId ? 'Set' : 'Missing')
  console.error('- APPWRITE_API_KEY:', apiKey ? 'Set' : 'Missing')
  process.exit(1)
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

async function setup() {
  console.log('Setting up Appwrite database and collections...\n')

  // Create database
  try {
    await databases.create(DATABASE_ID, 'SFTP Monitor')
    console.log('Created database: sftp_monitor')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
      console.log('Database already exists: sftp_monitor')
    } else {
      throw error
    }
  }

  // Create snapshots collection
  try {
    await databases.createCollection(DATABASE_ID, COLLECTIONS.SNAPSHOTS, 'Snapshots')
    console.log('Created collection: snapshots')
    
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SNAPSHOTS, 'createdAt', 64, true)
    await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.SNAPSHOTS, 'totalFiles', true, undefined, undefined, undefined)
    console.log('  - Added attributes to snapshots')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
      console.log('Collection already exists: snapshots')
    } else {
      throw error
    }
  }

  // Create file_records collection
  try {
    await databases.createCollection(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'File Records')
    console.log('Created collection: file_records')
    
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'snapshotId', 64, true)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'path', 2048, true)
    await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'size', true, undefined, undefined, undefined)
    await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'modifyTime', true, undefined, undefined, undefined)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.FILE_RECORDS, 'type', 16, true)
    console.log('  - Added attributes to file_records')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
      console.log('Collection already exists: file_records')
    } else {
      throw error
    }
  }

  // Create change_logs collection
  try {
    await databases.createCollection(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'Change Logs')
    console.log('Created collection: change_logs')
    
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'path', 2048, true)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'changeType', 16, true)
    await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'oldSize', false, undefined, undefined, undefined)
    await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'newSize', false, undefined, undefined, undefined)
    await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'oldModifyTime', false, undefined, undefined, undefined)
    await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'newModifyTime', false, undefined, undefined, undefined)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'detectedAt', 64, true)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGE_LOGS, 'snapshotId', 64, true)
    console.log('  - Added attributes to change_logs')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
      console.log('Collection already exists: change_logs')
    } else {
      throw error
    }
  }

  // Create changed_files collection
  try {
    await databases.createCollection(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'Changed Files')
    console.log('Created collection: changed_files')
    
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'path', 2048, true)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'firstDetectedAt', 64, true)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'lastDetectedAt', 64, true)
    await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'changeCount', true, undefined, undefined, undefined)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.CHANGED_FILES, 'lastChangeType', 16, true)
    console.log('  - Added attributes to changed_files')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
      console.log('Collection already exists: changed_files')
    } else {
      throw error
    }
  }

  // Create settings collection
  try {
    await databases.createCollection(DATABASE_ID, COLLECTIONS.SETTINGS, 'Settings')
    console.log('Created collection: settings')
    
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'host', 256, true)
    await databases.createIntegerAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'port', true, undefined, undefined, undefined)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'username', 256, true)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'password', 512, true)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'basePath', 1024, false)
    await databases.createStringAttribute(DATABASE_ID, COLLECTIONS.SETTINGS, 'ignoredFolders', 4096, false)
    console.log('  - Added attributes to settings')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 409) {
      console.log('Collection already exists: settings')
    } else {
      throw error
    }
  }

  console.log('\nSetup complete!')
  console.log('\nIMPORTANT: You need to set collection permissions in the Appwrite Console:')
  console.log('1. Go to your Appwrite Console')
  console.log('2. Navigate to Databases > sftp_monitor')
  console.log('3. For each collection, go to Settings > Permissions')
  console.log('4. Add a permission for "Any" with Read and Write access')
  console.log('   (Or configure more restrictive permissions as needed)')
}

setup().catch((error) => {
  console.error('Setup failed:', error)
  process.exit(1)
})
