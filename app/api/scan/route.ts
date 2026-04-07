import { NextRequest, NextResponse } from 'next/server'
import Client from 'ssh2-sftp-client'
import { databases, ID, Query, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite-server'

interface FileInfo {
  path: string
  size: number
  mtime: number
}

interface ChangeDetected {
  changeType: 'added' | 'modified' | 'deleted'
  path: string
  oldSize?: number
  newSize?: number
}

// In-memory baseline storage per account (shared across all users viewing same account)
const accountBaselines = new Map<string, {
  files: Map<string, FileInfo>
  lastScan: number
}>()

// Global rate limiting: track requests per second
let requestsThisSecond = 0
let currentSecond = Math.floor(Date.now() / 1000)
const MAX_REQUESTS_PER_SECOND = 3

function checkRateLimit(): boolean {
  const now = Math.floor(Date.now() / 1000)
  if (now !== currentSecond) {
    currentSecond = now
    requestsThisSecond = 0
  }
  
  if (requestsThisSecond >= MAX_REQUESTS_PER_SECOND) {
    return false // Rate limited
  }
  
  requestsThisSecond++
  return true
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

function matchesIgnorePattern(pathPart: string, pattern: string): boolean {
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    return pathPart.toLowerCase().startsWith(prefix.toLowerCase())
  }
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
        files.push({
          path: itemPath,
          size: item.size,
          mtime: item.modifyTime,
        })
      }
    }
  } catch {
    // Skip directories we can't access
  }
}

function detectChanges(baseline: Map<string, FileInfo>, currentFiles: FileInfo[]): ChangeDetected[] {
  const changes: ChangeDetected[] = []
  const currentMap = new Map<string, FileInfo>()

  for (const file of currentFiles) {
    currentMap.set(file.path, file)
    const oldFile = baseline.get(file.path)

    if (!oldFile) {
      changes.push({ changeType: 'added', path: file.path, newSize: file.size })
    } else if (oldFile.size !== file.size || oldFile.mtime !== file.mtime) {
      changes.push({ changeType: 'modified', path: file.path, oldSize: oldFile.size, newSize: file.size })
    }
  }

  // Check for deleted files
  for (const [path, oldFile] of baseline) {
    if (!currentMap.has(path)) {
      changes.push({ changeType: 'deleted', path, oldSize: oldFile.size })
    }
  }

  return changes
}

async function logChangesToDatabase(accountId: string, changes: ChangeDetected[]) {
  const now = new Date().toISOString()

  // Limit batch size
  const changesToLog = changes.slice(0, 20)

  for (const change of changesToLog) {
    try {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.CHANGE_LOGS,
        ID.unique(),
        {
          account_id: accountId,
          file_path: change.path,
          change_type: change.changeType,
          detected_at: now,
          old_size: change.oldSize ?? null,
          new_size: change.newSize ?? null,
        }
      )
    } catch (error) {
      console.error(`Failed to log change for ${change.path}:`, error)
    }
  }
}

export async function POST(request: NextRequest) {
  // Rate limit check FIRST
  if (!checkRateLimit()) {
    return NextResponse.json({
      success: true,
      message: 'Rate limited',
      rateLimited: true,
      changesDetected: 0,
    })
  }

  const sftp = new Client()

  try {
    const body = await request.json()
    const { account_id, action } = body

    if (!account_id) {
      return NextResponse.json(
        { success: false, message: 'account_id is required' },
        { status: 400 }
      )
    }

    const existingBaseline = accountBaselines.get(account_id)

    // INITIALIZE: Just mark the current timestamp as baseline - INSTANT, no scanning
    if (action === 'initialize') {
      // If baseline already exists, just return it
      if (existingBaseline) {
        return NextResponse.json({
          success: true,
          message: `Monitoring active.`,
          totalFiles: existingBaseline.files.size,
          changesDetected: 0,
        })
      }

      // Test connection only - don't scan all files
      const account = await getAccountSettings(account_id)
      if (!account) {
        return NextResponse.json({ success: false, message: 'Account not found.' }, { status: 404 })
      }

      try {
        await sftp.connect({
          host: account.sftp_host,
          port: account.sftp_port || 22,
          username: account.sftp_username,
          password: account.sftp_password,
          readyTimeout: 10000,
        })
        await sftp.end()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Connection failed'
        return NextResponse.json({ success: false, message: msg }, { status: 500 })
      }

      // Create EMPTY baseline - files will be added on first scan
      accountBaselines.set(account_id, {
        files: new Map(),
        lastScan: Date.now(),
      })

      return NextResponse.json({
        success: true,
        message: `Monitoring started. Watching for changes.`,
        totalFiles: 0,
        changesDetected: 0,
      })
    }

    // SCAN: Check for changes since baseline
    if (!existingBaseline) {
      return NextResponse.json({
        success: false,
        message: 'No baseline',
        needsInitialize: true,
      })
    }

    // Don't scan too frequently - minimum 25 seconds between scans
    const timeSinceLastScan = Date.now() - existingBaseline.lastScan
    if (timeSinceLastScan < 25000) {
      return NextResponse.json({
        success: true,
        message: 'Waiting...',
        changesDetected: 0,
        totalFiles: existingBaseline.files.size,
      })
    }

    const account = await getAccountSettings(account_id)
    if (!account) {
      return NextResponse.json({ success: false, message: 'Account not found.' }, { status: 404 })
    }

    await sftp.connect({
      host: account.sftp_host,
      port: account.sftp_port || 22,
      username: account.sftp_username,
      password: account.sftp_password,
      readyTimeout: 30000,
    })

    const ignoredPatterns = account.ignored_folders
      ? account.ignored_folders.split(',').map((s: string) => s.trim())
      : []

    const currentFiles: FileInfo[] = []
    await scanDirectory(sftp, account.base_path || '/', '', ignoredPatterns, currentFiles)
    await sftp.end()

    // First scan after initialize - just set baseline, don't report changes
    const isFirstScan = existingBaseline.files.size === 0
    
    // Detect changes (only if not first scan)
    const changes = isFirstScan ? [] : detectChanges(existingBaseline.files, currentFiles)

    // Update baseline
    const filesMap = new Map<string, FileInfo>()
    for (const file of currentFiles) {
      filesMap.set(file.path, file)
    }
    accountBaselines.set(account_id, {
      files: filesMap,
      lastScan: Date.now(),
    })

    // Log ONLY actual changes to database (not on first scan)
    if (changes.length > 0) {
      await logChangesToDatabase(account_id, changes)
    }

    return NextResponse.json({
      success: true,
      message: isFirstScan 
        ? `Baseline ready. Watching ${currentFiles.length} files.`
        : (changes.length > 0 ? `${changes.length} change(s) detected` : 'No changes'),
      totalFiles: currentFiles.length,
      changesDetected: changes.length,
      baselineReady: true,
    })

  } catch (error: unknown) {
    await sftp.end().catch(() => {})
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Scan failed:', message)
    return NextResponse.json({ success: false, message: `Scan failed: ${message}` }, { status: 500 })
  }
}

// Cleanup old baselines every 30 minutes
setInterval(() => {
  const now = Date.now()
  const maxAge = 60 * 60 * 1000 // 1 hour
  
  for (const [key, baseline] of accountBaselines) {
    if (now - baseline.lastScan > maxAge) {
      accountBaselines.delete(key)
    }
  }
}, 30 * 60 * 1000)
