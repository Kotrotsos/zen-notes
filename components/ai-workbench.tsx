"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { Editor } from "@monaco-editor/react"
import { X, Play, Square, ChevronDown, ChevronUp, Zap, FilePlus, FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { parseCsv, isValidCsv } from "@/lib/csv"
import WorkflowDropdown from '@/components/workflow-dropdown'
import WorkflowBrowser from '@/components/workflow-browser'
import { Workflow, WorkflowMetadata } from '@/lib/workflow-types'
import { parseWorkflowFile, buildWorkflowFile } from '@/lib/workflow-service'
import { BookOpen, Save, Maximize2, FilePlus } from 'lucide-react'

const NEW_WORKFLOW_TEMPLATE = `nodes:
  - id: process
    type: prompt
    prompt: |
      Process the following text:

      {{ chunk }}
    model: gpt-4.1
    temperature: 0.7
    expect: text
    output: result

  - id: log
    type: print
    message: "Result: {{ result }}"
`

const DEFAULT_WORKFLOW_SCRIPT = `# Advanced workflow example
nodes:
  - id: prepare
    type: func
    expr: |
      const base = row ? Object.values(row).join('\n') : chunk
      return { text: base }

  - id: summarize
    type: prompt
    prompt: |
      Summarize the following information in 3 bullet points.

      {{ text }}
    model: gpt-4.1
    temperature: 0.5
    expect: text

  - id: print
    type: print
    message: "Chunk {{ index }} summary: {{ summarize }}"
`

const DEFAULT_ADVANCED_SYSTEM_PROMPT = `You are a careful assistant that follows instructions exactly and only returns the requested output. If the user asks for JSON, return valid JSON. Be concise.`

interface AIWorkbenchProps {
  activeTabContent: string
  activeTabName?: string
  onClose: () => void
  onCreateNewTab?: (content: string, name: string) => void
  onAppendToTab?: (content: string) => void
  availablePrompts?: Array<{ id: string; name: string; content: string; folderPath?: string }>
  onSavePrompt?: (name: string, content: string, folderPath?: string) => void
  selectedPromptId?: string
  onActivityChange?: (active: boolean) => void
  availableWorkflows?: Workflow[]
  onSaveWorkflow?: (name: string, content: string, folderPath?: string, metadata?: WorkflowMetadata) => void
  onDeleteWorkflow?: (id: string) => void
  selectedWorkflowId?: string
}

type SeparatorType = "none" | "newline" | "blank-line" | "word" | "characters" | "custom"

interface ChunkResult {
  index: number
  chunk: string
  response: string
  isComplete: boolean
  error?: string
}

export default function AIWorkbench({ activeTabContent, activeTabName, onClose, onCreateNewTab, onAppendToTab, availablePrompts = [], onSavePrompt, selectedPromptId, onActivityChange, availableWorkflows, onSaveWorkflow, onDeleteWorkflow, selectedWorkflowId }: AIWorkbenchProps) {
  // Settings
  const [model, setModel] = useState("gpt-4.1")
  const [prompt, setPrompt] = useState("Summarize the following text:")
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(500)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mode, setMode] = useState<'basic' | 'advanced'>("basic")
  const [workflowScript, setWorkflowScript] = useState<string>(() => DEFAULT_WORKFLOW_SCRIPT)
  const [workflowLogs, setWorkflowLogs] = useState<string[]>([])
  const [workflowError, setWorkflowError] = useState<string | null>(null)
  const [workflowResults, setWorkflowResults] = useState<Array<{ index: number; context: Record<string, any> }>>([])
  const [isAdvancedProcessing, setIsAdvancedProcessing] = useState(false)
  const [selectedPromptIdState, setSelectedPromptIdState] = useState<string>("")
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [saveFolder, setSaveFolder] = useState("Prompts")
  const [overwrite, setOverwrite] = useState(false)
  // Vertical splitter (settings/results)
  const [panelRatio, setPanelRatio] = useState(0.45) // portion for settings (0..1)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Chunking
  const [separatorType, setSeparatorType] = useState<SeparatorType>("newline")
  const [customSeparator, setCustomSeparator] = useState("")
  const [charCount, setCharCount] = useState(500)
  const [wordCount, setWordCount] = useState(100)

  // CSV-specific
  const [isCsvMode, setIsCsvMode] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRowLimit, setCsvRowLimit] = useState<number>(0) // 0 = no limit

  // Processing
  const [isProcessing, setIsProcessing] = useState(false)
  const [chunks, setChunks] = useState<string[]>([])
  const [results, setResults] = useState<ChunkResult[]>([])
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0)
  const [exportAction, setExportAction] = useState<string>("new-tab")
  const [includeHeaders, setIncludeHeaders] = useState(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Workflow management
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null)
  const [isWorkflowModified, setIsWorkflowModified] = useState(false)
  const [showWorkflowBrowser, setShowWorkflowBrowser] = useState(false)
  const [workflowFavorites, setWorkflowFavorites] = useState<string[]>([])
  const [workflowRecent, setWorkflowRecent] = useState<string[]>([])
  const [showWorkflowSave, setShowWorkflowSave] = useState(false)
  const [workflowSaveName, setWorkflowSaveName] = useState('')
  const [workflowSaveFolder, setWorkflowSaveFolder] = useState('Workflows')
  const [workflowSaveCategory, setWorkflowSaveCategory] = useState('Content Generation')
  const [workflowSaveDifficulty, setWorkflowSaveDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner')
  const [workflowSaveTags, setWorkflowSaveTags] = useState('')
  const [workflowSaveDescription, setWorkflowSaveDescription] = useState('')
  const [workflowSaveUseCases, setWorkflowSaveUseCases] = useState('')
  const [workflowOverwrite, setWorkflowOverwrite] = useState(false)
  const [isEditorExpanded, setIsEditorExpanded] = useState(false)
  const promptVars = useMemo(() => {
    const vars = new Set<string>()
    if (!prompt) return vars
    const re = /\{\{\s*(\w+)\s*\}\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(prompt)) !== null) {
      if (m[1]) vars.add(m[1])
    }
    return vars
  }, [prompt])

  // Detect CSV on content change
  useEffect(() => {
    const isCSV = isValidCsv(activeTabContent)
    setIsCsvMode(isCSV)

    if (isCSV) {
      const { headers } = parseCsv(activeTabContent)
      setCsvHeaders(headers)
    } else {
      setCsvHeaders([])
    }
  }, [activeTabContent])

  // Interpolate variables in prompt
  const interpolatePrompt = (template: string, row: Record<string, string>): string => {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return row[key] !== undefined ? row[key] : match
    })
  }

  // Split content into chunks based on separator
  const createChunks = (content: string): string[] => {
    if (!content) return []

    // CSV mode: each row is a chunk
    if (isCsvMode) {
      const { rows } = parseCsv(content)
      const limitedRows = csvRowLimit > 0 ? rows.slice(0, csvRowLimit) : rows

      // For CSV, we'll return serialized row objects as strings
      // They will be parsed back in processChunk
      return limitedRows.map(row => JSON.stringify(row))
    }

    let parts: string[] = []

    switch (separatorType) {
      case "none":
        parts = [content]
        break
      case "newline":
        parts = content.split("\n")
        break
      case "blank-line":
        parts = content.split(/\n\s*\n/)
        break
      case "word":
        const words = content.split(/\s+/)
        parts = []
        for (let i = 0; i < words.length; i += wordCount) {
          parts.push(words.slice(i, i + wordCount).join(" "))
        }
        break
      case "characters":
        parts = []
        for (let i = 0; i < content.length; i += charCount) {
          parts.push(content.slice(i, i + charCount))
        }
        break
      case "custom":
        if (customSeparator) {
          parts = content.split(customSeparator)
        } else {
          parts = [content]
        }
        break
      default:
        parts = [content]
    }

    return parts.filter(p => p.trim().length > 0)
  }

  // Frontmatter helpers for .prompt files
  const parseFrontmatter = (text: string): { meta: Record<string, string>, body: string } => {
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!fmMatch) return { meta: {}, body: text }
    const metaLines = fmMatch[1].split(/\r?\n/)
    const meta: Record<string, string> = {}
    for (const line of metaLines) {
      const m = line.match(/^([a-zA-Z0-9_\-]+)\s*:\s*(.*)$/)
      if (m) meta[m[1]] = m[2]
    }
    return { meta, body: fmMatch[2] }
  }

  const buildPromptFile = (name: string, promptBody: string): string => {
    const fm = [
      '---',
      'type: prompt',
      `model: ${model}`,
      `temperature: ${temperature}`,
      `max_tokens: ${maxTokens}`,
      '---',
      promptBody.trimStart(),
      '',
    ].join('\n')
    return fm
  }

  const handleSelectPrompt = (id: string) => {
    setSelectedPromptIdState(id)
    const item = availablePrompts.find((p) => p.id === id)
    if (!item) return
    const { meta, body } = parseFrontmatter(item.content || '')
    if (meta.model) setModel(meta.model)
    if (meta.temperature && !Number.isNaN(Number(meta.temperature))) setTemperature(Number(meta.temperature))
    if (meta.max_tokens && !Number.isNaN(Number(meta.max_tokens))) setMaxTokens(Number(meta.max_tokens))
    setPrompt(body || '')
  }

  const handleSavePrompt = async () => {
    if (!onSavePrompt) return
    const rawName = saveName.trim() || (activeTabName || 'Untitled')
    const fileName = rawName.toLowerCase().endsWith('.prompt') ? rawName : `${rawName}.prompt`
    const exists = availablePrompts.some((p) => p.name === fileName)
    if (exists && !overwrite) return // prevent accidental overwrite; user must check overwrite
    const content = buildPromptFile(fileName, prompt)
    onSavePrompt(fileName, content, saveFolder || 'Prompts')
    setSaveOpen(false)
    setSaveName("")
    setOverwrite(false)
    setSelectedPromptIdState("")
  }

  // React to external selectedPromptId
  useEffect(() => {
    if (selectedPromptId) {
      handleSelectPrompt(selectedPromptId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPromptId])

  // Load workflow favorites and recent from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zenNotes.workflowPreferences.v1')
      if (stored) {
        const prefs = JSON.parse(stored)
        setWorkflowFavorites(prefs.favorites || [])
        setWorkflowRecent(prefs.recent || [])
      }
    } catch (e) {
      console.error('Failed to load workflow preferences', e)
    }
  }, [])

  // Save workflow preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('zenNotes.workflowPreferences.v1', JSON.stringify({
        favorites: workflowFavorites,
        recent: workflowRecent
      }))
    } catch (e) {
      console.error('Failed to save workflow preferences', e)
    }
  }, [workflowFavorites, workflowRecent])

  // Track workflow modifications
  useEffect(() => {
    if (currentWorkflowId && availableWorkflows) {
      const current = availableWorkflows.find(w => w.id === currentWorkflowId)
      if (current) {
        const { body } = parseWorkflowFile(current.content)
        setIsWorkflowModified(workflowScript !== body)
      }
    }
  }, [workflowScript, currentWorkflowId, availableWorkflows])

  // Process a single chunk
  const processChunk = async (chunk: string, index: number) => {
    try {
      // For CSV mode, parse the row and interpolate variables
      let actualChunk = chunk
      let actualPrompt = prompt
      let includeChunk = true

      if (isCsvMode) {
        try {
          const rowData = JSON.parse(chunk)
          // Check if the prompt uses any variables from the row
          let hasMatchingVars = false
          for (const v of promptVars) {
            if (Object.prototype.hasOwnProperty.call(rowData, v)) { hasMatchingVars = true; break }
          }

          actualPrompt = interpolatePrompt(prompt, rowData)
          const rowText = Object.entries(rowData)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')
          includeChunk = !hasMatchingVars // if variables are used, don't append the row as a chat turn
          actualChunk = includeChunk ? rowText : ""
        } catch (e) {
          console.error('Failed to parse CSV row:', e)
        }
      }

      console.log(`Processing chunk ${index + 1}:`, {
        chunk: actualChunk.substring(0, 50),
        prompt: actualPrompt.substring(0, 50),
        model,
        temperature
      })

      // Load API key from localStorage settings
      let apiKey: string | undefined
      try {
        const raw = localStorage.getItem("zenNotes.settings.v1")
        if (raw) {
          const parsed = JSON.parse(raw)
          apiKey = parsed?.modelsSettings?.openaiApiKey || parsed?.openaiApiKey
        }
      } catch {}

      const response = await fetch("/api/ai-workbench", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "x-openai-key": apiKey } : {}),
        },
        body: JSON.stringify({
          prompt: actualPrompt,
          chunk: actualChunk,
          model,
          temperature,
          maxTokens,
          includeChunk,
        }),
        signal: abortControllerRef.current?.signal,
      })

      console.log(`Response status for chunk ${index + 1}:`, response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Error response for chunk ${index + 1}:`, errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let accumulatedResponse = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const chunks = text.split("\n\n")

        for (const chunk of chunks) {
          if (!chunk.trim()) continue

          const lines = chunk.split("\n")
          let event = ""
          let data = ""

          for (const line of lines) {
            if (line.startsWith("event:")) {
              event = line.slice(6).trim()
            } else if (line.startsWith("data:")) {
              data = line.slice(5).trim()
            }
          }

          if (!event || !data) continue

          if (event === "content_delta") {
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.delta || ""
              accumulatedResponse += delta

              setResults(prev => {
                const newResults = [...prev]
                if (newResults[index]) {
                  newResults[index] = {
                    ...newResults[index],
                    response: accumulatedResponse,
                  }
                }
                return newResults
              })
            } catch (e) {
              console.error("Failed to parse delta:", e)
            }
          } else if (event === "done") {
            setResults(prev => {
              const newResults = [...prev]
              if (newResults[index]) {
                newResults[index] = {
                  ...newResults[index],
                  isComplete: true,
                }
              }
              return newResults
            })
          } else if (event === "error") {
            try {
              const parsed = JSON.parse(data)
              throw new Error(parsed.error || "Unknown error")
            } catch (e: any) {
              throw new Error(e.message || "Unknown error")
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        setResults(prev => {
          const newResults = [...prev]
          if (newResults[index]) {
            newResults[index] = {
              ...newResults[index],
              error: "Cancelled",
              isComplete: true,
            }
          }
          return newResults
        })
      } else {
        setResults(prev => {
          const newResults = [...prev]
          if (newResults[index]) {
            newResults[index] = {
              ...newResults[index],
              error: error.message || "Failed to process chunk",
              isComplete: true,
            }
          }
          return newResults
        })
      }
    }
  }

  const requestPromptResponse = async ({
    promptText,
    chunkText,
    includeChunkValue,
    modelOverride,
    temperatureOverride,
    maxTokensOverride,
    systemPrompt,
  }: {
    promptText: string
    chunkText: string
    includeChunkValue: boolean
    modelOverride?: string
    temperatureOverride?: number
    maxTokensOverride?: number
    systemPrompt?: string
  }): Promise<string> => {
    const response = await fetch("/api/ai-workbench", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: promptText,
        chunk: chunkText,
        includeChunk: includeChunkValue,
        model: modelOverride || model,
        temperature: temperatureOverride ?? temperature,
        maxTokens: maxTokensOverride ?? maxTokens,
        system: systemPrompt,
      }),
    })

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => "")
      throw new Error(errText || `HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let accumulated = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split("\n\n")
      buffer = parts.pop() || ""
      for (const part of parts) {
        if (!part.trim()) continue
        const lines = part.split("\n")
        let event = ""
        let data = ""
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim()
          if (line.startsWith("data:")) data = line.slice(5).trim()
        }
        if (!data) continue
        if (event === "content_delta") {
          try {
            const payload = JSON.parse(data)
            const delta = payload?.delta || ""
            accumulated += delta
          } catch (err) {
            console.error("Failed to parse delta", err)
          }
        } else if (event === "error") {
          try {
            const payload = JSON.parse(data)
            throw new Error(payload.error || "Unknown error")
          } catch (err: any) {
            throw new Error(err?.message || "Unknown error")
          }
        }
      }
    }

    return accumulated.trim()
  }

  const handleAdvancedRun = async () => {
    setWorkflowError(null)
    setWorkflowLogs([])
    setWorkflowResults([])
    setIsAdvancedProcessing(true)
    try {
      onActivityChange?.(true)
    } catch {}

    try {
      const parsed = parseWorkflowScript(workflowScript)
      const nodes: WorkflowNode[] = Array.isArray(parsed?.nodes) ? parsed.nodes : []
      if (!nodes.length) {
        throw new Error("Workflow script must define a 'nodes' array")
      }

      const logs: string[] = []
      const results: Array<{ index: number; context: Record<string, any> }> = []

      for (let i = 0; i < memoChunks.length; i++) {
        const chunkText = memoChunks[i]
        let rowData: any = null
        if (isCsvMode) {
          try {
            rowData = chunkText ? JSON.parse(chunkText) : null
          } catch {
            rowData = null
          }
        }

        const context: Record<string, any> = {
          chunk: chunkText,
          row: rowData,
          data: rowData,
          index: i,
        }

        const helpers = {
          template: (tpl: string) => renderTemplate(tpl, context),
          log: (msg: string) => logs.push(`[${i}] ${msg}`),
        }

        let skipRow = false

        for (const node of nodes) {
          const type = (node.type || '').toLowerCase()
          const nodeId = node.id || `${type || 'node'}_${i}`

          if (type === 'func') {
            const expr = node.expr || node.code
            if (!expr) continue
            try {
              const fn = new Function('context', 'chunk', 'row', 'helpers', expr)
              const result = await Promise.resolve(fn(context, chunkText, rowData, helpers))
              if (result && typeof result === 'object') {
                if (result.skip) {
                  skipRow = true
                  logs.push(`[${i}] func ${nodeId} skipped row`)
                  break
                }
                Object.assign(context, result)
              }
            } catch (err: any) {
              logs.push(`[${i}] func ${nodeId} error: ${err?.message || err}`)
              skipRow = true
              break
            }
          } else if (type === 'prompt') {
            const promptTemplate = node.prompt || ''
            if (!promptTemplate) {
              logs.push(`[${i}] prompt ${nodeId} missing prompt text`)
              skipRow = true
              break
            }
            const systemPrompt = renderTemplate(node.system || DEFAULT_ADVANCED_SYSTEM_PROMPT, context)
            const promptText = renderTemplate(promptTemplate, context)
            const appendChunk = node.append_chunk ?? false
            try {
              const responseText = await requestPromptResponse({
                promptText,
                chunkText: appendChunk ? chunkText : '',
                includeChunkValue: appendChunk,
                modelOverride: node.model,
                temperatureOverride: node.temperature,
                maxTokensOverride: node.maxTokens ?? node.max_tokens,
                systemPrompt,
              })
              const key = node.output_key || node.output || nodeId
              if ((node.expect || '').toLowerCase() === 'json') {
                try {
                  context[key] = JSON.parse(responseText)
                } catch {
                  logs.push(`[${i}] prompt ${nodeId} returned invalid JSON, storing raw text`)
                  context[key] = responseText
                }
              } else {
                context[key] = responseText
              }
              helpers.log(`prompt ${nodeId} complete`)
            } catch (err: any) {
              logs.push(`[${i}] prompt ${nodeId} error: ${err?.message || err}`)
              skipRow = true
              break
            }
          } else if (type === 'print') {
            const message = renderTemplate(node.message || '', context)
            logs.push(`[${i}] ${message}`)
          } else {
            logs.push(`[${i}] Unknown node type: ${node.type}`)
          }
        }

        if (!skipRow) {
          const snapshot = { ...context, chunk: chunkText }
          results.push({ index: i, context: snapshot })
        }
      }

      setWorkflowLogs(logs)
      setWorkflowResults(results)
    } catch (err: any) {
      setWorkflowError(err?.message || 'Workflow failed')
    } finally {
      setIsAdvancedProcessing(false)
      try { onActivityChange?.(false) } catch {}
    }
  }

  // Splitter handlers
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
  const onSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  useEffect(() => {
    if (!isDragging) return
    const onMove = (ev: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const y = ev.clientY - rect.top
      const ratio = clamp(y / rect.height, 0.15, 0.85)
      setPanelRatio(ratio)
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  // Precompute chunks to avoid re-parsing on every keystroke
  const memoChunks = useMemo(() => createChunks(activeTabContent), [activeTabContent, isCsvMode, csvRowLimit, separatorType, customSeparator, wordCount, charCount])
  const largeData = useMemo(() => {
    const chars = activeTabContent?.length || 0
    const count = memoChunks.length
    const overRows = count >= 500
    const overChars = chars >= 200_000 // ~200 KB
    return { over: overRows || overChars, count, chars }
  }, [activeTabContent, memoChunks])

  // Process all chunks sequentially
  const handleRun = async () => {
    const chunksToProcess = memoChunks

    if (chunksToProcess.length === 0) {
      return
    }

    setChunks(chunksToProcess)
    setResults(
      chunksToProcess.map((chunk, index) => ({
        index,
        chunk,
        response: "",
        isComplete: false,
      }))
    )
    setIsProcessing(true)
    try { onActivityChange?.(true) } catch {}
    setCurrentChunkIndex(0)

    abortControllerRef.current = new AbortController()

    for (let i = 0; i < chunksToProcess.length; i++) {
      if (abortControllerRef.current.signal.aborted) break
      setCurrentChunkIndex(i)
      await processChunk(chunksToProcess[i], i)
    }

    setIsProcessing(false)
    setCurrentChunkIndex(0)
    try { onActivityChange?.(false) } catch {}
  }

  // Stop processing
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsProcessing(false)
      try { onActivityChange?.(false) } catch {}
    }
  }

  // Export actions
  const handleExport = () => {
    if (exportAction === "new-tab") {
      const content = includeHeaders
        ? results
            .map((r, i) => `## Chunk ${i + 1}\n\n${r.response || r.error || 'No response'}`)
            .join('\n\n---\n\n')
        : results
            .map((r) => r.response || r.error || 'No response')
            .join('\n\n')

      if (onCreateNewTab) {
        onCreateNewTab(content, `AI Results - ${activeTabName || 'Untitled'}`)
      }
    } else if (exportAction === "append") {
      const content = includeHeaders
        ? results
            .map((r, i) => `\n\n## AI Response ${i + 1}\n\n${r.response || r.error || 'No response'}`)
            .join('\n\n')
        : results
            .map((r) => `\n\n${r.response || r.error || 'No response'}`)
            .join('\n\n')

      if (onAppendToTab) {
        onAppendToTab(content)
      }
    } else if (exportAction === "csv") {
      const csvRows = [
        ['Chunk #', 'Original Text', 'Response', 'Status'],
        ...results.map((r, i) => [
          String(i + 1),
          r.chunk.replace(/"/g, '""'),
          (r.response || r.error || '').replace(/"/g, '""'),
          r.error ? 'Error' : r.isComplete ? 'Complete' : 'Incomplete'
        ])
      ]

      const csvContent = csvRows
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `ai-workbench-results-${Date.now()}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    }
  }

  const handleLoadWorkflow = (id: string) => {
    const workflow = availableWorkflows?.find(w => w.id === id)
    if (!workflow) return

    // Check for unsaved changes
    if (isWorkflowModified) {
      const confirm = window.confirm('You have unsaved changes. Load anyway?')
      if (!confirm) return
    }

    const { body } = parseWorkflowFile(workflow.content)
    setWorkflowScript(body)
    setCurrentWorkflowId(id)
    setIsWorkflowModified(false)

    // Add to recent (max 5)
    setWorkflowRecent(prev => {
      const filtered = prev.filter(wid => wid !== id)
      return [id, ...filtered].slice(0, 5)
    })
  }

  const handleToggleWorkflowFavorite = (id: string) => {
    setWorkflowFavorites(prev => {
      if (prev.includes(id)) {
        return prev.filter(wid => wid !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const handleSaveWorkflow = () => {
    if (!onSaveWorkflow) return

    const rawName = workflowSaveName.trim() || 'Untitled'
    const fileName = rawName.toLowerCase().endsWith('.workflow') ? rawName : `${rawName}.workflow`

    const exists = availableWorkflows?.some(w => w.name === fileName)
    if (exists && !workflowOverwrite) {
      return // User must check overwrite
    }

    const metadata: WorkflowMetadata = {
      name: workflowSaveName.trim() || 'Untitled Workflow',
      category: workflowSaveCategory,
      difficulty: workflowSaveDifficulty,
      tags: workflowSaveTags.split(',').map(t => t.trim()).filter(Boolean),
      description: workflowSaveDescription.trim(),
      use_cases: workflowSaveUseCases.split(',').map(u => u.trim()).filter(Boolean)
    }

    const content = buildWorkflowFile(metadata, workflowScript)
    onSaveWorkflow(fileName, content, workflowSaveFolder || 'Workflows', metadata)

    setShowWorkflowSave(false)
    setWorkflowSaveName('')
    setWorkflowSaveDescription('')
    setWorkflowSaveTags('')
    setWorkflowSaveUseCases('')
    setWorkflowOverwrite(false)
    setIsWorkflowModified(false)
  }

  const handleOpenSaveDialog = () => {
    // Pre-fill with current workflow metadata if editing an existing one
    if (currentWorkflowId && availableWorkflows) {
      const current = availableWorkflows.find(w => w.id === currentWorkflowId)
      if (current) {
        setWorkflowSaveName(current.name)
        setWorkflowSaveCategory(current.metadata.category)
        setWorkflowSaveDifficulty(current.metadata.difficulty)
        setWorkflowSaveTags(current.metadata.tags.join(', '))
        setWorkflowSaveDescription(current.metadata.description)
        setWorkflowSaveUseCases(current.metadata.use_cases.join(', '))
      }
    }
    setShowWorkflowSave(true)
  }

  const handleNewWorkflow = () => {
    // Check for unsaved changes
    if (isWorkflowModified) {
      const confirm = window.confirm('You have unsaved changes. Create new workflow anyway?')
      if (!confirm) return
    }

    setWorkflowScript(NEW_WORKFLOW_TEMPLATE)
    setCurrentWorkflowId(null)
    setIsWorkflowModified(false)
  }

  return (
    <div className={`h-full bg-background border-l flex flex-col ${isDragging ? 'select-none' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Zap size={16} />
          <h3 className="font-semibold text-sm">AI Workbench</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      {/* Split Container: Settings (top) + Results (bottom) */}
            <div ref={containerRef} className="flex-1 min-h-0 flex flex-col">
        <div
          className="p-4 border-b space-y-4 overflow-auto"
          style={{ height: `calc(${(panelRatio * 100).toFixed(2)}% - 2px)` }}
        >
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded border border-border overflow-hidden">
              <button
                className={`px-3 py-1 text-xs font-medium ${mode === 'basic' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted/60'}`}
                onClick={() => setMode('basic')}
              >
                Basic Mode
              </button>
              <button
                className={`px-3 py-1 text-xs font-medium ${mode === 'advanced' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted/60'}`}
                onClick={() => setMode('advanced')}
              >
                Advanced Mode
              </button>
            </div>
          </div>

          {isCsvMode && (
            <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
              <Label className="text-xs font-semibold text-blue-900 dark:text-blue-100">CSV/Table Mode</Label>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Each row will be processed. Use variables in your prompt or workflow:
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {csvHeaders.map(header => (
                  <code key={header} className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">
                    {`{{ ${header} }}`}
                  </code>
                ))}
              </div>
            </div>
          )}

          {isCsvMode && (
            <div className="space-y-2">
              <Label className="text-xs">Process First N Rows (0 = all)</Label>
              <Input
                type="number"
                value={csvRowLimit}
                onChange={(e) => setCsvRowLimit(Number(e.target.value))}
                className="h-8 text-xs"
                min={0}
                placeholder="0 for all rows"
              />
            </div>
          )}

          {!isCsvMode && (
            <div className="space-y-2">
              <Label className="text-xs">Chunk By</Label>
              <Select value={separatorType} onValueChange={(v) => setSeparatorType(v as SeparatorType)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Whole Document)</SelectItem>
                  <SelectItem value="newline">Newline</SelectItem>
                  <SelectItem value="blank-line">Blank Line</SelectItem>
                  <SelectItem value="word">Word Count</SelectItem>
                  <SelectItem value="characters">Character Count
                  </SelectItem>
                  <SelectItem value="custom">Custom Separator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {!isCsvMode && separatorType === "word" && (
            <div className="space-y-2">
              <Label className="text-xs">Words per Chunk</Label>
              <Input
                type="number"
                value={wordCount}
                onChange={(e) => setWordCount(Number(e.target.value))}
                className="h-8 text-xs"
                min={1}
              />
            </div>
          )}

          {!isCsvMode && separatorType === "characters" && (
            <div className="space-y-2">
              <Label className="text-xs">Characters per Chunk</Label>
              <Input
                type="number"
                value={charCount}
                onChange={(e) => setCharCount(Number(e.target.value))}
                className="h-8 text-xs"
                min={1}
              />
            </div>
          )}

          {!isCsvMode && separatorType === "custom" && (
            <div className="space-y-2">
              <Label className="text-xs">Custom Separator
              </Label>
              <Input
                value={customSeparator}
                onChange={(e) => setCustomSeparator(e.target.value)}
                placeholder="Enter separator (e.g., '---')"
                className="h-8 text-xs"
              />
            </div>
          )}

          {mode === 'basic' ? (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Prompt Template</Label>
                <div className="flex items-center gap-2">
                  <select
                    className="h-8 text-xs border border-border rounded bg-background px-2 flex-1"
                    value={selectedPromptIdState}
                    onChange={(e) => handleSelectPrompt(e.target.value)}
                  >
                    <option value="">— Select a saved prompt —</option>
                    {availablePrompts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <Button variant="secondary" size="sm" onClick={() => setSaveOpen(true)}>Save Prompt</Button>
                </div>
              </div>

              {saveOpen && (
                <div className="border border-border rounded p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold">Save Prompt</div>
                    <button className="text-xs" onClick={() => setSaveOpen(false)}>Close</button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="My prompt.prompt"
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Folder</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Prompts"
                        value={saveFolder}
                        onChange={(e) => setSaveFolder(e.target.value)}
                      />
                    </div>
                    {availablePrompts.some((p) => (saveName?.toLowerCase().endsWith('.prompt') ? p.name === saveName : p.name === `${saveName}.prompt`)) && (
                      <label className="flex items-center gap-2 text-xs text-destructive">
                        <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                        A prompt with this name exists. Overwrite?
                      </label>
                    )}
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleSavePrompt} disabled={!saveName.trim() || (availablePrompts.some((p) => (saveName?.toLowerCase().endsWith('.prompt') ? p.name === saveName : p.name === `${saveName}.prompt`)) && !overwrite)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Prompt</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your prompt here..."
                  className="text-xs min-h-[80px]"
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Advanced Settings
                </button>
              </div>

              {showAdvanced && (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Temperature</Label>
                      <span className="text-xs text-muted-foreground">{temperature}</span>
                    </div>
                    <Slider
                      value={[temperature]}
                      onValueChange={(v) => setTemperature(v[0])}
                      min={0}
                      max={2}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Max Tokens</Label>
                    <Input
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                      className="h-8 text-xs"
                      min={1}
                      max={4000}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2">
                {!isProcessing ? (
                  <>
                    {largeData.over && (
                      <div className="mb-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        Large input detected ({largeData.count} chunks, ~{Math.round(largeData.chars/1024)} KB). Consider using Row Limit or coarser chunking for speed.
                      </div>
                    )}
                    <Button onClick={handleRun} className="w-full" size="sm" disabled={!prompt.trim()}>
                      <Play size={14} className="mr-2" />
                      Run on {memoChunks.length} chunk(s)
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="w-full" size="sm">
                    <Square size={14} className="mr-2" />
                    Stop Processing
                  </Button>
                )}
              </div>

              {results.length > 0 && !isProcessing && (
                <div className="pt-4 border-t mt-4 space-y-2">
                  <Label className="text-xs">Export Results</Label>
                  <Select value={exportAction} onValueChange={setExportAction}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new-tab">Create New Tab</SelectItem>
                      <SelectItem value="append">Append to Current Tab</SelectItem>
                      <SelectItem value="csv">Download as CSV</SelectItem>
                    </SelectContent>
                  </Select>

                  {(exportAction === "new-tab" || exportAction === "append") && (
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={includeHeaders}
                        onChange={(e) => setIncludeHeaders(e.target.checked)}
                        className="w-3 h-3"
                      />
                      <span>Include chunk headers</span>
                    </label>
                  )}

                  <Button onClick={handleExport} className="w-full" size="sm" variant="secondary">
                    Export
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {results.filter(r => r.isComplete && !r.error).length} of {results.length} completed
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <WorkflowDropdown
                  workflows={availableWorkflows || []}
                  selectedId={currentWorkflowId}
                  favorites={workflowFavorites}
                  recent={workflowRecent}
                  onSelect={handleLoadWorkflow}
                  onToggleFavorite={handleToggleWorkflowFavorite}
                />
                <Button variant="secondary" size="sm" onClick={() => setShowWorkflowBrowser(true)}>
                  <BookOpen size={14} className="mr-1" />
                  Browse
                </Button>
                <Button variant="secondary" size="sm" onClick={handleNewWorkflow}>
                  <FilePlus size={14} className="mr-1" />
                  New
                </Button>
                <Button variant="secondary" size="sm" onClick={handleOpenSaveDialog}>
                  <Save size={14} className="mr-1" />
                  Save to Project
                </Button>
              </div>

              {isWorkflowModified && (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
                  Unsaved changes
                  {currentWorkflowId && ` (modified from: ${availableWorkflows?.find(w => w.id === currentWorkflowId)?.name})`}
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Define a workflow using YAML. Each chunk or row flows through the nodes in order. Available node types:
                  <code className="mx-1">func</code>, <code className="mx-1">prompt</code>, and <code className="mx-1">print</code>.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditorExpanded(!isEditorExpanded)}
                  className="shrink-0"
                >
                  <Maximize2 size={14} />
                </Button>
              </div>
              <div className="border border-border rounded overflow-hidden">
                <Editor
                  height={isEditorExpanded ? "500px" : "280px"}
                  language="yaml"
                  value={workflowScript}
                  onChange={(value) => setWorkflowScript(value ?? "")}
                  options={{ minimap: { enabled: false }, fontSize: 12, wordWrap: "on" }}
                />
              </div>
              {workflowError && (
                <div className="text-xs text-destructive border border-destructive/40 bg-destructive/10 rounded px-2 py-1">
                  {workflowError}
                </div>
              )}

              {showWorkflowSave && (
                <div className="border border-border rounded p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Save Workflow</div>
                    <button className="text-xs hover:text-primary" onClick={() => setShowWorkflowSave(false)}>Close</button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="My workflow.workflow"
                        value={workflowSaveName}
                        onChange={(e) => setWorkflowSaveName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Category</Label>
                        <Select value={workflowSaveCategory} onValueChange={setWorkflowSaveCategory}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Content Generation">Content Generation</SelectItem>
                            <SelectItem value="Data Processing">Data Processing</SelectItem>
                            <SelectItem value="Analysis">Analysis</SelectItem>
                            <SelectItem value="Multi-step Workflows">Multi-step Workflows</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Difficulty</Label>
                        <Select value={workflowSaveDifficulty} onValueChange={(v: any) => setWorkflowSaveDifficulty(v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        className="h-16 text-xs"
                        placeholder="Brief description of what this workflow does"
                        value={workflowSaveDescription}
                        onChange={(e) => setWorkflowSaveDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Tags (comma-separated)</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="summarization, analysis, etc."
                        value={workflowSaveTags}
                        onChange={(e) => setWorkflowSaveTags(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Use Cases (comma-separated)</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Meeting notes, Report generation, etc."
                        value={workflowSaveUseCases}
                        onChange={(e) => setWorkflowSaveUseCases(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Folder</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Workflows"
                        value={workflowSaveFolder}
                        onChange={(e) => setWorkflowSaveFolder(e.target.value)}
                      />
                    </div>
                    {availableWorkflows?.some(w => {
                      const targetName = workflowSaveName?.toLowerCase().endsWith('.workflow')
                        ? workflowSaveName
                        : `${workflowSaveName}.workflow`
                      return w.name === targetName
                    }) && (
                      <label className="flex items-center gap-2 text-xs text-destructive">
                        <input type="checkbox" checked={workflowOverwrite} onChange={(e) => setWorkflowOverwrite(e.target.checked)} />
                        A workflow with this name exists. Overwrite?
                      </label>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveWorkflow}
                        disabled={!workflowSaveName.trim() || (availableWorkflows?.some(w => {
                          const targetName = workflowSaveName?.toLowerCase().endsWith('.workflow')
                            ? workflowSaveName
                            : `${workflowSaveName}.workflow`
                          return w.name === targetName
                        }) && !workflowOverwrite)}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowWorkflowSave(false)}>Cancel</Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleAdvancedRun} disabled={isAdvancedProcessing}>
                  {isAdvancedProcessing ? 'Running…' : 'Run Workflow'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setWorkflowScript(DEFAULT_WORKFLOW_SCRIPT)}>
                  Reset Example
                </Button>
              </div>
            </div>
          )}
        </div>

        <div
          onMouseDown={onSplitterMouseDown}
          title="Drag to resize"
          className={`relative h-2 cursor-row-resize bg-transparent group ${isDragging ? 'bg-primary/20' : ''}`}
        >
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-border" />
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-16 h-2 rounded-full bg-border group-hover:bg-primary/60" />
        </div>

        <div className="flex-1 overflow-auto">
          {mode === 'basic' ? (
            results.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                Configure settings and click Run to process your document
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-2 font-semibold w-12">#</th>
                    <th className="text-left p-2 font-semibold w-[35%]">Chunk</th>
                    <th className="text-left p-2 font-semibold">Response</th>
                    <th className="text-left p-2 font-semibold w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr
                      key={result.index}
                      className={`border-b ${
                        result.index === currentChunkIndex && isProcessing
                          ? "bg-primary/5"
                          : result.error
                          ? "bg-destructive/5"
                          : ""
                      }`}
                    >
                      <td className="p-2 align-top font-mono">{result.index + 1}</td>
                      <td className="p-2 align-top">
                        <div className="max-h-32 overflow-auto">
                          <pre className="whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                            {result.chunk}
                          </pre>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {result.chunk.length} chars
                        </div>
                      </td>
                      <td className="p-2 align-top">
                        {result.error ? (
                          <div className="text-destructive whitespace-pre-wrap">
                            {result.error}
                          </div>
                        ) : result.response ? (
                          <div className="whitespace-pre-wrap">
                            {result.response}
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic">
                            {result.index === currentChunkIndex && isProcessing
                              ? "Processing..."
                              : "Waiting..."}
                          </div>
                        )}
                      </td>
                      <td className="p-2 align-top">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                            result.error
                              ? "bg-destructive/10 text-destructive"
                              : result.isComplete
                              ? "bg-green-100 text-green-700"
                              : result.index === currentChunkIndex && isProcessing
                              ? "bg-blue-100 text-blue-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {result.error
                            ? "Error"
                            : result.isComplete
                            ? "Complete"
                            : result.index === currentChunkIndex && isProcessing
                            ? "Processing"
                            : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <div className="p-4 space-y-4">
              {workflowLogs.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Logs</h4>
                  <div className="border border-border rounded bg-muted/20 max-h-48 overflow-auto text-[11px] font-mono whitespace-pre-wrap px-2 py-1">
                    {workflowLogs.join('\n')}
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Results</h4>
                {isAdvancedProcessing ? (
                  <div className="text-xs text-muted-foreground">Running workflow...</div>
                ) : workflowResults.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Run the workflow to see results.</div>
                ) : (
                  <table className="w-full text-xs border border-border rounded overflow-hidden">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-2 w-14">Chunk</th>
                        <th className="text-left p-2">Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workflowResults.map((result) => (
                        <tr key={result.index} className="border-t border-border/50 align-top">
                          <td className="p-2 font-mono">{result.index + 1}</td>
                          <td className="p-2">
                            <pre className="text-[11px] font-mono whitespace-pre-wrap bg-muted/40 rounded p-2">
                              {JSON.stringify(result.context, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showWorkflowBrowser && (
        <WorkflowBrowser
          workflows={availableWorkflows || []}
          favorites={workflowFavorites}
          onLoad={handleLoadWorkflow}
          onToggleFavorite={handleToggleWorkflowFavorite}
          onClose={() => setShowWorkflowBrowser(false)}
        />
      )}
    </div>
  )
}
interface WorkflowNode {
  id?: string
  type: string
  prompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  max_tokens?: number
  expect?: string
  append_chunk?: boolean
  system?: string
  expr?: string
  code?: string
  message?: string
  output?: string
  output_key?: string
}

const resolvePath = (obj: Record<string, any>, path: string): any => {
  const parts = path.split('.')
  let current: any = obj
  for (const part of parts) {
    if (current == null) return ''
    current = current[part]
  }
  return current ?? ''
}

const renderTemplate = (template: string, data: Record<string, any>): string => {
  if (!template) return ''
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = resolvePath(data, key)
    if (value == null) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  })
}

const coerceValue = (raw: string): any => {
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1)
  }
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1)
  }
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw === 'null') return null
  if (!Number.isNaN(Number(raw)) && raw !== '') return Number(raw)
  return raw
}

const parseWorkflowScript = (script: string): { nodes: WorkflowNode[] } => {
  const nodes: WorkflowNode[] = []
  let currentNode: Record<string, any> | null = null
  let multilineKey: string | null = null
  let multilineBuffer: string[] = []

  const flushMultiline = () => {
    if (currentNode && multilineKey) {
      currentNode[multilineKey] = multilineBuffer.join('\n')
    }
    multilineKey = null
    multilineBuffer = []
  }

  const lines = script.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '  ')
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (trimmed === 'nodes:' || trimmed === '- nodes:') {
      flushMultiline()
      continue
    }

    if (trimmed.startsWith('- ')) {
      flushMultiline()
      const rest = trimmed.slice(2)
      currentNode = { type: '' } as WorkflowNode
      nodes.push(currentNode as WorkflowNode)
      if (rest.includes(':')) {
        const [key, ...valueParts] = rest.split(':')
        const value = valueParts.join(':').trim()
        if (value === '|') {
          multilineKey = key.trim()
          multilineBuffer = []
        } else {
          currentNode[key.trim()] = coerceValue(value)
        }
      }
      continue
    }

    if (!currentNode) continue

    if (multilineKey) {
      if (line.startsWith('    ') || line.startsWith('  ')) {
        multilineBuffer.push(line.trimStart())
        continue
      } else {
        flushMultiline()
      }
    }

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue
    const key = trimmed.slice(0, colonIndex).trim()
    let value = trimmed.slice(colonIndex + 1).trim()
    if (value === '|') {
      multilineKey = key
      multilineBuffer = []
      continue
    }
    if (value === '') {
      currentNode[key] = ''
    } else {
      currentNode[key] = coerceValue(value)
    }
  }

  flushMultiline()
  return { nodes }
}
