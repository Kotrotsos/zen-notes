import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq, and, sql } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    // Find active share link
    const [shareLink] = await db
      .select({
        id: schema.sharedLinks.id,
        slug: schema.sharedLinks.slug,
        createdAt: schema.sharedLinks.createdAt,
        documentId: schema.documents.id,
        documentName: schema.documents.name,
        documentContent: schema.documents.content,
        documentView: schema.documents.view,
        ownerUsername: schema.users.username,
      })
      .from(schema.sharedLinks)
      .innerJoin(schema.documents, eq(schema.sharedLinks.documentId, schema.documents.id))
      .innerJoin(schema.users, eq(schema.sharedLinks.userId, schema.users.id))
      .where(
        and(
          eq(schema.sharedLinks.slug, slug),
          eq(schema.sharedLinks.isActive, true)
        )
      )
      .limit(1)

    if (!shareLink) {
      return NextResponse.json(
        { error: 'Share link not found or has been deactivated' },
        { status: 404 }
      )
    }

    // Increment access count
    await db
      .update(schema.sharedLinks)
      .set({
        accessCount: sql`CAST(${schema.sharedLinks.accessCount} AS INTEGER) + 1`,
      })
      .where(eq(schema.sharedLinks.id, shareLink.id))

    return NextResponse.json({
      success: true,
      document: {
        name: shareLink.documentName,
        content: shareLink.documentContent,
        view: shareLink.documentView,
        owner: shareLink.ownerUsername,
        sharedAt: shareLink.createdAt,
      },
    })
  } catch (error) {
    console.error('Get shared document error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
