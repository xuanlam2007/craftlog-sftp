import { NextRequest, NextResponse } from 'next/server'
import Client from 'ssh2-sftp-client'
import { databases, ID, Query, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite-server'

interface FileInfo {
  path: string
  filename: string
  size: number
  mtime: string
}

interface ChangeDetected {
  changeType: 'upload' | 'edit' | 'delete'
  filename: string
  path: string
}

async function getAccountSettings(accountId: string) {
  try {
    const account = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.SFTP_ACCOUNTS,
      accountId
    )
    return account
  } catch {
    return null
  }
}

// Check if a path matches an ignore pattern (supports wildcards like world*)
function matchesIgnorePattern(pathPart: string, pattern: string): boolean {
  // Handle wildcard patterns
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    return pathPart.toLowerCase().startsWith(prefix.toLowerCase())
  }
  // Exact match (case-insensitive)
  return pathPart.toLowerCase() === pattern.toLowerCase()
}

function shouldIgnorePath(fullPath: string, ignoredPatterns: string[]): boolean {
  const pathParts = fullPath.split('/').filter(Boolean)
  
  for (const pattern of ignoredPatterns) {
    for (const part of pathParts) {
      if (matchesIgnorePattern(part, pattern)) {
        return true
      }
    }
  }
  return false
}

async function scanDirectory(
  sftp: Client,
  basePath: string,
  currentPath: string,
  ignoredPatterns: string[],
  files: FileInfo[]
): Promise<void> {
  const fullPath = currentPath || basePath

  // Check if current path should be ignored
  if (shouldIgnorePath(fullPath, ignoredPatterns)) {
    return
  }

  try {
    const listing = await sftp.list(fullPath)

    for (const item of listing) {
      const itemPath = `${fullPath}/${item.name}`

      if (item.type === 'd') {
        await scanDirectory(sftp, basePath, itemPath, ignoredPatterns, files)
      } else if (item.type === '-') {
        const ext = item.name.split('.').pop()?.toLowerCase()
        if (ext === 'jar' && item.size > 10 * 1024 * 1024) {
          continue
        }

        files.push({
          path: itemPath,
          filename: item.name,
          size: item.size,
          mtime: new Date(item.modifyTime).toISOString(),
        })
      }
    }
  } catch (error) {
    console.error(`Failed to scan directory ${fullPath}:`, error)
  }
}

async function getLatestSnapshot(accountId: string) {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.SNAPSHOTS,
      [
        Query.equal('account_id', accountId),
        Query.orderDesc('$createdAt'),
        Query.limit(1)
      ]
    )
    return response.documents[0] || null
  } catch {
    return null
  }
}

async function getSnapshotFiles(snapshotId: string, accountId: string) {
  const files: Map<string, FileInfo> = new Map()
  let offset = 0
  const limit = 100

  try {
    while (true) {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.FILE_RECORDS,
        [
          Query.equal('snapshot_id', snapshotId),
          Query.equal('account_id', accountId),
          Query.limit(limit),
          Query.offset(offset),
        ]
      )

      for (const doc of response.documents) {
        files.set(doc.path, {
          path: doc.path,
          filename: doc.path.split('/').pop() || doc.path,
          size: doc.size,
          mtime: doc.modified_time,
        })
      }

      if (response.documents.length < limit) {
        break
      }
      offset += limit
    }
  } catch {
    // Collection might not exist
  }

  return files
}

function detectChanges(
  oldFiles: Map<string, FileInfo>,
  newFiles: FileInfo[]
): ChangeDetected[] {
  const changes: ChangeDetected[] = []
  const newFilesMap = new Map<string, FileInfo>()

  for (const file of newFiles) {
    newFilesMap.set(file.path, file)

    const oldFile = oldFiles.get(file.path)
    if (!oldFile) {
      changes.push({
        changeType: 'upload',
        filename: file.filename,
        path: file.path,
      })
    } else if (oldFile.size !== file.size || oldFile.mtime !== file.mtime) {
      changes.push({
        changeType: 'edit',
        filename: file.filename,
        path: file.path,
      })
    }
  }

  for (const [path, file] of oldFiles) {
    if (!newFilesMap.has(path)) {
      changes.push({
        changeType: 'delete',
        filename: file.filename,
        path: file.path,
      })
    }
  }

  return changes
}

