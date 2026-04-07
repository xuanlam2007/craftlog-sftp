// SFTP Account - stores connection details, owned by a user
export interface SftpAccount {
  $id?: string
  $createdAt?: string
  name: string // Display name like "My Minecraft Server"
  owner_id: string // Appwrite user ID who created this
  sftp_host: string
  sftp_port: number
  sftp_username: string
  sftp_password: string
  base_path: string
  ignored_folders?: string
}

// Account Member - links users to accounts they can access
export interface SftpAccountMember {
  $id?: string
  account_id: string
  user_id: string
  user_email: string
  role: 'owner' | 'member'
  joined_at: string
}

// User Preferences - stores last used account for auto-connect
export interface UserPreferences {
  $id?: string
  user_id: string
  last_account_id?: string
}

export interface FileRecord {
  $id?: string
  account_id: string // Link to SFTP account
  snapshot_id: string
  path: string
  size: number
  modified_time: string
}

export interface Snapshot {
  $id?: string
  $createdAt?: string
  account_id: string // Link to SFTP account
}

export interface ChangeLog {
  $id?: string
  account_id: string // Link to SFTP account
  file_path: string
  change_type: 'upload' | 'edit' | 'delete'
  detected_at: string
  old_size?: number
  new_size?: number
  old_modified?: string
  new_modified?: string
}

export interface ChangedFile {
  $id?: string
  account_id: string // Link to SFTP account
  file_path: string
  first_detected: string
  last_detected: string
  change_count: number
}

// Legacy - keeping for backwards compatibility but will be replaced by SftpAccount
export interface SftpSettings {
  $id?: string
  sftp_host: string
  sftp_port: number
  sftp_username: string
  sftp_password: string
  base_path: string
  ignored_folders?: string
}

export interface ScanResult {
  success: boolean
  message: string
  snapshotId?: string
  isBaseline?: boolean
  changesDetected?: number
}
