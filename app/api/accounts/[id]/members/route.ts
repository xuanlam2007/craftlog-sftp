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

// GET - List members
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

    const members = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ACCOUNT_MEMBERS,
      [Query.equal('account_id', id), Query.limit(100)]
    )

    return NextResponse.json({ members: members.documents })
  } catch (error) {
    console.error('Failed to fetch members:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

// POST - Add member by email (owner only)
export async function POST(
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
      return NextResponse.json({ error: 'Only owner can add members' }, { status: 403 })
    }

    const body = await request.json()
    const { email, user_id } = body

    if (!email || !user_id) {
      return NextResponse.json({ error: 'Email and user_id are required' }, { status: 400 })
    }

    // Check if already a member
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ACCOUNT_MEMBERS,
      [
        Query.equal('account_id', id),
        Query.equal('user_id', user_id),
        Query.limit(1)
      ]
    )

    if (existing.documents.length > 0) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 })
    }

    const member = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.ACCOUNT_MEMBERS,
      ID.unique(),
      {
        account_id: id,
        user_id,
        user_email: email,
        role: 'member',
        joined_at: new Date().toISOString()
      }
    )

    return NextResponse.json({ member })
  } catch (error) {
    console.error('Failed to add member:', error)
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
  }
}

// DELETE - Remove member (owner only, or self-remove)
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
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    }

    // Get the member to check permissions
    const member = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.ACCOUNT_MEMBERS,
      memberId
    )

    // Allow self-remove or owner can remove anyone
    const isOwnerUser = await isOwner(id, user.$id)
    const isSelf = member.user_id === user.$id

    if (!isOwnerUser && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prevent owner from being removed
    if (member.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove owner' }, { status: 400 })
    }

    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.ACCOUNT_MEMBERS, memberId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to remove member:', error)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}
