import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { generatePasswordResetToken, validateEmail } from '@/lib/auth'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    // Validate input
    if (!email || !validateEmail(email)) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }

    // Find user
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1)

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      })
    }

    // Generate reset token
    const token = generatePasswordResetToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Delete any existing tokens for this user
    await db
      .delete(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.userId, user.id))

    // Create new reset token
    await db.insert(schema.passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    })

    // TODO: Send email with reset link
    // const resetLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`
    // await sendPasswordResetEmail(user.email, resetLink)

    console.log(`Password reset token for ${email}: ${token}`)
    console.log(`Reset link: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${token}`)

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
      // In development, return the token for testing (remove in production!)
      ...(process.env.NODE_ENV === 'development' && { token }),
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
