// Document reference system for @-mentions

export type DisplayMode = 'reference' | 'paragraph' | 'full'

export interface DocumentReference {
  id: string // unique reference id
  targetTabId: string // referenced tab/document ID
  displayMode: DisplayMode
  position: number // character position in document
}

export interface Tab {
  id: string
  name: string
  content: string
  folderPath?: string
  view?: 'text' | 'table'
  isOpen?: boolean
  references?: DocumentReference[]
}

/**
 * Parse @-references from document content
 * Format: @[tabId:displayMode] or @[tabId] (default to 'reference')
 */
export function parseReferences(content: string): DocumentReference[] {
  const references: DocumentReference[] = []
  const regex = /@\[([^\]]+)\]/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    const parts = match[1].split(':')
    const targetTabId = parts[0]
    const displayMode = (parts[1] as DisplayMode) || 'reference'

    references.push({
      id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      targetTabId,
      displayMode,
      position: match.index
    })
  }

  return references
}

/**
 * Get first paragraph from content
 */
export function getFirstParagraph(content: string): string {
  const paragraphs = content.split(/\n\n+/)
  return paragraphs[0]?.trim() || content.trim()
}

/**
 * Expand all references in content recursively
 */
export function expandReferences(
  content: string,
  tabs: Tab[],
  visited = new Set<string>()
): string {
  let expanded = content
  const regex = /@\[([^\]]+)\]/g
  let match: RegExpExecArray | null

  const replacements: Array<{ start: number; end: number; text: string }> = []

  while ((match = regex.exec(content)) !== null) {
    const parts = match[1].split(':')
    const targetTabId = parts[0]
    const displayMode = (parts[1] as DisplayMode) || 'reference'

    // Circular reference detection
    if (visited.has(targetTabId)) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        text: `[Circular reference: ${targetTabId}]`
      })
      continue
    }

    // Find referenced tab
    const targetTab = tabs.find(t => t.id === targetTabId)
    if (!targetTab) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        text: `[Missing document: ${targetTabId}]`
      })
      continue
    }

    // Get content based on display mode
    let refContent = ''
    switch (displayMode) {
      case 'paragraph':
        refContent = getFirstParagraph(targetTab.content)
        break
      case 'full':
        // Recursively expand references in the target document
        visited.add(targetTabId)
        refContent = expandReferences(targetTab.content, tabs, visited)
        visited.delete(targetTabId)
        break
      default:
        refContent = `[@${targetTab.name}]`
    }

    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      text: refContent
    })
  }

  // Apply replacements in reverse order to maintain positions
  replacements.reverse().forEach(({ start, end, text }) => {
    expanded = expanded.slice(0, start) + text + expanded.slice(end)
  })

  return expanded
}

/**
 * Convert friendly @documentname format to @[tabId:mode] format
 */
export function createReferenceTag(tabId: string, displayMode: DisplayMode = 'reference'): string {
  return `@[${tabId}:${displayMode}]`
}

/**
 * Extract tab name from reference for display
 */
export function getReferenceLabel(referenceText: string, tabs: Tab[]): string {
  const match = referenceText.match(/@\[([^\]:]+)/)
  if (!match) return referenceText

  const tabId = match[1]
  const tab = tabs.find(t => t.id === tabId)
  return tab ? `@${tab.name}` : `@${tabId}`
}

/**
 * Check if content has any references
 */
export function hasReferences(content: string): boolean {
  return /@\[[^\]]+\]/.test(content)
}

/**
 * Get all unique referenced tab IDs
 */
export function getReferencedTabIds(content: string): string[] {
  const ids = new Set<string>()
  const regex = /@\[([^\]:]+)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    ids.add(match[1])
  }

  return Array.from(ids)
}
