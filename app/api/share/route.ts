import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { generateShareableSlug } from '@/lib/url-generator'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { documentId, customSlug } = await request.json()

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Verify document belongs to user
    const [document] = await db
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.id, documentId),
          eq(schema.documents.userId, user.id)
        )
      )
      .limit(1)

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if share link already exists
    const [existingLink] = await db
      .select()
      .from(schema.sharedLinks)
      .where(
        and(
          eq(schema.sharedLinks.documentId, documentId),
          eq(schema.sharedLinks.isActive, true)
        )
      )
      .limit(1)

    if (existingLink) {
      return NextResponse.json({
        success: true,
        shareLink: existingLink,
        url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/${existingLink.slug}`,
      })
    }

    // Generate unique slug
    let slug = customSlug || generateShareableSlug()
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const [existing] = await db
        .select()
        .from(schema.sharedLinks)
        .where(eq(schema.sharedLinks.slug, slug))
        .limit(1)

      if (!existing) break

      slug = generateShareableSlug()
      attempts++
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique slug. Please try again.' },
        { status: 500 }
      )
    }

    // Create share link
    const [shareLink] = await db
      .insert(schema.sharedLinks)
      .values({
        documentId,
        userId: user.id,
        slug,
        isActive: true,
        accessCount: '0',
      })
      .returning()

    return NextResponse.json({
      success: true,
      shareLink,
      url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/${slug}`,
    })
  } catch (error) {
    console.error('Create share link error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get all share links for current user
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const shareLinks = await db
      .select({
        id: schema.sharedLinks.id,
        slug: schema.sharedLinks.slug,
        isActive: schema.sharedLinks.isActive,
        accessCount: schema.sharedLinks.accessCount,
        createdAt: schema.sharedLinks.createdAt,
        documentName: schema.documents.name,
        documentId: schema.documents.id,
      })
      .from(schema.sharedLinks)
      .innerJoin(schema.documents, eq(schema.sharedLinks.documentId, schema.documents.id))
      .where(eq(schema.sharedLinks.userId, user.id))

    return NextResponse.json({
      success: true,
      shareLinks,
    })
  } catch (error) {
    console.error('Get share links error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Delete/deactivate share link
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { shareLinkId } = await request.json()

    if (!shareLinkId) {
      return NextResponse.json(
        { error: 'Share link ID is required' },
        { status: 400 }
      )
    }

    // Verify share link belongs to user
    const [shareLink] = await db
      .select()
      .from(schema.sharedLinks)
      .where(
        and(
          eq(schema.sharedLinks.id, shareLinkId),
          eq(schema.sharedLinks.userId, user.id)
        )
      )
      .limit(1)

    if (!shareLink) {
      return NextResponse.json(
        { error: 'Share link not found' },
        { status: 404 }
      )
    }

    // Deactivate the share link
    await db
      .update(schema.sharedLinks)
      .set({ isActive: false })
      .where(eq(schema.sharedLinks.id, shareLinkId))

    return NextResponse.json({
      success: true,
      message: 'Share link deactivated',
    })
  } catch (error) {
    console.error('Delete share link error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
