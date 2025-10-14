"use client"

import React, { useState, useEffect, useRef } from 'react'
import { File, Folder, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Tab {
  id: string
  name: string
  content: string
  folderPath?: string
}

interface FolderItem {
  id: string
  name: string
  type: 'folder'
  children: (FileItem | FolderItem)[]
}

interface FileItem {
  id: string
  name: string
  type: 'file'
  tabId: string
}

interface DocumentReferencePickerProps {
  tabs: Tab[]
  folders: (FolderItem | FileItem)[]
  position: { x: number; y: number }
  onSelect: (tabId: string) => void
  onClose: () => void
  currentTabId: string
}

export default function DocumentReferencePicker({
  tabs,
  folders,
  position,
  onSelect,
  onClose,
  currentTabId
}: DocumentReferencePickerProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter tabs (exclude current tab and filter by search)
  const filteredTabs = tabs.filter(tab =>
    tab.id !== currentTabId &&
    tab.name.toLowerCase().includes(search.toLowerCase())
  )

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredTabs.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredTabs[selectedIndex]) {
          onSelect(filteredTabs[selectedIndex].id)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredTabs, selectedIndex, onSelect, onClose])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={containerRef}
      className="fixed bg-background border border-border rounded-lg shadow-xl z-[100] w-80 max-h-96 overflow-hidden flex flex-col"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* Search header */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedIndex(0)
            }}
            className="pl-8 h-8 text-xs"
            autoFocus
          />
        </div>
      </div>

      {/* Document list */}
      <div className="overflow-y-auto flex-1">
        {filteredTabs.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No documents found
          </div>
        ) : (
          <div className="py-1">
            {filteredTabs.map((tab, index) => {
              const folderPath = tab.folderPath || 'Default'

              return (
                <button
                  key={tab.id}
                  onClick={() => onSelect(tab.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                    index === selectedIndex
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <File size={14} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{tab.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {folderPath}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Esc Close</span>
      </div>
    </div>
  )
}
