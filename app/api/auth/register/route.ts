import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { hashPassword, validateEmail, validatePassword, createToken, setAuthCookie } from '@/lib/auth'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, username } = body

    // Validate input
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: 'Email, password, and username are required' },
        { status: 400 }
      )
    }

    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      )
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1)

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const [newUser] = await db
      .insert(schema.users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        username,
        avatarUrl: null,
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        username: schema.users.username,
        avatarUrl: schema.users.avatarUrl,
      })

    // Create user settings
    await db.insert(schema.userSettings).values({
      userId: newUser.id,
      editorSettings: {},
      previewSettings: {},
      copilotSettings: {},
      modelsSettings: {},
      appPrefs: {},
      uiState: {},
    })

    // Create token and set cookie
    const token = await createToken({
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      avatarUrl: newUser.avatarUrl,
    })

    await setAuthCookie(token)

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        avatarUrl: newUser.avatarUrl,
      },
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
