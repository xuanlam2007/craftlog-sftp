import { Client, Databases, ID, Query } from 'node-appwrite'

// Get environment variables at runtime (not at module load time)
function getClient() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
  const apiKey = process.env.APPWRITE_API_KEY

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      `Missing Appwrite environment variables. Please ensure NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, and APPWRITE_API_KEY are set.`
    )
  }

  const client = new Client()
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey)

  return client
}

// Lazy initialization to ensure env vars are loaded
let _databases: Databases | null = null

export function getDatabases(): Databases {
  if (!_databases) {
    _databases = new Databases(getClient())
  }
  return _databases
}

// For backwards compatibility - proxy object that calls getDatabases() lazily
export const databases = {
  listDocuments: (...args: Parameters<Databases['listDocuments']>) =>
    getDatabases().listDocuments(...args),
  createDocument: (...args: Parameters<Databases['createDocument']>) =>
    getDatabases().createDocument(...args),
  updateDocument: (...args: Parameters<Databases['updateDocument']>) =>
    getDatabases().updateDocument(...args),
  deleteDocument: (...args: Parameters<Databases['deleteDocument']>) =>
    getDatabases().deleteDocument(...args),
  getDocument: (...args: Parameters<Databases['getDocument']>) =>
    getDatabases().getDocument(...args),
}

export { ID, Query }

// Database and Collection IDs
export const DATABASE_ID = 'sftp_monitor'
export const COLLECTIONS = {
  SNAPSHOTS: 'snapshots',
  FILE_RECORDS: 'file_records',
  CHANGE_LOGS: 'change_logs',
  CHANGED_FILES: 'changed_files',
  SETTINGS: 'settings',
  // New collections for multi-user support
  SFTP_ACCOUNTS: 'sftp_accounts',
  ACCOUNT_MEMBERS: 'account_members',
  USER_PREFERENCES: 'user_preferences',
}
