"use client"

import React, { useState, useMemo } from 'react'
import { X, Star, FolderOpen, Tag, Code, ChevronDown, ChevronRight, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Workflow } from '@/lib/workflow-types'

interface WorkflowBrowserProps {
  workflows: Workflow[]
  favorites: string[]
  onLoad: (id: string) => void
  onToggleFavorite: (id: string) => void
  onClose: () => void
}

export default function WorkflowBrowser({
  workflows,
  favorites,
  onLoad,
  onToggleFavorite,
  onClose
}: WorkflowBrowserProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const categories = useMemo(() => {
    const cats = new Set(workflows.map(w => w.metadata.category))
    return ['all', ...Array.from(cats).sort()]
  }, [workflows])

  const filteredWorkflows = useMemo(() => {
    let filtered = workflows

    if (search) {
      const lower = search.toLowerCase()
      filtered = filtered.filter(w =>
        w.name.toLowerCase().includes(lower) ||
        w.metadata.description.toLowerCase().includes(lower) ||
        w.metadata.tags.some(t => t.toLowerCase().includes(lower))
      )
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(w => w.metadata.category === categoryFilter)
    }

    if (difficultyFilter !== 'all') {
      filtered = filtered.filter(w => w.metadata.difficulty === difficultyFilter)
    }

    return filtered
  }, [workflows, search, categoryFilter, difficultyFilter])

  const groupedByDifficulty = useMemo(() => {
    const groups: Record<string, Record<string, Workflow[]>> = {
      beginner: {},
      intermediate: {},
      advanced: {}
    }

    for (const workflow of filteredWorkflows) {
      const diff = workflow.metadata.difficulty
      const cat = workflow.metadata.category
      if (!groups[diff][cat]) groups[diff][cat] = []
      groups[diff][cat].push(workflow)
    }

    return groups
  }, [filteredWorkflows])

  const toggleCategory = (key: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedCategories(newExpanded)
  }

  const getDifficultyIcon = (difficulty: string) => {
    return null // Placeholder, icons inline below
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-50 border-green-200'
      case 'intermediate': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'advanced': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-[90vw] h-[80vh] max-w-6xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-lg font-semibold">Workflow Cookbook</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 h-9 text-sm">
              <Filter size={14} className="mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-48 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar - category tree */}
          <div className="w-64 border-r overflow-auto">
            <div className="p-2">
              {Object.entries(groupedByDifficulty).map(([difficulty, categories]) => {
                const hasWorkflows = Object.keys(categories).length > 0
                if (!hasWorkflows) return null

                return (
                  <div key={difficulty} className="mb-2">
                    <button
                      onClick={() => toggleCategory(difficulty)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium hover:bg-muted rounded"
                    >
                      {expandedCategories.has(difficulty) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getDifficultyColor(difficulty)}`}>
                        {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                      </span>
                    </button>
                    {expandedCategories.has(difficulty) && (
                      <div className="ml-4 mt-1 space-y-1">
                        {Object.entries(categories).map(([category, workflows]) => (
                          <div key={category}>
                            <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                              <FolderOpen size={12} />
                              <span>{category}</span>
                              <span className="ml-auto text-[10px]">({workflows.length})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right content - workflow details */}
          <div className="flex-1 overflow-auto p-4">
            {selectedWorkflow ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{selectedWorkflow.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold border ${getDifficultyColor(selectedWorkflow.metadata.difficulty)}`}>
                        {selectedWorkflow.metadata.difficulty}
                      </span>
                      <span className="text-sm text-muted-foreground">{selectedWorkflow.metadata.category}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleFavorite(selectedWorkflow.id)}
                  >
                    <Star
                      size={16}
                      className={favorites.includes(selectedWorkflow.id) ? 'fill-yellow-400 text-yellow-400' : ''}
                    />
                  </Button>
                </div>

                <p className="text-sm">{selectedWorkflow.metadata.description}</p>

                {selectedWorkflow.metadata.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag size={14} className="text-muted-foreground" />
                    {selectedWorkflow.metadata.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-muted rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {selectedWorkflow.metadata.use_cases.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Use Cases:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {selectedWorkflow.metadata.use_cases.map((uc, i) => (
                        <li key={i}>{uc}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-2 text-sm font-semibold hover:text-primary"
                  >
                    <Code size={14} />
                    {showPreview ? 'Hide' : 'Show'} Code Preview
                    {showPreview ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {showPreview && (
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-64 font-mono">
                      {selectedWorkflow.content}
                    </pre>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={() => {
                      onLoad(selectedWorkflow.id)
                      onClose()
                    }}
                  >
                    Load Workflow
                  </Button>
                  <Button variant="secondary" onClick={() => setSelectedWorkflow(null)}>
                    Back to List
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredWorkflows.map(workflow => (
                  <button
                    key={workflow.id}
                    onClick={() => setSelectedWorkflow(workflow)}
                    className="border border-border rounded p-3 text-left hover:border-primary hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm">{workflow.name}</h4>
                      <Star
                        size={14}
                        className={favorites.includes(workflow.id) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleFavorite(workflow.id)
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getDifficultyColor(workflow.metadata.difficulty)}`}>
                        {workflow.metadata.difficulty}
                      </span>
                      <span className="text-xs text-muted-foreground">{workflow.metadata.category}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {workflow.metadata.description}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {filteredWorkflows.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No workflows found matching your criteria
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
