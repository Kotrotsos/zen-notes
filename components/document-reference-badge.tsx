"use client"

import React, { useState } from 'react'
import { FileText, ExternalLink, Edit3, Eye, FileInput } from 'lucide-react'
import { DisplayMode } from '@/lib/document-references'

interface DocumentReferenceBadgeProps {
  tabId: string
  tabName: string
  displayMode: DisplayMode
  onJump: () => void
  onEdit: () => void
  onChangeMode: (mode: DisplayMode) => void
  onImport: () => void
}

export default function DocumentReferenceBadge({
  tabId,
  tabName,
  displayMode,
  onJump,
  onEdit,
  onChangeMode,
  onImport
}: DocumentReferenceBadgeProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <span
      className="inline-flex items-center relative group"
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      <span
        onClick={onJump}
        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
        title={`Reference: ${tabName}`}
      >
        <FileText size={12} />
        <span>@{tabName}</span>
      </span>

      {/* Hover menu */}
      {showMenu && (
        <div className="absolute left-0 top-full mt-1 bg-background border border-border rounded shadow-lg z-50 flex items-center gap-1 p-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onJump()
            }}
            className="p-1.5 hover:bg-muted rounded"
            title="Jump to document"
          >
            <ExternalLink size={14} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-1.5 hover:bg-muted rounded"
            title="Edit reference"
          >
            <Edit3 size={14} />
          </button>

          <div className="relative group/display">
            <button
              className="p-1.5 hover:bg-muted rounded"
              title="Change display mode"
            >
              <Eye size={14} />
            </button>

            {/* Display mode submenu */}
            <div className="absolute left-full top-0 ml-1 bg-background border border-border rounded shadow-lg hidden group-hover/display:block whitespace-nowrap">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onChangeMode('reference')
                }}
                className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-muted ${
                  displayMode === 'reference' ? 'bg-muted font-medium' : ''
                }`}
              >
                Reference only
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onChangeMode('paragraph')
                }}
                className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-muted ${
                  displayMode === 'paragraph' ? 'bg-muted font-medium' : ''
                }`}
              >
                First paragraph
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onChangeMode('full')
                }}
                className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-muted ${
                  displayMode === 'full' ? 'bg-muted font-medium' : ''
                }`}
              >
                Full document
              </button>
            </div>
          </div>

          <div className="w-px h-4 bg-border" />

          <button
            onClick={(e) => {
              e.stopPropagation()
              onImport()
            }}
            className="p-1.5 hover:bg-muted rounded"
            title="Import (replace with content)"
          >
            <FileInput size={14} />
          </button>
        </div>
      )}
    </span>
  )
}
