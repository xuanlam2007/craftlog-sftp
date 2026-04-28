import { NextRequest, NextResponse } from 'next/server'
import Client from 'ssh2-sftp-client'
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite-server'

// Get account settings
async function getAccountSettings(accountId: string) {
  try {
    const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.SFTP_ACCOUNTS, accountId)
    return doc
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const sftp = new Client()
  
  try {
    const { account_id, path = '/' } = await request.json()

    if (!account_id) {
      return NextResponse.json({ success: false, message: 'Missing account_id' }, { status: 400 })
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
      readyTimeout: 10000,
    })

    // Get base path from account settings
    const basePath = account.base_path || '/'
    const fullPath = path === '/' ? basePath : `${basePath}${path}`.replace(/\/+/g, '/')

    // List ONLY this directory (not recursive)
    const listing = await sftp.list(fullPath)
    await sftp.end()

    // Sort: folders first, then files, alphabetically
    const items = listing
      .map(item => ({
        name: item.name,
        type: item.type === 'd' ? 'folder' : 'file',
        size: item.size,
        path: path === '/' ? `/${item.name}` : `${path}/${item.name}`,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name)
      })

    return NextResponse.json({
      success: true,
      path,
      items,
    })

  } catch (err) {
    await sftp.end().catch(() => {})
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : 'Failed to browse directory',
    }, { status: 500 })
  }
}