async function updateChangedFilesRegistry(accountId: string, changes: ChangeDetected[]) {
  const now = new Date().toISOString()

  for (const change of changes) {
    try {
      const existing = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.CHANGED_FILES,
        [
          Query.equal('account_id', accountId),
          Query.equal('file_path', change.path),
          Query.limit(1)
        ]
      )

      if (existing.documents.length > 0) {
        const doc = existing.documents[0]
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.CHANGED_FILES,
          doc.$id,
          {
            last_detected: now,
            change_count: (doc.change_count || 0) + 1,
          }
        )
      } else {
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.CHANGED_FILES,
          ID.unique(),
          {
            account_id: accountId,
            file_path: change.path,
            first_detected: now,
            last_detected: now,
            change_count: 1,
          }
        )
      }
    } catch (error) {
      console.error(`Failed to update changed files registry for ${change.path}:`, error)
    }
  }
}

export async function POST(request: NextRequest) {
  const sftp = new Client()

  try {
    const body = await request.json()
    const { account_id } = body

    if (!account_id) {
      return NextResponse.json(
        { success: false, message: 'No account selected. Please select an SFTP account first.' },
        { status: 400 }
      )
    }

    // Get account settings
    const account = await getAccountSettings(account_id)
    if (!account) {
      return NextResponse.json(
        { success: false, message: 'SFTP account not found.' },
        { status: 400 }
      )
    }

    const host = account.sftp_host
    const port = account.sftp_port
    const username = account.sftp_username
    const password = account.sftp_password
    const basePath = account.base_path
    const ignoredFolders = account.ignored_folders ? account.ignored_folders.split(',').map((s: string) => s.trim()) : []

    // Connect to SFTP
    await sftp.connect({
      host,
      port: port || 22,
      username,
      password,
      readyTimeout: 30000,
    })

    // Scan all files
    const files: FileInfo[] = []
    await scanDirectory(sftp, basePath, '', ignoredFolders, files)

    await sftp.end()

    // Get previous snapshot for this account
    const previousSnapshot = await getLatestSnapshot(account_id)
    const isBaseline = !previousSnapshot

    // Create new snapshot
    const snapshot = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.SNAPSHOTS,
      ID.unique(),
      {
        account_id: account_id,
        createdAt: new Date().toISOString(),
        totalFiles: files.length,
        isBaseline,
      }
    )

    // Store file records
    for (const file of files) {
      try {
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.FILE_RECORDS,
          ID.unique(),
          {
            account_id: account_id,
            snapshot_id: snapshot.$id,
            path: file.path,
            size: file.size,
            modified_time: file.mtime,
          }
        )
      } catch (error) {
        console.error(`Failed to store file record for ${file.path}:`, error)
      }
    }

    // If not baseline, detect and log changes
    let changesDetected = 0
    if (!isBaseline && previousSnapshot) {
      const oldFiles = await getSnapshotFiles(previousSnapshot.$id, account_id)
      const changes = detectChanges(oldFiles, files)
      changesDetected = changes.length

      const now = new Date().toISOString()
      for (const change of changes) {
        try {
          await databases.createDocument(
            DATABASE_ID,
            COLLECTIONS.CHANGE_LOGS,
            ID.unique(),
            {
              account_id: account_id,
              file_path: change.path,
              change_type: change.changeType,
              detected_at: now,
            }
          )
        } catch (error) {
          console.error(`Failed to log change for ${change.path}:`, error)
        }
      }

      await updateChangedFilesRegistry(account_id, changes)
    }

    return NextResponse.json({
      success: true,
      message: isBaseline
        ? `Baseline snapshot created with ${files.length} files`
        : `Scan complete. ${changesDetected} changes detected.`,
      snapshotId: snapshot.$id,
      isBaseline,
      changesDetected,
      totalFiles: files.length,
    })
  } catch (error: unknown) {
    await sftp.end().catch(() => {})

    const errorMessage = error instanceof Error ? error.message : 'Scan failed'
    console.error('Scan failed:', errorMessage)

    return NextResponse.json(
      { success: false, message: `Scan failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
