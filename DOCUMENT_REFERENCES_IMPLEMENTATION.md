# Document Reference System Implementation Status

## Overview
A system for embedding document references (`@-mentions`) that can be included when processing with AI Workbench or Scripts.

## Completed Components

### 1. Core Library (`lib/document-references.ts`)
- ✅ Data structures for references
- ✅ Parse references from content: `@[tabId:displayMode]`
- ✅ Display modes: `reference`, `paragraph`, `full`
- ✅ Recursive reference expansion with circular detection
- ✅ Helper functions for creating/managing references

### 2. UI Components
- ✅ `DocumentReferencePicker` - Search and select documents to reference
- ✅ `DocumentReferenceBadge` - Render references with hover menu
  - Click to jump to document
  - Edit reference
  - Change display mode
  - Import (replace with content)

## What Still Needs to be Done

### 1. Integration with Monaco Editor
The existing `@` detection system in `app/page.tsx` (lines 1640-1686) needs to be modified to:
- Insert references in format: `@[tabId:reference]` instead of `@tabName`
- Add a display mode selector after picking a document
- Store reference metadata in tab

### 2. Reference Rendering in Editor
- Add Monaco decorations to show reference badges inline
- Implement hover provider for the action menu
- Handle click events for jumping to documents

### 3. AI Workbench Integration
Add "Process Imports" toggle to AI Workbench that:
- When enabled: Expands all `@[...]` references before processing
- When disabled: Processes content as-is
- Location: In chunking settings section (around line 1240 in `ai-workbench.tsx`)

### 4. Processing Logic
Modify these functions in `ai-workbench.tsx`:
- `createChunks()` - Pre-process content to expand references if enabled
- `processChunk()` - Pass expanded content to API
- `handleAdvancedRun()` - Same for workflow mode

### 5. Visual Feedback
- Show indicator when document has references
- Show expanded size in UI when "Process Imports" is enabled
- Highlight referenced documents in Explorer

## Implementation Steps

### Step 1: Add "Process Imports" Toggle
```typescript
// In AIWorkbench component state
const [processImports, setProcessImports] = useState(false)

// In UI (after CSV row limit, around line 1240)
<div className="space-y-2">
  <label className="flex items-center gap-2 text-xs">
    <input
      type="checkbox"
      checked={processImports}
      onChange={(e) => setProcessImports(e.target.checked)}
      className="w-3 h-3"
    />
    <span>Also process document references (@-mentions)</span>
  </label>
  <p className="text-xs text-muted-foreground">
    When enabled, all @[document] references will be expanded with their content
  </p>
</div>
```

### Step 2: Modify Content Processing
```typescript
// Update AIWorkbenchProps to include tabs
interface AIWorkbenchProps {
  // ... existing props
  allTabs: Tab[] // Add this
}

// Modify createChunks to expand references
const createChunks = (content: string): string[] => {
  let processedContent = content

  if (processImports) {
    processedContent = expandReferences(content, allTabs)
  }

  // ... rest of chunking logic
}
```

### Step 3: Update @ Detection in page.tsx
Modify the click handler (line 5110-5147) to:
```typescript
onClick={() => {
  // Show display mode picker
  const mode = await pickDisplayMode() // 'reference' | 'paragraph' | 'full'

  const insertText = createReferenceTag(item.id, mode)

  editor.executeEdits("at-reference", [{
    range: range,
    text: insertText,
  }])

  // ... rest of code
}}
```

### Step 4: Reference Rendering
Use Monaco decorations to render references as badges with hover:
```typescript
// In handleEditorDidMount
const updateReferenceDecorations = () => {
  const model = editor.getModel()
  if (!model) return

  const content = model.getValue()
  const references = parseReferences(content)

  const decorations = references.map(ref => ({
    range: new monaco.Range(/* calculate from position */),
    options: {
      inlineClassName: 'document-reference-badge',
      hoverMessage: { value: 'Click to jump | Hover for options' }
    }
  }))

  referenceDecorationsRef.current?.set(decorations)
}
```

## Testing Checklist

- [ ] Insert @ and pick a document
- [ ] Choose display mode (reference/paragraph/full)
- [ ] Click badge to jump to document
- [ ] Hover to see action menu
- [ ] Change display mode from menu
- [ ] Import reference (replace with content)
- [ ] Enable "Process imports" in AI Workbench
- [ ] Run basic mode with references - verify expansion
- [ ] Run advanced mode with references - verify expansion
- [ ] Test circular reference detection
- [ ] Test missing document handling

## File References

- Core logic: `lib/document-references.ts`
- Picker component: `components/document-reference-picker.tsx`
- Badge component: `components/document-reference-badge.tsx`
- Main app: `app/page.tsx` (@ detection at line 1640-1686, click handler at 5110-5147)
- AI Workbench: `components/ai-workbench.tsx` (needs toggle + processing integration)
