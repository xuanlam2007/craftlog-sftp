import { NextRequest, NextResponse } from 'next/server'
import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '@/lib/appwrite-server'
import { cookies } from 'next/headers'

async function getCurrentUser() {
  const cookieStore = await cookies()
  const userIdCookie = cookieStore.get('appwrite-user-id')
  const userEmailCookie = cookieStore.get('appwrite-user-email')
  
  if (!userIdCookie || !userEmailCookie) return null

  return {
    $id: userIdCookie.value,
    email: decodeURIComponent(userEmailCookie.value)
  }
}

// GET - List all accounts user has access to
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get accounts where user is a member
    const memberships = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ACCOUNT_MEMBERS,
      [Query.equal('user_id', user.$id), Query.limit(100)]
    )

    const accountIds = memberships.documents.map(m => m.account_id)
    
    if (accountIds.length === 0) {
      return NextResponse.json({ accounts: [] })
    }

    // Fetch the actual accounts
    const accounts = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.SFTP_ACCOUNTS,
      [Query.equal('$id', accountIds), Query.limit(100)]
    )

    return NextResponse.json({ accounts: accounts.documents })
  } catch (error) {
    console.error('Failed to fetch accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

// POST - Create new account
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, sftp_host, sftp_port, sftp_username, sftp_password, base_path, ignored_folders } = body

    if (!name || !sftp_host || !sftp_username || !sftp_password || !base_path) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create the account
    const account = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.SFTP_ACCOUNTS,
      ID.unique(),
      {
        name,
        owner_id: user.$id,
        sftp_host,
        sftp_port: sftp_port || 22,
        sftp_username,
        sftp_password,
        base_path,
        ignored_folders: ignored_folders || ''
      }
    )

    // Add owner as a member
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.ACCOUNT_MEMBERS,
      ID.unique(),
      {
        account_id: account.$id,
        user_id: user.$id,
        user_email: user.email,
        role: 'owner',
        joined_at: new Date().toISOString()
      }
    )

    return NextResponse.json({ account })
  } catch (error) {
    console.error('Failed to create account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
