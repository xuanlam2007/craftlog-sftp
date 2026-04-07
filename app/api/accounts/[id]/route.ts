import { NextRequest, NextResponse } from 'next/server'
import { databases, DATABASE_ID, COLLECTIONS, Query } from '@/lib/appwrite-server'
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

async function checkAccess(accountId: string, userId: string): Promise<boolean> {
  const memberships = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.ACCOUNT_MEMBERS,
    [
      Query.equal('account_id', accountId),
      Query.equal('user_id', userId),
      Query.limit(1)
    ]
  )
  return memberships.documents.length > 0
}

async function isOwner(accountId: string, userId: string): Promise<boolean> {
  const memberships = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.ACCOUNT_MEMBERS,
    [
      Query.equal('account_id', accountId),
      Query.equal('user_id', userId),
      Query.equal('role', 'owner'),
      Query.limit(1)
    ]
  )
  return memberships.documents.length > 0
}

// GET - Get single account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    
    if (!await checkAccess(id, user.$id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const account = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.SFTP_ACCOUNTS,
      id
    )

    return NextResponse.json({ account })
  } catch (error) {
    console.error('Failed to fetch account:', error)
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 })
  }
}

// PATCH - Update account (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    
    if (!await isOwner(id, user.$id)) {
      return NextResponse.json({ error: 'Only owner can update account' }, { status: 403 })
    }

    const body = await request.json()
    const allowedFields = ['name', 'sftp_host', 'sftp_port', 'sftp_username', 'sftp_password', 'base_path', 'ignored_folders']
    const updateData: Record<string, unknown> = {}
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const account = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.SFTP_ACCOUNTS,
      id,
      updateData
    )

    return NextResponse.json({ account })
  } catch (error) {
    console.error('Failed to update account:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}

// DELETE - Delete account (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    
    if (!await isOwner(id, user.$id)) {
      return NextResponse.json({ error: 'Only owner can delete account' }, { status: 403 })
    }

    // Delete all members
    const members = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ACCOUNT_MEMBERS,
      [Query.equal('account_id', id), Query.limit(100)]
    )
    for (const member of members.documents) {
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.ACCOUNT_MEMBERS, member.$id)
    }

    // Delete the account
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SFTP_ACCOUNTS, id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete account:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
