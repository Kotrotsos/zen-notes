# Railway Database Setup Guide

## 1. Create PostgreSQL Database on Railway

### Step 1: Create a New PostgreSQL Database

1. Log in to Railway at https://railway.app
2. Click "New Project"
3. Select "Provision PostgreSQL"
4. Railway will automatically create a PostgreSQL database instance

### Step 2: Get Database Credentials

Once the database is provisioned, click on the PostgreSQL service to view connection details:

- `PGHOST`: Database host
- `PGPORT`: Database port (usually 5432)
- `PGUSER`: Database user
- `PGPASSWORD`: Database password
- `PGDATABASE`: Database name
- `DATABASE_URL`: Full connection string (recommended)

### Step 3: Add Environment Variables to Your Project

In your Railway project settings or locally in `.env.local`:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
NEXTAUTH_URL=http://localhost:3000  # For development
NEXTAUTH_SECRET=your-random-secret-here  # Generate with: openssl rand -base64 32
```

## 2. Database Schema

Our database will have the following tables:

### Users Table
Stores user authentication and profile information.

### Documents Table
Stores user documents (tabs) synced from local IndexedDB.

### Folders Table
Stores folder structure for organizing documents.

### Shared Links Table
Stores the cute phrase-based share links for public documents.

## 3. Migration Commands

### Initialize Database

```bash
# Install dependencies
npm install pg @types/pg drizzle-orm drizzle-kit bcryptjs @types/bcryptjs nanoid next-auth

# Generate migration
npm run db:generate

# Push schema to database
npm run db:push

# Seed database (optional)
npm run db:seed
```

### Development Commands

```bash
# Run migrations
npm run db:migrate

# Open Drizzle Studio (visual database manager)
npm run db:studio

# Reset database (careful in production!)
npm run db:reset
```

## 4. Local Development

For local development, you can also use Railway's local PostgreSQL:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Pull environment variables
railway vars

# Run dev with Railway environment
railway run npm run dev
```

## 5. Environment Variables Setup

Create `.env.local` in your project root:

```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Optional: Email for password reset
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="noreply@zennotes.com"
```

## 6. Railway Deployment

When deploying to Railway:

1. Connect your GitHub repository
2. Railway will automatically detect Next.js
3. Add environment variables in Railway dashboard
4. Railway will auto-deploy on push

Ensure these are set in Railway's environment variables:
- `DATABASE_URL` (already available from PostgreSQL service)
- `NEXTAUTH_URL` (your production URL: https://your-app.railway.app)
- `NEXTAUTH_SECRET`

## 7. Database Backup

Railway automatically backs up your PostgreSQL database. To manually backup:

```bash
# Using Railway CLI
railway run pg_dump $DATABASE_URL > backup.sql

# Restore from backup
railway run psql $DATABASE_URL < backup.sql
```

## 8. Security Best Practices

1. Never commit `.env.local` to git (already in .gitignore)
2. Use strong NEXTAUTH_SECRET (32+ characters)
3. Enable SSL for database connections in production
4. Regularly rotate database passwords
5. Use Railway's built-in monitoring for unusual activity

## 9. Scaling

Railway handles database scaling:
- Automatic connection pooling
- Vertical scaling (increase RAM/CPU)
- Backups and point-in-time recovery

For connection pooling in your app, consider using PgBouncer or Prisma's connection pooling.
