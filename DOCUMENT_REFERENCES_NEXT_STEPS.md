# Document References - Remaining Integration Steps

## What's Already Done ✅

1. **Core library** (`lib/document-references.ts`) - Complete
2. **UI components** (`components/document-reference-picker.tsx`, `components/document-reference-badge.tsx`) - Complete
3. **Foundation** - All helper functions, data structures, and expansion logic ready

## What Needs to Be Done 🚧

### Step 1: Update AIWorkbenchProps Interface

**File**: `components/ai-workbench.tsx` (line 61-75)

Add `allTabs` prop:

```typescript
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
  allTabs: Array<{ id: string; name: string; content: string; folderPath?: string }> // ADD THIS LINE
}
```

### Step 2: Add State for "Process Imports"

**File**: `components/ai-workbench.tsx` (around line 115-120)

Add after the CSV-specific state:

```typescript
// CSV-specific
const [isCsvMode, setIsCsvMode] = useState(false)
const [csvHeaders, setCsvHeaders] = useState<string[]>([])
const [csvRowLimit, setCSVRowLimit] = useState<number>(0)

// Document references
const [processImports, setProcessImports] = useState(false) // ADD THIS LINE
```

### Step 3: Import the Expansion Function

**File**: `components/ai-workbench.tsx` (top of file, around line 12)

```typescript
import { parseCsv, isValidCsv } from "@/lib/csv"
import { expandReferences, hasReferences } from "@/lib/document-references" // ADD THIS LINE
```

### Step 4: Modify createChunks Function

**File**: `components/ai-workbench.tsx` (line 98)

Replace the function with:

```typescript
const createChunks = (content: string): string[] => {
  if (!content) return []

  // Expand document references if enabled
  let processedContent = content
  if (processImports && hasReferences(content)) {
    processedContent = expandReferences(content, allTabs)
  }

  // CSV mode: each row is a chunk
  if (isCsvMode) {
    const { rows } = parseCsv(processedContent)
    const limitedRows = csvRowLimit > 0 ? rows.slice(0, csvRowLimit) : rows
    return limitedRows.map(row => JSON.stringify(row))
  }

  let parts: string[] = []

  switch (separatorType) {
    case "none":
      parts = [processedContent]
      break
    case "newline":
      parts = processedContent.split("\n")
      break
    case "blank-line":
      parts = processedContent.split(/\n\s*\n/)
      break
    case "word":
      const words = processedContent.split(/\s+/)
      parts = []
      for (let i = 0; i < words.length; i += wordCount) {
        parts.push(words.slice(i, i + wordCount).join(" "))
      }
      break
    case "characters":
      parts = []
      for (let i = 0; i < processedContent.length; i += charCount) {
        parts.push(processedContent.slice(i, i + charCount))
      }
      break
    case "custom":
      if (customSeparator) {
        parts = processedContent.split(customSeparator)
      } else {
        parts = [processedContent]
      }
      break
    default:
      parts = [processedContent]
  }

  return parts.filter(p => p.trim().length > 0)
}
```

### Step 5: Update memoChunks Dependencies

**File**: `components/ai-workbench.tsx` (line 651)

Update the dependencies array:

```typescript
const memoChunks = useMemo(
  () => createChunks(activeTabContent),
  [activeTabContent, isCsvMode, csvRowLimit, separatorType, customSeparator, wordCount, charCount, processImports, allTabs] // ADD processImports and allTabs
)
```

### Step 6: Add UI Toggle for "Process Imports"

**File**: `components/ai-workbench.tsx` (after line 1153, after CSV row limit input)

```typescript
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

{/* ADD THIS SECTION */}
{hasReferences(activeTabContent) && (
  <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-950 rounded border border-purple-200 dark:border-purple-800">
    <label className="flex items-center gap-2 text-xs font-semibold text-purple-900 dark:text-purple-100">
      <input
        type="checkbox"
        checked={processImports}
        onChange={(e) => setProcessImports(e.target.checked)}
        className="w-3 h-3"
      />
      <span>Also process document references (@-mentions)</span>
    </label>
    <p className="text-xs text-purple-700 dark:text-purple-300">
      When enabled, all @[document] references will be expanded with their content before processing.
    </p>
  </div>
)}
```

### Step 7: Pass allTabs Prop from page.tsx

**File**: `app/page.tsx` (find where AIWorkbench is rendered, around line 3400-3500)

Find this line:
```typescript
<AIWorkbench
  activeTabContent={activeTab?.content || ""}
  activeTabName={activeTab?.name}
  onClose={() => setShowAIWorkbench(false)}
  // ... other props
/>
```

Add the allTabs prop:
```typescript
<AIWorkbench
  activeTabContent={activeTab?.content || ""}
  activeTabName={activeTab?.name}
  onClose={() => setShowAIWorkbench(false)}
  allTabs={tabs} // ADD THIS LINE
  // ... other props
/>
```

## Testing

1. Create a document with `@[otherTabId:reference]` format
2. Open AI Workbench
3. You should see the purple "Process imports" toggle appear
4. Enable it and run - the referenced document content should be included
5. Test with circular references (should show error message)
6. Test with missing documents (should show warning)

## Notes

- The reference format is `@[tabId:displayMode]` where displayMode is `reference`, `paragraph`, or `full`
- Circular references are automatically detected and prevented
- Missing documents show `[Missing document: tabId]` message
- The expansion happens before chunking, so references work with all chunking modes

## Future Enhancements (Not Required Now)

1. Visual rendering of references in Monaco editor (badges with hover menus)
2. Click-to-jump functionality
3. Modify the @ picker to insert `@[tabId:reference]` format instead of `@tabName`
4. Add reference metadata to tabs

For now, users can manually type `@[tabId:reference]` and it will work with the "Process imports" toggle.
