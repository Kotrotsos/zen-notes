"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback, useContext, createContext } from "react"
import { Editor } from "@monaco-editor/react"
import { useTheme } from "next-themes"
import {
  Plus,
  X,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Save,
  Download,
  Upload,
  FolderOpen,
  Settings,
  Info,
  Folder,
  File,
  ChevronRight,
  Star,
  Edit3,
  Trash2,
  FolderPlus,
  MessageSquare,
  Send,
  Pin,
  FileText,
  Wrench,
  Columns,
  Rows,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Tab {
  id: string
  name: string
  content: string
  folderPath?: string
}

interface EditorSettings {
  fontSize: number
  lineHeight: 1.6
  fullWidth: boolean
  fontFamily: string
  showLineNumbers: boolean
  showGutter: boolean
}

interface FileItem {
  id: string
  name: string
  type: "file"
  tabId: string
  isFavorite?: boolean
}

interface FolderItem {
  id: string
  name: string
  type: "folder"
  children: (FileItem | FolderItem)[]
  isExpanded?: boolean
}

interface AppData {
  tabs: Tab[]
  activeTabId: string
  settings: Record<string, any>
  editorSettings?: EditorSettings
  folderStructure?: FolderItem[]
  favorites?: string[] // Tab IDs
  previewSettings?: PreviewSettings
  copilotSettings?: CopilotSettings
}

type PreviewStyle = "classic" | "clean" | "serif" | "compact"

interface PreviewTemplate {
  id: string
  name: string
  style: PreviewStyle
  customCss?: string
}

interface PreviewSettings {
  style: PreviewStyle
  customCss?: string
  templates: PreviewTemplate[]
}

interface CopilotSettings {
  systemPrompt: string
  defaultModel: string
  enableWebSearch: boolean
  enableFetchTool: boolean
  allowedDomains: string // comma-separated list
  maxFetchBytes: number
  userAgent?: string
}

function PreviewTemplates({
  previewSettings,
  setPreviewSettings,
}: {
  previewSettings: PreviewSettings
  setPreviewSettings: React.Dispatch<React.SetStateAction<PreviewSettings>>
}) {
  const [name, setName] = useState("")

  const saveTemplate = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const tpl: PreviewTemplate = {
      id: `tpl-${Date.now()}`,
      name: trimmed,
      style: previewSettings.style,
      customCss: previewSettings.customCss || "",
    }
    setPreviewSettings((ps) => ({ ...ps, templates: [...ps.templates, tpl] }))
    setName("")
  }

  const applyTemplate = (tpl: PreviewTemplate) => {
    setPreviewSettings((ps) => ({ ...ps, style: tpl.style, customCss: tpl.customCss || ps.customCss }))
  }

  const deleteTemplate = (id: string) => {
    setPreviewSettings((ps) => ({ ...ps, templates: ps.templates.filter((t) => t.id !== id) }))
  }

  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-xs">Templates</h4>
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background"
        />
        <button onClick={saveTemplate} className="px-2 py-1 text-xs border rounded">
          Save Template
        </button>
      </div>
      {previewSettings.templates.length > 0 && (
        <div className="max-h-40 overflow-auto space-y-1">
          {previewSettings.templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center justify-between text-xs border rounded px-2 py-1">
              <div className="truncate">
                <span className="font-medium mr-2">{tpl.name}</span>
                <span className="text-muted-foreground">{tpl.style}</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-0.5 border rounded" onClick={() => applyTemplate(tpl)}>
                  Apply
                </button>
                <button className="px-2 py-0.5 border rounded" onClick={() => deleteTemplate(tpl.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ZenNotes() {
  type UIState = {
    showFileExplorer?: boolean
    pinnedExplorer?: boolean
    showCopilot?: boolean
    showWorkbench?: boolean
    workbenchScript?: string
    wbUseSelection?: boolean
    wbAllTabs?: boolean
    workbenchPreviewBelow?: boolean
    workbenchSplitRatio?: number
    workbenchActiveScriptId?: string | null
    splitView?: boolean
    showMarkdownPreview?: boolean
    splitRatio?: number
    settingsTab?: 'appearance' | 'editor' | 'preview' | 'ai' | 'shortcuts'
  }
  // Read initial UI state from localStorage synchronously on first render
  const getInitialUIState = () => {
    try {
      const raw = localStorage.getItem("zenNotes.uiState.v1")
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
      return {}
    }
  }
  const initialUI = getInitialUIState() as Partial<UIState>
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>("")
  const [isLoaded, setIsLoaded] = useState(false)
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(
    () => (typeof initialUI.showMarkdownPreview === "boolean" ? initialUI.showMarkdownPreview : false),
  )
  const [splitView, setSplitView] = useState(
    () => (typeof initialUI.splitView === "boolean" ? initialUI.splitView : false),
  )
  const [splitRatio, setSplitRatio] = useState(() => (typeof initialUI.splitRatio === "number" ? initialUI.splitRatio : 0.5)) // 50/50 split by default
  const [isDragging, setIsDragging] = useState(false)
  const [showStartMenu, setShowStartMenu] = useState(false)
  const [showEditorSettings, setShowEditorSettings] = useState(false)
  const [showFileExplorer, setShowFileExplorer] = useState(() => {
    const base = typeof initialUI.showFileExplorer === "boolean" ? initialUI.showFileExplorer : false
    // Ensure explorer is visible when pinned
    return initialUI.pinnedExplorer ? true : base
  })
  const [folderStructure, setFolderStructure] = useState<FolderItem[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState("")
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    fontSize: 16,
    lineHeight: 1.6,
    fullWidth: true,
    fontFamily: "JetBrains Mono",
    showLineNumbers: true,
    showGutter: true,
  })
  const editorRef = useRef(null)
  const blockDecorationsRef = useRef<any>(null)
  const blockSelectedDecorationsRef = useRef<any>(null)
  const lastBlockRangeRef = useRef<{ start: number; end: number } | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const { theme, resolvedTheme, setTheme } = useTheme()
  const dbRef = useRef<IDBDatabase | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const [draggedItem, setDraggedItem] = useState<{ type: "file" | "folder"; id: string; tabId?: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const [hoveredTab, setHoveredTab] = useState<string | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [pinnedExplorer, setPinnedExplorer] = useState(
    () => (typeof initialUI.pinnedExplorer === "boolean" ? initialUI.pinnedExplorer : false),
  )

  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>({
    style: "classic",
    customCss: "",
    templates: [],
  })
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'editor' | 'preview' | 'ai' | 'shortcuts'>(
    () => (typeof initialUI.settingsTab === "string" ? initialUI.settingsTab : 'editor'),
  )

  const fontOptions = [
    { name: "JetBrains Mono", value: "JetBrains Mono" },
    { name: "Fira Code", value: "Fira Code" },
    { name: "Source Code Pro", value: "Source Code Pro" },
    { name: "Monaco", value: "Monaco" },
    { name: "Consolas", value: "Consolas" },
    { name: "SF Mono", value: "SF Mono" },
    { name: "Cascadia Code", value: "Cascadia Code" },
    { name: "Inter", value: "Inter" },
    { name: "Roboto", value: "Roboto" },
    { name: "Open Sans", value: "Open Sans" },
    { name: "Lato", value: "Lato" },
    { name: "Poppins", value: "Poppins" },
  ]

  const [selectedText, setSelectedText] = useState("")
  const [showCopilotButton, setShowCopilotButton] = useState(false)
  const [showCopilot, setShowCopilot] = useState(
    () => (typeof initialUI.showCopilot === "boolean" ? initialUI.showCopilot : false),
  )
  // Workbench state
  const [showWorkbench, setShowWorkbench] = useState(
    () => (typeof initialUI.showWorkbench === "boolean" ? initialUI.showWorkbench : false),
  )
  const [workbenchTool, setWorkbenchTool] = useState<'script' | 'regex' | 'merge'>('script')
  const DEFAULT_EXAMPLE_SCRIPT = `// Define a transform function that receives the current file content
// and returns the transformed content as a string.
// You can also use the provided context: { filename }

function transform(input, context) {
  // Example: Convert to Title Case per line
  const toTitle = (s) => s.replace(/(^|\s|[-_])([a-z])/g, (m, p1, p2) => (p1 || '') + p2.toUpperCase())
  return input.split('\n').map(toTitle).join('\n')
}
`
  const exampleScripts: Array<{ id: string; name: string; code: string; description: string }> = [
    {
      id: 'title-case',
      name: 'Title Case Lines',
      description: 'Convert each line to Title Case',
      code: DEFAULT_EXAMPLE_SCRIPT,
    },
    {
      id: 'uppercase',
      name: 'Uppercase',
      description: 'Transform content to UPPERCASE',
      code: `function transform(input) {\n  return input.toUpperCase()\n}`,
    },
    {
      id: 'trim-trailing',
      name: 'Trim Trailing Spaces',
      description: 'Removes trailing spaces from each line',
      code: `function transform(input) {\n  return input.split('\\n').map(l => l.replace(/\\s+$/,'')).join('\\n')\n}`,
    },
    {
      id: 'wrap-80',
      name: 'Wrap at 80 cols',
      description: 'Naively wrap lines at 80 characters',
      code: `function transform(input) {\n  const wrap = (s, n=80) => s.match(new RegExp('.{1,'+n+'}', 'g')).join('\\n')\n  return input.split('\\n').map(l => l.length>80 ? wrap(l) : l).join('\\n')\n}`,
    },
  ]
  const [workbenchScript, setWorkbenchScript] = useState<string>(
    () => (typeof initialUI.workbenchScript === 'string' && initialUI.workbenchScript.trim().length > 0
      ? (initialUI.workbenchScript as string)
      : DEFAULT_EXAMPLE_SCRIPT),
  )
  // Saved scripts CRUD
  type SavedScript = { id: string; name: string; code: string; updatedAt: string }
  const SCRIPTS_KEY = 'zenNotes.scripts.v1'
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([])
  const [activeScriptId, setActiveScriptId] = useState<string | null>(() => (typeof initialUI.workbenchActiveScriptId === 'string' ? (initialUI.workbenchActiveScriptId as string) : null))
  const [scriptName, setScriptName] = useState<string>('Untitled')
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCRIPTS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setSavedScripts(parsed)
        // If active id is set, hydrate editor and name from it
        if (activeScriptId) {
          const found = parsed.find((s: SavedScript) => s.id === activeScriptId)
          if (found) {
            setWorkbenchScript(found.code)
            setScriptName(found.name)
          }
        }
      }
    } catch {}
  }, [])
  useEffect(() => {
    try { localStorage.setItem(SCRIPTS_KEY, JSON.stringify(savedScripts)) } catch {}
  }, [savedScripts])
  const [wbUseSelection, setWbUseSelection] = useState<boolean>(() => (typeof initialUI.wbUseSelection === 'boolean' ? !!initialUI.wbUseSelection : false))
  const [wbAllTabs, setWbAllTabs] = useState<boolean>(() => (typeof initialUI.wbAllTabs === 'boolean' ? !!initialUI.wbAllTabs : false))
  const [wbPreviewBelow, setWbPreviewBelow] = useState<boolean>(() => (typeof initialUI.workbenchPreviewBelow === 'boolean' ? !!initialUI.workbenchPreviewBelow : false))
  const [wbSplitRatio, setWbSplitRatio] = useState<number>(() => (typeof initialUI.workbenchSplitRatio === 'number' ? (initialUI.workbenchSplitRatio as number) : 0.5))
  const wbContainerRef = useRef<HTMLDivElement>(null)
  const [wbIsDragging, setWbIsDragging] = useState(false)
  const handleWbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setWbIsDragging(true)
  }
  const handleWbMouseMove = (e: MouseEvent) => {
    if (!wbIsDragging || !wbContainerRef.current) return
    const rect = wbContainerRef.current.getBoundingClientRect()
    let ratio = 0.5
    if (wbPreviewBelow) {
      ratio = (e.clientY - rect.top) / rect.height
    } else {
      ratio = (e.clientX - rect.left) / rect.width
    }
    ratio = Math.max(0.2, Math.min(0.8, ratio))
    setWbSplitRatio(ratio)
  }
  const handleWbMouseUp = () => setWbIsDragging(false)
  useEffect(() => {
    if (!wbIsDragging) return
    document.addEventListener('mousemove', handleWbMouseMove)
    document.addEventListener('mouseup', handleWbMouseUp)
    document.body.style.cursor = wbPreviewBelow ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.removeEventListener('mousemove', handleWbMouseMove)
      document.removeEventListener('mouseup', handleWbMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [wbIsDragging, wbPreviewBelow])
  // Hidden legacy for backward compat
  const [selectionPattern, setSelectionPattern] = useState<string>('')
  const [selectionFlags, setSelectionFlags] = useState<string>('m')
  // Hidden legacy tool state (disabled in UI) so code compiles
  const [regexPattern, setRegexPattern] = useState<string>('')
  const [regexFlags, setRegexFlags] = useState<string>('g')
  const [regexReplacement, setRegexReplacement] = useState<string>('')
  const [mergeCsvText, setMergeCsvText] = useState<string>('')
  const [mergeSelectedRow, setMergeSelectedRow] = useState<number>(0)
  const [mergeDataMode, setMergeDataMode] = useState<'csv' | 'json'>('csv')
  const [mergeJsonText, setMergeJsonText] = useState<string>('')
  const [mergeBatch, setMergeBatch] = useState<boolean>(false)
  const [mergeFilenameTemplate, setMergeFilenameTemplate] = useState<string>('{{name}}.md')
  const [mergeDownload, setMergeDownload] = useState<boolean>(false)
  const [mergeCreateTabs, setMergeCreateTabs] = useState<boolean>(false)
  const [mergeFolderTemplate, setMergeFolderTemplate] = useState<string>('Default')
  const [mergePreviewCount, setMergePreviewCount] = useState<number>(5)
  const [workbenchResult, setWorkbenchResult] = useState<string>("")
  const [copilotInput, setCopilotInput] = useState("")
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 })
  const [copilotMessages, setCopilotMessages] = useState<
    {
      id: string
      role: "user" | "assistant"
      content: string
      timestamp: Date
    }[]
  >([])
  const copilotTextareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [copilotModel, setCopilotModel] = useState<string>("gpt-4.1")
  const [copilotUsage, setCopilotUsage] = useState<{ input: number; output: number; total: number; contextPct: number } | null>(
    null,
  )
  const [copilotSettings, setCopilotSettings] = useState<CopilotSettings>({
    systemPrompt:
      "You are Zen Notes Copilot with tools. Always respond in GitHub-Flavored Markdown with clear headings, lists, and code fences. You can use tools: (1) web_search — use for current events, missing facts, or to verify claims; cite sources with full URLs. (2) fetch_url — when the user provides an HTTPS URL or asks to fetch a specific page or API, retrieve a concise text snapshot and then summarize with citations. If a tool isn\'t needed, answer directly. Be concise and factual; if unsure, say so and propose next steps.",
    defaultModel: "gpt-4.1",
    enableWebSearch: true,
    enableFetchTool: true,
    allowedDomains: "news.ycombinator.com, api.github.com, developer.apple.com",
    maxFetchBytes: 150000,
    userAgent: "ZenNotesCopilot/1.0 (+https://example.com)",
  })
  const SETTINGS_KEY = "zenNotes.settings.v1"
  const UI_STATE_KEY = "zenNotes.uiState.v1"

  const [showAtReference, setShowAtReference] = useState(false)
  const [atReferencePosition, setAtReferencePosition] = useState({ x: 0, y: 0 })
  const [atReferenceItems, setAtReferenceItems] = useState<
    Array<{
      id: string
      name: string
      type: "file" | "folder" | "special"
      path?: string
      icon: React.ReactNode
    }>
  >([])
  const [atReferenceFilter, setAtReferenceFilter] = useState("")
  const [selectedAtIndex, setSelectedAtIndex] = useState(0)
  const atReferenceStartPos = useRef<{ lineNumber: number; column: number } | null>(null)

  const [showChatAtReference, setShowChatAtReference] = useState(false)
  const [chatAtReferencePosition, setChatAtReferencePosition] = useState({ x: 0, y: 0 })
  const [chatAtReferenceItems, setChatAtReferenceItems] = useState<
    Array<{
      id: string
      name: string
      type: "file" | "folder" | "special"
      path?: string
      description?: string
    }>
  >([])
  const [chatAtReferenceFilter, setChatAtReferenceFilter] = useState("")
  const [chatAtReferenceSelectedIndex, setChatAtReferenceSelectedIndex] = useState(0)

  const createDefaultFolder = (): FolderItem => ({
    id: "default",
    name: "Default",
    type: "folder",
    children: [],
    isExpanded: true,
  })

  const findFolderByPath = (path: string, folders: FolderItem[] = folderStructure): FolderItem | null => {
    if (path === "" || path === "Default") {
      return folders.find((f) => f.name === "Default") || null
    }

    const pathParts = path.split("/")
    let currentFolder = folders.find((f) => f.name === pathParts[0])

    for (let i = 1; i < pathParts.length && currentFolder; i++) {
      currentFolder = currentFolder.children.find(
        (item) => item.type === "folder" && item.name === pathParts[i],
      ) as FolderItem
    }

    return currentFolder || null
  }

  const createFolderPath = (path: string, folders: FolderItem[]): FolderItem[] => {
    if (path === "" || path === "Default") return folders

    const pathParts = path.split("/")
    const updatedFolders = [...folders]
    let currentLevel = updatedFolders

    for (const part of pathParts) {
      let existingFolder = currentLevel.find((item) => item.type === "folder" && item.name === part) as FolderItem

      if (!existingFolder) {
        existingFolder = {
          id: `folder-${Date.now()}-${Math.random()}`,
          name: part,
          type: "folder",
          children: [],
          isExpanded: true,
        }
        currentLevel.push(existingFolder)
      }

      currentLevel = existingFolder.children as (FileItem | FolderItem)[]
    }

    return updatedFolders
  }

  const addFileToFolder = (tabId: string, tabName: string, folderPath = "Default") => {
    setFolderStructure((prev) => {
      let updatedStructure = [...prev]

      // Ensure Default folder exists
      if (!updatedStructure.find((f) => f.name === "Default")) {
        updatedStructure.push(createDefaultFolder())
      }

      // Create folder path if needed
      if (folderPath !== "Default") {
        updatedStructure = createFolderPath(folderPath, updatedStructure)
      }

      // Find target folder
      const targetFolder = findFolderByPath(folderPath, updatedStructure)
      if (targetFolder) {
        // Remove file from any existing location
        const removeFileFromStructure = (items: (FileItem | FolderItem)[]): (FileItem | FolderItem)[] => {
          return items.filter((item) => {
            if (item.type === "file" && item.tabId === tabId) {
              return false
            }
            if (item.type === "folder") {
              item.children = removeFileFromStructure(item.children)
            }
            return true
          })
        }

        updatedStructure = removeFileFromStructure(updatedStructure) as FolderItem[]

        // Add file to target folder
        const targetFolderInStructure = findFolderByPath(folderPath, updatedStructure)
        if (targetFolderInStructure) {
          targetFolderInStructure.children.push({
            id: `file-${tabId}`,
            name: tabName,
            type: "file",
            tabId,
          })
        }
      }

      return updatedStructure
    })
  }

  const moveFileToFolder = (tabId: string, targetFolderPath: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return

    setFolderStructure((prev) => {
      let updatedStructure = [...prev]

      // Remove file from current location
      const removeFileFromStructure = (items: (FileItem | FolderItem)[]): (FileItem | FolderItem)[] => {
        return items.filter((item) => {
          if (item.type === "file" && item.tabId === tabId) {
            return false
          }
          if (item.type === "folder") {
            item.children = removeFileFromStructure(item.children)
          }
          return true
        })
      }

      updatedStructure = removeFileFromStructure(updatedStructure) as FolderItem[]

      // Create target folder path if needed
      if (targetFolderPath !== "Default") {
        updatedStructure = createFolderPath(targetFolderPath, updatedStructure)
      }

      // Add file to target folder
      const targetFolder = findFolderByPath(targetFolderPath, updatedStructure)
      if (targetFolder) {
        targetFolder.children.push({
          id: `file-${tabId}`,
          name: tab.name,
          type: "file",
          tabId: tabId,
        })
      }

      return updatedStructure
    })
  }

  const handleDragStart = (e: React.DragEvent, item: FileItem | FolderItem) => {
    if (item.type === "file") {
      setDraggedItem({ type: "file", id: item.id, tabId: item.tabId })
      e.dataTransfer.setData("text/plain", item.tabId)
    }
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTarget(folderId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear drop target if we're leaving the folder entirely
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDropTarget(null)
    }
  }

  const handleDrop = (e: React.DragEvent, targetFolder: FolderItem) => {
    e.preventDefault()
    const tabId = e.dataTransfer.getData("text/plain")

    if (draggedItem && draggedItem.type === "file" && draggedItem.tabId === tabId) {
      // Get folder path for the target folder
      const getFolderPath = (folderId: string, items: FolderItem[], currentPath = ""): string => {
        for (const item of items) {
          if (item.type === "folder") {
            const newPath = currentPath ? `${currentPath}/${item.name}` : item.name
            if (item.id === folderId) {
              return newPath === "Default" ? "Default" : newPath
            }
            const childPath = getFolderPath(folderId, item.children as FolderItem[], newPath)
            if (childPath) return childPath
          }
        }
        return ""
      }

      const targetPath = getFolderPath(targetFolder.id, folderStructure)
      if (targetPath) {
        moveFileToFolder(tabId, targetPath)
      }
    }

    setDraggedItem(null)
    setDropTarget(null)
  }

  const initDB = async () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("ZenNotesDB", 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains("appData")) {
          db.createObjectStore("appData", { keyPath: "id" })
        }
      }
    })
  }

  const saveToIndexedDB = async (data: AppData) => {
    if (!dbRef.current) return

    const transaction = dbRef.current.transaction(["appData"], "readwrite")
    const store = transaction.objectStore("appData")
    await store.put({ id: "main", ...data })
  }

  const loadFromIndexedDB = async (): Promise<AppData | null> => {
    if (!dbRef.current) return null

    const transaction = dbRef.current.transaction(["appData"], "readonly")
    const store = transaction.objectStore("appData")
    const request = store.get("main")

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const result = request.result
        if (result) {
          const { id, ...data } = result
          resolve(data as AppData)
        } else {
          resolve(null)
        }
      }
      request.onerror = () => resolve(null)
    })
  }

  useEffect(() => {
    const initApp = async () => {
      try {
        dbRef.current = await initDB()
        const savedData = await loadFromIndexedDB()

        if (savedData && savedData.tabs.length > 0) {
          setTabs(savedData.tabs)
          setActiveTabId(savedData.activeTabId)
          if (savedData.editorSettings) {
            setEditorSettings(savedData.editorSettings)
          }
          if (savedData.folderStructure) {
            setFolderStructure(savedData.folderStructure)
          } else {
            // Create default folder structure
            const defaultFolder = createDefaultFolder()
            savedData.tabs.forEach((tab) => {
              defaultFolder.children.push({
                id: `file-${tab.id}`,
                name: tab.name,
                type: "file",
                tabId: tab.id,
              })
            })
            setFolderStructure([defaultFolder])
          }
          if (savedData.favorites) {
            setFavorites(savedData.favorites)
          }
          if (savedData.previewSettings) {
            setPreviewSettings(savedData.previewSettings)
          }
          if ((savedData as any).settings && (savedData as any).settings.copilotModel) {
            setCopilotModel((savedData as any).settings.copilotModel)
          }
          if ((savedData as any).copilotSettings) {
            setCopilotSettings((savedData as any).copilotSettings)
            setCopilotModel((savedData as any).copilotSettings.defaultModel || "gpt-4.1")
          }
          if ((savedData as any).settings && (savedData as any).settings.copilotModel) {
            setCopilotModel((savedData as any).settings.copilotModel)
          }
        } else {
          // Create default tab and folder structure
          const defaultTab: Tab = {
            id: "tab-1",
            name: "Untitled",
            content: "# New document",
            folderPath: "Default",
          }
          setTabs([defaultTab])
          setActiveTabId(defaultTab.id)

          const defaultFolder = createDefaultFolder()
          defaultFolder.children.push({
            id: `file-${defaultTab.id}`,
            name: defaultTab.name,
            type: "file",
            tabId: defaultTab.id,
          })
          setFolderStructure([defaultFolder])
        }
      } catch (error) {
        console.error("Failed to initialize IndexedDB:", error)
        // Fallback to default tab
        const defaultTab: Tab = {
          id: "tab-1",
          name: "Untitled",
          content: "# New document",
          folderPath: "Default",
        }
        setTabs([defaultTab])
        setActiveTabId(defaultTab.id)

        const defaultFolder = createDefaultFolder()
        defaultFolder.children.push({
          id: `file-${defaultTab.id}`,
          name: defaultTab.name,
          type: "file",
          tabId: defaultTab.id,
        })
        setFolderStructure([defaultFolder])
      }

      setIsLoaded(true)
    }

    initApp()
  }, [])

  // Load settings from localStorage (fast path) on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.editorSettings) setEditorSettings((prev) => ({ ...prev, ...parsed.editorSettings }))
        if (parsed.previewSettings) setPreviewSettings((prev) => ({ ...prev, ...parsed.previewSettings }))
        if (parsed.copilotSettings) {
          setCopilotSettings((prev) => ({ ...prev, ...parsed.copilotSettings }))
          if (parsed.copilotSettings.defaultModel) setCopilotModel(parsed.copilotSettings.defaultModel)
        }
      }
    } catch {}
  }, [])

  // UI state is initialized lazily from localStorage above; no extra load effect needed

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    try {
      const payload = {
        editorSettings,
        previewSettings,
        copilotSettings,
      }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload))
    } catch {}
  }, [editorSettings, previewSettings, copilotSettings])

  // Persist UI state to localStorage whenever it changes
  useEffect(() => {
    try {
      const ui = {
        showFileExplorer,
        pinnedExplorer,
        showCopilot,
        showWorkbench,
        workbenchScript,
        wbUseSelection,
        wbAllTabs,
        workbenchPreviewBelow: wbPreviewBelow,
        workbenchSplitRatio: wbSplitRatio,
        workbenchActiveScriptId: activeScriptId,
        splitView,
        showMarkdownPreview,
        splitRatio,
        settingsTab,
      }
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(ui))
    } catch {}
  }, [showFileExplorer, pinnedExplorer, showCopilot, showWorkbench, workbenchScript, wbUseSelection, wbAllTabs, wbPreviewBelow, wbSplitRatio, activeScriptId, splitView, showMarkdownPreview, splitRatio, settingsTab])

  const handleKeyDown = (e: KeyboardEvent) => {
    // Unified shortcuts: require Ctrl + Command + key (no Shift)
    const withCtrlCmd = e.metaKey && e.ctrlKey && !e.shiftKey && !e.altKey

    // Explorer: Ctrl+Cmd+E
    if (withCtrlCmd && (e.key === "e" || e.key === "E")) {
      e.preventDefault()
      setShowFileExplorer((prev) => !prev)
    }

    // Copilot: Ctrl+Cmd+K
    if (withCtrlCmd && (e.key === "k" || e.key === "K")) {
      e.preventDefault()
      setShowCopilot((prev) => {
        const newState = !prev
        if (newState) {
          // Close preview pane if open to avoid clutter
          setSplitView(false)
          setShowMarkdownPreview(false)
        }
        return newState
      })
    }

    // Preview overlay: Ctrl+Cmd+P
    if (withCtrlCmd && (e.key === "p" || e.key === "P")) {
      e.preventDefault()
      setShowMarkdownPreview((prev) => !prev)
      setSplitView(false) // Close split view if open
      setShowCopilot(false)
    }

    // Split view: Ctrl+Cmd+S
    if (withCtrlCmd && (e.key === "s" || e.key === "S")) {
      e.preventDefault()
      setSplitView((prev) => !prev)
      setShowMarkdownPreview(false) // Close preview overlay if open
      setShowCopilot(false)
      setShowWorkbench(false)
    }

    // Workbench: Ctrl+Cmd+W
    if (withCtrlCmd && (e.key === "w" || e.key === "W")) {
      e.preventDefault()
      setShowWorkbench((prev) => {
        const next = !prev
        if (next) {
          setShowMarkdownPreview(false)
          setSplitView(false)
          setShowCopilot(false)
        }
        return next
      })
    }

    // Escape: Close any preview mode
    if (e.key === "Escape") {
      setShowMarkdownPreview(false)
      setSplitView(false)
      setShowStartMenu(false)
      setShowEditorSettings(false)
      setShowFileExplorer(false)
      setShowCopilot(false)
      setShowWorkbench(false)
      setShowAtReference(false) // Close @ reference dropdown
      setShowChatAtReference(false) // Close chat @ reference dropdown
    }
  }

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleClickOutside = (e: MouseEvent | TouchEvent) => {
    const target = e.target as Element

    // Check if click/touch is inside any dialog
    const isInsideStartMenu = target.closest("[data-start-menu]")
    const isInsideSettings = target.closest("[data-settings-menu]")
    const isInsideExplorer = target.closest("[data-explorer]")
    const isStartButton = target.closest("[data-start-button]")
    const isAtReferenceDropdown = target.closest(".at-reference-dropdown") // Add a class to the dropdown
    const isChatAtReferenceDropdown = target.closest(".chat-at-reference-dropdown") // Add a class for chat dropdown

    // If click/touch is outside all dialogs and not on the start button, close all dialogs
    if (
      !isInsideStartMenu &&
      !isInsideSettings &&
      !isInsideExplorer &&
      !isStartButton &&
      !isAtReferenceDropdown &&
      !isChatAtReferenceDropdown
    ) {
      setShowStartMenu(false)
      setShowEditorSettings(false)
      if (!pinnedExplorer) {
        setShowFileExplorer(false)
      }
      setShowAtReference(false) // Close @ reference dropdown
      setShowChatAtReference(false) // Close chat @ reference dropdown
    }
  }

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [pinnedExplorer])

  useEffect(() => {
    const originalError = console.error
    const originalWarn = console.warn

    // Handle ResizeObserver errors at the window level
    const handleResizeObserverError = (event: ErrorEvent) => {
      if (event.message?.includes("ResizeObserver loop completed")) {
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    }

    // Handle unhandled promise rejections that might be ResizeObserver related
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes("ResizeObserver loop completed")) {
        event.preventDefault()
        return false
      }
    }

    window.addEventListener("error", handleResizeObserverError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    console.error = (...args) => {
      if (args[0]?.toString().includes("ResizeObserver loop completed")) {
        return // Suppress ResizeObserver errors
      }
      originalError.apply(console, args)
    }

    console.warn = (...args) => {
      if (args[0]?.toString().includes("ResizeObserver loop completed")) {
        return // Suppress ResizeObserver warnings
      }
      originalWarn.apply(console, args)
    }

    return () => {
      window.removeEventListener("error", handleResizeObserverError)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
      console.error = originalError
      console.warn = originalWarn
    }
  }, [])

  useEffect(() => {
    if (isLoaded && tabs.length > 0) {
      const appData: AppData = {
        tabs,
        activeTabId,
        settings: {
          splitView,
          showMarkdownPreview,
          lastSaved: new Date().toISOString(),
          copilotModel,
        },
        editorSettings,
        folderStructure,
        favorites,
        previewSettings,
        copilotSettings,
      }
      autoSave(appData)
    }
  }, [tabs, activeTabId, isLoaded, splitView, showMarkdownPreview, copilotModel, editorSettings, folderStructure, favorites, previewSettings])

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: editorSettings.fontSize,
        lineHeight: editorSettings.lineHeight,
        fontFamily: `"${editorSettings.fontFamily}", var(--font-mono), "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace`,
        wordWrap: "on",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: "none",
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        scrollbar: {
          vertical: "auto",
          horizontal: "hidden",
          alwaysConsumeMouseWheel: true,
        },
        lineNumbers: editorSettings.showGutter ? (editorSettings.showLineNumbers ? "on" : "off") : "off",
        glyphMargin: editorSettings.showGutter,
        folding: editorSettings.showGutter,
        lineDecorationsWidth: editorSettings.showGutter ? 10 : 0,
        lineNumbersMinChars: editorSettings.showGutter ? 3 : 0,
        renderValidationDecorations: "off",
        automaticLayout: false, // Disable automatic layout to prevent conflicts
        fixedOverflowWidgets: true, // Prevent widget overflow issues
        padding: { left: editorSettings.showGutter ? 0 : 16, bottom: 12 },
      })

      const monaco = (window as any).monaco
      if (monaco) {
        monaco.editor.defineTheme("custom-vs", {
          base: "vs",
          inherit: true,
          rules: [],
          colors: {
            "editorLineNumber.foreground": "#d0d0d0",
            "editorLineNumber.activeForeground": "#999999",
          },
        })

        monaco.editor.defineTheme("custom-vs-dark", {
          base: "vs-dark",
          inherit: true,
          rules: [],
          colors: {
            "editorLineNumber.foreground": "#404040",
            "editorLineNumber.activeForeground": "#666666",
          },
        })

        // Apply the custom theme
        monaco.editor.setTheme(resolvedTheme === "dark" ? "custom-vs-dark" : "custom-vs")
      }
    }
  }, [
    editorSettings.fontSize,
    editorSettings.lineHeight,
    editorSettings.fontFamily,
    editorSettings.showLineNumbers,
    editorSettings.showGutter,
    resolvedTheme,
  ])

  const activeTab = tabs.find((tab) => tab.id === activeTabId)

  const addTab = () => {
    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      name: "Untitled",
      content: "# New document",
      folderPath: "Default",
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return // Don't close the last tab

    const newTabs = tabs.filter((tab) => tab.id !== tabId)
    setTabs(newTabs)

    if (activeTabId === tabId) {
      const tabIndex = tabs.findIndex((tab) => tab.id === tabId)
      const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0
      setActiveTabId(newTabs[newActiveIndex].id)
    }
  }

  const updateTabContent = (content: string) => {
    setTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? { ...tab, content } : tab)))
    if (isLoaded) {
      const updatedTabs = tabs.map((tab) => (tab.id === activeTabId ? { ...tab, content } : tab))
      const appData: AppData = {
        tabs: updatedTabs,
        activeTabId,
        settings: {
          splitView,
          showMarkdownPreview,
          lastSaved: new Date().toISOString(),
        },
        editorSettings,
        folderStructure,
        favorites,
      }
      autoSave(appData)
    }
  }

  const startEditingTab = (tabId: string, currentName: string) => {
    setEditingTabId(tabId)
    setEditingName(currentName)
  }

  const saveTabName = () => {
    if (editingTabId && editingName.trim()) {
      const trimmedName = editingName.trim()

      let folderPath = "Default"
      let fileName = trimmedName

      if (trimmedName.startsWith("/")) {
        const pathParts = trimmedName.slice(1).split("/")
        if (pathParts.length > 1) {
          folderPath = pathParts.slice(0, -1).join("/")
          fileName = pathParts[pathParts.length - 1]
        } else {
          fileName = pathParts[0]
        }
      }

      setTabs((prev) => prev.map((tab) => (tab.id === editingTabId ? { ...tab, name: fileName, folderPath } : tab)))

      // Add to folder structure
      addFileToFolder(editingTabId, fileName, folderPath)

      if (isLoaded) {
        const updatedTabs = tabs.map((tab) => (tab.id === editingTabId ? { ...tab, name: fileName, folderPath } : tab))
        const appData: AppData = {
          tabs: updatedTabs,
          activeTabId,
          settings: {
            splitView,
            showMarkdownPreview,
            lastSaved: new Date().toISOString(),
          },
          editorSettings,
          folderStructure,
          favorites,
        }
        autoSave(appData)
      }
    }
    setEditingTabId(null)
    setEditingName("")
  }

  const cancelEditingTab = () => {
    setEditingTabId(null)
    setEditingName("")
  }

  const collectAllItems = useCallback(() => {
    const items: Array<{
      id: string
      name: string
      type: "file" | "folder" | "special"
      path?: string
      icon: React.ReactNode
    }> = []

    // Add special @opentabs option
    items.push({
      id: "opentabs",
      name: "@opentabs",
      type: "special",
      icon: <File size={14} className="text-blue-500" />,
    })

    // Recursively collect folders and files
    const collectFromFolder = (folder: FolderItem, parentPath = "") => {
      const currentPath = parentPath ? `${parentPath}/${folder.name}` : folder.name

      // Add folder
      items.push({
        id: folder.id,
        name: folder.name,
        type: "folder",
        path: currentPath,
        icon: <Folder size={14} className="text-yellow-600" />,
      })

      // Add files in this folder
      folder.children.forEach((child) => {
        if (child.type === "file") {
          const tab = tabs.find((t) => t.id === child.tabId)
          if (tab) {
            items.push({
              id: child.id,
              name: tab.name,
              type: "file",
              path: `${currentPath}/${tab.name}`,
              icon: <File size={14} className="text-blue-500" />,
            })
          }
        } else if (child.type === "folder") {
          collectFromFolder(child, currentPath)
        }
      })
    }

    folderStructure.forEach((folder) => collectFromFolder(folder))

    return items
  }, [folderStructure, tabs])

  const handleEditorDidMount = useCallback(
    (editor: any, monaco: any) => {
      editorRef.current = editor
      blockDecorationsRef.current = editor.createDecorationsCollection()
      blockSelectedDecorationsRef.current = editor.createDecorationsCollection()

      // Focus the editor immediately
      editor.focus()

      console.log("[v0] Editor mounted, setting up event handlers")

      const handleContentChange = () => {
        console.log("[v0] Content changed event fired")
        const model = editor.getModel()
        const position = editor.getPosition()

        if (model && position) {
          const lineContent = model.getLineContent(position.lineNumber)
          const beforeCursor = lineContent.substring(0, position.column - 1)

          console.log("[v0] Line content:", lineContent)
          console.log("[v0] Before cursor:", beforeCursor)

          // Check if we just typed @ or are continuing to type after @
          const atMatch = beforeCursor.match(/@(\w*)$/)

          console.log("[v0] Checking for @ pattern:", beforeCursor, "Match:", atMatch)

          if (atMatch) {
            console.log("[v0] @ pattern detected, showing dropdown")
            const filter = atMatch[1] || ""
            const atStartColumn = position.column - atMatch[0].length

            // Store the position where @ started for later replacement
            atReferenceStartPos.current = {
              lineNumber: position.lineNumber,
              column: atStartColumn,
            }

            // Get all available items
            const allItems = collectAllItems()
            console.log("[v0] Collected items:", allItems.length)

            // Filter items based on what user has typed after @
            const filteredItems = allItems.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()))

            setAtReferenceItems(filteredItems)
            setAtReferenceFilter(filter)
            setSelectedAtIndex(0)

            // Position the dropdown near the cursor
            const cursorPosition = editor.getScrolledVisiblePosition(position)
            if (cursorPosition) {
              const editorContainer = editor.getDomNode()
              const containerRect = editorContainer.getBoundingClientRect()
              setAtReferencePosition({
                x: containerRect.left + cursorPosition.left,
                y: containerRect.top + cursorPosition.top + 20,
              })
            }

            setShowAtReference(true)
          } else {
            if (showAtReference) {
              console.log("[v0] Hiding @ reference dropdown")
            }
            setShowAtReference(false)
            atReferenceStartPos.current = null
          }
        }
      }

      // Try multiple event listeners to ensure we catch content changes
      try {
        editor.onDidChangeModelContent(handleContentChange)
        console.log("[v0] onDidChangeModelContent listener attached")
      } catch (error) {
        console.error("[v0] Failed to attach onDidChangeModelContent:", error)
      }

      // Fallback: also listen to key events
      const handleKeyUp = (e: any) => {
        console.log("[v0] Key up event:", e.keyCode)
        // Small delay to ensure content is updated
        setTimeout(handleContentChange, 10)
      }

      try {
        editor.onKeyUp(handleKeyUp)
        console.log("[v0] onKeyUp listener attached")
      } catch (error) {
        console.error("[v0] Failed to attach onKeyUp:", error)
      }

      // Paragraph hover detection -> highlight only (no floating action)

      const computeParagraphRange = (line: number) => {
        const model = editor.getModel()
        if (!model) return null
        const lineCount = model.getLineCount()
        const isBlank = (ln: number) => model.getLineContent(ln).trim() === ""
        if (isBlank(line)) return null
        let start = line
        while (start > 1 && !isBlank(start - 1)) start--
        let end = line
        while (end < lineCount && !isBlank(end + 1)) end++
        return { start, end }
      }

      const onMouseMove = (e: any) => {
        const pos = e?.target?.position
        if (!pos) {
          blockDecorationsRef.current?.clear()
          setShowCopilotButton(false)
          lastBlockRangeRef.current = null
          return
        }
        // If user has a selection, don't show hover affordance
        const sel = editor.getSelection()
        if (sel && !sel.isEmpty()) return
        const range = computeParagraphRange(pos.lineNumber)
        if (!range) {
          blockDecorationsRef.current?.clear()
          setShowCopilotButton(false)
          lastBlockRangeRef.current = null
          return
        }
        if (
          lastBlockRangeRef.current &&
          lastBlockRangeRef.current.start === range.start &&
          lastBlockRangeRef.current.end === range.end
        ) {
          return
        }
        lastBlockRangeRef.current = range
        blockDecorationsRef.current.set([
          {
            range: new monaco.Range(range.start, 1, range.end, 1),
            options: { isWholeLine: true, className: "copilot-block-hover" },
          },
        ])

        if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current)
      }

      const onMouseLeave = () => {
        blockDecorationsRef.current?.clear()
        setShowCopilotButton(false)
        lastBlockRangeRef.current = null
      }

      editor.onMouseMove(onMouseMove)
      editor.onMouseLeave(onMouseLeave)

      // Keep visual selection while the native context menu is open
      editor.onContextMenu((e: any) => {
        try {
          const model = editor.getModel()
          if (!model) return
          const sel = editor.getSelection()
          let rangeObj: any = null
          if (sel && !sel.isEmpty()) {
            rangeObj = sel
          } else if (e?.target?.position) {
            const r = computeParagraphRange(e.target.position.lineNumber)
            if (r) {
              rangeObj = new monaco.Range(r.start, 1, r.end, model.getLineMaxColumn(r.end))
            }
          }
          if (rangeObj) {
            const r = rangeObj
            const decoRange = new monaco.Range(r.startLineNumber, 1, r.endLineNumber, 1)
            blockSelectedDecorationsRef.current?.set([
              { range: decoRange, options: { isWholeLine: true, className: "copilot-block-selected" } },
            ])
          }
        } catch {}
      })

      // Context menu: Send block/selection to Copilot (prefill only)
      editor.addAction({
        id: "zen-copilot-send-block",
        label: "Send to Copilot",
        contextMenuGroupId: "navigation",
        contextMenuOrder: 1.5,
        run: () => {
          try {
            const model = editor.getModel()
            if (!model) return
            const sel = editor.getSelection()
            let text = ""
            let rangeObj: any = null
            if (sel && !sel.isEmpty()) {
              text = model.getValueInRange(sel)
              rangeObj = sel
            } else {
              const pos = editor.getPosition()
              if (!pos) return
              const range = computeParagraphRange(pos.lineNumber)
              if (!range) return
              rangeObj = new monaco.Range(range.start, 1, range.end, model.getLineMaxColumn(range.end))
              text = model.getValueInRange(rangeObj)
            }
            if (!text.trim()) return
            if (rangeObj) {
              const r = rangeObj
              const decoRange = new monaco.Range(r.startLineNumber, 1, r.endLineNumber, 1)
              blockSelectedDecorationsRef.current?.set([
                { range: decoRange, options: { isWholeLine: true, className: "copilot-block-selected" } },
              ])
            }
            setShowCopilot(true)
            setSplitView(false)
            setShowMarkdownPreview(false)
            setCopilotInput(text)
            // Keep editor focus so selection stays visible
          } catch (e) {
            console.error("Copilot prefill failed", e)
          }
        },
      })

      // Context menu: Ask Copilot now (auto-submit)
      editor.addAction({
        id: "zen-copilot-ask-block",
        label: "Ask Copilot (send now)",
        contextMenuGroupId: "navigation",
        contextMenuOrder: 1.6,
        run: () => {
          try {
            const model = editor.getModel()
            if (!model) return
            const sel = editor.getSelection()
            let text = ""
            let rangeObj: any = null
            if (sel && !sel.isEmpty()) {
              text = model.getValueInRange(sel)
              rangeObj = sel
            } else {
              const pos = editor.getPosition()
              if (!pos) return
              const range = computeParagraphRange(pos.lineNumber)
              if (!range) return
              rangeObj = new monaco.Range(range.start, 1, range.end, model.getLineMaxColumn(range.end))
              text = model.getValueInRange(rangeObj)
            }
            if (!text.trim()) return
            if (rangeObj) {
              const r = rangeObj
              const decoRange = new monaco.Range(r.startLineNumber, 1, r.endLineNumber, 1)
              blockSelectedDecorationsRef.current?.set([
                { range: decoRange, options: { isWholeLine: true, className: "copilot-block-selected" } },
              ])
            }
            setShowCopilot(true)
            setSplitView(false)
            setShowMarkdownPreview(false)
            setCopilotInput(text)
            setTimeout(() => {
              try {
                handleSendCopilotMessage()
              } catch {}
            }, 0)
          } catch (e) {
            console.error("Copilot ask failed", e)
          }
        },
      })

      editor.onDidChangeCursorSelection((e: any) => {
        const selection = editor.getSelection()
        if (selection && !selection.isEmpty()) {
          const selectedText = editor.getModel()?.getValueInRange(selection)
          if (selectedText && selectedText.trim()) {
            setSelectedText(selectedText)

            // Get selection position for button placement
            const position = editor.getScrolledVisiblePosition(selection.getEndPosition())
            if (position) {
              const editorContainer = editor.getDomNode()
              const containerRect = editorContainer.getBoundingClientRect()
              setButtonPosition({
                x: containerRect.left + position.left,
                y: containerRect.top + position.top - 40,
              })
            }
            setShowCopilotButton(true)
          }
        } else {
          setShowCopilotButton(false)
          setSelectedText("")
          blockSelectedDecorationsRef.current?.clear()
        }
      })

      let resizeTimeout: NodeJS.Timeout
      let isResizing = false

      const handleResize = () => {
        if (isResizing) return // Prevent concurrent resize operations

        clearTimeout(resizeTimeout)
        resizeTimeout = setTimeout(() => {
          isResizing = true
          try {
            // Use requestAnimationFrame to ensure layout happens at the right time
            requestAnimationFrame(() => {
              try {
                if (editor && typeof editor.layout === "function") {
                  editor.layout()
                }
              } catch (error) {
                // Silently handle layout errors
              } finally {
                isResizing = false
              }
            })
          } catch (error) {
            isResizing = false
          }
        }, 150) // Increased debounce time to reduce frequency
      }

      let resizeObserver: ResizeObserver | null = null

      try {
        resizeObserver = new ResizeObserver((entries) => {
          try {
            handleResize()
          } catch (error) {
            // Silently handle ResizeObserver errors
          }
        })

        const editorContainer = editor.getDomNode()?.parentElement
        if (editorContainer) {
          resizeObserver.observe(editorContainer)
        }
      } catch (error) {
        // Fallback to window resize if ResizeObserver fails
        window.addEventListener("resize", handleResize)
      }

      if (editor && typeof editor.updateOptions === "function") {
        editor.updateOptions({
          fontSize: editorSettings.fontSize,
          lineHeight: editorSettings.lineHeight,
          fontFamily: editorSettings.fontFamily,
          wordWrap: "on",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderWhitespace: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: {
            alwaysConsumeMouseWheel: true,
          },
          lineNumbers: editorSettings.showGutter ? (editorSettings.showLineNumbers ? "on" : "off") : "off",
          glyphMargin: editorSettings.showGutter,
          folding: editorSettings.showGutter,
          lineDecorationsWidth: editorSettings.showGutter ? 10 : 0,
          lineNumbersMinChars: editorSettings.showGutter ? 3 : 0,
          renderValidationDecorations: "off",
          automaticLayout: false, // Disable automatic layout to prevent conflicts
          fixedOverflowWidgets: true, // Prevent widget overflow issues
          padding: {
            left: editorSettings.showGutter ? (editorSettings.fullWidth ? 8 : 0) : 16,
            bottom: 12,
          },
        })
      }

      return () => {
        try {
          if (resizeObserver) {
            resizeObserver.disconnect()
          } else {
            window.removeEventListener("resize", handleResize)
          }
          clearTimeout(resizeTimeout)
          blockDecorationsRef.current?.clear()
          blockSelectedDecorationsRef.current?.clear()
        } catch (error) {
          // Silently handle cleanup errors
        }
      }
    },
    [
      editorSettings.fontSize,
      editorSettings.lineHeight,
      editorSettings.fontFamily,
      editorSettings.showGutter,
      editorSettings.showLineNumbers,
      showAtReference, // Dependency added
      atReferenceItems,
      selectedAtIndex,
      collectAllItems,
    ],
  )

  // Moved useRef and useEffect to top level
  const showAtReferenceRef = useRef(false)
  useEffect(() => {
    showAtReferenceRef.current = showAtReference
  }, [showAtReference])

  const autoSave = (data: AppData) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveToIndexedDB(data)
        console.log("[v0] Auto-saved to IndexedDB")
      } catch (error) {
        console.error("[v0] Auto-save failed:", error)
      }
    }, 500) // Debounce for 500ms
  }

  const handleChange = (value: string | undefined) => {
    updateTabContent(value || "")
  }

  const getTextStats = () => {
    const content = activeTab?.content || ""
    if (!content) return { words: 0, characters: 0, lines: 0, charactersNoSpaces: 0 }

    const lines = content.split("\n").length
    const characters = content.length
    const charactersNoSpaces = content.replace(/\s/g, "").length
    const words = content.trim() === "" ? 0 : content.trim().split(/\s+/).length

    return { words, characters, lines, charactersNoSpaces }
  }

  const stats = getTextStats()

  const saveCurrentFile = () => {
    if (!activeTab) return
    const blob = new Blob([activeTab.content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${activeTab.name}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyPreviewHtml = async () => {
    if (!previewRef.current) return
    const html = previewRef.current.innerHTML
    try {
      await navigator.clipboard.writeText(html)
    } catch (e) {
      console.error("Failed to copy HTML", e)
    }
  }

  const downloadPreviewHtml = () => {
    if (!previewRef.current) return
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${
      activeTab?.name || "Document"
    }</title><style>${previewSettings.customCss || ""}</style></head><body class="${
      previewSettings.style ? `preview-style-${previewSettings.style}` : ""
    }"><div class="prose">${previewRef.current.innerHTML}</div></body></html>`
    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${activeTab?.name || "document"}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const saveAllTabs = () => {
    const exportData = {
      tabs,
      activeTabId,
      editorSettings,
      exportDate: new Date().toISOString(),
      version: "1.0",
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "notee-tabs.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const loadFile = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".md,.txt,.json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const newTab: Tab = {
          id: `tab-${Date.now()}`,
          name: file.name.replace(/\.(md|txt|json)$/, ""),
          content,
          folderPath: "Default",
        }
        setTabs((prev) => [...prev, newTab])
        setActiveTabId(newTab.id)
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const loadTabs = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          if (data.tabs && Array.isArray(data.tabs)) {
            setTabs((prev) => [...prev, ...data.tabs])
            if (data.editorSettings) {
              setEditorSettings(data.editorSettings)
            }
          }
        } catch (error) {
          console.error("Failed to load tabs:", error)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const toggleFolder = (folderId: string) => {
    setFolderStructure((prev) => {
      const toggleFolderInStructure = (items: FolderItem[]): FolderItem[] => {
        return items.map((item) => {
          if (item.type === "folder" && item.id === folderId) {
            return { ...item, isExpanded: !item.isExpanded }
          }
          if (item.type === "folder") {
            return { ...item, children: toggleFolderInStructure(item.children as FolderItem[]) }
          }
          return item
        })
      }
      return toggleFolderInStructure(prev)
    })
  }

  const toggleFavorite = (tabId: string) => {
    setFavorites((prev) => (prev.includes(tabId) ? prev.filter((id) => id !== tabId) : [...prev, tabId]))
  }

  const createNewFolder = (parentPath = "") => {
    const newFolder: FolderItem = {
      id: `folder-${Date.now()}`,
      name: "New Folder",
      type: "folder",
      children: [],
      isExpanded: true,
    }

    setFolderStructure((prev) => {
      if (parentPath === "") {
        return [...prev, newFolder]
      }

      const addToParent = (items: FolderItem[]): FolderItem[] => {
        return items.map((item) => {
          if (item.type === "folder" && item.name === parentPath) {
            return { ...item, children: [...item.children, newFolder] }
          }
          if (item.type === "folder") {
            return { ...item, children: addToParent(item.children as FolderItem[]) }
          }
          return item
        })
      }

      return addToParent(prev)
    })

    setEditingFolderId(newFolder.id)
    setEditingFolderName("New Folder")
  }

  const saveFolderName = () => {
    if (editingFolderId && editingFolderName.trim()) {
      setFolderStructure((prev) => {
        const updateFolderName = (items: FolderItem[]): FolderItem[] => {
          return items.map((item) => {
            if (item.type === "folder" && item.id === editingFolderId) {
              return { ...item, name: editingFolderName.trim() }
            }
            if (item.type === "folder") {
              return { ...item, children: updateFolderName(item.children as FolderItem[]) }
            }
            return item
          })
        }
        return updateFolderName(prev)
      })
    }
    setEditingFolderId(null)
    setEditingFolderName("")
  }

  const deleteFolder = (folderId: string) => {
    setFolderStructure((prev) => {
      const removeFolderFromStructure = (items: FolderItem[]): FolderItem[] => {
        return items.filter((item) => {
          if (item.type === "folder" && item.id === folderId) {
            return false
          }
          if (item.type === "folder") {
            item.children = removeFolderFromStructure(item.children as FolderItem[])
          }
          return true
        })
      }
      return removeFolderFromStructure(prev)
    })
  }

  const handleTabMouseEnter = (tabId: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 5 })
    setHoveredTab(tabId)

    hoverTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true)
    }, 800) // Show tooltip after 800ms
  }

  const handleTabMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setShowTooltip(false)
    setHoveredTab(null)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !splitContainerRef.current) return

    const container = splitContainerRef.current
    const rect = container.getBoundingClientRect()
    const newRatio = Math.max(0.2, Math.min(0.8, (e.clientX - rect.left) / rect.width))
    setSplitRatio(newRatio)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
  }, [isDragging])

  const handleExplorerMouseEnter = () => {
    if (!pinnedExplorer) {
      setShowFileExplorer(true)
    }
  }

  const handleExplorerMouseLeave = () => {
    if (!pinnedExplorer) {
      setShowFileExplorer(false)
    }
  }

  const handleCopilotClick = (action: "ask" | "send") => {
    if (!selectedText.trim()) return

    setShowCopilot(true)

    if (action === "ask") {
      // Add selected text as a message and submit it
      const userMessage = {
        id: Date.now().toString(),
        role: "user" as const,
        content: selectedText,
        timestamp: new Date(),
      }
      setCopilotMessages((prev) => [...prev, userMessage])

      // Simulate AI response (placeholder for now)
      setTimeout(() => {
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant" as const,
          content:
            "I'm your AI assistant! I can help you generate content, summarize your notes, and assist with various tasks. This is a placeholder response - full AI integration coming soon!",
          timestamp: new Date(),
        }
        setCopilotMessages((prev) => [...prev, aiMessage])
      }, 1000)
    } else if (action === "send") {
      // Just pre-fill the input field
      setCopilotInput(selectedText)
    }

    setShowCopilotButton(false)
  }

  const handleSendCopilotMessage = async () => {
    if (!copilotInput.trim()) return

    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: copilotInput,
      timestamp: new Date(),
    }

    setCopilotMessages((prev) => [...prev, userMessage])
    setCopilotInput("")
    
    // Create a streaming placeholder for assistant
    const streamId = `stream-${Date.now()}`
    setCopilotMessages((prev) => [...prev, { id: streamId, role: "assistant", content: "", timestamp: new Date() }])

    const MODEL_CONTEXT: Record<string, number> = {
      "gpt-4.1": 128000,
      "gpt-4o": 128000,
      "gpt-4.1-mini": 128000,
    }

    try {
      const history = [...copilotMessages, userMessage].map((m) => ({ role: m.role, content: m.content }))
      const instructions = copilotSettings.systemPrompt

      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          model: copilotModel,
          instructions,
          webSearch: copilotSettings.enableWebSearch,
          fetchConfig: {
            enabled: copilotSettings.enableFetchTool,
            allowedDomains: (copilotSettings.allowedDomains || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            maxBytes: copilotSettings.maxFetchBytes,
            userAgent: copilotSettings.userAgent,
          },
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error("Failed to start stream")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""

      const applyDelta = (delta: string) => {
        setCopilotMessages((prev) =>
          prev.map((m) => (m.id === streamId ? { ...m, content: (m.content || "") + delta } : m)),
        )
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() || ""
        for (const part of parts) {
          const lines = part.split("\n").filter(Boolean)
          let event = ""
          let dataLine = ""
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.replace("event:", "").trim()
            if (line.startsWith("data:")) dataLine = line.slice(5).trim()
          }
          if (!dataLine) continue
          try {
            const payload = JSON.parse(dataLine)
            if (event === "response.output_text.delta") {
              applyDelta(payload.delta || "")
              // keep view pinned to bottom as content streams
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
            } else if (event === "response.refusal.delta") {
              applyDelta(payload.delta || "")
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
            } else if (event === "response.completed") {
              const usage = payload.response?.usage
              if (usage) {
                const input = usage.input_tokens || 0
                const output = usage.output_tokens || 0
                const total = usage.total_tokens || input + output
                const ctx = MODEL_CONTEXT[copilotModel] || 128000
                const contextPct = ctx ? Math.min(100, Math.round((input / ctx) * 100)) : 0
                setCopilotUsage({ input, output, total, contextPct })
              }
            } else if (event === "error") {
              applyDelta(`\n\n> Error: ${payload.error || "Unknown error"}`)
            }
          } catch {
            // ignore malformed event rows
          }
        }
      }
    } catch (e: any) {
      setCopilotMessages((prev) =>
        prev.map((m) => (m.id === streamId ? { ...m, content: `${m.content}\n\n> Error: ${e?.message}` } : m)),
      )
    }
  }

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showChatAtReference) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setChatAtReferenceSelectedIndex((prev) => (prev < chatAtReferenceItems.length - 1 ? prev + 1 : prev))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setChatAtReferenceSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (chatAtReferenceItems[chatAtReferenceSelectedIndex]) {
          e.preventDefault()
          handleChatAtReferenceSelect(chatAtReferenceItems[chatAtReferenceSelectedIndex])
          return
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        setShowChatAtReference(false)
        return
      }
    }

    // Original chat key handler
    if (e.key === "Enter" && !e.shiftKey && !showChatAtReference) {
      e.preventDefault()
      handleSendCopilotMessage()
    }
  }

  const handleChatAtReference = (textarea: HTMLTextAreaElement) => {
    const cursorPosition = textarea.selectionStart
    const textBeforeCursor = textarea.value.substring(0, cursorPosition)

    console.log("[v0] Chat content before cursor:", textBeforeCursor)

    // Check for @ pattern at the end of text before cursor
    const atMatch = textBeforeCursor.match(/@(\w*)$/)

    if (atMatch) {
      console.log("[v0] Chat @ pattern detected:", atMatch)
      const filter = atMatch[1] || ""
      setChatAtReferenceFilter(filter)

      // Get all items and filter them
      const allItems = collectAllItems()
      const filteredItems = allItems.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()))

      setChatAtReferenceItems(filteredItems)
      setChatAtReferenceSelectedIndex(0)

      // Position the dropdown near the cursor
      const rect = textarea.getBoundingClientRect()
      setChatAtReferencePosition({
        x: rect.left + 10,
        y: rect.top - 200, // Position above the textarea
      })

      setShowChatAtReference(true)
      console.log("[v0] Chat @ reference dropdown shown with", filteredItems.length, "items")
    } else {
      setShowChatAtReference(false)
      console.log("[v0] Chat @ pattern not found, hiding dropdown")
    }
  }

  const handleChatAtReferenceSelect = (item: any) => {
    const textarea = copilotTextareaRef.current
    if (!textarea) return

    const cursorPosition = textarea.selectionStart
    const textBeforeCursor = textarea.value.substring(0, cursorPosition)
    const textAfterCursor = textarea.value.substring(cursorPosition)

    // Find the @ pattern and replace it
    const atMatch = textBeforeCursor.match(/@(\w*)$/)
    if (atMatch) {
      const beforeAt = textBeforeCursor.substring(0, textBeforeCursor.length - atMatch[0].length)
      const newText = beforeAt + item.name + textAfterCursor

      setCopilotInput(newText)
      setShowChatAtReference(false)

      // Focus back to textarea and position cursor after the inserted text
      setTimeout(() => {
        textarea.focus()
        const newCursorPosition = beforeAt.length + item.name.length
        textarea.setSelectionRange(newCursorPosition, newCursorPosition)
      }, 0)
    }
  }

  const handleChatInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCopilotInput(e.target.value)
    handleChatAtReference(e.target)
  }

  const renderFolderTree = (items: (FileItem | FolderItem)[], level = 0) => {
    return items.map((item) => (
      <div key={item.id} style={{ paddingLeft: `${level * 16}px` }}>
        {item.type === "folder" ? (
          <div
            className={`flex items-center gap-1 py-1 hover:bg-muted/50 rounded group ${
              dropTarget === item.id
                ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"
                : ""
            }`}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item)}
          >
            <button onClick={() => toggleFolder(item.id)} className="p-1 hover:bg-muted rounded">
              <ChevronRight size={12} className={`transition-transform ${item.isExpanded ? "rotate-90" : ""}`} />
            </button>
            <Folder size={14} className="text-muted-foreground" />
            {editingFolderId === item.id ? (
              <input
                type="text"
                value={editingFolderName || ""}
                onChange={(e) => setEditingFolderName(e.target.value)}
                onBlur={saveFolderName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveFolderName()
                  if (e.key === "Escape") {
                    setEditingFolderId(null)
                    setEditingFolderName("")
                  }
                }}
                className="bg-transparent border-none outline-none text-xs flex-1"
                autoFocus
              />
            ) : (
              <span
                className="text-xs flex-1 cursor-pointer"
                onDoubleClick={() => {
                  setEditingFolderId(item.id)
                  setEditingFolderName(item.name)
                }}
              >
                {item.name}
              </span>
            )}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
              <button
                onClick={() => createNewFolder(item.name)}
                className="p-1 hover:bg-muted rounded"
                title="Add folder"
              >
                <FolderPlus size={10} />
              </button>
              <button
                onClick={() => {
                  setEditingFolderId(item.id)
                  setEditingFolderName(item.name)
                }}
                className="p-1 hover:bg-muted rounded"
                title="Rename"
              >
                <Edit3 size={10} />
              </button>
              {item.name !== "Default" && (
                <button
                  onClick={() => deleteFolder(item.id)}
                  className="p-1 hover:bg-muted rounded text-red-500"
                  title="Delete"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer group ${
              activeTabId === item.tabId ? "bg-muted" : ""
            } ${draggedItem?.tabId === item.tabId ? "opacity-50" : ""}`}
            onClick={() => setActiveTabId(item.tabId)}
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
          >
            <File size={12} className="text-muted-foreground" />
            <span className="text-xs flex-1">{item.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleFavorite(item.tabId)
              }}
              className={`p-1 hover:bg-muted rounded ${
                favorites.includes(item.tabId) ? "text-yellow-500" : "opacity-0 group-hover:opacity-100"
              }`}
              title="Toggle favorite"
            >
              <Star size={10} fill={favorites.includes(item.tabId) ? "currentColor" : "none"} />
            </button>
          </div>
        )}
        {item.type === "folder" && item.isExpanded && <div>{renderFolderTree(item.children, level + 1)}</div>}
      </div>
    ))
  }

  if (!isLoaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-muted-foreground font-mono">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Explorer trigger button - only show when not pinned and not visible */}
      {!showFileExplorer && !pinnedExplorer && (
        <button
          onClick={() => setShowFileExplorer(true)}
          onMouseEnter={handleExplorerMouseEnter}
          className="fixed left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-muted-foreground/30 hover:bg-muted-foreground/50 hover:w-3 transition-all duration-200 z-30 rounded-r-sm"
          title="Open Explorer (⌃⌘E)"
        />
      )}

      {/* File Explorer Drawer */}
      <div
        data-explorer
        className={`fixed inset-y-0 left-0 w-64 bg-background border-r border-border z-40 transform transition-transform duration-300 ease-out ${
          showFileExplorer || pinnedExplorer ? "translate-x-0" : "-translate-x-full"
        }`}
        onMouseEnter={handleExplorerMouseEnter}
        onMouseLeave={handleExplorerMouseLeave}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-sm">Explorer</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPinnedExplorer(!pinnedExplorer)}
              className={`p-1 hover:bg-muted rounded ${pinnedExplorer ? "text-blue-500" : "text-muted-foreground"}`}
              title={pinnedExplorer ? "Unpin Explorer" : "Pin Explorer"}
            >
              <Pin size={14} className={pinnedExplorer ? "rotate-45" : ""} />
            </button>
            {!pinnedExplorer && (
              <button onClick={() => setShowFileExplorer(false)} className="p-1 hover:bg-muted rounded">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="p-2 overflow-auto h-full pb-20">
          {/* Favorites Section */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Star size={12} className="text-yellow-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Favorites</span>
            </div>
            <div className="pl-4">
              {favorites.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No favorites</div>
              ) : (
                favorites.map((tabId) => {
                  const tab = tabs.find((t) => t.id === tabId)
                  if (!tab) return null
                  return (
                    <div
                      key={tabId}
                      className={`flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer ${
                        activeTabId === tabId ? "bg-background" : ""
                      }`}
                      onClick={() => setActiveTabId(tabId)}
                    >
                      <File size={12} className="text-muted-foreground" />
                      <span className="text-xs">{tab.name}</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Folders Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Folder size={12} className="text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Folders</span>
              </div>
              <button onClick={() => createNewFolder()} className="p-1 hover:bg-muted rounded" title="New folder">
                <FolderPlus size={12} />
              </button>
            </div>
            <div>{renderFolderTree(folderStructure)}</div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div
        className={`flex items-center justify-between border-b border-border bg-muted/20 transition-all duration-300 ${pinnedExplorer ? "ml-64" : "ml-0"}`}
      >
        <div className="flex items-center">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer hover:bg-muted/40 ${
                tab.id === activeTabId ? "bg-background" : ""
              }`}
              onClick={() => setActiveTabId(tab.id)}
              onMouseEnter={(e) => handleTabMouseEnter(tab.id, e)}
              onMouseLeave={handleTabMouseLeave}
            >
              {editingTabId === tab.id ? (
                <input
                  type="text"
                  value={editingName || ""}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={saveTabName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTabName()
                    if (e.key === "Escape") cancelEditingTab()
                  }}
                  className="bg-transparent border-none outline-none text-sm font-mono w-20"
                  autoFocus
                />
              ) : (
                <span className="text-sm font-mono select-none" onDoubleClick={() => startEditingTab(tab.id, tab.name)}>
                  {tab.name}
                </span>
              )}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className="hover:bg-muted rounded p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <button onClick={addTab} className="p-2 hover:bg-muted/40 rounded" title="Add new tab">
            <Plus size={16} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              setShowWorkbench(!showWorkbench)
              if (!showWorkbench) {
                setSplitView(false)
                setShowMarkdownPreview(false)
                setShowCopilot(false)
              }
            }}
            className={`p-2 hover:bg-muted/40 rounded ${showWorkbench ? "bg-muted" : ""}`}
            title="Toggle Workbench (⌃⌘W)"
          >
            <Wrench size={16} />
          </button>
          <button
            onClick={() => {
              setShowCopilot(!showCopilot)
              if (!showCopilot) {
                setSplitView(false)
                setShowMarkdownPreview(false)
              }
            }}
            className={`p-2 hover:bg-muted/40 rounded ${showCopilot ? "bg-muted" : ""}`}
            title="Toggle Copilot (⌃⌘K)"
          >
            <MessageSquare size={16} />
          </button>
          <button
            onClick={() => {
              setShowMarkdownPreview(!showMarkdownPreview)
              setSplitView(false)
              setShowCopilot(false)
              setShowWorkbench(false)
            }}
            className={`p-2 hover:bg-muted/40 rounded ${showMarkdownPreview ? "bg-muted" : ""}`}
            title="Toggle Preview (⌃⌘P)"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => {
              setSplitView(!splitView)
              setShowMarkdownPreview(false)
              setShowCopilot(false)
              setShowWorkbench(false)
            }}
            className={`p-2 hover:bg-muted/40 rounded ${splitView ? "bg-muted" : ""}`}
            title="Toggle Split View (⌃⌘S)"
          >
            <EyeOff size={16} />
          </button>
        </div>
      </div>

      {/* Editor and Split View */}
      {/* Adjust main content margin when explorer is pinned */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${pinnedExplorer ? "ml-64" : "ml-0"} overflow-hidden`}
      >
        <div
          ref={splitContainerRef}
          className={`${
            splitView || showCopilot || showWorkbench ? "max-w-full" : editorSettings.fullWidth ? "max-w-full" : "max-w-[80%]"
          } w-full h-full relative flex min-h-0 ${splitView || showCopilot || showWorkbench ? "gap-0" : "flex-col"}`}
        >
          <div
            className={`${splitView || showCopilot || showWorkbench ? "" : "w-full"} h-full relative flex flex-col min-h-0`}
            style={splitView || showCopilot || showWorkbench ? { width: `${splitRatio * 100}%` } : {}}
          >
            <div className="flex-1 pt-4">
              <Editor
                height="100%"
                width="100%"
                language="markdown"
                theme={resolvedTheme === "dark" ? "custom-vs-dark" : "custom-vs"} // Use custom theme with dimmed line numbers
                value={activeTab?.content || ""}
                onChange={handleChange}
                onMount={handleEditorDidMount}
                options={{
                  automaticLayout: false,
                  scrollbar: {
                    alwaysConsumeMouseWheel: true,
                  },
                  padding: {
                    left: editorSettings.showGutter ? (editorSettings.fullWidth ? 8 : 0) : 16,
                    bottom: 12,
                  },
                }}
              />
            </div>
          </div>

          {showCopilot && (
            <>
              <div
                className={`w-2 cursor-col-resize flex-shrink-0 relative group ${
                  isDragging ? "bg-primary" : ""
                }`}
                onMouseDown={handleMouseDown}
              >
                <div
                  className="absolute inset-y-0 left-1 w-px bg-border group-hover:bg-primary/60 transition-colors"
                  onMouseDown={handleMouseDown}
                />
              </div>

              <div
                className="h-full bg-gray-50 border-l border-gray-200 flex-shrink-0 flex flex-col min-h-0"
                style={{ width: `${(1 - splitRatio) * 100}%` }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-100/50">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <h3 className="font-semibold text-sm text-gray-800">AI Copilot</h3>
                    <select
                      className="text-xs border rounded px-2 py-1 bg-white"
                      value={copilotModel}
                      onChange={(e) => setCopilotModel(e.target.value)}
                      title="Model"
                    >
                      <option value="gpt-4.1">GPT-4.1</option>
                      <option value="gpt-4o">GPT-4o</option>
                      <option value="gpt-4.1-mini">GPT-4.1-mini</option>
                    </select>
                    <label className="text-[10px] flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={copilotSettings.enableWebSearch}
                        onChange={(e) => setCopilotSettings((cs) => ({ ...cs, enableWebSearch: e.target.checked }))}
                      />
                      Web
                    </label>
                    <label className="text-[10px] flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={copilotSettings.enableFetchTool}
                        onChange={(e) => setCopilotSettings((cs) => ({ ...cs, enableFetchTool: e.target.checked }))}
                      />
                      Fetch
                    </label>
                    {copilotUsage && (
                      <span className="text-[10px] text-gray-500">
                        {copilotUsage.total} tok • ctx {copilotUsage.contextPct}%
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowCopilot(false)}
                    className="p-1 hover:bg-gray-200/60 rounded text-gray-500 hover:text-gray-700 transition-colors"
                    title="Close Copilot (Escape)"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 pb-16 space-y-4 bg-gray-50" id="copilot-scroll-region">
                  {copilotMessages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
                      <p className="text-sm mb-2">Welcome to AI Copilot!</p>
                      <p className="text-xs leading-relaxed max-w-xs mx-auto">
                        I can help you generate content, summarize your notes, find information, and assist with various
                        writing tasks.
                      </p>
                    </div>
                  ) : (
                    copilotMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            message.role === "user"
                              ? "bg-gray-300 text-gray-900 ml-4" // Changed from dark gray to light gray with dark text for accessibility
                              : "bg-white text-gray-800 mr-4 border border-gray-200"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ""}</ReactMarkdown>
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          )}
                          <div
                            className={`text-xs mt-1 opacity-70 ${
                              message.role === "user" ? "text-gray-700" : "text-gray-500" // Updated timestamp color for user messages to maintain contrast
                            }`}
                          >
                            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-200 bg-white relative">
                  {showChatAtReference && (
                    <div
                      className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50 chat-at-reference-dropdown"
                      style={{
                        maxHeight: "200px",
                      }}
                    >
                      {chatAtReferenceItems.length > 0 ? (
                        chatAtReferenceItems.map((item, index) => (
                          <div
                            key={item.id}
                            className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${
                              index === chatAtReferenceSelectedIndex ? "bg-blue-50 text-blue-900" : "hover:bg-gray-50"
                            }`}
                            onClick={() => handleChatAtReferenceSelect(item)}
                          >
                            {item.type === "file" && <FileText size={14} className="text-blue-500" />}
                            {item.type === "folder" && <Folder size={14} className="text-yellow-500" />}
                            {item.type === "special" && <MessageSquare size={14} className="text-green-500" />}
                            <div className="flex-1">
                              <div className="font-medium">{item.name}</div>
                              {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                              {item.path && <div className="text-xs text-gray-400">{item.path}</div>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500">No matches found</div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <textarea
                        ref={copilotTextareaRef}
                        value={copilotInput}
                        onChange={handleChatInputChange}
                        onKeyDown={handleChatKeyDown}
                        placeholder="Ask anything... (type @ to reference files)"
                        className="w-full resize-none border-0 bg-transparent focus:outline-none text-sm"
                        rows={4}
                        style={{ minHeight: "100px" }}
                      />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={handleSendCopilotMessage}
                        disabled={!copilotInput.trim()}
                        className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-[40px]"
                        title="Send message (Enter)"
                      >
                        <Send size={14} />
                      </button>
                      <span className="text-xs text-gray-500 whitespace-nowrap">⌘K to toggle</span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    <span>Press Enter to send, Shift+Enter for new line. Type @ to reference files.</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {showWorkbench && (
            <>
              <div
                className={`w-2 cursor-col-resize flex-shrink-0 relative group ${
                  isDragging ? "bg-primary" : ""
                }`}
                onMouseDown={handleMouseDown}
              >
                <div
                  className="absolute inset-y-0 left-1 w-px bg-border group-hover:bg-primary/60 transition-colors"
                  onMouseDown={handleMouseDown}
                />
              </div>

              <div
                className="h-full bg-gray-50 border-l border-gray-200 flex-shrink-0 flex flex-col min-h-0"
                style={{ width: `${(1 - splitRatio) * 100}%` }}
              >
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-100/50">
                  <div className="flex items-center gap-3">
                    <Wrench size={16} className="text-gray-700" />
                    <h3 className="font-semibold text-sm text-gray-800">Workbench</h3>
                    <div className="ml-2 flex items-center gap-2 text-xs text-gray-600" />
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <label className="text-[11px] text-gray-600 flex items-center gap-2" title="If checked, operate only on current selection (for other tabs, full document)">
                      <input type="checkbox" className="accent-current" checked={wbUseSelection} onChange={(e) => setWbUseSelection(e.target.checked)} />
                      <span>Use selection</span>
                    </label>
                    <label className="text-[11px] text-gray-600 flex items-center gap-2" title="If checked, Apply affects all open tabs">
                      <input type="checkbox" className="accent-current" checked={wbAllTabs} onChange={(e) => setWbAllTabs(e.target.checked)} />
                      <span>All tabs</span>
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => setWbPreviewBelow((v) => !v)} title={wbPreviewBelow ? 'Preview side-by-side' : 'Preview below'}>
                      {wbPreviewBelow ? <Columns size={16} /> : <Rows size={16} />}
                    </Button>
                  </div>
                  <button
                    onClick={() => setShowWorkbench(false)}
                    className="p-1 hover:bg-gray-200/60 rounded text-gray-500 hover:text-gray-700 transition-colors"
                    title="Close Workbench (Escape)"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Workbench Body: Script Transform */}
                {
                  wbPreviewBelow ? (
                    <div className="flex-1 min-h-0 flex flex-col" ref={wbContainerRef}>
                      <div className="flex flex-col border-b border-gray-200" style={{ height: `${wbSplitRatio * 100}%` }}>
                        <div className="px-3 py-2 border-b bg-white flex items-center gap-2">
                          <label className="text-xs text-gray-600">Script</label>
                          <select
                            className="text-xs border rounded px-2 py-1 bg-white"
                            value={activeScriptId || ''}
                            onChange={(e) => {
                              const id = e.target.value || null
                              setActiveScriptId(id)
                              if (id) {
                                const found = savedScripts.find((s) => s.id === id)
                                if (found) { setWorkbenchScript(found.code); setScriptName(found.name) }
                              } else {
                                setScriptName('Untitled')
                                setWorkbenchScript(DEFAULT_EXAMPLE_SCRIPT)
                              }
                            }}
                          >
                            <option value="">— Unsaved —</option>
                            {savedScripts.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <input
                            className="text-xs border rounded px-2 py-1 bg-white w-40"
                            placeholder="Name"
                            value={scriptName}
                            onChange={(e) => setScriptName(e.target.value)}
                          />
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                              onClick={() => {
                                setActiveScriptId(null)
                                setScriptName('Untitled')
                                setWorkbenchScript(DEFAULT_EXAMPLE_SCRIPT)
                              }}
                              title="New script"
                            >
                              New
                            </button>
                            <button
                              className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                              onClick={() => {
                                const name = scriptName.trim() || 'Untitled'
                                if (activeScriptId) {
                                  setSavedScripts((prev) => prev.map((s) => (s.id === activeScriptId ? { ...s, name, code: workbenchScript, updatedAt: new Date().toISOString() } : s)))
                                } else {
                                  const id = `script-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
                                  const rec: SavedScript = { id, name, code: workbenchScript, updatedAt: new Date().toISOString() }
                                  setSavedScripts((prev) => [...prev, rec])
                                  setActiveScriptId(id)
                                }
                              }}
                              title="Save script"
                            >
                              Save
                            </button>
                            <button
                              className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
                              disabled={!activeScriptId}
                              onClick={() => {
                                if (!activeScriptId) return
                                setSavedScripts((prev) => prev.filter((s) => s.id !== activeScriptId))
                                setActiveScriptId(null)
                              }}
                              title="Delete script"
                            >
                              Delete
                            </button>
                            <button
                              className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                              onClick={() => {
                                try {
                                  const code = `${workbenchScript}\n; if (typeof transform !== 'function') { throw new Error('Define function transform(input, context)') }`
                                  // eslint-disable-next-line no-new-func
                                  new Function('input','context', `${workbenchScript}; return true;`)
                                } catch {}
                              }}
                              title="Quick-check script compiles"
                            >
                              Check
                            </button>
                            <button
                              className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                              onClick={() => {
                                const full = activeTab?.content || ''
                                let input = full
                                if (wbUseSelection && editorRef.current) {
                                  const editor = editorRef.current as any
                                  const model = editor.getModel()
                                  const sel = editor.getSelection()
                                  if (sel && !sel.isEmpty()) {
                                    input = model.getValueInRange(sel)
                                  }
                                }
                                try {
                                  // eslint-disable-next-line no-new-func
                                  const fn = new Function(
                                    'input',
                                    'context',
                                    `${workbenchScript}; if (typeof transform !== 'function') { throw new Error('Define function transform(input, context)') } return String(transform(input, context));`,
                                  ) as (input: string, context: { filename?: string }) => string
                                  const output = fn(input, { filename: activeTab?.name })
                                  setWorkbenchResult(output)
                                } catch (err: any) {
                                  setWorkbenchResult(`/* Transform error: ${err?.message || String(err)} */\n`)
                                }
                              }}
                              title="Run transform on current file"
                            >
                              Run
                            </button>
                            <button
                              className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                              onClick={() => {
                                // Compile transformer once
                                let fn: ((input: string, context: { filename?: string }) => string) | null = null
                                try {
                                  // eslint-disable-next-line no-new-func
                                  fn = new Function(
                                    'input',
                                    'context',
                                    `${workbenchScript}; if (typeof transform !== 'function') { throw new Error('Define function transform(input, context)') } return String(transform(input, context));`,
                                  ) as any
                                } catch (err) {
                                  return
                                }
                                if (!fn) return

                                const applyActiveWithSelectionIfAny = (content: string): string => {
                                  if (wbUseSelection && editorRef.current) {
                                    const editor = editorRef.current as any
                                    const model = editor.getModel()
                                    const sel = editor.getSelection()
                                    if (sel && !sel.isEmpty()) {
                                      const start = model.getOffsetAt(sel.getStartPosition())
                                      const end = model.getOffsetAt(sel.getEndPosition())
                                      const snippet = model.getValueInRange(sel)
                                      const out = fn(snippet, { filename: activeTab?.name })
                                      const before = content.slice(0, start)
                                      const after = content.slice(end)
                                      return before + out + after
                                    }
                                  }
                                  return fn(content, { filename: activeTab?.name })
                                }

                                if (wbAllTabs) {
                                  setTabs((prev) => prev.map((t) => {
                                    if (t.id === activeTabId) {
                                      return { ...t, content: applyActiveWithSelectionIfAny(t.content) }
                                    }
                                    const out = fn!(t.content, { filename: t.name })
                                    return { ...t, content: out }
                                  }))
                                } else {
                                  if (!activeTab?.id) return
                                  setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, content: applyActiveWithSelectionIfAny(t.content) } : t)))
                                }
                              }}
                              title="Replace the current editor content with the result"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-h-0">
                          <Editor
                            height="100%"
                            width="100%"
                            language="javascript"
                            theme={resolvedTheme === 'dark' ? 'custom-vs-dark' : 'custom-vs'}
                            value={workbenchScript}
                            onChange={(v) => setWorkbenchScript(v || '')}
                            options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', scrollBeyondLastLine: false }}
                          />
                        </div>
                      </div>
                      <div
                        className={`h-2 cursor-row-resize flex-shrink-0 relative group ${wbIsDragging ? 'bg-primary/40' : ''}`}
                        onMouseDown={handleWbMouseDown}
                      >
                        <div className="absolute inset-x-0 top-1 h-px bg-border group-hover:bg-primary/60 transition-colors" />
                      </div>
                      <div className="flex-1 min-h-0 flex flex-col" style={{ height: `${(1 - wbSplitRatio) * 100}%` }}>
                        <div className="px-3 py-2 border-b bg-white text-xs text-gray-600 flex items-center justify-between">
                          <span>Result Preview</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{activeTab?.name || 'Untitled'}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-h-0">
                          <Editor
                            height="100%"
                            width="100%"
                            language="markdown"
                            theme={resolvedTheme === 'dark' ? 'custom-vs-dark' : 'custom-vs'}
                            value={workbenchResult}
                            onChange={() => undefined}
                            options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 flex" ref={wbContainerRef}>
                    <div className="border-r border-gray-200 flex flex-col" style={{ width: `${wbSplitRatio * 100}%` }}>
                      <div className="px-3 py-2 border-b bg-white flex items-center gap-2">
                        <label className="text-xs text-gray-600">Script</label>
                        <select
                          className="text-xs border rounded px-2 py-1 bg-white"
                          value={activeScriptId || ''}
                          onChange={(e) => {
                            const id = e.target.value || null
                            setActiveScriptId(id)
                            if (id) {
                              const found = savedScripts.find((s) => s.id === id)
                              if (found) { setWorkbenchScript(found.code); setScriptName(found.name) }
                            } else {
                              setScriptName('Untitled')
                              setWorkbenchScript(DEFAULT_EXAMPLE_SCRIPT)
                            }
                          }}
                        >
                          <option value="">— Unsaved —</option>
                          {savedScripts.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <input
                          className="text-xs border rounded px-2 py-1 bg-white w-40"
                          placeholder="Name"
                          value={scriptName}
                          onChange={(e) => setScriptName(e.target.value)}
                        />
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                            onClick={() => {
                              setActiveScriptId(null)
                              setScriptName('Untitled')
                              setWorkbenchScript(DEFAULT_EXAMPLE_SCRIPT)
                            }}
                            title="New script"
                          >
                            New
                          </button>
                          <button
                            className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                            onClick={() => {
                              const name = scriptName.trim() || 'Untitled'
                              if (activeScriptId) {
                                setSavedScripts((prev) => prev.map((s) => (s.id === activeScriptId ? { ...s, name, code: workbenchScript, updatedAt: new Date().toISOString() } : s)))
                              } else {
                                const id = `script-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
                                const rec: SavedScript = { id, name, code: workbenchScript, updatedAt: new Date().toISOString() }
                                setSavedScripts((prev) => [...prev, rec])
                                setActiveScriptId(id)
                              }
                            }}
                            title="Save script"
                          >
                            Save
                          </button>
                          <button
                            className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50 disabled:opacity-50"
                            disabled={!activeScriptId}
                            onClick={() => {
                              if (!activeScriptId) return
                              setSavedScripts((prev) => prev.filter((s) => s.id !== activeScriptId))
                              setActiveScriptId(null)
                            }}
                            title="Delete script"
                          >
                            Delete
                          </button>
                          <button
                            className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                            onClick={() => {
                              try {
                                const code = `${workbenchScript}\n; if (typeof transform !== 'function') { throw new Error('Define function transform(input, context)') }` // lint
                                // test compile only
                                // eslint-disable-next-line no-new-func
                                new Function('input','context', `${workbenchScript}; return true;`) // compile test
                              } catch {}
                              // no-op compile test
                            }}
                            title="Quick-check script compiles"
                          >
                            Check
                          </button>
                          <button
                            className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                            onClick={() => {
                              const full = activeTab?.content || ''
                              let input = full
                              if (wbUseSelection && editorRef.current) {
                                const editor = editorRef.current as any
                                const model = editor.getModel()
                                const sel = editor.getSelection()
                                if (sel && !sel.isEmpty()) {
                                  input = model.getValueInRange(sel)
                                }
                              }
                              try {
                                // eslint-disable-next-line no-new-func
                                const fn = new Function(
                                  'input',
                                  'context',
                                  `${workbenchScript}; if (typeof transform !== 'function') { throw new Error('Define function transform(input, context)') } return String(transform(input, context));`,
                                ) as (input: string, context: { filename?: string }) => string
                                const output = fn(input, { filename: activeTab?.name })
                                setWorkbenchResult(output)
                              } catch (err: any) {
                                setWorkbenchResult(`/* Transform error: ${err?.message || String(err)} */\n`)
                              }
                            }}
                            title="Run transform on current file"
                          >
                            Run
                          </button>
                          <button
                            className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                            onClick={() => {
                              // Compile transformer once
                              let fn: ((input: string, context: { filename?: string }) => string) | null = null
                              try {
                                // eslint-disable-next-line no-new-func
                                fn = new Function(
                                  'input',
                                  'context',
                                  `${workbenchScript}; if (typeof transform !== 'function') { throw new Error('Define function transform(input, context)') } return String(transform(input, context));`,
                                ) as any
                              } catch (err) {
                                return
                              }
                              if (!fn) return

                              const applyActiveWithSelectionIfAny = (content: string): string => {
                                if (wbUseSelection && editorRef.current) {
                                  const editor = editorRef.current as any
                                  const model = editor.getModel()
                                  const sel = editor.getSelection()
                                  if (sel && !sel.isEmpty()) {
                                    const start = model.getOffsetAt(sel.getStartPosition())
                                    const end = model.getOffsetAt(sel.getEndPosition())
                                    const snippet = model.getValueInRange(sel)
                                    const out = fn(snippet, { filename: activeTab?.name })
                                    const before = content.slice(0, start)
                                    const after = content.slice(end)
                                    return before + out + after
                                  }
                                }
                                return fn(content, { filename: activeTab?.name })
                              }

                              if (wbAllTabs) {
                                setTabs((prev) => prev.map((t) => {
                                  if (t.id === activeTabId) {
                                    return { ...t, content: applyActiveWithSelectionIfAny(t.content) }
                                  }
                                  const out = fn!(t.content, { filename: t.name })
                                  return { ...t, content: out }
                                }))
                              } else {
                                if (!activeTab?.id) return
                                setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, content: applyActiveWithSelectionIfAny(t.content) } : t)))
                              }
                            }}
                            title="Replace the current editor content with the result"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0">
                        <Editor
                          height="100%"
                          width="100%"
                          language="javascript"
                          theme={resolvedTheme === 'dark' ? 'custom-vs-dark' : 'custom-vs'}
                          value={workbenchScript}
                          onChange={(v) => setWorkbenchScript(v || '')}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                          }}
                        />
                      </div>
                    </div>
                    <div
                      className={`w-2 cursor-col-resize flex-shrink-0 relative group ${wbIsDragging ? 'bg-primary/40' : ''}`}
                      onMouseDown={handleWbMouseDown}
                    >
                      <div className="absolute inset-y-0 left-1 w-px bg-border group-hover:bg-primary/60 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col" style={{ width: `${(1 - wbSplitRatio) * 100}%` }}>
                      <div className="px-3 py-2 border-b bg-white text-xs text-gray-600 flex items-center justify-between">
                        <span>Result Preview</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{activeTab?.name || 'Untitled'}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0">
                        <Editor
                          height="100%"
                          width="100%"
                          language="markdown"
                          theme={resolvedTheme === 'dark' ? 'custom-vs-dark' : 'custom-vs'}
                          value={workbenchResult}
                          onChange={() => undefined}
                          options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false }}
                        />
                      </div>
                    </div>
                  </div>
                  )
                }

                {false && (
                  <div className="flex-1 min-h-0 flex">
                    <div className="w-1/2 min-w-[40%] border-r border-gray-200 flex flex-col">
                      <div className="px-3 py-2 border-b bg-white grid grid-cols-12 gap-2 items-center">
                        <label className="text-[11px] text-gray-600 col-span-2">Pattern</label>
                        <input
                          className="col-span-6 text-xs border rounded px-2 py-1"
                          placeholder="e.g. \\bTODO:(.*)"
                          value={regexPattern}
                          onChange={(e) => setRegexPattern(e.target.value)}
                        />
                        <label className="text-[11px] text-gray-600 col-span-1 text-right">Flags</label>
                        <input
                          className="col-span-3 text-xs border rounded px-2 py-1"
                          placeholder="gim"
                          value={regexFlags}
                          onChange={(e) => setRegexFlags(e.target.value)}
                        />

                        <label className="text-[11px] text-gray-600 col-span-2">Replace</label>
                        <input
                          className="col-span-10 text-xs border rounded px-2 py-1"
                          placeholder="e.g. NOTE:$1"
                          value={regexReplacement}
                          onChange={(e) => setRegexReplacement(e.target.value)}
                        />

                        <div className="col-span-12 flex items-center gap-2 justify-end mt-1">
                          <button
                            className="text-xs px-2 py-1 border rounded bg-blue-600 text-white hover:bg-blue-700"
                          onClick={() => {
                            const full = activeTab?.content || ''
                            let input = full
                            if (wbUseSelection && editorRef.current) {
                              const editor = editorRef.current as any
                              const model = editor.getModel()
                              const sel = editor.getSelection()
                              if (sel && !sel.isEmpty()) {
                                input = model.getValueInRange(sel)
                              }
                            }
                            try {
                              const re = new RegExp(regexPattern, regexFlags)
                              const out = input.replace(re, regexReplacement)
                              setWorkbenchResult(out)
                            } catch (err: any) {
                              setWorkbenchResult(`/* Regex error: ${err?.message || String(err)} */\n`)
                            }
                          }}
                            title="Run regex replace on current file"
                          >
                            Run
                          </button>
                          <button
                            className="text-xs px-2 py-1 border rounded bg-green-600 text-white hover:bg-green-700"
                            onClick={() => {
                              const applyActive = (content: string): string => {
                                if (wbUseSelection && editorRef.current) {
                                  const editor = editorRef.current as any
                                  const model = editor.getModel()
                                  const sel = editor.getSelection()
                                  if (sel && !sel.isEmpty()) {
                                    const start = model.getOffsetAt(sel.getStartPosition())
                                    const end = model.getOffsetAt(sel.getEndPosition())
                                    const snippet = model.getValueInRange(sel)
                                    try {
                                      const re = new RegExp(regexPattern, regexFlags)
                                      const out = snippet.replace(re, regexReplacement)
                                      const before = content.slice(0, start)
                                      const after = content.slice(end)
                                      return before + out + after
                                    } catch {
                                      return content
                                    }
                                  }
                                }
                                try {
                                  const re = new RegExp(regexPattern, regexFlags)
                                  return content.replace(re, regexReplacement)
                                } catch {
                                  return content
                                }
                              }
                              const selectionRangeForNonActive = (content: string): { start: number; end: number } | null => {
                                return null
                              }
                              if (wbAllTabs) {
                                setTabs((prev) => prev.map((t) => {
                                  if (t.id === activeTabId) return { ...t, content: applyActive(t.content) }
                                  if (wbUseSelection) {
                                    const rng = selectionRangeForNonActive(t.content)
                                    if (rng) {
                                      try { const re = new RegExp(regexPattern, regexFlags); const snippet = t.content.slice(rng.start, rng.end); const out = snippet.replace(re, regexReplacement); return { ...t, content: t.content.slice(0, rng.start) + out + t.content.slice(rng.end) } } catch { return t }
                                    }
                                  }
                                  try { const re = new RegExp(regexPattern, regexFlags); return { ...t, content: t.content.replace(re, regexReplacement) } } catch { return t }
                                }))
                              } else {
                                if (!activeTab?.id) return
                                setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, content: applyActive(t.content) } : t)))
                              }
                            }}
                            title="Replace the current editor content with the result"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                      <div className="p-3 text-[11px] text-gray-500 bg-gray-50 border-b">
                        Use JavaScript-style RegExp. Replacement supports capture groups like $1.
                      </div>
                      <div className="flex-1 min-h-0 overflow-auto p-3 text-xs text-gray-600">
                        <div>
                          <div>Examples:</div>
                          <div className="mt-1">Pattern: <code className="bg-gray-100 px-1 rounded">^# (.*)$</code> Flags: <code className="bg-gray-100 px-1 rounded">gm</code> Replace: <code className="bg-gray-100 px-1 rounded">## $1</code></div>
                          <div>Pattern: <code className="bg-gray-100 px-1 rounded">\\s+$</code> Flags: <code className="bg-gray-100 px-1 rounded">gm</code> Replace: <code className="bg-gray-100 px-1 rounded"></code></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="px-3 py-2 border-b bg-white text-xs text-gray-600 flex items-center justify-between">
                        <span>Result Preview</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{activeTab?.name || 'Untitled'}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0">
                        <Editor
                          height="100%"
                          width="100%"
                          language="markdown"
                          theme={resolvedTheme === 'dark' ? 'custom-vs-dark' : 'custom-vs'}
                          value={workbenchResult}
                          onChange={() => undefined}
                          options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {false && (
                  <div className="flex-1 min-h-0 flex">
                    <div className="w-1/2 min-w-[40%] border-r border-gray-200 flex flex-col">
                      <div className="px-3 py-2 border-b bg-white flex items-center gap-2">
                        <label className="text-xs text-gray-600">Data</label>
                        <div className="inline-flex border rounded overflow-hidden">
                          <button className={`text-xs px-2 py-1 ${mergeDataMode === 'csv' ? 'bg-gray-100' : 'bg-white'}`} onClick={() => setMergeDataMode('csv')}>CSV</button>
                          <button className={`text-xs px-2 py-1 ${mergeDataMode === 'json' ? 'bg-gray-100' : 'bg-white'}`} onClick={() => setMergeDataMode('json')}>JSON</button>
                        </div>
                        {mergeDataMode === 'csv' && (
                          <>
                            <input
                              type="file"
                              accept=".csv,text/csv"
                              className="text-xs"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (!f) return
                                const reader = new FileReader()
                                reader.onload = () => {
                                  setMergeCsvText(String(reader.result || ''))
                                }
                                reader.readAsText(f)
                              }}
                            />
                            <button
                              className="ml-auto text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                              onClick={() => {
                                setMergeCsvText('name,email\nAlice,alice@example.com\nBob,bob@example.com')
                              }}
                            >
                              Insert CSV example
                            </button>
                          </>
                        )}
                        {mergeDataMode === 'json' && (
                          <button
                            className="ml-auto text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50"
                            onClick={() => setMergeJsonText('[{"name":"Alice","email":"alice@example.com"},{"name":"Bob","email":"bob@example.com"}]')}
                          >
                            Insert JSON example
                          </button>
                        )}
                      </div>
                      <div className="flex-1 min-h-0 p-2">
                        {mergeDataMode === 'csv' ? (
                          <textarea
                            className="w-full h-full text-xs border rounded p-2 font-mono"
                            placeholder="Paste CSV here (first line headers)"
                            value={mergeCsvText}
                            onChange={(e) => setMergeCsvText(e.target.value)}
                          />
                        ) : (
                          <textarea
                            className="w-full h-full text-xs border rounded p-2 font-mono"
                            placeholder='Paste JSON array of objects, e.g. [{"name":"Alice"}]'
                            value={mergeJsonText}
                            onChange={(e) => setMergeJsonText(e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="px-3 py-2 border-b bg-white text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                        <span>Row</span>
                        {mergeDataMode === 'csv' ? (
                          <select className="text-xs border rounded px-2 py-1 bg-white" value={mergeSelectedRow} onChange={(e) => setMergeSelectedRow(parseInt(e.target.value, 10) || 0)}>
                            {(() => { const lines = mergeCsvText ? mergeCsvText.split(/\r?\n/).filter(Boolean) : []; const rowCount = Math.max(0, lines.length - 1); return Array.from({ length: rowCount }, (_, i) => i).map((i) => (<option key={i} value={i}>{i}</option>)) })()}
                          </select>
                        ) : (
                          <select className="text-xs border rounded px-2 py-1 bg-white" value={mergeSelectedRow} onChange={(e) => setMergeSelectedRow(parseInt(e.target.value, 10) || 0)}>
                            {(() => { let arr: any[] = []; try { arr = JSON.parse(mergeJsonText || '[]') } catch {}; if (!Array.isArray(arr)) arr = []; return arr.map((_, i) => (<option key={i} value={i}>{i}</option>)) })()}
                          </select>
                        )}
                        <label className="ml-auto text-[11px] flex items-center gap-2">
                          <input type="checkbox" className="accent-current" checked={mergeBatch} onChange={(e) => setMergeBatch(e.target.checked)} />
                          <span>Batch per row</span>
                        </label>
                        <span>Filename</span>
                        <Input className="text-xs h-8 w-48" placeholder="{{name}}.md" value={mergeFilenameTemplate} onChange={(e) => setMergeFilenameTemplate(e.target.value)} />
                        <span>Folder</span>
                        <Input className="text-xs h-8 w-48" placeholder="Clients/{{name}}" value={mergeFolderTemplate} onChange={(e) => setMergeFolderTemplate(e.target.value)} title="Outputs will be placed in this folder path (created if missing)" />
                        <span>Preview</span>
                        <Select value={String(mergePreviewCount)} onValueChange={(v) => setMergePreviewCount(parseInt(v, 10) || 5)}>
                          <SelectTrigger size="sm"><SelectValue placeholder="Rows" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="text-[11px] flex items-center gap-1">
                          <input type="checkbox" className="accent-current" checked={mergeCreateTabs} onChange={(e) => setMergeCreateTabs(e.target.checked)} />
                          <span>Create tabs</span>
                        </label>
                        <label className="text-[11px] flex items-center gap-1">
                          <input type="checkbox" className="accent-current" checked={mergeDownload} onChange={(e) => setMergeDownload(e.target.checked)} />
                          <span>Download files</span>
                        </label>
                        <Button
                          className="ml-auto"
                          size="sm"
                          onClick={() => {
                            const baseContent = activeTab?.content || ''
                            const tagRe = /\{\{\s*([\w.-]+)\s*\}\}/g
                            const applyMap = (text: string, map: Record<string, string>): string => text.replace(tagRe, (_, k) => (k in map ? map[k] : _))
                            if (mergeDataMode === 'csv') {
                              const parseCsv = (text: string) => {
                                const rows: string[][] = []
                                let row: string[] = []
                                let cell = ''
                                let inQuotes = false
                                for (let i = 0; i < text.length; i++) {
                                  const ch = text[i]
                                  if (inQuotes) {
                                    if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else { inQuotes = false } }
                                    else { cell += ch }
                                  } else {
                                    if (ch === '"') inQuotes = true
                                    else if (ch === ',') { row.push(cell); cell = '' }
                                    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
                                    else { cell += ch }
                                  }
                                }
                                if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row) }
                                return rows
                              }
                              const rows = parseCsv(mergeCsvText || '')
                              if (rows.length < 2) { setWorkbenchResult(baseContent); return }
                              const headers = rows[0]
                              const idx = Math.min(Math.max(0, mergeSelectedRow), rows.length - 2)
                              const values = rows[idx + 1]
                              const map: Record<string, string> = {}
                              headers.forEach((h, i) => { map[h.trim()] = (values[i] ?? '').trim() })
                              const snippet = (() => {
                                if (wbUseSelection && editorRef.current) {
                                  const editor = editorRef.current as any
                                  const model = editor.getModel()
                                  const sel = editor.getSelection()
                                  if (sel && !sel.isEmpty()) return model.getValueInRange(sel)
                                }
                                return baseContent
                              })()
                              const replaced = applyMap(snippet, map)
                              setWorkbenchResult(replaced)
                            } else {
                              let arr: any[] = []
                              try { arr = JSON.parse(mergeJsonText || '[]') } catch {}
                              if (!Array.isArray(arr) || arr.length === 0) { setWorkbenchResult(baseContent); return }
                              const idx = Math.min(Math.max(0, mergeSelectedRow), arr.length - 1)
                              const map = arr[idx] && typeof arr[idx] === 'object' ? arr[idx] : {}
                              const snippet = (() => {
                                if (wbUseSelection && editorRef.current) {
                                  const editor = editorRef.current as any
                                  const model = editor.getModel()
                                  const sel = editor.getSelection()
                                  if (sel && !sel.isEmpty()) return model.getValueInRange(sel)
                                }
                                return baseContent
                              })()
                              const replaced = applyMap(snippet, map as Record<string, string>)
                              setWorkbenchResult(replaced)
                            }
                          }}
                        >
                          Run
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            const baseActiveContent = activeTab?.content || ''
                            const tagRe = /\{\{\s*([\w.-]+)\s*\}\}/g
                            const applyMap = (text: string, map: Record<string, string>): string => text.replace(tagRe, (_, k) => (k in map ? map[k] : _))
                            const buildMaps = (): Record<string, string>[] => {
                              if (mergeDataMode === 'csv') {
                                const parseCsv = (text: string) => {
                                  const rows: string[][] = []
                                  let row: string[] = []
                                  let cell = ''
                                  let inQuotes = false
                                  for (let i = 0; i < text.length; i++) {
                                    const ch = text[i]
                                    if (inQuotes) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else { inQuotes = false } } else { cell += ch } }
                                    else { if (ch === '"') inQuotes = true; else if (ch === ',') { row.push(cell); cell = '' } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' } else { cell += ch } }
                                  }
                                  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row) }
                                  return rows
                                }
                                const rows = parseCsv(mergeCsvText || '')
                                if (rows.length < 2) return []
                                const headers = rows[0]
                                return rows.slice(1).map((values) => { const map: Record<string, string> = {}; headers.forEach((h, i) => { map[h.trim()] = (values[i] ?? '').trim() }); return map })
                              } else {
                                let arr: any[] = []
                                try { arr = JSON.parse(mergeJsonText || '[]') } catch {}
                                if (!Array.isArray(arr) || arr.length === 0) return []
                                return arr.map((obj) => (obj && typeof obj === 'object' ? obj : {}))
                              }
                            }
                            const buildFilename = (map: Record<string, string>) => mergeFilenameTemplate.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => (k in map ? map[k] : _))
                            const selectionRangeForNonActive = (content: string): { start: number; end: number } | null => null
                            const maps = mergeBatch ? buildMaps() : (() => { const single = buildMaps(); const idx = mergeSelectedRow; return single.length ? [single[Math.min(Math.max(0, idx), single.length - 1)]] : [] })()
                            if (!maps.length) return
                            if (mergeBatch) {
                              const sourceText = (() => { if (wbUseSelection && editorRef.current) { const editor = editorRef.current as any; const model = editor.getModel(); const sel = editor.getSelection(); if (sel && !sel.isEmpty()) return model.getValueInRange(sel) } return baseActiveContent })()
                              const outputs = maps.map((map) => ({ name: buildFilename(map), content: applyMap(sourceText, map), data: map }))
                              if (mergeCreateTabs) {
                                setTabs((prev) => { const next = [...prev]; for (const out of outputs) { const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; const folderPath = (mergeFolderTemplate || 'Default').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_: any, k: string) => (k in (out.data as any) ? (out.data as any)[k] : _)); next.push({ id, name: out.name, content: out.content, folderPath }); addFileToFolder(id, out.name, folderPath) } return next })
                              }
                              if (mergeDownload) {
                                for (const out of outputs) { try { const blob = new Blob([out.content], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = out.name || 'output.md'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url) } catch {} }
                              }
                              return
                            }
                            const applyToContent = (content: string, isActive: boolean): string => {
                              if (wbUseSelection) {
                                if (isActive && editorRef.current) {
                                  const editor = editorRef.current as any; const model = editor.getModel(); const sel = editor.getSelection(); if (sel && !sel.isEmpty()) { const start = model.getOffsetAt(sel.getStartPosition()); const end = model.getOffsetAt(sel.getEndPosition()); const snippet = model.getValueInRange(sel); const rep = applyMap(snippet, maps[0]); return content.slice(0, start) + rep + content.slice(end) }
                                } else {
                                  const rng = selectionRangeForNonActive(content); if (rng) { const snippet = content.slice(rng.start, rng.end); const rep = applyMap(snippet, maps[0]); return content.slice(0, rng.start) + rep + content.slice(rng.end) }
                                }
                              }
                              return applyMap(content, maps[0])
                            }
                            if (wbAllTabs) { setTabs((prev) => prev.map((t) => ({ ...t, content: applyToContent(t.content, t.id === activeTabId) }))) } else { setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, content: applyToContent(t.content, true) } : t))) }
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                      {/* Batch Preview Table */}
                      <div className="px-3 py-2 border-b bg-white text-xs text-gray-600">
                        <div className="font-medium mb-2">Preview</div>
                        {(() => {
                          const computeMaps = () => {
                            if (mergeDataMode === 'csv') {
                              const parseCsv = (text: string) => {
                                const rows: string[][] = []
                                let row: string[] = []
                                let cell = ''
                                let inQuotes = false
                                for (let i = 0; i < text.length; i++) {
                                  const ch = text[i]
                                  if (inQuotes) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else { inQuotes = false } } else { cell += ch } }
                                  else { if (ch === '"') inQuotes = true; else if (ch === ',') { row.push(cell); cell = '' } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' } else { cell += ch } }
                                }
                                if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row) }
                                return rows
                              }
                              const rows = parseCsv(mergeCsvText || '')
                              if (rows.length < 2) return [] as Record<string, string>[]
                              const headers = rows[0]
                              return rows.slice(1).map((values) => { const map: Record<string, string> = {}; headers.forEach((h, i) => { map[h.trim()] = (values[i] ?? '').trim() }); return map })
                            } else {
                              let arr: any[] = []
                              try { arr = JSON.parse(mergeJsonText || '[]') } catch {}
                              if (!Array.isArray(arr) || arr.length === 0) return [] as Record<string, string>[]
                              return arr.map((obj) => (obj && typeof obj === 'object' ? obj : {}))
                            }
                          }
                          const maps = computeMaps()
                          if (maps.length === 0) return <div className="text-gray-500">No data</div>
                          const sourceText = (() => {
                            if (wbUseSelection && editorRef.current) {
                              const editor = editorRef.current as any
                              const model = editor.getModel()
                              const sel = editor.getSelection()
                              if (sel && !sel.isEmpty()) return model.getValueInRange(sel)
                            }
                            return activeTab?.content || ''
                          })()
                          const tagRe = /\{\{\s*([\w.-]+)\s*\}\}/g
                          const applyMap = (text: string, map: Record<string, string>): string => text.replace(tagRe, (_, k) => (k in map ? map[k] : _))
                          const items = maps.slice(0, Math.max(1, mergePreviewCount))
                          return (
                            <div className="border rounded">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-14">Row</TableHead>
                                    <TableHead>Filename</TableHead>
                                    <TableHead>Snippet</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((m, i) => {
                                    const name = (mergeFilenameTemplate || '{{name}}.md').replace(tagRe, (_, k) => (k in m ? m[k] : _))
                                    const out = applyMap(sourceText, m)
                                    const snippet = out.slice(0, 120).replace(/\n/g, ' ')
                                    const rowIndex = i
                                    return (
                                      <TableRow key={i} className="cursor-pointer hover:bg-muted/40" onClick={() => { setMergeSelectedRow(rowIndex); setWorkbenchResult(out) }}>
                                        <TableCell>{rowIndex}</TableCell>
                                        <TableCell className="font-mono text-xs">{name}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{snippet}{out.length > 120 ? '…' : ''}</TableCell>
                                      </TableRow>
                                    )
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )
                        })()}
                      </div>
                      <div className="flex-1 min-h-0">
                        <Editor
                          height="100%"
                          width="100%"
                          language="markdown"
                          theme={resolvedTheme === 'dark' ? 'custom-vs-dark' : 'custom-vs'}
                          value={workbenchResult}
                          onChange={() => undefined}
                          options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', scrollBeyondLastLine: false }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {splitView && !showCopilot && (
            <>
              <div
                className={`w-2 cursor-col-resize flex-shrink-0 relative group ${
                  isDragging ? "bg-primary" : ""
                }`}
                onMouseDown={handleMouseDown}
              >
                <div
                  className="absolute inset-y-0 left-1 w-px bg-border group-hover:bg-primary/60 transition-colors"
                  onMouseDown={handleMouseDown}
                />
              </div>

              <div
                className={`h-full bg-muted/10 overflow-auto flex-shrink-0 preview-style-${previewSettings.style}`}
                style={{ width: `${(1 - splitRatio) * 100}%` }}
              >
                <div className="flex items-center justify-between px-4 py-2 border-b bg-white/60 sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">Style</label>
                    <select
                      className="text-sm border rounded px-2 py-1 bg-white"
                      value={previewSettings.style}
                      onChange={(e) =>
                        setPreviewSettings((ps) => ({ ...ps, style: e.target.value as PreviewStyle }))
                      }
                    >
                      <option value="classic">Classic</option>
                      <option value="clean">Clean</option>
                      <option value="serif">Serif</option>
                      <option value="compact">Compact</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-sm px-2 py-1 border rounded" onClick={copyPreviewHtml}>
                      Copy HTML
                    </button>
                    <button className="text-sm px-2 py-1 border rounded" onClick={downloadPreviewHtml}>
                      Download HTML
                    </button>
                    <button className="text-sm px-2 py-1 border rounded" onClick={saveCurrentFile}>
                      Download MD
                    </button>
                  </div>
                </div>

                <div className="p-8 pb-24">
                  <style>{previewSettings.customCss || ""}</style>
                  <div ref={previewRef} className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a href={href as string} target="_blank" rel="noreferrer" className="underline">
                            {children}
                          </a>
                        ),
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || "")
                          return !inline && match ? (
                            <pre className="bg-muted p-4 rounded-md overflow-x-auto border">
                              <code className="text-sm font-mono text-foreground">
                                {String(children).replace(/\n$/, "")}
                              </code>
                            </pre>
                          ) : (
                            <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props}>
                              {children}
                            </code>
                          )
                        },
                        h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>,
                        p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        del: ({ children }) => <del className="line-through">{children}</del>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-muted-foreground pl-4 italic my-4">
                            {children}
                          </blockquote>
                        ),
                        ul: ({ children }) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-4">
                            <table className="min-w-full border border-border">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                        tbody: ({ children }) => <tbody>{children}</tbody>,
                        tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
                        th: ({ children }) => <th className="px-4 py-2 text-left font-semibold">{children}</th>,
                        td: ({ children }) => <td className="px-4 py-2">{children}</td>,
                      }}
                    >
                      {activeTab?.content || "Nothing to preview..."}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview Overlay */}
      {showMarkdownPreview && (
        <div className="fixed inset-0 bg-background z-50 overflow-auto">
          <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold">Preview</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Style</label>
                <select
                  className="text-sm border rounded px-2 py-1 bg-background"
                  value={previewSettings.style}
                  onChange={(e) => setPreviewSettings((ps) => ({ ...ps, style: e.target.value as PreviewStyle }))}
                >
                  <option value="classic">Classic</option>
                  <option value="clean">Clean</option>
                  <option value="serif">Serif</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-sm px-2 py-1 border rounded" onClick={copyPreviewHtml}>Copy HTML</button>
              <button className="text-sm px-2 py-1 border rounded" onClick={downloadPreviewHtml}>Download HTML</button>
              <button className="text-sm px-2 py-1 border rounded" onClick={saveCurrentFile}>Download MD</button>
              <button
                onClick={() => setShowMarkdownPreview(false)}
                className="p-2 hover:bg-muted rounded"
                title="Close Preview (Escape)"
              >
                <Eye size={16} />
              </button>
            </div>
          </div>
          <div className={`p-8 pb-28 max-w-4xl mx-auto preview-style-${previewSettings.style}`}>
            <style>{previewSettings.customCss || ""}</style>
            <div ref={previewRef} className="prose prose-lg max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href as string} target="_blank" rel="noreferrer" className="underline">
                      {children}
                    </a>
                  ),
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "")
                    return !inline && match ? (
                      <pre className="bg-muted p-4 rounded-md overflow-x-auto border">
                        <code className="text-sm font-mono text-foreground">{String(children).replace(/\n$/, "")}</code>
                      </pre>
                    ) : (
                      <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    )
                  },
                  h1: ({ children }) => <h1 className="text-3xl font-bold mb-6 mt-8">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-2xl font-bold mb-4 mt-6">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-xl font-bold mb-3 mt-5">{children}</h3>,
                  p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  del: ({ children }) => <del className="line-through">{children}</del>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-muted-foreground pl-4 italic my-4">{children}</blockquote>
                  ),
                  ul: ({ children }) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-6">
                      <table className="min-w-full border border-border">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
                  th: ({ children }) => <th className="px-4 py-2 text-left font-semibold">{children}</th>,
                  td: ({ children }) => <td className="px-4 py-2">{children}</td>,
                }}
              >
                {activeTab?.content || "Nothing to preview..."}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* Start Menu */}
      {showStartMenu && (
        <div
          data-start-menu
          className="fixed bottom-12 left-0 bg-background border border-border rounded-tr-lg shadow-lg z-50 min-w-48 animate-in slide-in-from-bottom-2 duration-200"
        >
          <div className="py-2">
            <button
              onClick={() => {
                saveCurrentFile()
                setShowStartMenu(false)
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
            >
              <Save size={14} />
              Save File
            </button>
            <button
              onClick={() => {
                saveAllTabs()
                setShowStartMenu(false)
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
            >
              <Download size={14} />
              Save All
            </button>
            <button
              onClick={() => {
                loadFile()
                setShowStartMenu(false)
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
            >
              <Upload size={14} />
              Load File
            </button>
            <button
              onClick={() => {
                loadTabs()
                setShowStartMenu(false)
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
            >
              <FolderOpen size={14} />
              Load Tabs
            </button>

            <div className="border-t border-border my-1"></div>

            <button
              onClick={() => setShowEditorSettings(!showEditorSettings)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
            >
              <Settings size={14} />
              Editor Settings
            </button>

            <div className="border-t border-border my-1"></div>

            <button
              onClick={() => setShowStartMenu(false)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-muted flex items-center gap-3"
            >
              <Info size={14} />
              About Notee
              <span className="ml-auto text-xs text-muted-foreground">v1.0</span>
            </button>
          </div>
        </div>
      )}

      {/* Editor Settings */}
      {showEditorSettings && (
        <div
          data-settings-menu
          className="fixed bottom-16 left-48 bg-background border border-border rounded-lg shadow-lg p-4 z-50 min-w-64 animate-in slide-in-from-left-2 duration-200"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Settings</h3>
            <button onClick={() => setShowEditorSettings(false)} className="p-1 hover:bg-muted rounded">
              <X size={14} />
            </button>
          </div>

          {/* Settings Tabs with context */}
          <SettingsTabsContext.Provider value={[settingsTab, setSettingsTab] as any}>
            <SettingsTabs />
          </SettingsTabsContext.Provider>

          <div className="space-y-4 mt-3">
            {settingsTab === 'appearance' && (
            <div>
              <h4 className="font-semibold text-xs mb-2">Appearance</h4>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="radio"
                    name="theme-mode"
                    value="light"
                    checked={theme === 'light'}
                    onChange={() => setTheme('light')}
                    className="rounded"
                  />
                  Light
                </label>
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="radio"
                    name="theme-mode"
                    value="dark"
                    checked={theme === 'dark'}
                    onChange={() => setTheme('dark')}
                    className="rounded"
                  />
                  Dark
                </label>
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="radio"
                    name="theme-mode"
                    value="system"
                    checked={theme === 'system' || !theme}
                    onChange={() => setTheme('system')}
                    className="rounded"
                  />
                  System
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Applies across the app, including editor and preview. Current: {resolvedTheme || theme}
              </p>
            </div>
            )}
            {settingsTab === 'editor' && (
            <div>
              <label className="block text-xs font-medium mb-2">Font Family</label>
              <select
                value={editorSettings.fontFamily}
                onChange={(e) => setEditorSettings((prev) => ({ ...prev, fontFamily: e.target.value }))}
                className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
              >
                {fontOptions.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.name}
                  </option>
                ))}
              </select>
            </div>
            )}

            {settingsTab === 'shortcuts' && (
            <div>
              <h4 className="font-semibold text-xs mb-2">Keyboard Shortcuts</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between border rounded px-2 py-1">
                  <span>Toggle Explorer</span>
                  <span className="font-mono">⌃⌘E</span>
                </div>
                <div className="flex items-center justify-between border rounded px-2 py-1">
                  <span>Toggle Copilot</span>
                  <span className="font-mono">⌃⌘K</span>
                </div>
                <div className="flex items-center justify-between border rounded px-2 py-1">
                  <span>Toggle Preview Overlay</span>
                  <span className="font-mono">⌃⌘P</span>
                </div>
                <div className="flex items-center justify-between border rounded px-2 py-1">
                  <span>Toggle Split View</span>
                  <span className="font-mono">⌃⌘S</span>
                </div>
                <div className="flex items-center justify-between border rounded px-2 py-1">
                  <span>Close dialogs/overlays</span>
                  <span className="font-mono">Esc</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Shortcuts require holding Control and Command together.</p>
            </div>
            )}

            {settingsTab === 'editor' && (
            <div>
              <label className="block text-xs font-medium mb-2">Font Size</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="12"
                  max="24"
                  value={editorSettings.fontSize}
                  onChange={(e) =>
                    setEditorSettings((prev) => ({ ...prev, fontSize: Number.parseInt(e.target.value) }))
                  }
                  className="flex-1"
                />
                <span className="text-xs font-mono w-8">{editorSettings.fontSize}px</span>
              </div>
            </div>
            )}

            {settingsTab === 'editor' && (
            <div>
              <label className="block text-xs font-medium mb-2">Line Height</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1.2"
                  max="2.0"
                  step="0.1"
                  value={editorSettings.lineHeight}
                  onChange={(e) =>
                    setEditorSettings((prev) => ({ ...prev, lineHeight: Number.parseFloat(e.target.value) }))
                  }
                  className="flex-1"
                />
                <span className="text-xs font-mono w-8">{editorSettings.lineHeight.toFixed(1)}</span>
              </div>
            </div>
            )}

            {settingsTab === 'editor' && (
            <div>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={editorSettings.fullWidth}
                  onChange={(e) => setEditorSettings((prev) => ({ ...prev, fullWidth: e.target.checked }))}
                  className="rounded"
                />
                Full Width Editor
              </label>
            </div>
            )}

            {settingsTab === 'editor' && (
            <div>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={editorSettings.showGutter}
                  onChange={(e) => setEditorSettings((prev) => ({ ...prev, showGutter: e.target.checked }))}
                  className="rounded"
                />
                Show Gutter
              </label>
            </div>
            )}

            {settingsTab === 'editor' && (
            <div>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={editorSettings.showLineNumbers}
                  onChange={(e) => setEditorSettings((prev) => ({ ...prev, showLineNumbers: e.target.checked }))}
                  className="rounded"
                  disabled={!editorSettings.showGutter}
                />
                Show Line Numbers
              </label>
            </div>
            )}

            {settingsTab === 'preview' && (
            <div>
              <h4 className="font-semibold text-xs mb-2">Markdown Preview</h4>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs font-medium">Style</label>
                <select
                  value={previewSettings.style}
                  onChange={(e) => setPreviewSettings((ps) => ({ ...ps, style: e.target.value as PreviewStyle }))}
                  className="px-2 py-1 text-xs border border-border rounded bg-background"
                >
                  <option value="classic">Classic</option>
                  <option value="clean">Clean</option>
                  <option value="serif">Serif</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
              <label className="block text-xs font-medium mb-1">Custom CSS</label>
              <textarea
                value={previewSettings.customCss || ''}
                onChange={(e) => setPreviewSettings((ps) => ({ ...ps, customCss: e.target.value }))}
                placeholder="/* Optional CSS applied to preview */"
                rows={4}
                className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
              />
            </div>
            )}

            {settingsTab === 'preview' && (
            <PreviewTemplates
              previewSettings={previewSettings}
              setPreviewSettings={setPreviewSettings}
            />
            )}

            <div className="border-t border-border my-2"></div>

            {settingsTab === 'ai' && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Copilot Settings</h3>
              <div className="mb-2 flex items-center gap-2">
                <label className="text-xs font-medium">Default Model</label>
                <select
                  value={copilotSettings.defaultModel}
                  onChange={(e) => {
                    const m = e.target.value
                    setCopilotSettings((cs) => ({ ...cs, defaultModel: m }))
                    setCopilotModel(m)
                  }}
                  className="px-2 py-1 text-xs border border-border rounded bg-background"
                >
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4.1-mini">GPT-4.1-mini</option>
                </select>
                <label className="flex items-center gap-2 text-xs ml-4">
                  <input
                    type="checkbox"
                    checked={copilotSettings.enableWebSearch}
                    onChange={(e) => setCopilotSettings((cs) => ({ ...cs, enableWebSearch: e.target.checked }))}
                  />
                  Enable Web Search (OpenAI tool)
                </label>
                <label className="flex items-center gap-2 text-xs ml-4">
                  <input
                    type="checkbox"
                    checked={copilotSettings.enableFetchTool}
                    onChange={(e) => setCopilotSettings((cs) => ({ ...cs, enableFetchTool: e.target.checked }))}
                  />
                  Enable Fetch Function
                </label>
              </div>
              <label className="block text-xs font-medium mb-1">System Prompt</label>
              <textarea
                value={copilotSettings.systemPrompt}
                onChange={(e) => setCopilotSettings((cs) => ({ ...cs, systemPrompt: e.target.value }))}
                rows={5}
                className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                placeholder="Guide the assistant's behavior. Markdown-friendly."
              />
              {copilotSettings.enableFetchTool && (
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">Allowed Domains (comma-separated)</label>
                    <input
                      value={copilotSettings.allowedDomains}
                      onChange={(e) => setCopilotSettings((cs) => ({ ...cs, allowedDomains: e.target.value }))}
                      className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium">Max Bytes</label>
                      <input
                        type="number"
                        min={1000}
                        max={1000000}
                        value={copilotSettings.maxFetchBytes}
                        onChange={(e) =>
                          setCopilotSettings((cs) => ({ ...cs, maxFetchBytes: Number(e.target.value) }))
                        }
                        className="w-28 px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium mb-1">User-Agent</label>
                      <input
                        value={copilotSettings.userAgent || ''}
                        onChange={(e) => setCopilotSettings((cs) => ({ ...cs, userAgent: e.target.value }))}
                        className="w-full px-2 py-1 text-xs border border-border rounded bg-background font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Tooltip */}
      {showTooltip && hoveredTab && (
        <div
          className="fixed z-50 bg-popover text-popover-foreground px-2 py-1 rounded shadow-lg text-xs font-mono border pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: "translateX(-50%)",
          }}
        >
          {(() => {
            const tab = tabs.find((t) => t.id === hoveredTab)
            if (!tab) return ""
            const folderPath = tab.folderPath || "Default"
            return folderPath === "Default" ? tab.name : `${folderPath}/${tab.name}`
          })()}
        </div>
      )}

      {/* Status Bar */}
      <div
        className={`sticky bottom-0 h-12 border-t border-border bg-background px-0 py-0 flex justify-between items-center text-xs font-mono text-muted-foreground transition-all duration-300 ${pinnedExplorer ? "ml-64" : "ml-0"}`}
      >
        <div className="flex items-center gap-6 h-full">
          <button
            data-start-button
            onClick={() => {
              setShowStartMenu(!showStartMenu)
              setShowEditorSettings(false)
            }}
            className={`flex items-center justify-center h-full px-4 transition-all duration-200 ${
              showStartMenu ? "bg-orange-700 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"
            }`}
            title="Start Menu"
          >
            {showStartMenu ? (
              <ChevronDown size={14} className="transition-transform duration-200" />
            ) : (
              <ChevronUp size={14} className="transition-transform duration-200" />
            )}
          </button>
          <div className="flex items-center gap-6 px-4">
            <span className="hidden sm:inline">{stats.lines} lines</span>
            <span className="sm:hidden">{stats.lines}L</span>

            <span className="hidden sm:inline">{stats.words} words</span>
            <span className="sm:hidden">{stats.words}W</span>

            <span className="hidden sm:inline">{stats.characters} characters</span>
            <span className="sm:hidden">{stats.characters}C</span>

            <span className="hidden md:inline">{stats.charactersNoSpaces} characters (no spaces)</span>
            <span className="hidden sm:inline md:hidden">{stats.charactersNoSpaces} chars (no spaces)</span>
            <span className="sm:hidden">{stats.charactersNoSpaces}C-</span>
          </div>
        </div>
        <div className="flex items-center gap-4 px-4">
          <span className="hidden lg:inline text-muted-foreground/60">
            ⌘E Explorer • ⌘⇧P Preview • ⌘⇧S Split • ⌘K Copilot
          </span>

          <span className="hidden md:inline lg:hidden text-muted-foreground/60">⌘E • ⌘⇧P • ⌘⇧S • ⌘K</span>
          <span className="text-muted-foreground/60">Markdown</span>
        </div>
      </div>
      {showCopilotButton && !showCopilot && (
        <div
          className="fixed z-50 bg-background border border-border rounded-md shadow-lg overflow-hidden"
          style={{
            left: buttonPosition.x,
            top: buttonPosition.y,
          }}
        >
          <button
            onClick={() => handleCopilotClick("ask")}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left"
          >
            <MessageSquare size={14} />
            Ask AI
          </button>
          <button
            onClick={() => handleCopilotClick("send")}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors w-full text-left border-t border-border"
          >
            <Send size={14} />
            Send to Copilot
          </button>
        </div>
      )}

      {/* @ Reference Dropdown */}
      {showAtReference && (
        <div
          className="fixed z-50 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto min-w-64 at-reference-dropdown" // Added class for handleClickOutside
          style={{
            left: atReferencePosition.x,
            top: atReferencePosition.y,
          }}
        >
          {atReferenceItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 ${
                index === selectedAtIndex ? "bg-muted" : ""
              }`}
              onClick={() => {
                if (editorRef.current && atReferenceStartPos.current) {
                  const editor = editorRef.current as any
                  const monaco = (window as any).monaco
                  const model = editor.getModel()
                  const position = editor.getPosition()

                  if (model && position && monaco) {
                    // Replace from @ to current cursor position with the selected item
                    const range = new monaco.Range(
                      atReferenceStartPos.current.lineNumber,
                      atReferenceStartPos.current.column,
                      position.lineNumber,
                      position.column,
                    )

                    const insertText = item.type === "special" ? item.name : `@${item.name}`

                    editor.executeEdits("at-reference", [
                      {
                        range: range,
                        text: insertText,
                      },
                    ])

                    // Position cursor after the inserted text
                    const newPosition = new monaco.Position(
                      atReferenceStartPos.current.lineNumber,
                      atReferenceStartPos.current.column + insertText.length,
                    )
                    editor.setPosition(newPosition)
                    editor.focus()
                  }
                }

                setShowAtReference(false)
                atReferenceStartPos.current = null
              }}
            >
              {item.icon}
              <div className="flex flex-col">
                <span className="text-sm font-medium">{item.name}</span>
                {item.path && item.type !== "special" && (
                  <span className="text-xs text-muted-foreground">{item.path}</span>
                )}
                {item.type === "special" && (
                  <span className="text-xs text-muted-foreground">Reference all open tabs</span>
                )}
              </div>
            </div>
          ))}
          {atReferenceItems.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches found</div>
          )}
        </div>
      )}

      {/* Chat @ Reference Dropdown */}
      {showChatAtReference && (
        <div
          className="fixed z-50 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-64 chat-at-reference-dropdown"
          style={{
            left: chatAtReferencePosition.x,
            top: chatAtReferencePosition.y,
          }}
        >
          {chatAtReferenceItems.length > 0 ? (
            chatAtReferenceItems.map((item, index) => (
              <div
                key={item.id}
                className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm ${
                  index === chatAtReferenceSelectedIndex ? "bg-blue-50 text-blue-900" : "hover:bg-gray-50"
                }`}
                onClick={() => handleChatAtReferenceSelect(item)}
              >
                {item.type === "file" && <FileText size={14} className="text-blue-500" />}
                {item.type === "folder" && <Folder size={14} className="text-yellow-500" />}
                {item.type === "special" && <MessageSquare size={14} className="text-green-500" />}
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                  {item.path && <div className="text-xs text-gray-400">{item.path}</div>}
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No matches found</div>
          )}
        </div>
      )}
    </div>
  )
}
function SettingsTabs() {
  const [active, setActive] = useContext(SettingsTabsContext)
  return (
    <div className="inline-flex border rounded overflow-hidden text-xs">
      {([
        ['appearance', 'Appearance'],
        ['editor', 'Editor'],
        ['preview', 'Preview'],
        ['ai', 'AI'],
        ['shortcuts', 'Shortcuts'],
      ] as const).map(([key, label]) => (
        <button
          key={key}
          onClick={() => setActive(key)}
          className={`px-3 py-1 border-r last:border-r-0 ${active === key ? 'bg-muted font-medium' : 'bg-background hover:bg-muted/50'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const SettingsTabsContext = createContext<any>(undefined)
