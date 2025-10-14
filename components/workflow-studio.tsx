"use client"

import React, { useState, useRef, useEffect } from 'react'
import { X, Play, Trash2, Settings, GripVertical, Code2, Boxes, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Maximize2, Minimize2, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Editor } from '@monaco-editor/react'

interface WorkflowNode {
  id: string
  type: 'func' | 'prompt' | 'print'
  position: number
  config: {
    // func
    expr?: string
    // prompt
    prompt?: string
    model?: string
    temperature?: number
    maxTokens?: number
    expect?: string
    output?: string
    system?: string
    // print
    message?: string
  }
}

interface WorkflowStudioProps {
  initialYaml?: string
  onClose: () => void
  onSave: (yaml: string) => void
  onTest: (yaml: string, chunkLimit: number) => Promise<{
    logs: string[]
    results: Array<{ index: number; context: Record<string, any> }>
    error?: string
  }>
}

const NODE_TEMPLATES = {
  func: {
    type: 'func' as const,
    config: {
      expr: 'return { processed: chunk }'
    }
  },
  prompt: {
    type: 'prompt' as const,
    config: {
      prompt: 'Process the following:\n\n{{ chunk }}',
      model: 'gpt-4.1',
      temperature: 0.7,
      maxTokens: 500,
      expect: 'text',
      output: 'result'
    }
  },
  print: {
    type: 'print' as const,
    config: {
      message: 'Result: {{ result }}'
    }
  }
}

