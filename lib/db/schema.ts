import { pgTable, text, timestamp, boolean, jsonb, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  username: text('username').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('email_idx').on(table.email),
}))

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  content: text('content').notNull(),
  folderPath: text('folder_path'),
  view: text('view', { enum: ['text', 'table'] }).default('text'),
  isOpen: boolean('is_open').default(true),
  isFavorite: boolean('is_favorite').default(false),
  localTabId: text('local_tab_id'), // Original client-side ID for migration
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('documents_user_id_idx').on(table.userId),
  folderPathIdx: index('documents_folder_path_idx').on(table.folderPath),
}))

export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  parentId: uuid('parent_id').references((): any => folders.id, { onDelete: 'cascade' }),
  path: text('path').notNull(), // Full path for quick lookups, e.g., "/folder1/subfolder2"
  isExpanded: boolean('is_expanded').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('folders_user_id_idx').on(table.userId),
  pathIdx: index('folders_path_idx').on(table.path),
  parentIdIdx: index('folders_parent_id_idx').on(table.parentId),
}))

export const sharedLinks = pgTable('shared_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  slug: text('slug').notNull().unique(), // The cute phrase URL, e.g., "glowy-worm-like-santa-9a4b"
  isActive: boolean('is_active').default(true),
  accessCount: text('access_count').default('0'), // Track how many times it's been viewed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // Optional expiration
}, (table) => ({
  slugIdx: uniqueIndex('shared_links_slug_idx').on(table.slug),
  documentIdIdx: index('shared_links_document_id_idx').on(table.documentId),
}))

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenIdx: uniqueIndex('password_reset_tokens_token_idx').on(table.token),
  userIdIdx: index('password_reset_tokens_user_id_idx').on(table.userId),
}))

export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  editorSettings: jsonb('editor_settings'),
  previewSettings: jsonb('preview_settings'),
  copilotSettings: jsonb('copilot_settings'),
  modelsSettings: jsonb('models_settings'),
  appPrefs: jsonb('app_prefs'),
  uiState: jsonb('ui_state'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: uniqueIndex('user_settings_user_id_idx').on(table.userId),
}))

// Type exports for TypeScript
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert

export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert

export type SharedLink = typeof sharedLinks.$inferSelect
export type NewSharedLink = typeof sharedLinks.$inferInsert

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert

export type UserSettings = typeof userSettings.$inferSelect
export type NewUserSettings = typeof userSettings.$inferInsert
