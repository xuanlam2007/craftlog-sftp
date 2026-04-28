import { NextRequest, NextResponse } from 'next/server'
import Client from 'ssh2-sftp-client'
import { databases, ID, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite-server'

// Rate limiting: max 3 requests per second
let requestsThisSecond = 0
let currentSecond = Math.floor(Date.now() / 1000)

function checkRateLimit(): boolean {
  const now = Math.floor(Date.now() / 1000)
  if (now !== currentSecond) {
    currentSecond = now
    requestsThisSecond = 0
  }
  if (requestsThisSecond >= 3) return false
  requestsThisSecond++
  return true
}

// Session stored in database (monitoring_sessions collection)
// Fields: account_id, start_time, last_scan_time, logged_paths (JSON array)
interface MonitoringSession {
  $id: string
  account_id: string
  start_time: number
  last_scan_time: number
  logged_paths: string // JSON array of paths
}

async function getSession(accountId: string): Promise<MonitoringSession | null> {
  try {
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.MONITORING_SESSIONS, [
      Query.equal('account_id', accountId),
      Query.limit(1)
    ])
    return response.documents[0] as unknown as MonitoringSession || null
  } catch {
    return null
  }
}

async function saveSession(accountId: string, startTime: number, lastScanTime: number, loggedPaths: string[]): Promise<void> {
  const existing = await getSession(accountId)
  
  if (existing) {
    await databases.updateDocument(DATABASE_ID, COLLECTIONS.MONITORING_SESSIONS, existing.$id, {
      start_time: startTime,
      last_scan_time: lastScanTime,
      logged_paths: JSON.stringify(loggedPaths)
    })
  } else {
    await databases.createDocument(DATABASE_ID, COLLECTIONS.MONITORING_SESSIONS, ID.unique(), {
      account_id: accountId,
      start_time: startTime,
      last_scan_time: lastScanTime,
      logged_paths: JSON.stringify(loggedPaths)
    })
  }
}

async function deleteSession(accountId: string): Promise<void> {
  const existing = await getSession(accountId)
  if (existing) {
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.MONITORING_SESSIONS, existing.$id)
  }
}

async function getAccountSettings(accountId: string) {
  try {
    return await databases.getDocument(DATABASE_ID, COLLECTIONS.SFTP_ACCOUNTS, accountId)
  } catch {
    return null
  }
}

function shouldIgnorePath(path: string, ignoredPatterns: string[]): boolean {
  const normalizedPath = path.toLowerCase()
  return ignoredPatterns.some(pattern => {
    const p = pattern.toLowerCase().trim()
    return p && normalizedPath.includes(p)
  })
}

// Scan for files modified after startTime
async function findChangedFiles(
  sftp: Client,
  basePath: string,
  startTime: number,
  ignoredPatterns: string[],
  loggedPaths: Set<string>
): Promise<Array<{ path: string; size: number; mtime: number }>> {
  const changes: Array<{ path: string; size: number; mtime: number }> = []
  
  async function scanDir(dirPath: string, depth: number): Promise<void> {
    if (depth > 5 || changes.length >= 50) return
    if (shouldIgnorePath(dirPath, ignoredPatterns)) return

    try {
      const listing = await sftp.list(dirPath)
      
      for (const item of listing) {
        const fullPath = dirPath === '/' ? `/${item.name}` : `${dirPath}/${item.name}`
        
        if (shouldIgnorePath(fullPath, ignoredPatterns)) continue

        if (item.type === '-') {
          // File - modifyTime could be in seconds or milliseconds depending on server
          // If it looks like seconds (< year 2100 in ms), convert to ms
          const rawMtime = item.modifyTime
          const mtimeMs = rawMtime < 4102444800000 ? rawMtime * 1000 : rawMtime
          
          // Only include if modified AFTER monitoring started AND not already logged
          if (mtimeMs > startTime && !loggedPaths.has(fullPath)) {
            changes.push({ path: fullPath, size: item.size, mtime: mtimeMs })
          }
        } else if (item.type === 'd') {
          await scanDir(fullPath, depth + 1)
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  await scanDir(basePath, 0)
  return changes
}

async function logChanges(accountId: string, changes: Array<{ path: string; size: number }>) {
  const now = new Date().toISOString()
  
  // Log in parallel for speed
  await Promise.all(changes.map(change => 
    databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.CHANGE_LOGS,
      ID.unique(),
      {
        account_id: accountId,
        file_path: change.path,
        change_type: 'modified',
        detected_at: now,
        new_size: change.size,
      }
    ).catch(err => console.error('Failed to log:', err))
  ))
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit()) {
    return NextResponse.json({ success: true, message: 'Rate limited', rateLimited: true })
  }

  const sftp = new Client()

  try {
    const body = await request.json()
    const { account_id, action } = body

    if (!account_id) {
      return NextResponse.json({ success: false, message: 'account_id required' }, { status: 400 })
    }

    // STOP monitoring
    if (action === 'stop') {
      await deleteSession(account_id)
      return NextResponse.json({ success: true, message: 'Monitoring stopped' })
    }

    // INITIALIZE: Start monitoring (just record timestamp, no scanning)
    if (action === 'initialize') {
      const account = await getAccountSettings(account_id)
      if (!account) {
        return NextResponse.json({ success: false, message: 'Account not found' }, { status: 404 })
      }

      // Test connection only
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
        return NextResponse.json({ 
          success: false, 
          message: err instanceof Error ? err.message : 'Connection failed' 
        }, { status: 500 })
      }

      // Start session in database - record current time as baseline
      const now = Date.now()
      await saveSession(account_id, now, now, [])

      return NextResponse.json({
        success: true,
        message: 'Monitoring started. Only changes from now will be detected.',
      })
    }

    // SCAN: Check for changes since startTime
    const session = await getSession(account_id)
    if (!session) {
      return NextResponse.json({ 
        success: false, 
        needsInitialize: true,
        message: 'Not monitoring' 
      })
    }

    // Don't scan too frequently
    const now = Date.now()
    if (now - session.last_scan_time < 5000) {
      return NextResponse.json({ success: true, message: 'Waiting...', changesDetected: 0 })
    }

    const account = await getAccountSettings(account_id)
    if (!account) {
      return NextResponse.json({ success: false, message: 'Account not found' }, { status: 404 })
    }

    await sftp.connect({
      host: account.sftp_host,
      port: account.sftp_port || 22,
      username: account.sftp_username,
      password: account.sftp_password,
      readyTimeout: 15000,
    })

    const ignoredPatterns = account.ignored_folders
      ? account.ignored_folders.split(',').map((s: string) => s.trim())
      : []

    const loggedPaths = new Set<string>(JSON.parse(session.logged_paths || '[]'))

    const changes = await findChangedFiles(
      sftp,
      account.base_path || '/',
      session.start_time,
      ignoredPatterns,
      loggedPaths
    )

    await sftp.end()

    // Log changes and update session
    if (changes.length > 0) {
      await logChanges(account_id, changes)
      changes.forEach(c => loggedPaths.add(c.path))
    }

    // Update session in database
    await saveSession(account_id, session.start_time, now, Array.from(loggedPaths))

    return NextResponse.json({
      success: true,
      changesDetected: changes.length,
      message: changes.length > 0 ? `${changes.length} change(s) detected` : 'No changes'
    })

  } catch (error) {
    try { await sftp.end() } catch {}
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Scan failed' 
    }, { status: 500 })
  }
}
