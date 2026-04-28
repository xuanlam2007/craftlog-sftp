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

// Change Log - manually created log entries
export interface ChangeLog {
  $id?: string
  account_id: string
  file_path: string
  change_type: 'added' | 'modified' | 'deleted'
  detected_at: string
}
