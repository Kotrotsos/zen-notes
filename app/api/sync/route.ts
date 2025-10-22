import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { eq } from 'drizzle-orm'

interface FolderItem {
  id: string
  name: string
  type: 'folder'
  children?: any[]
  isExpanded?: boolean
}

interface SyncData {
  tabs: Array<{
    id: string
    name: string
    content: string
    folderPath?: string
    view?: 'text' | 'table'
    isOpen?: boolean
    isFavorite?: boolean
  }>
  folders: Array<FolderItem | {
    id: string
    name: string
    parentId?: string
    path?: string
    isExpanded?: boolean
  }>
  settings?: {
    editorSettings?: any
    previewSettings?: any
    copilotSettings?: any
    modelsSettings?: any
    appPrefs?: any
    uiState?: any
  }
}

// Helper to flatten folder tree and generate paths
function flattenFolders(folders: any[], parentPath: string = '', parentId: string | null = null): Array<{
  id: string
  name: string
  parentId: string | null
  path: string
  isExpanded: boolean
}> {
  const result: Array<{
    id: string
    name: string
    parentId: string | null
    path: string
    isExpanded: boolean
  }> = []

  for (const folder of folders) {
    if (folder.type === 'folder') {
      const path = parentPath ? `${parentPath}/${folder.name}` : `/${folder.name}`

      result.push({
        id: folder.id,
        name: folder.name,
        parentId,
        path,
        isExpanded: folder.isExpanded || false,
      })

      // Recursively process children
      if (folder.children && folder.children.length > 0) {
        const childFolders = folder.children.filter((c: any) => c.type === 'folder')
        if (childFolders.length > 0) {
          result.push(...flattenFolders(childFolders, path, folder.id))
        }
      }
    } else if (folder.path) {
      // Already a flat folder with path
      result.push({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId || null,
        path: folder.path,
        isExpanded: folder.isExpanded || false,
      })
    }
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const data: SyncData = await request.json()

    // Sync folders first (they're needed for folder references)
    if (data.folders && data.folders.length > 0) {
      // Delete existing folders
      await db.delete(schema.folders).where(eq(schema.folders.userId, user.id))

      // Flatten folder tree and generate paths
      const flatFolders = flattenFolders(data.folders)

      // Insert new folders
      for (const folder of flatFolders) {
        await db.insert(schema.folders).values({
          userId: user.id,
          name: folder.name,
          parentId: folder.parentId,
          path: folder.path,
          isExpanded: folder.isExpanded,
        })
      }
    }

    // Sync documents (tabs)
    if (data.tabs && data.tabs.length > 0) {
      // Delete existing documents
      await db.delete(schema.documents).where(eq(schema.documents.userId, user.id))

      // Insert new documents
      for (const tab of data.tabs) {
        await db.insert(schema.documents).values({
          userId: user.id,
          name: tab.name,
          content: tab.content,
          folderPath: tab.folderPath || null,
          view: tab.view || 'text',
          isOpen: tab.isOpen !== false,
          isFavorite: tab.isFavorite || false,
          localTabId: tab.id, // Store original local ID for reference
        })
      }
    }

    // Sync settings
    if (data.settings) {
      await db
        .insert(schema.userSettings)
        .values({
          userId: user.id,
          editorSettings: data.settings.editorSettings || {},
          previewSettings: data.settings.previewSettings || {},
          copilotSettings: data.settings.copilotSettings || {},
          modelsSettings: data.settings.modelsSettings || {},
          appPrefs: data.settings.appPrefs || {},
          uiState: data.settings.uiState || {},
        })
        .onConflictDoUpdate({
          target: schema.userSettings.userId,
          set: {
            editorSettings: data.settings.editorSettings,
            previewSettings: data.settings.previewSettings,
            copilotSettings: data.settings.copilotSettings,
            modelsSettings: data.settings.modelsSettings,
            appPrefs: data.settings.appPrefs,
            uiState: data.settings.uiState,
            updatedAt: new Date(),
          },
        })
    }

    return NextResponse.json({
      success: true,
      message: 'Data synced successfully',
      synced: {
        documents: data.tabs?.length || 0,
        folders: data.folders?.length || 0,
        settings: !!data.settings,
      },
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Fetch user's documents
    const documents = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.userId, user.id))

    // Fetch user's folders
    const folders = await db
      .select()
      .from(schema.folders)
      .where(eq(schema.folders.userId, user.id))

    // Fetch user's settings
    const [settings] = await db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, user.id))
      .limit(1)

    return NextResponse.json({
      success: true,
      data: {
        documents,
        folders,
        settings: settings || null,
      },
    })
  } catch (error) {
    console.error('Fetch sync data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