export default function WorkflowStudio({ initialYaml, onClose, onSave, onTest }: WorkflowStudioProps) {
  const [view, setView] = useState<'visual' | 'code'>('visual')
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [yamlCode, setYamlCode] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [testChunkLimit, setTestChunkLimit] = useState(3)
  const [draggedType, setDraggedType] = useState<keyof typeof NODE_TEMPLATES | null>(null)
  const [testLogs, setTestLogs] = useState<string[]>([])
  const [testResults, setTestResults] = useState<Array<{ index: number; context: Record<string, any> }>>([])
  const [testError, setTestError] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [hideKeys, setHideKeys] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [expandedField, setExpandedField] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  const selectedNode = nodes.find(n => n.id === selectedNodeId)

  // Get available variables for a given node
  const getAvailableVariables = (nodeId: string): string[] => {
    const builtInVars = ['chunk', 'row', 'data', 'index']
    const nodeIndex = nodes.findIndex(n => n.id === nodeId)
    if (nodeIndex === -1) return builtInVars

    const contextVars: string[] = []
    // Get variables from all previous nodes
    for (let i = 0; i < nodeIndex; i++) {
      const node = nodes[i]
      if (node.type === 'prompt') {
        // Prompt nodes add their output key to context
        contextVars.push(node.config.output || 'result')
      } else if (node.type === 'func') {
        // Func nodes can return multiple keys, so we show the node ID
        // (the actual keys depend on what the func returns)
        contextVars.push(`${node.id}.*`)
      }
    }

    return [...builtInVars, ...contextVars]
  }

  // Parse YAML to nodes
  const parseYamlToNodes = (yaml: string): WorkflowNode[] => {
    try {
      const lines = yaml.split(/\r?\n/)
      const parsedNodes: WorkflowNode[] = []
      let currentNode: any = null
      let multilineKey: string | null = null
      let multilineBuffer: string[] = []

      const flushMultiline = () => {
        if (currentNode && multilineKey) {
          currentNode.config[multilineKey] = multilineBuffer.join('\n')
        }
        multilineKey = null
        multilineBuffer = []
      }

      for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '  ')
        const trimmed = line.trim()

        if (!trimmed || trimmed.startsWith('#')) continue
        if (trimmed === 'nodes:') {
          flushMultiline()
          continue
        }

        if (trimmed.startsWith('- ')) {
          flushMultiline()
          if (currentNode) {
            parsedNodes.push(currentNode)
          }
          currentNode = {
            id: `node-${Date.now()}-${parsedNodes.length}`,
            position: parsedNodes.length,
            type: 'func',
            config: {}
          }

          const rest = trimmed.slice(2)
          if (rest.includes(':')) {
            const [key, ...valueParts] = rest.split(':')
            const value = valueParts.join(':').trim()
            if (key.trim() === 'id') {
              currentNode.id = value.replace(/^["']|["']$/g, '')
            } else if (key.trim() === 'type') {
              currentNode.type = value
            } else if (value === '|') {
              multilineKey = key.trim()
              multilineBuffer = []
            } else {
              currentNode.config[key.trim()] = value.replace(/^["']|["']$/g, '')
            }
          }
          continue
        }

        if (!currentNode) continue

        if (multilineKey) {
          // Check if this line is indented more than the key level (should be at least 6 spaces for prompt content)
          if (line.startsWith('      ')) {
            // Remove the 6-space indentation but preserve any additional indentation
            multilineBuffer.push(line.slice(6))
            continue
          } else if (line.trim() === '' && multilineBuffer.length > 0) {
            // Allow blank lines within multiline content
            multilineBuffer.push('')
            continue
          } else {
            // This line is not part of the multiline content
            flushMultiline()
          }
        }

        const colonIndex = trimmed.indexOf(':')
        if (colonIndex === -1) continue

        const key = trimmed.slice(0, colonIndex).trim()
        const value = trimmed.slice(colonIndex + 1).trim()

        if (key === 'id') {
          currentNode.id = value.replace(/^["']|["']$/g, '')
        } else if (key === 'type') {
          currentNode.type = value
        } else if (value === '|') {
          multilineKey = key
          multilineBuffer = []
        } else if (value) {
          // Handle numeric values
          if (key === 'temperature' || key === 'max_tokens' || key === 'maxTokens') {
            currentNode.config[key === 'max_tokens' ? 'maxTokens' : key] = Number(value)
          } else {
            currentNode.config[key] = value.replace(/^["']|["']$/g, '')
          }
        }
      }

      flushMultiline()
      if (currentNode) {
        parsedNodes.push(currentNode)
      }

      return parsedNodes
    } catch (err) {
      console.error('Failed to parse YAML:', err)
      return []
    }
  }

  // Initialize from initialYaml
  useEffect(() => {
    if (initialYaml) {
      const parsed = parseYamlToNodes(initialYaml)
      setNodes(parsed)
      setYamlCode(initialYaml)
    }
  }, [initialYaml])

  // Sync visual to code when nodes change
  useEffect(() => {
    if (view === 'visual' && nodes.length > 0) {
      setYamlCode(generateYaml())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, view])

  const handleDragStart = (type: keyof typeof NODE_TEMPLATES) => {
    setDraggedType(type)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedType) return

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      position: nodes.length,
      ...NODE_TEMPLATES[draggedType]
    }

    setNodes([...nodes, newNode])
    setDraggedType(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const updateNodeConfig = (nodeId: string, config: Partial<WorkflowNode['config']>) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n))
  }

  const updateNodeId = (oldId: string, newId: string) => {
    if (!newId.trim() || oldId === newId) return
    // Check for duplicate IDs
    if (nodes.some(n => n.id !== oldId && n.id === newId)) {
      alert('A node with this ID already exists')
      return
    }
    setNodes(nodes.map(n => n.id === oldId ? { ...n, id: newId } : n))
    if (selectedNodeId === oldId) {
      setSelectedNodeId(newId)
    }
  }

  const deleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId))
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null)
    }
  }

  const moveNode = (nodeId: string, direction: 'up' | 'down') => {
    const index = nodes.findIndex(n => n.id === nodeId)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === nodes.length - 1) return

    const newNodes = [...nodes]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newNodes[index], newNodes[targetIndex]] = [newNodes[targetIndex], newNodes[index]]

    // Update positions
    newNodes.forEach((n, i) => n.position = i)
    setNodes(newNodes)
  }

  const generateYaml = (): string => {
    const lines = ['nodes:']

    nodes.forEach((node, idx) => {
      lines.push(`  - id: ${node.id}`)
      lines.push(`    type: ${node.type}`)

      if (node.type === 'func') {
        lines.push(`    expr: |`)
        const exprLines = (node.config.expr || '').split('\n')
        exprLines.forEach(line => lines.push(`      ${line}`))
      } else if (node.type === 'prompt') {
        lines.push(`    prompt: |`)
        const promptLines = (node.config.prompt || '').split('\n')
        promptLines.forEach(line => lines.push(`      ${line}`))
        lines.push(`    output: ${node.config.output || 'result'}`)
        if (node.config.model) lines.push(`    model: ${node.config.model}`)
        if (node.config.temperature !== undefined) lines.push(`    temperature: ${node.config.temperature}`)
        if (node.config.maxTokens) lines.push(`    max_tokens: ${node.config.maxTokens}`)
        if (node.config.expect) lines.push(`    expect: ${node.config.expect}`)
        if (node.config.system) {
          lines.push(`    system: |`)
          const systemLines = node.config.system.split('\n')
          systemLines.forEach(line => lines.push(`      ${line}`))
        }
      } else if (node.type === 'print') {
        lines.push(`    message: "${node.config.message || ''}"`)
      }

      if (idx < nodes.length - 1) lines.push('')
    })

    return lines.join('\n')
  }

  const handleViewSwitch = (newView: 'visual' | 'code') => {
    if (newView === 'code' && view === 'visual') {
      // Switching to code view - generate YAML from nodes
      setYamlCode(generateYaml())
    } else if (newView === 'visual' && view === 'code') {
      // Switching to visual view - parse YAML to nodes
      const parsed = parseYamlToNodes(yamlCode)
      setNodes(parsed)
    }
    setView(newView)
  }

  const handleYamlChange = (value: string | undefined) => {
    if (value !== undefined) {
      setYamlCode(value)
    }
  }

  const handleSave = () => {
    const yaml = view === 'visual' ? generateYaml() : yamlCode
    onSave(yaml)
    onClose()
  }

  const handleTest = async () => {
    const yaml = view === 'visual' ? generateYaml() : yamlCode
    setIsTesting(true)
    setTestError(null)
    setTestLogs([])
    setTestResults([])
    setShowResults(true)

    try {
      const result = await onTest(yaml, testChunkLimit)
      setTestLogs(result.logs || [])
      setTestResults(result.results || [])
      setTestError(result.error || null)
    } catch (err: any) {
      setTestError(err?.message || 'Test failed')
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        ref={modalRef}
        className={`bg-background border border-border rounded-lg shadow-xl flex flex-col resize overflow-auto ${
          isFullscreen ? 'w-full h-full' : 'w-full max-w-7xl h-[90vh]'
        }`}
        style={isFullscreen ? {} : { resize: 'both', minWidth: '800px', minHeight: '600px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold">Workflow Studio (Beta)</h2>
              <p className="text-xs text-muted-foreground">
                {view === 'visual' ? 'Drag nodes to canvas to build your workflow' : 'Edit YAML workflow definition'}
              </p>
            </div>

            {/* View Toggle */}
            <div className="inline-flex rounded border border-border overflow-hidden">
              <button
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${
                  view === 'visual'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/60'
                }`}
                onClick={() => handleViewSwitch('visual')}
              >
                <Boxes size={14} />
                Visual
              </button>
              <button
                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${
                  view === 'code'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted/60'
                }`}
                onClick={() => handleViewSwitch('code')}
              >
                <Code2 size={14} />
                Code
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-4">
              <Label className="text-xs">Test with</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={testChunkLimit}
                onChange={(e) => setTestChunkLimit(Number(e.target.value))}
                className="w-16 h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">chunks</span>
            </div>
            <Button size="sm" variant="outline" onClick={handleTest} disabled={view === 'visual' && nodes.length === 0}>
              <Play size={14} className="mr-1" />
              Test
            </Button>
            <Button size="sm" onClick={handleSave} disabled={view === 'visual' && nodes.length === 0}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          {view === 'visual' ? (
            <>
              {/* Node Palette */}
              <div className="w-56 border-r p-4 space-y-3 overflow-auto">
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              Node Types
            </div>

            <div
              draggable
              onDragStart={() => handleDragStart('func')}
              className="p-3 border border-border rounded bg-card hover:bg-muted cursor-move transition"
            >
              <div className="text-sm font-medium mb-1">Function</div>
              <div className="text-xs text-muted-foreground">Execute JavaScript code</div>
            </div>

            <div
              draggable
              onDragStart={() => handleDragStart('prompt')}
              className="p-3 border border-border rounded bg-card hover:bg-muted cursor-move transition"
            >
              <div className="text-sm font-medium mb-1">Prompt</div>
              <div className="text-xs text-muted-foreground">Call AI model with prompt</div>
            </div>

            <div
              draggable
              onDragStart={() => handleDragStart('print')}
              className="p-3 border border-border rounded bg-card hover:bg-muted cursor-move transition"
            >
              <div className="text-sm font-medium mb-1">Print</div>
              <div className="text-xs text-muted-foreground">Log a message</div>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 flex">
            <div
              ref={canvasRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="flex-1 p-6 overflow-auto bg-muted/20"
            >
              {nodes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center">
                  <div className="text-muted-foreground">
                    <div className="text-sm mb-2">Drop nodes here to build your workflow</div>
                    <div className="text-xs">Nodes execute in order from top to bottom</div>
                  </div>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-4">
                  {nodes.map((node, idx) => (
                    <div key={node.id}>
                      <div
                        onClick={() => setSelectedNodeId(node.id)}
                        className={`p-4 border-2 rounded-lg bg-background cursor-pointer transition ${
                          selectedNodeId === node.id
                            ? 'border-blue-500 shadow-lg'
                            : 'border-border hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col gap-0.5 pt-1">
                            {idx > 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  moveNode(node.id, 'up')
                                }}
                                className="p-1 hover:bg-muted rounded transition-colors"
                                title="Move up"
                              >
                                <ArrowUp size={14} />
                              </button>
                            ) : (
                              <div className="p-1 opacity-0">
                                <ArrowUp size={14} />
                              </div>
                            )}
                            {idx < nodes.length - 1 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  moveNode(node.id, 'down')
                                }}
                                className="p-1 hover:bg-muted rounded transition-colors"
                                title="Move down"
                              >
                                <ArrowDown size={14} />
                              </button>
                            ) : (
                              <div className="p-1 opacity-0">
                                <ArrowDown size={14} />
                              </div>
                            )}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`px-2 py-0.5 rounded text-xs font-medium ${
                                node.type === 'func' ? 'bg-purple-100 text-purple-700' :
                                node.type === 'prompt' ? 'bg-blue-100 text-blue-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {node.type}
                              </div>
                              <span className="text-xs text-muted-foreground">node{idx + 1}</span>
                            </div>

                            <div className="text-sm">
                              {node.type === 'func' && (
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {(node.config.expr || '').split('\n')[0]}...
                                </code>
                              )}
                              {node.type === 'prompt' && (
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {node.config.prompt}
                                </div>
                              )}
                              {node.type === 'print' && (
                                <div className="text-xs text-muted-foreground">
                                  {node.config.message}
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteNode(node.id)
                            }}
                            className="p-2 hover:bg-destructive/10 text-destructive rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {idx < nodes.length - 1 && (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <div className="text-muted-foreground">↓</div>
                          {(node.type === 'prompt' || node.type === 'func') && (
                            <code className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                              {node.type === 'prompt'
                                ? (node.config.output || 'result')
                                : node.id
                              }
                            </code>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Configuration Panel */}
            {selectedNode && (
              <div className="w-96 border-l p-4 overflow-auto bg-background">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings size={16} />
                    <h3 className="text-sm font-semibold">Node Configuration</h3>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedNodeId(null)}
                  >
                    <X size={14} />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-xs mb-2">Node ID</Label>
                    <Input
                      value={selectedNode.id}
                      onChange={(e) => updateNodeId(selectedNode.id, e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="node_id"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Used to reference this node's output in other nodes
                    </p>
                  </div>

                  {/* Available Variables Card */}
                  <div className="border border-border rounded-lg p-3 bg-muted/30">
                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground">Available Variables</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {getAvailableVariables(selectedNode.id).map((variable) => (
                        <code
                          key={variable}
                          className="text-[10px] px-2 py-1 bg-background border border-border rounded font-mono"
                        >
                          {`{{ ${variable} }}`}
                        </code>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use these variables in templates with {`{{ }}`} syntax
                    </p>
                  </div>

                  {selectedNode.type === 'func' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs">JavaScript Expression</Label>
                        <button
                          onClick={() => setExpandedField(expandedField === 'func-expr' ? null : 'func-expr')}
                          className="p-1 hover:bg-muted rounded"
                          title="Expand editor"
                        >
                          <Maximize size={12} />
                        </button>
                      </div>
                      <Textarea
                        value={selectedNode.config.expr || ''}
                        onChange={(e) => updateNodeConfig(selectedNode.id, { expr: e.target.value })}
                        placeholder="return { result: chunk.toUpperCase() }"
                        className={`font-mono text-xs ${expandedField === 'func-expr' ? 'h-96' : 'h-48'}`}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Must return an object. Keys become available as variables. Example: {`return { animals: "cats, dogs" }`}. Return {`{ skip: true }`} to skip this row.
                      </p>
                    </div>
                  )}

                  {selectedNode.type === 'prompt' && (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs">Prompt Template</Label>
                          <button
                            onClick={() => setExpandedField(expandedField === 'prompt-template' ? null : 'prompt-template')}
                            className="p-1 hover:bg-muted rounded"
                            title="Expand editor"
                          >
                            <Maximize size={12} />
                          </button>
                        </div>
                        <Textarea
                          value={selectedNode.config.prompt || ''}
                          onChange={(e) => updateNodeConfig(selectedNode.id, { prompt: e.target.value })}
                          placeholder="Process the following:\n\n{{ chunk }}"
                          className={`text-xs ${expandedField === 'prompt-template' ? 'h-96' : 'h-32'}`}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Use {`{{ key }}`} for variable interpolation
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs mb-2">Model</Label>
                        <Select
                          value={selectedNode.config.model || 'gpt-4.1'}
                          onValueChange={(v) => updateNodeConfig(selectedNode.id, { model: v })}
                        >
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

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs mb-2">Temperature</Label>
                          <Input
                            type="number"
                            min={0}
                            max={2}
                            step={0.1}
                            value={selectedNode.config.temperature || 0.7}
                            onChange={(e) => updateNodeConfig(selectedNode.id, { temperature: Number(e.target.value) })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Max Tokens</Label>
                          <Input
                            type="number"
                            min={1}
                            value={selectedNode.config.maxTokens || 500}
                            onChange={(e) => updateNodeConfig(selectedNode.id, { maxTokens: Number(e.target.value) })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs mb-2">Expect</Label>
                          <Select
                            value={selectedNode.config.expect || 'text'}
                            onValueChange={(v) => updateNodeConfig(selectedNode.id, { expect: v })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="json">JSON</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs mb-2">Output Key</Label>
                          <Input
                            value={selectedNode.config.output || 'result'}
                            onChange={(e) => updateNodeConfig(selectedNode.id, { output: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs">System Prompt (Optional)</Label>
                          <button
                            onClick={() => setExpandedField(expandedField === 'system-prompt' ? null : 'system-prompt')}
                            className="p-1 hover:bg-muted rounded"
                            title="Expand editor"
                          >
                            <Maximize size={12} />
                          </button>
                        </div>
                        <Textarea
                          value={selectedNode.config.system || ''}
                          onChange={(e) => updateNodeConfig(selectedNode.id, { system: e.target.value })}
                          placeholder="You are a helpful assistant..."
                          className={`text-xs ${expandedField === 'system-prompt' ? 'h-96' : 'h-24'}`}
                        />
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'print' && (
                    <div>
                      <Label className="text-xs mb-2">Message</Label>
                      <Input
                        value={selectedNode.config.message || ''}
                        onChange={(e) => updateNodeConfig(selectedNode.id, { message: e.target.value })}
                        placeholder="Result: {{ result }}"
                        className="h-8 text-xs"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use {`{{ key }}`} for variable interpolation
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
            </>
          ) : (
            <div className="flex-1 p-4 flex flex-col">
              <div className="flex-1 border border-border rounded overflow-hidden">
                <Editor
                  height="100%"
                  language="yaml"
                  value={yamlCode}
                  onChange={handleYamlChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Test Results Panel */}
        {showResults && (
          <div className="border-t">
            <button
              onClick={() => setShowResults(!showResults)}
              className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>Test Results</span>
                {isTesting && <span className="text-xs text-muted-foreground">(Running...)</span>}
                {!isTesting && testResults.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({testResults.length} chunk{testResults.length !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
              {showResults ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showResults && (
              <div className="max-h-80 overflow-auto border-t bg-muted/20">
                {testError && (
                  <div className="p-4">
                    <div className="text-xs text-destructive border border-destructive/40 bg-destructive/10 rounded px-2 py-1">
                      {testError}
                    </div>
                  </div>
                )}

                {!isTesting && testLogs.length > 0 && (
                  <div className="p-4 border-b">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Logs</h4>
                    <div className="border border-border rounded bg-background max-h-32 overflow-auto text-[11px] font-mono whitespace-pre-wrap px-2 py-1">
                      {testLogs.join('\n')}
                    </div>
                  </div>
                )}

                {!isTesting && testResults.length > 0 && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Results</h4>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={hideKeys}
                          onChange={(e) => setHideKeys(e.target.checked)}
                          className="rounded"
                        />
                        <span>Show values only</span>
                      </label>
                    </div>
                    <table className="w-full text-xs border border-border rounded overflow-hidden">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 w-14">Chunk</th>
                          <th className="text-left p-2">Context</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testResults.map((result) => {
                          let displayContent: string
                          if (hideKeys) {
                            // Show only values, one per line
                            const values = Object.entries(result.context)
                              .filter(([key]) => key !== 'chunk' && key !== 'row' && key !== 'data' && key !== 'index')
                              .map(([_, value]) => typeof value === 'string' ? value : JSON.stringify(value, null, 2))
                            displayContent = values.join('\n')
                          } else {
                            // Show full JSON
                            displayContent = JSON.stringify(result.context, null, 2)
                          }

                          return (
                            <tr key={result.index} className="border-t border-border/50 align-top">
                              <td className="p-2 font-mono">{result.index + 1}</td>
                              <td className="p-2">
                                <pre className="text-[11px] font-mono whitespace-pre-wrap bg-muted/40 rounded p-2 max-h-48 overflow-auto">
                                  {displayContent}
                                </pre>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {isTesting && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Running test...
                  </div>
                )}

                {!isTesting && !testError && testResults.length === 0 && testLogs.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No results yet. Click Test to run the workflow.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
