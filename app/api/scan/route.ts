import { NextRequest, NextResponse } from 'next/server'
import SftpWatcher from 'sftp-watcher'
import { databases, ID, DATABASE_ID, COLLECTIONS } from '@/lib/appwrite-server'

interface WatcherInstance {
  watcher: typeof SftpWatcher.prototype
  startedAt: number
  accountId: string
}

// Active watchers per account
const activeWatchers = new Map<string, WatcherInstance>()

// Rate limiting
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

async function getAccountSettings(accountId: string) {
  try {
    return await databases.getDocument(DATABASE_ID, COLLECTIONS.SFTP_ACCOUNTS, accountId)
  } catch {
    return null
  }
}

async function logChange(accountId: string, filePath: string, changeType: 'added' | 'modified' | 'deleted', size?: number) {
  try {
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.CHANGE_LOGS,
      ID.unique(),
      {
        account_id: accountId,
        file_path: filePath,
        change_type: changeType,
        detected_at: new Date().toISOString(),
        new_size: size || 0,
      }
    )
    console.log(`[v0] Logged ${changeType}: ${filePath}`)
  } catch (error) {
    console.error(`[v0] Failed to log change:`, error)
  }
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit()) {
    return NextResponse.json({ success: true, message: 'Rate limited', rateLimited: true })
  }

  try {
    const body = await request.json()
    const { account_id, action } = body

    if (!account_id) {
      return NextResponse.json({ success: false, message: 'account_id required' }, { status: 400 })
    }

    // STOP monitoring
    if (action === 'stop') {
      const existing = activeWatchers.get(account_id)
      if (existing) {
        existing.watcher.emit('stop')
        activeWatchers.delete(account_id)
        console.log(`[v0] Stopped monitoring for account ${account_id}`)
      }
      return NextResponse.json({ success: true, message: 'Monitoring stopped' })
    }

    // START monitoring
    if (action === 'initialize') {
      // Stop existing watcher if any
      const existing = activeWatchers.get(account_id)
      if (existing) {
        existing.watcher.emit('stop')
        activeWatchers.delete(account_id)
      }

      const account = await getAccountSettings(account_id)
      if (!account) {
        return NextResponse.json({ success: false, message: 'Account not found' }, { status: 404 })
      }

      try {
        const watcher = new SftpWatcher({
          host: account.sftp_host,
          port: account.sftp_port || 22,
          username: account.sftp_username,
          password: account.sftp_password,
          path: account.base_path || '/',
          interval: 30000, // Check every 30 seconds
        })

        // Handle file upload (new or modified)
        watcher.on('upload', async (data: { filename: string; filepath: string; size?: number }) => {
          console.log(`[v0] File uploaded: ${data.filepath}`)
          await logChange(account_id, data.filepath, 'added', data.size)
        })

        // Handle file delete
        watcher.on('delete', async (data: { filename: string; filepath: string }) => {
          console.log(`[v0] File deleted: ${data.filepath}`)
          await logChange(account_id, data.filepath, 'deleted')
        })

        // Handle errors
        watcher.on('error', (error: Error) => {
          console.error(`[v0] Watcher error:`, error.message)
        })

        activeWatchers.set(account_id, {
          watcher,
          startedAt: Date.now(),
          accountId: account_id,
        })

        console.log(`[v0] Started monitoring for account ${account_id} at ${account.base_path || '/'}`)

        return NextResponse.json({
          success: true,
          message: 'Monitoring started. Changes will be detected automatically.',
          startedAt: Date.now(),
        })
      } catch (err) {
        return NextResponse.json({
          success: false,
          message: err instanceof Error ? err.message : 'Failed to start monitoring',
        }, { status: 500 })
      }
    }

    // STATUS check
    const existing = activeWatchers.get(account_id)
    if (existing) {
      return NextResponse.json({
        success: true,
        isMonitoring: true,
        startedAt: existing.startedAt,
        message: 'Monitoring active',
      })
    }

    return NextResponse.json({
      success: false,
      isMonitoring: false,
      needsInitialize: true,
      message: 'Not monitoring',
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

// Cleanup old watchers after 2 hours
setInterval(() => {
  const maxAge = 2 * 60 * 60 * 1000
  const now = Date.now()
  for (const [key, instance] of activeWatchers) {
    if (now - instance.startedAt > maxAge) {
      instance.watcher.emit('stop')
      activeWatchers.delete(key)
      console.log(`[v0] Auto-stopped old watcher for ${key}`)
    }
  }
}, 30 * 60 * 1000)
