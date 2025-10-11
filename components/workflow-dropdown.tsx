"use client"

import React, { useState, useMemo } from 'react'
import { ChevronDown, Star, Clock, Search, FolderOpen } from 'lucide-react'
import { Workflow } from '@/lib/workflow-types'

interface WorkflowDropdownProps {
  workflows: Workflow[]
  selectedId: string | null
  favorites: string[]
  recent: string[]
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
}

export default function WorkflowDropdown({
  workflows,
  selectedId,
  favorites,
  recent,
  onSelect,
  onToggleFavorite
}: WorkflowDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedWorkflow = workflows.find(w => w.id === selectedId)

  const filteredWorkflows = useMemo(() => {
    if (!search) return workflows
    const lower = search.toLowerCase()
    return workflows.filter(w =>
      w.name.toLowerCase().includes(lower) ||
      w.metadata.category.toLowerCase().includes(lower) ||
      w.metadata.tags.some(t => t.toLowerCase().includes(lower))
    )
  }, [workflows, search])

  const favoriteWorkflows = useMemo(() => {
    return workflows.filter(w => favorites.includes(w.id))
  }, [workflows, favorites])

  const recentWorkflows = useMemo(() => {
    return recent
      .map(id => workflows.find(w => w.id === id))
      .filter(Boolean) as Workflow[]
  }, [workflows, recent])

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, Workflow[]> = {}
    for (const workflow of filteredWorkflows) {
      const cat = workflow.metadata.category
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(workflow)
    }
    return groups
  }, [filteredWorkflows])

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-600 bg-green-50'
      case 'intermediate': return 'text-orange-600 bg-orange-50'
      case 'advanced': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm border border-border rounded bg-background hover:bg-muted"
      >
        <span className="flex-1 text-left truncate">
          {selectedWorkflow ? selectedWorkflow.name : 'Select workflow...'}
        </span>
        <ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded shadow-lg z-50 max-h-[500px] overflow-auto w-[480px]">
            <div className="p-2 border-b sticky top-0 bg-background">
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {!search && favoriteWorkflows.length > 0 && (
              <div className="border-b">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Star size={12} />
                  Favorites
                </div>
                {favoriteWorkflows.map(workflow => (
                  <button
                    key={workflow.id}
                    onClick={() => {
                      onSelect(workflow.id)
                      setIsOpen(false)
                    }}
                    className="w-full px-3 py-3 text-left hover:bg-muted flex items-start gap-2 border-b border-border/50 last:border-b-0"
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${getDifficultyColor(workflow.metadata.difficulty)}`}>
                      {workflow.metadata.difficulty[0].toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium mb-0.5">{workflow.name}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{workflow.metadata.description}</div>
                    </div>
                    <Star
                      size={12}
                      className="fill-yellow-400 text-yellow-400 shrink-0 mt-0.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleFavorite(workflow.id)
                      }}
                    />
                  </button>
                ))}
              </div>
            )}

            {!search && recentWorkflows.length > 0 && (
              <div className="border-b">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Clock size={12} />
                  Recent
                </div>
                {recentWorkflows.map(workflow => (
                  <button
                    key={workflow.id}
                    onClick={() => {
                      onSelect(workflow.id)
                      setIsOpen(false)
                    }}
                    className="w-full px-3 py-3 text-left hover:bg-muted flex items-start gap-2 border-b border-border/50 last:border-b-0"
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${getDifficultyColor(workflow.metadata.difficulty)}`}>
                      {workflow.metadata.difficulty[0].toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium mb-0.5">{workflow.name}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{workflow.metadata.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {Object.entries(groupedByCategory).map(([category, categoryWorkflows]) => (
              <div key={category} className="border-b last:border-b-0">
                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <FolderOpen size={12} />
                  {category}
                </div>
                {categoryWorkflows.map(workflow => (
                  <button
                    key={workflow.id}
                    onClick={() => {
                      onSelect(workflow.id)
                      setIsOpen(false)
                    }}
                    className="w-full px-3 py-3 text-left hover:bg-muted flex items-start gap-2 border-b border-border/50 last:border-b-0"
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${getDifficultyColor(workflow.metadata.difficulty)}`}>
                      {workflow.metadata.difficulty[0].toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium mb-0.5">{workflow.name}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{workflow.metadata.description}</div>
                    </div>
                    <Star
                      size={12}
                      className={favorites.includes(workflow.id) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleFavorite(workflow.id)
                      }}
                    />
                  </button>
                ))}
              </div>
            ))}

            {filteredWorkflows.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                No workflows found
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
