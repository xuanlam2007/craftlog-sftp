import { Client, Databases, ID, Query } from 'appwrite'

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)

export const databases = new Databases(client)
export { ID, Query }

// Database and Collection IDs - you'll need to create these in Appwrite Console
export const DATABASE_ID = 'sftp_monitor'
export const COLLECTIONS = {
  SNAPSHOTS: 'snapshots',
  FILE_RECORDS: 'file_records',
  CHANGE_LOGS: 'change_logs',
  CHANGED_FILES: 'changed_files',
  SETTINGS: 'settings',
}

// Types
export interface FileRecord {
  $id?: string
  snapshotId: string
  path: string
  filename: string
  size: number
  mtime: string
  hash?: string
}

export interface Snapshot {
  $id?: string
  createdAt: string
  totalFiles: number
  isBaseline: boolean
}

export interface ChangeLog {
  $id?: string
  snapshotId: string
  changeType: 'Uploaded' | 'Edited' | 'Deleted'
  filename: string
  path: string
  detectedAt: string
}

export interface ChangedFile {
  $id?: string
  path: string
  filename: string
  firstDetected: string
  lastDetected: string
  changeCount: number
}

export interface SftpSettings {
  $id?: string
  host: string
  port: number
  username: string
  password: string
  basePath: string
  ignoredPaths: string[]
}
