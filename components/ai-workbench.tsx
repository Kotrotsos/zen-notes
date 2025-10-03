"use client"

import React, { useState, useRef, useEffect } from "react"
import { X, Play, Square, ChevronDown, ChevronUp, Zap, FilePlus, FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { parseCsv, isValidCsv } from "@/lib/csv"

interface AIWorkbenchProps {
  activeTabContent: string
  activeTabName?: string
  onClose: () => void
  onCreateNewTab?: (content: string, name: string) => void
  onAppendToTab?: (content: string) => void
  availablePrompts?: Array<{ id: string; name: string; content: string; folderPath?: string }>
  onSavePrompt?: (name: string, content: string, folderPath?: string) => void
  selectedPromptId?: string
}

type SeparatorType = "none" | "newline" | "blank-line" | "word" | "characters" | "custom"

interface ChunkResult {
  index: number
  chunk: string
  response: string
  isComplete: boolean
  error?: string
}

export default function AIWorkbench({ activeTabContent, activeTabName, onClose, onCreateNewTab, onAppendToTab, availablePrompts = [], onSavePrompt, selectedPromptId }: AIWorkbenchProps) {
  // Settings
  const [model, setModel] = useState("gpt-4.1")
  const [prompt, setPrompt] = useState("Summarize the following text:")
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(500)
  const [showAdvanced, setShowAdvanced] = useState(false)
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

  // Process a single chunk
  const processChunk = async (chunk: string, index: number) => {
    try {
      // For CSV mode, parse the row and interpolate variables
      let actualChunk = chunk
      let actualPrompt = prompt

      if (isCsvMode) {
        try {
          const rowData = JSON.parse(chunk)
          actualPrompt = interpolatePrompt(prompt, rowData)
          actualChunk = Object.entries(rowData)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n')
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

  // Process all chunks sequentially
  const handleRun = async () => {
    const chunksToProcess = createChunks(activeTabContent)

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
    setCurrentChunkIndex(0)

    abortControllerRef.current = new AbortController()

    for (let i = 0; i < chunksToProcess.length; i++) {
      if (abortControllerRef.current.signal.aborted) break
      setCurrentChunkIndex(i)
      await processChunk(chunksToProcess[i], i)
    }

    setIsProcessing(false)
    setCurrentChunkIndex(0)
  }

  // Stop processing
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsProcessing(false)
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
        {/* Settings Panel */}
        <div
          className="p-4 border-b space-y-4 overflow-auto"
          style={{ height: `calc(${(panelRatio * 100).toFixed(2)}% - 2px)` }}
        >
        {/* Prompt Selection + Save */}
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

        {/* Save Prompt Dialog */}
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

        {/* Model Selection */}
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

        {/* Prompt */}
        <div className="space-y-2">
          <Label className="text-xs">Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="text-xs min-h-[80px]"
          />
        </div>

        {/* CSV Mode Info */}
        {isCsvMode && (
          <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <Label className="text-xs font-semibold text-blue-900 dark:text-blue-100">CSV/Table Mode</Label>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Each row will be processed. Use variables in your prompt:
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

        {/* Row Limit (CSV only) */}
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

        {/* Separator Type (only for non-CSV) */}
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
                <SelectItem value="characters">Character Count</SelectItem>
                <SelectItem value="custom">Custom Separator</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Conditional separator inputs (only for non-CSV) */}
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
            <Label className="text-xs">Custom Separator</Label>
            <Input
              value={customSeparator}
              onChange={(e) => setCustomSeparator(e.target.value)}
              placeholder="Enter separator (e.g., '---')"
              className="h-8 text-xs"
            />
          </div>
        )}

        {/* Advanced Settings Toggle */}
        <div className="pt-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Advanced Settings
          </button>
        </div>

        {/* Advanced Settings */}
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

        {/* Run/Stop Button */}
        <div className="pt-2">
          {!isProcessing ? (
            <Button onClick={handleRun} className="w-full" size="sm" disabled={!prompt.trim()}>
              <Play size={14} className="mr-2" />
              Run on {createChunks(activeTabContent).length} chunk(s)
            </Button>
          ) : (
            <Button onClick={handleStop} variant="destructive" className="w-full" size="sm">
              <Square size={14} className="mr-2" />
              Stop Processing
            </Button>
          )}
        </div>

        {/* Export Actions - Show after processing */}
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
        </div>

        {/* Divider */}
        <div
          onMouseDown={onSplitterMouseDown}
          title="Drag to resize"
          className={`relative h-2 cursor-row-resize bg-transparent group ${isDragging ? 'bg-primary/20' : ''}`}
        >
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-border" />
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-16 h-2 rounded-full bg-border group-hover:bg-primary/60" />
        </div>

        {/* Results Panel */}
        <div className="flex-1 overflow-auto">
          {results.length === 0 ? (
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
        )}
        </div>
      </div>
    </div>
  )
}
