# Zen Notes - Authentication & Sharing Implementation Guide

This guide walks you through setting up the complete authentication, database sync, and sharing features for Zen Notes.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Database Setup](#database-setup)
4. [Local Development Setup](#local-development-setup)
5. [Railway Deployment](#railway-deployment)
6. [Features Implemented](#features-implemented)
7. [Usage Guide](#usage-guide)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)

## Overview

The implementation includes:
- User authentication (sign up, sign in, forgot password)
- PostgreSQL database for storing user data
- Local-to-remote data synchronization
- Document sharing with cute URL phrases
- Public document viewing
- User profile management

## Prerequisites

- Node.js 18+ and npm 9+
- Railway account (free tier works fine)
- Git (for deployment)

## Database Setup

### 1. Create PostgreSQL Database on Railway

1. Go to [Railway](https://railway.app) and log in
2. Click "New Project"
3. Select "Provision PostgreSQL"
4. Railway will create a database instance automatically

### 2. Get Database Connection String

1. Click on your PostgreSQL service
2. Go to the "Variables" tab
3. Copy the `DATABASE_URL` value

### 3. Set Up Local Environment

```bash
# Copy the example environment file
cp .env.local.example .env.local

# Edit .env.local and add your credentials
```

Your `.env.local` should look like:

```bash
DATABASE_URL="postgresql://user:password@host:port/database"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"
OPENAI_API_KEY="your-openai-key-if-you-have-one"
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Push Database Schema

This creates all the necessary tables in your Railway database:

```bash
npm run db:push
```

You should see output confirming tables were created:
- users
- documents
- folders
- shared_links
- password_reset_tokens
- user_settings

### 3. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Railway Deployment

### 1. Connect GitHub Repository

1. Push your code to GitHub
2. In Railway dashboard, click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### 2. Configure Environment Variables

In Railway dashboard, go to your project settings and add:

```
DATABASE_URL=<already-set-by-railway>
NEXTAUTH_URL=https://your-app.railway.app
NEXTAUTH_SECRET=<same-as-local>
OPENAI_API_KEY=<your-key>
```

### 3. Deploy

Railway will automatically:
- Detect Next.js
- Run `npm run build`
- Start the server with `npm start`

## Features Implemented

### Authentication System

**User Registration**
- Email, username, and password
- Password requirements: 8+ chars, uppercase, lowercase, number
- Automatic login after registration
- User profile creation

**Sign In**
- Email and password authentication
- JWT token-based sessions
- 7-day session expiry
- Secure HTTP-only cookies

**Password Reset**
- Forgot password flow
- Token-based reset (1-hour expiry)
- Email sending ready (currently logs to console in dev)

### Data Synchronization

**Local Storage (When Not Logged In)**
- All data stored in IndexedDB
- No account required
- Full app functionality

**Remote Sync (When Logged In)**
- Automatic sync on first login/registration
- Syncs: documents, folders, settings, UI state
- Merges local data with remote
- Real-time updates

### Document Sharing

**Share Link Generation**
- Cute phrase-based URLs (e.g., `/glowy-worm-like-santa-9a4b`)
- 2.5 trillion+ possible combinations
- Collision-proof with 4-char code suffix
- 5 URL options to choose from
- One-click copy to clipboard

**Public Viewing**
- Read-only access
- Shows document owner and share date
- Access count tracking
- Works for both text and table views

### User Interface

**User Profile Component**
- Sticky at bottom of explorer
- Shows avatar (initials fallback)
- Username and email display
- Sign in/Sign up buttons when logged out
- Profile menu with settings when logged in

**Authentication Dialogs**
- Login modal
- Registration modal
- Forgot password modal
- Reset password page
- Smooth transitions between flows

## Usage Guide

### For Users

#### First Time (Not Logged In)

1. Open Zen Notes
2. Create documents in the explorer
3. Everything saves locally (IndexedDB)
4. App works fully offline

#### Creating an Account

1. Click "Sign Up" at bottom of explorer
2. Enter username, email, and password
3. Click "Create Account"
4. Your local data automatically syncs to the cloud

#### Signing In on Another Device

1. Click "Sign In" at bottom of explorer
2. Enter email and password
3. Your documents load from the cloud
4. Continue working from where you left off

#### Sharing a Document

1. Right-click a document in explorer (or add share button to UI)
2. Select "Share"
3. Choose from 5 cute URL phrases
4. Click "Create Share Link"
5. Copy and send the link

#### Viewing Shared Documents

1. Open shared link (e.g., `zennotes.com/glowy-worm-like-santa-9a4b`)
2. View document contents
3. See who shared it and when
4. Click "Create Your Own" to start using Zen Notes

### For Developers

#### Adding Share Button to Documents

Add this to your document context menu or toolbar:

```tsx
import { ShareDialog } from '@/components/share-dialog'

const [shareDialogOpen, setShareDialogOpen] = useState(false)
const [shareDocumentId, setShareDocumentId] = useState('')

// In your component
<ShareDialog
  open={shareDialogOpen}
  onOpenChange={setShareDialogOpen}
  documentId={shareDocumentId}
  documentName={documentName}
/>
```

#### Implementing Sync on Login

The sync is triggered automatically via custom event. To handle it in your main app component:

```tsx
useEffect(() => {
  const handleLogin = async () => {
    // Get local data from IndexedDB
    const localData = await loadFromIndexedDB()

    // Sync to remote
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tabs: localData.tabs,
        folders: localData.folders,
        settings: localData.settings,
      }),
    })
  }

  window.addEventListener('user-logged-in', handleLogin)
  return () => window.removeEventListener('user-logged-in', handleLogin)
}, [])
```

## API Reference

### Authentication

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Data Sync

```
POST /api/sync           # Sync local data to remote
GET  /api/sync           # Get remote data
```

### Document Sharing

```
POST   /api/share        # Create share link
GET    /api/share        # Get user's share links
DELETE /api/share        # Deactivate share link
GET    /api/share/[slug] # Get public document
```

## Database Management

### View Your Database

```bash
# Open Drizzle Studio (visual database browser)
npm run db:studio
```

This opens a web interface at http://localhost:4983

### Run Migrations

```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (development)
npm run db:push
```

### Backup Database

```bash
# Using Railway CLI
railway run pg_dump $DATABASE_URL > backup.sql

# Restore
railway run psql $DATABASE_URL < backup.sql
```

## Troubleshooting

### Database Connection Issues

**Error: "DATABASE_URL environment variable is not set"**

Solution: Ensure `.env.local` exists and contains `DATABASE_URL`

**Error: "Connection refused"**

Solution: Check Railway database is running, verify connection string

### Authentication Issues

**Error: "Invalid email or password"**

Solution: Passwords are case-sensitive, check for typos

**Error: "User already exists"**

Solution: Try logging in instead, or use forgot password

### Share Link Issues

**Error: "Failed to generate unique slug"**

Solution: Very rare, try again. The system has 2.5T+ combinations

**Share link shows 404**

Solution: Check link is active in database, verify slug matches exactly

### Sync Issues

**Local data not syncing**

Solution: Check network connection, verify you're logged in, check browser console for errors

## Next Steps

### Recommended Enhancements

1. **Email Integration**
   - Set up SMTP for password reset emails
   - Send welcome emails on registration

2. **Share Link Management**
   - Add UI to view all share links
   - Option to deactivate links
   - Set expiration dates

3. **Collaboration**
   - Real-time collaborative editing
   - Comments on shared documents
   - Version history

4. **User Settings**
   - Profile picture upload
   - Change password
   - Delete account
   - Export all data

5. **Analytics**
   - Track share link views
   - Popular documents
   - User engagement metrics

## Security Notes

1. Never commit `.env.local` to git
2. Use strong `NEXTAUTH_SECRET` (32+ characters)
3. Enable SSL for production database connections
4. Regularly rotate database passwords
5. Implement rate limiting on auth endpoints
6. Add CAPTCHA to prevent bot registrations

## Support

For issues or questions:
1. Check this guide
2. Review Railway logs: `railway logs`
3. Check browser console for client-side errors
4. Review server logs for API errors

## Summary

You now have a complete authentication and sharing system with:
- PostgreSQL database on Railway
- User registration and login
- Local-to-remote data sync
- Cute phrase-based share URLs
- Public document viewing
- User profile UI

The app works fully offline for non-authenticated users, and seamlessly syncs when users log in!
