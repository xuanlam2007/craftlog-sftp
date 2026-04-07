import { NextResponse } from 'next/server'
import Client from 'ssh2-sftp-client'

export async function POST(request: Request) {
  const sftp = new Client()
  
  try {
    const body = await request.json()
    const { host, port, username, password, basePath } = body

    if (!host || !username || !password) {
      return NextResponse.json(
        { success: false, message: 'Missing required connection details' },
        { status: 400 }
      )
    }

    await sftp.connect({
      host,
      port: port || 22,
      username,
      password,
      readyTimeout: 10000,
    })

    // Try to list the base path to verify access
    await sftp.list(basePath || '/')

    await sftp.end()

    return NextResponse.json({
      success: true,
      message: 'Connection successful!',
    })
  } catch (error: unknown) {
    await sftp.end().catch(() => {})
    
    const errorMessage = error instanceof Error ? error.message : 'Connection failed'
    console.error('SFTP connection test failed:', errorMessage)
    
    return NextResponse.json(
      { success: false, message: `Connection failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
