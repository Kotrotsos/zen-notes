# Workflow Cookbook with Management System Implementation Plan

> **For Claude:** Use `${CLAUDE_PLUGIN_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add a workflow cookbook system with full management capabilities (load, save, browse, favorite) for AI Workbench advanced mode, including 11 built-in example workflows.

**Architecture:** Hybrid system with built-in workflows in `/public/workflows/` (shipped with app) and custom workflows saved as `.workflow` files in user workspace. Follows existing prompt system pattern. YAML frontmatter for metadata + workflow body. New components for dropdown/modal browsing. localStorage for favorites/recent.

**Tech Stack:** React, TypeScript, Next.js, Monaco Editor, Lucide icons, shadcn/ui components, YAML parsing

---

## Task 1: Create TypeScript Types

**Files:**
- Create: `lib/workflow-types.ts`

**Step 1: Create workflow type definitions**

```typescript
export interface WorkflowMetadata {
  name: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  description: string
  use_cases: string[]
}

export interface Workflow {
  id: string
  name: string
  content: string
  folderPath?: string
  isBuiltIn: boolean
  metadata: WorkflowMetadata
}

export interface ParsedWorkflow {
  metadata: WorkflowMetadata
  body: string
}
```

**Step 2: Commit**

```bash
git add lib/workflow-types.ts
git commit -m "feat: add workflow type definitions"
```

---

## Task 2: Create Workflow Service

**Files:**
- Create: `lib/workflow-service.ts`

**Step 1: Create workflow parsing utility**

```typescript
import { WorkflowMetadata, ParsedWorkflow } from './workflow-types'

export function parseWorkflowFile(content: string): ParsedWorkflow {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)

  if (!fmMatch) {
    return {
      metadata: {
        name: 'Untitled',
        category: 'Uncategorized',
        difficulty: 'beginner',
        tags: [],
        description: '',
        use_cases: []
      },
      body: content
    }
  }

  const metaLines = fmMatch[1].split(/\r?\n/)
  const metadata: Partial<WorkflowMetadata> = {}

  for (const line of metaLines) {
    const match = line.match(/^([a-zA-Z0-9_\-]+)\s*:\s*(.*)$/)
    if (match) {
      const key = match[1]
      let value: any = match[2].trim()

      // Parse arrays [item1, item2]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map(v => v.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
      }

      metadata[key as keyof WorkflowMetadata] = value
    }
  }

  return {
    metadata: {
      name: metadata.name || 'Untitled',
      category: metadata.category || 'Uncategorized',
      difficulty: metadata.difficulty || 'beginner',
      tags: metadata.tags || [],
      description: metadata.description || '',
      use_cases: metadata.use_cases || []
    } as WorkflowMetadata,
    body: fmMatch[2]
  }
}

export function buildWorkflowFile(metadata: WorkflowMetadata, body: string): string {
  const lines = [
    '---',
    `name: ${metadata.name}`,
    `category: ${metadata.category}`,
    `difficulty: ${metadata.difficulty}`,
    `tags: [${metadata.tags.join(', ')}]`,
    `description: ${metadata.description}`,
    `use_cases: [${metadata.use_cases.map(u => `"${u}"`).join(', ')}]`,
    '---',
    body.trimStart(),
    ''
  ]
  return lines.join('\n')
}

export async function fetchBuiltInWorkflows(): Promise<Array<{ path: string; content: string }>> {
  const workflows: Array<{ path: string; content: string }> = []
  const difficulties = ['beginner', 'intermediate', 'advanced']

  for (const difficulty of difficulties) {
    let fileIndex = 1
    let keepTrying = true

    while (keepTrying) {
      const paddedIndex = String(fileIndex).padStart(2, '0')
      try {
        const response = await fetch(`/workflows/${difficulty}/${paddedIndex}.workflow`)
        if (response.ok) {
          const content = await response.text()
          workflows.push({
            path: `/workflows/${difficulty}/${paddedIndex}.workflow`,
            content
          })
          fileIndex++
        } else {
          keepTrying = false
        }
      } catch {
        keepTrying = false
      }
    }
  }

  return workflows
}
```

**Step 2: Commit**

```bash
git add lib/workflow-service.ts
git commit -m "feat: add workflow parsing and loading utilities"
```

---

## Task 3: Create Beginner Workflow Files

**Files:**
- Create: `public/workflows/beginner/01.workflow`
- Create: `public/workflows/beginner/02.workflow`
- Create: `public/workflows/beginner/03.workflow`
- Create: `public/workflows/beginner/04.workflow`

**Step 1: Create simple summarization workflow**

File: `public/workflows/beginner/01.workflow`

```yaml
---
name: Simple Summarization
category: Content Generation
difficulty: beginner
tags: [summarization, text-processing]
description: Summarizes text into 3 concise bullet points
use_cases: ["Meeting notes", "Article summaries", "Email digests"]
---
nodes:
  - id: summarize
    type: prompt
    prompt: |
      Summarize the following in 3 concise bullet points:

      {{ chunk }}
    output: summary
    model: gpt-4.1
    temperature: 0.5
    max_tokens: 300
```

**Step 2: Create CSV row filtering workflow**

File: `public/workflows/beginner/02.workflow`

```yaml
---
name: CSV Row Filtering
category: Data Processing
difficulty: beginner
tags: [csv, filtering, validation]
description: Filter CSV rows based on custom criteria with skip logic
use_cases: ["Data cleaning", "Quality control", "Validation"]
---
nodes:
  - id: validate
    type: func
    expr: |
      // Example: skip rows where a numeric column is below threshold
      // Adjust logic for your use case
      if (!row || !row.value) {
        return { skip: true }
      }
      const numValue = parseFloat(row.value)
      if (isNaN(numValue) || numValue < 10) {
        helpers.log('Filtered out row with low value')
        return { skip: true }
      }
      return { validated: true }

  - id: report
    type: print
    message: "Row {{ index }} passed validation"
```

**Step 3: Create sentiment analysis workflow**

File: `public/workflows/beginner/03.workflow`

```yaml
---
name: Sentiment Analysis
category: Analysis
difficulty: beginner
tags: [sentiment, analysis, json]
description: Analyzes sentiment and returns structured JSON output
use_cases: ["Customer feedback", "Review analysis", "Social media monitoring"]
---
nodes:
  - id: analyze
    type: prompt
    prompt: |
      Analyze the sentiment of the following text and return a JSON object with:
      - sentiment: "positive", "neutral", or "negative"
      - score: a number between 0 and 1 (0=very negative, 1=very positive)
      - reason: brief explanation

      Text: {{ chunk }}
    output: sentiment_result
    expect: json
    model: gpt-4.1
    temperature: 0.3
    max_tokens: 200

  - id: log
    type: print
    message: "Sentiment: {{ sentiment_result.sentiment }} ({{ sentiment_result.score }})"
```

**Step 4: Create translation workflow**

File: `public/workflows/beginner/04.workflow`

```yaml
---
name: Text Translation
category: Content Generation
difficulty: beginner
tags: [translation, localization, i18n]
description: Translates text to a target language with variable interpolation
use_cases: ["Localization", "Multilingual content", "International communication"]
---
nodes:
  - id: translate
    type: prompt
    prompt: |
      Translate the following text to {{ row.target_language || 'Spanish' }}:

      {{ chunk }}

      Provide only the translation, no explanations.
    output: translation
    model: gpt-4.1
    temperature: 0.3
    max_tokens: 500

  - id: report
    type: print
    message: "Translated to {{ row.target_language || 'Spanish' }}"
```

**Step 5: Commit**

```bash
git add public/workflows/beginner/
git commit -m "feat: add beginner workflow examples"
```

---

## Task 4: Create Intermediate Workflow Files

**Files:**
- Create: `public/workflows/intermediate/01.workflow`
- Create: `public/workflows/intermediate/02.workflow`
- Create: `public/workflows/intermediate/03.workflow`
- Create: `public/workflows/intermediate/04.workflow`

**Step 1: Create extract and enrich workflow**

File: `public/workflows/intermediate/01.workflow`

```yaml
---
name: Extract and Enrich
category: Multi-step Workflows
difficulty: intermediate
tags: [extraction, enrichment, json, multi-step]
description: Extracts entities from text then enriches them with additional context
use_cases: ["Data extraction pipelines", "Entity recognition", "Information enrichment"]
---
nodes:
  - id: extract
    type: prompt
    prompt: |
      Extract key entities from this text as JSON:
      {
        "people": ["names"],
        "organizations": ["org names"],
        "locations": ["places"],
        "topics": ["main topics"]
      }

      Text: {{ chunk }}
    output: entities
    expect: json
    model: gpt-4.1
    temperature: 0.2
    max_tokens: 400

  - id: process
    type: func
    expr: |
      const entities = context.entities || {}
      const totalCount = Object.values(entities)
        .reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
      return {
        entity_count: totalCount,
        has_people: (entities.people || []).length > 0
      }

  - id: enrich
    type: prompt
    prompt: |
      Based on these extracted entities, provide 2-3 sentences of additional context:

      {{ entities }}
    output: enrichment
    model: gpt-4.1
    temperature: 0.7
    max_tokens: 300

  - id: summary
    type: print
    message: "Extracted {{ entity_count }} entities. Enrichment: {{ enrichment }}"
```

**Step 2: Create content rewriter workflow**

File: `public/workflows/intermediate/02.workflow`

```yaml
---
name: Content Rewriter
category: Content Generation
difficulty: intermediate
tags: [rewriting, tone-adjustment, analytics]
description: Analyzes text then rewrites it to match target tone and length
use_cases: ["Marketing copy", "Style adjustment", "Content optimization"]
---
nodes:
  - id: analyze
    type: func
    expr: |
      const text = chunk || ''
      const wordCount = text.split(/\s+/).filter(Boolean).length
      const avgWordLength = text.replace(/\s/g, '').length / Math.max(wordCount, 1)

      return {
        original_words: wordCount,
        avg_word_length: avgWordLength.toFixed(1),
        original_text: text
      }

  - id: rewrite
    type: prompt
    prompt: |
      Rewrite this text with a {{ row.target_tone || 'professional and friendly' }} tone.
      Target length: {{ row.target_words || '50-100' }} words.

      Original: {{ original_text }}
    output: rewritten
    model: gpt-4.1
    temperature: 0.8
    max_tokens: 500

  - id: log_stats
    type: print
    message: "Rewrote {{ original_words }} words → ~{{ row.target_words || 100 }} words"
```

**Step 3: Create CSV classification workflow**

File: `public/workflows/intermediate/03.workflow`

```yaml
---
name: CSV Classification with Validation
category: Data Processing
difficulty: intermediate
tags: [csv, classification, validation, multi-step]
description: Validates CSV row data then classifies it with confidence scoring
use_cases: ["Data categorization", "Content tagging", "Quality scoring"]
---
nodes:
  - id: validate
    type: func
    expr: |
      if (!row || !row.content) {
        return { skip: true }
      }
      const content = String(row.content).trim()
      if (content.length < 10) {
        helpers.log('Content too short, skipping')
        return { skip: true }
      }
      return { valid_content: content }

  - id: classify
    type: prompt
    prompt: |
      Classify this content into ONE of these categories:
      - Technology
      - Business
      - Health
      - Education
      - Entertainment

      Return JSON: { "category": "...", "confidence": 0.0-1.0, "keywords": ["..."] }

      Content: {{ valid_content }}
    output: classification
    expect: json
    model: gpt-4.1
    temperature: 0.3
    max_tokens: 200

  - id: post_process
    type: func
    expr: |
      const result = context.classification || {}
      return {
        final_category: result.category,
        high_confidence: (result.confidence || 0) > 0.8
      }

  - id: report
    type: print
    message: "Classified as {{ final_category }} (confidence: {{ classification.confidence }})"
```

**Step 4: Create multi-field analysis workflow**

File: `public/workflows/intermediate/04.workflow`

```yaml
---
name: Multi-field Analysis
category: Analysis
difficulty: intermediate
tags: [csv, analysis, multi-field, insights]
description: Combines multiple CSV columns for complex analysis with structured output
use_cases: ["Complex data analysis", "Cross-field insights", "Report generation"]
---
nodes:
  - id: combine
    type: func
    expr: |
      if (!row) return { skip: true }

      const fields = Object.entries(row)
        .filter(([k, v]) => v && String(v).trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')

      return { combined_fields: fields }

  - id: analyze
    type: prompt
    prompt: |
      Analyze this data and provide structured insights as JSON:
      {
        "key_findings": ["finding 1", "finding 2"],
        "sentiment": "positive/neutral/negative",
        "action_items": ["action 1", "action 2"],
        "priority": "high/medium/low"
      }

      Data:
      {{ combined_fields }}
    output: insights
    expect: json
    model: gpt-4.1
    temperature: 0.5
    max_tokens: 400

  - id: summary
    type: print
    message: "Analysis complete. Priority: {{ insights.priority }}"
```

**Step 5: Commit**

```bash
git add public/workflows/intermediate/
git commit -m "feat: add intermediate workflow examples"
```

---

## Task 5: Create Advanced Workflow Files

**Files:**
- Create: `public/workflows/advanced/01.workflow`
- Create: `public/workflows/advanced/02.workflow`
- Create: `public/workflows/advanced/03.workflow`

**Step 1: Create conditional processing workflow**

File: `public/workflows/advanced/01.workflow`

```yaml
---
name: Conditional Processing
category: Multi-step Workflows
difficulty: advanced
tags: [conditional, routing, error-handling, dynamic]
description: Routes chunks through different processing paths based on content characteristics
use_cases: ["Dynamic workflows", "Conditional logic", "Smart routing"]
---
nodes:
  - id: detect_type
    type: func
    expr: |
      const text = chunk || ''
      const hasNumbers = /\d+/.test(text)
      const hasEmail = /\w+@\w+\.\w+/.test(text)
      const wordCount = text.split(/\s+/).filter(Boolean).length

      let contentType = 'general'
      if (hasEmail) contentType = 'contact'
      else if (hasNumbers && wordCount < 50) contentType = 'data'
      else if (wordCount > 200) contentType = 'article'

      helpers.log(`Detected type: ${contentType}`)
      return { content_type: contentType, word_count: wordCount }

  - id: process_contact
    type: prompt
    prompt: |
      Extract contact information as JSON:
      { "emails": [], "phones": [], "names": [] }

      {{ chunk }}
    output: contact_info
    expect: json
    model: gpt-4.1
    temperature: 0.2
    max_tokens: 300
    condition: context.content_type === 'contact'

  - id: process_data
    type: prompt
    prompt: |
      Extract and structure the numeric data in this text.

      {{ chunk }}
    output: structured_data
    model: gpt-4.1
    temperature: 0.2
    max_tokens: 300
    condition: context.content_type === 'data'

  - id: process_article
    type: prompt
    prompt: |
      Create a detailed summary with:
      - Main points (3-5 bullets)
      - Key takeaways
      - Target audience

      {{ chunk }}
    output: article_summary
    model: gpt-4.1
    temperature: 0.6
    max_tokens: 500
    condition: context.content_type === 'article'

  - id: process_general
    type: prompt
    prompt: |
      Provide a brief summary of this content.

      {{ chunk }}
    output: general_summary
    model: gpt-4.1
    temperature: 0.5
    max_tokens: 200
    condition: context.content_type === 'general'

  - id: finalize
    type: print
    message: "Processed as {{ content_type }} ({{ word_count }} words)"
```

**Step 2: Create iterative refinement workflow**

File: `public/workflows/advanced/02.workflow`

```yaml
---
name: Iterative Refinement
category: Content Generation
difficulty: advanced
tags: [iterative, refinement, quality, multi-step]
description: Generates content, critiques it, then refines based on feedback
use_cases: ["High-quality content", "Iterative improvement", "Quality assurance"]
---
nodes:
  - id: generate_draft
    type: prompt
    prompt: |
      Write a compelling {{ row.content_type || 'blog post introduction' }} about:

      {{ chunk }}

      Make it engaging and informative.
    output: draft
    model: gpt-4.1
    temperature: 0.8
    max_tokens: 400

  - id: critique
    type: prompt
    prompt: |
      Critique this draft and provide specific improvement suggestions as JSON:
      {
        "strengths": ["strength 1", "strength 2"],
        "weaknesses": ["weakness 1", "weakness 2"],
        "suggestions": ["suggestion 1", "suggestion 2"]
      }

      Draft:
      {{ draft }}
    output: critique_result
    expect: json
    model: gpt-4.1
    temperature: 0.5
    max_tokens: 400

  - id: refine
    type: prompt
    prompt: |
      Improve this draft based on the critique below:

      Original Draft:
      {{ draft }}

      Critique:
      Weaknesses: {{ critique_result.weaknesses }}
      Suggestions: {{ critique_result.suggestions }}

      Write the improved version:
    output: refined
    model: gpt-4.1
    temperature: 0.7
    max_tokens: 500

  - id: report
    type: print
    message: "Refined content with {{ critique_result.suggestions.length }} improvements applied"
```

**Step 3: Create data transformation pipeline**

File: `public/workflows/advanced/03.workflow`

```yaml
---
name: Data Transformation Pipeline
category: Data Processing
difficulty: advanced
tags: [etl, transformation, pipeline, json]
description: Complex ETL workflow with data extraction, transformation, and formatting
use_cases: ["ETL pipelines", "Data migration", "Format conversion"]
---
nodes:
  - id: extract
    type: func
    expr: |
      // Extract and normalize data from row
      if (!row) return { skip: true }

      const normalized = {}
      for (const [key, value] of Object.entries(row)) {
        const cleanKey = key.toLowerCase().replace(/\s+/g, '_')
        const cleanValue = String(value).trim()
        normalized[cleanKey] = cleanValue
      }

      return { normalized_data: normalized }

  - id: validate_schema
    type: func
    expr: |
      const data = context.normalized_data || {}
      const requiredFields = ['id', 'name'] // customize as needed

      const missing = requiredFields.filter(f => !data[f])
      if (missing.length > 0) {
        helpers.log(`Missing required fields: ${missing.join(', ')}`)
        return { skip: true }
      }

      return { validated: true, field_count: Object.keys(data).length }

  - id: enrich
    type: prompt
    prompt: |
      Enrich this record with additional derived fields. Return enhanced JSON:

      {{ normalized_data }}

      Add fields like:
      - category (inferred from data)
      - tags (array of relevant tags)
      - priority (high/medium/low based on data)
    output: enriched_data
    expect: json
    model: gpt-4.1
    temperature: 0.3
    max_tokens: 500

  - id: transform
    type: func
    expr: |
      const base = context.normalized_data || {}
      const enriched = context.enriched_data || {}

      const final = {
        ...base,
        ...enriched,
        processed_at: new Date().toISOString(),
        pipeline_version: '1.0'
      }

      return {
        final_output: final,
        output_json: JSON.stringify(final, null, 2)
      }

  - id: report
    type: print
    message: "Transformed record {{ normalized_data.id }} with {{ field_count }} fields"
```

**Step 4: Commit**

```bash
git add public/workflows/advanced/
git commit -m "feat: add advanced workflow examples"
```

---

## Task 6: Create Workflow Dropdown Component

**Files:**
- Create: `components/workflow-dropdown.tsx`

**Step 1: Create workflow dropdown component**

```typescript
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
          <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded shadow-lg z-50 max-h-[500px] overflow-auto">
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
                    className="w-full px-3 py-2 text-left text-xs hover:bg-muted flex items-center gap-2"
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getDifficultyColor(workflow.metadata.difficulty)}`}>
                      {workflow.metadata.difficulty[0].toUpperCase()}
                    </span>
                    <span className="flex-1 truncate">{workflow.name}</span>
                    <Star
                      size={12}
                      className="fill-yellow-400 text-yellow-400"
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
                    className="w-full px-3 py-2 text-left text-xs hover:bg-muted flex items-center gap-2"
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getDifficultyColor(workflow.metadata.difficulty)}`}>
                      {workflow.metadata.difficulty[0].toUpperCase()}
                    </span>
                    <span className="flex-1 truncate">{workflow.name}</span>
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
                    className="w-full px-3 py-2 text-left text-xs hover:bg-muted flex items-center gap-2"
                  >
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getDifficultyColor(workflow.metadata.difficulty)}`}>
                      {workflow.metadata.difficulty[0].toUpperCase()}
                    </span>
                    <span className="flex-1 truncate">{workflow.name}</span>
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
```

**Step 2: Commit**

```bash
git add components/workflow-dropdown.tsx
git commit -m "feat: add workflow dropdown component"
```

---

## Task 7: Create Workflow Browser Modal Component

**Files:**
- Create: `components/workflow-browser.tsx`

**Step 1: Create workflow browser modal (part 1 - structure)**

```typescript
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
```

**Step 2: Commit**

```bash
git add components/workflow-browser.tsx
git commit -m "feat: add workflow browser modal component"
```

---

## Task 8: Update AIWorkbench Component (Part 1 - Add Workflow Props and State)

**Files:**
- Modify: `components/ai-workbench.tsx`

**Step 1: Add workflow imports and props**

Add to imports section (around line 12):
```typescript
import WorkflowDropdown from '@/components/workflow-dropdown'
import WorkflowBrowser from '@/components/workflow-browser'
import { Workflow, WorkflowMetadata } from '@/lib/workflow-types'
import { parseWorkflowFile, buildWorkflowFile } from '@/lib/workflow-service'
import { BookOpen, Save } from 'lucide-react'
```

Add to AIWorkbenchProps interface (around line 46):
```typescript
  availableWorkflows?: Workflow[]
  onSaveWorkflow?: (name: string, content: string, folderPath?: string, metadata?: WorkflowMetadata) => void
  onDeleteWorkflow?: (id: string) => void
  selectedWorkflowId?: string
```

**Step 2: Add workflow state variables**

Add after existing state declarations (around line 100):
```typescript
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
```

**Step 3: Commit**

```bash
git add components/ai-workbench.tsx
git commit -m "feat: add workflow management props and state to AIWorkbench"
```

---

## Task 9: Update AIWorkbench Component (Part 2 - Add Workflow Management Functions)

**Files:**
- Modify: `components/ai-workbench.tsx`

**Step 1: Add localStorage effects for favorites and recent**

Add after other useEffect hooks (around line 245):
```typescript
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
```

**Step 2: Add workflow management handlers**

Add before the return statement (around line 750):
```typescript
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
```

**Step 3: Commit**

```bash
git add components/ai-workbench.tsx
git commit -m "feat: add workflow management handlers to AIWorkbench"
```

---

## Task 10: Update AIWorkbench Component (Part 3 - Update UI for Workflow Management)

**Files:**
- Modify: `components/ai-workbench.tsx`

**Step 1: Update advanced mode UI section**

Find the advanced mode section (around line 1057) and replace:
```typescript
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Define a workflow using YAML. Each chunk or row flows through the nodes in order. Available node types:
                <code className="mx-1">func</code>, <code className="mx-1">prompt</code>, and <code className="mx-1">print</code>.
              </p>
```

With:
```typescript
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
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
                <Button variant="secondary" size="sm" onClick={handleOpenSaveDialog}>
                  <Save size={14} className="mr-1" />
                  Save
                </Button>
              </div>

              {isWorkflowModified && (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
                  Unsaved changes
                  {currentWorkflowId && ` (modified from: ${availableWorkflows?.find(w => w.id === currentWorkflowId)?.name})`}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Define a workflow using YAML. Each chunk or row flows through the nodes in order. Available node types:
                <code className="mx-1">func</code>, <code className="mx-1">prompt</code>, and <code className="mx-1">print</code>.
              </p>
```

**Step 2: Add workflow save dialog**

Add before the closing div of the advanced mode section (around line 1085):
```typescript
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
```

**Step 3: Add workflow browser modal rendering**

Add at the end of the component, before the closing return parenthesis (around line 1224):
```typescript
      {showWorkflowBrowser && (
        <WorkflowBrowser
          workflows={availableWorkflows || []}
          favorites={workflowFavorites}
          onLoad={handleLoadWorkflow}
          onToggleFavorite={handleToggleWorkflowFavorite}
          onClose={() => setShowWorkflowBrowser(false)}
        />
      )}
```

**Step 4: Commit**

```bash
git add components/ai-workbench.tsx
git commit -m "feat: integrate workflow dropdown, browser, and save UI into AIWorkbench"
```

---

## Task 11: Update app/page.tsx for Workflow File Management

**Files:**
- Modify: `app/page.tsx`

**Step 1: Add workflow imports and state**

Add to imports section:
```typescript
import { Workflow, WorkflowMetadata } from '@/lib/workflow-types'
import { fetchBuiltInWorkflows, parseWorkflowFile } from '@/lib/workflow-service'
import { FileCode } from 'lucide-react'
```

Add to state declarations (find where `tabs` state is):
```typescript
  const [availableWorkflows, setAvailableWorkflows] = useState<Workflow[]>([])
```

**Step 2: Add function to load workflows**

Add after the `loadPrompts` function:
```typescript
  const loadWorkflows = useCallback(async () => {
    try {
      // Load built-in workflows
      const builtIn = await fetchBuiltInWorkflows()
      const builtInWorkflows: Workflow[] = builtIn.map((w, idx) => {
        const { metadata, body } = parseWorkflowFile(w.content)
        return {
          id: `builtin-${idx}-${metadata.name.replace(/\s+/g, '-').toLowerCase()}`,
          name: `${metadata.name}.workflow`,
          content: w.content,
          isBuiltIn: true,
          metadata
        }
      })

      // Load custom workflows from workspace
      const customWorkflows: Workflow[] = []
      const workflowFiles = files.filter(f =>
        f.type === 'file' && f.name.toLowerCase().endsWith('.workflow')
      )

      for (const file of workflowFiles) {
        try {
          const handle = await getFileHandle(file.path)
          if (handle && handle.kind === 'file') {
            const fileObj = await handle.getFile()
            const content = await fileObj.text()
            const { metadata } = parseWorkflowFile(content)
            customWorkflows.push({
              id: file.path,
              name: file.name,
              content,
              folderPath: file.path.substring(0, file.path.lastIndexOf('/')),
              isBuiltIn: false,
              metadata
            })
          }
        } catch (err) {
          console.error(`Failed to load workflow ${file.path}:`, err)
        }
      }

      setAvailableWorkflows([...builtInWorkflows, ...customWorkflows])
    } catch (err) {
      console.error('Failed to load workflows:', err)
    }
  }, [files, getFileHandle])
```

**Step 3: Add workflow file management handlers**

Add after the `handleSavePrompt` function:
```typescript
  const handleSaveWorkflow = useCallback(async (name: string, content: string, folderPath?: string, metadata?: WorkflowMetadata) => {
    try {
      const folder = folderPath || 'Workflows'
      const fullPath = `${folder}/${name}`

      await writeFile(fullPath, content)
      await loadWorkflows()

      toast({
        title: 'Workflow saved',
        description: `Saved to ${fullPath}`
      })
    } catch (err: any) {
      toast({
        title: 'Failed to save workflow',
        description: err.message,
        variant: 'destructive'
      })
    }
  }, [writeFile, loadWorkflows, toast])

  const handleDeleteWorkflow = useCallback(async (id: string) => {
    const workflow = availableWorkflows.find(w => w.id === id)
    if (!workflow || workflow.isBuiltIn) return

    try {
      await deleteFile(workflow.id) // id is the path for custom workflows
      await loadWorkflows()

      toast({
        title: 'Workflow deleted',
        description: workflow.name
      })
    } catch (err: any) {
      toast({
        title: 'Failed to delete workflow',
        description: err.message,
        variant: 'destructive'
      })
    }
  }, [availableWorkflows, deleteFile, loadWorkflows, toast])
```

**Step 4: Add useEffect to load workflows on mount**

Add after the `loadPrompts` useEffect:
```typescript
  useEffect(() => {
    if (directoryHandle) {
      loadWorkflows()
    }
  }, [directoryHandle, loadWorkflows])
```

**Step 5: Update AIWorkbench component with workflow props**

Find where `<AIWorkbench` is rendered and add these props:
```typescript
          <AIWorkbench
            // ... existing props
            availableWorkflows={availableWorkflows}
            onSaveWorkflow={handleSaveWorkflow}
            onDeleteWorkflow={handleDeleteWorkflow}
          />
```

**Step 6: Update file icon rendering to include workflow files**

Find the `getFileIcon` function or file icon rendering logic and add:
```typescript
  } else if (name.endsWith('.workflow')) {
    return <FileCode size={14} className="text-purple-500" />
```

**Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add workflow file management to main app"
```

---

## Task 12: Testing and Verification

**Files:**
- Test: All created files and integration

**Step 1: Start development server**

Run:
```bash
npm run dev
```

Expected: Server starts on http://localhost:3000

**Step 2: Test workflow loading**

1. Open the app
2. Open a tab with content or CSV data
3. Open AI Workbench
4. Switch to Advanced Mode
5. Click workflow dropdown

Expected: See beginner/intermediate/advanced workflows organized by category

**Step 3: Test workflow browser**

1. Click "Browse" button
2. Test search functionality
3. Test category and difficulty filters
4. Click on a workflow card
5. Verify metadata displays correctly
6. Toggle "Show Code Preview"

Expected: All UI interactions work smoothly, metadata and code display correctly

**Step 4: Test workflow loading and execution**

1. Load "Simple Summarization" workflow
2. Verify it loads into the editor
3. Check for "Unsaved changes" indicator (should not show)
4. Run the workflow on test content

Expected: Workflow executes successfully, results display in results pane

**Step 5: Test favorites and recent**

1. Star a workflow in dropdown
2. Close and reopen workbench
3. Verify favorite persists
4. Load 3 different workflows
5. Verify they appear in Recent section

Expected: Favorites and recent tracking works across sessions

**Step 6: Test workflow saving**

1. Load a built-in workflow
2. Modify the YAML
3. Verify "Unsaved changes" appears
4. Click Save button
5. Fill in all metadata fields
6. Save to "Workflows" folder
7. Verify it appears in dropdown as custom workflow
8. Check file system for `.workflow` file

Expected: Workflow saves successfully, appears in file explorer and dropdown

**Step 7: Test CSV mode with workflows**

1. Load CSV data with headers
2. Load "CSV Row Filtering" workflow
3. Verify row variables are available
4. Run workflow

Expected: Workflow processes each CSV row correctly

**Step 8: Test error handling**

1. Load workflow with invalid YAML
2. Try to run it

Expected: Appropriate error message displays

**Step 9: Run build**

Run:
```bash
npm run build
```

Expected: Build succeeds with no errors

**Step 10: Run linter**

Run:
```bash
npm run lint
```

Expected: No linting errors (or fix any that appear)

**Step 11: Commit**

```bash
git add -A
git commit -m "test: verify workflow cookbook functionality"
```

---

## Task 13: Documentation and Final Touches

**Files:**
- Update: `AGENTS.md`

**Step 1: Document the workflow cookbook feature**

Add to the "Project Memory (Agent Notes)" section in AGENTS.md:
```markdown
- Workflow Cookbook: Advanced mode now includes a comprehensive workflow management system:
  - **Built-in Examples**: 11 example workflows (4 beginner, 4 intermediate, 3 advanced) shipped in `/public/workflows/` organized by difficulty.
  - **Categories**: Content Generation, Data Processing, Analysis, Multi-step Workflows.
  - **Workflow Files**: Stored as `.workflow` files with YAML frontmatter (name, category, difficulty, tags, description, use_cases) + workflow body.
  - **UI Components**: `WorkflowDropdown` for quick access (favorites, recent, grouped by category), `WorkflowBrowser` modal for detailed browsing with filters and code preview.
  - **Management**: Full CRUD - load built-in/custom workflows, save custom workflows to workspace, favorite tracking, recent tracking (localStorage).
  - **Unsaved Changes**: Smart tracking with warnings before loading new workflow.
  - **Integration**: Follows prompt system pattern - parent (`app/page.tsx`) handles file I/O, `AIWorkbench` handles UI/state.
  - **Utilities**: `lib/workflow-service.ts` (parsing, building, loading), `lib/workflow-types.ts` (TypeScript types).
```

**Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: document workflow cookbook feature"
```

---

## Task 14: Final Verification and Cleanup

**Files:**
- Verify: Complete feature integration

**Step 1: Full feature test**

Perform a complete end-to-end test:
1. Load each of the 11 built-in workflows
2. Execute each one with appropriate test data
3. Verify all node types work (func, prompt, print)
4. Test favorites/recent across all workflows
5. Save a custom workflow
6. Edit and re-save a custom workflow
7. Test with CSV data using variables

Expected: All workflows execute correctly, all features work as designed

**Step 2: Check for console errors**

Open browser dev tools and verify:
- No console errors during normal operation
- No network errors loading workflows
- No React warnings

Expected: Clean console output

**Step 3: Verify TypeScript compilation**

Run:
```bash
npx tsc --noEmit
```

Expected: No type errors

**Step 4: Performance check**

1. Open workflow browser with all workflows
2. Verify it loads quickly
3. Test filtering performance with search
4. Load large workflow and verify editor responsiveness

Expected: Smooth performance, no lag

**Step 5: Create final commit**

```bash
git add -A
git commit -m "feat: complete workflow cookbook implementation with 11 examples and full management system"
```

---

## Summary

**What We Built:**
- Complete workflow cookbook system with 11 built-in examples
- Full workflow management (load, save, favorite, recent)
- Two-tier UI (dropdown + browser modal)
- YAML-based workflow files with rich metadata
- Integration with existing prompt system pattern
- localStorage persistence for preferences

**Files Created:**
- `lib/workflow-types.ts` - TypeScript types
- `lib/workflow-service.ts` - Parsing and loading utilities
- `public/workflows/**/*.workflow` - 11 example workflows
- `components/workflow-dropdown.tsx` - Quick access dropdown
- `components/workflow-browser.tsx` - Full browser modal

**Files Modified:**
- `components/ai-workbench.tsx` - Integrated workflow management
- `app/page.tsx` - Added file I/O for workflows
- `AGENTS.md` - Documentation

**Key Features:**
- Smart unsaved changes tracking
- Favorites and recent workflows
- Category/difficulty organization and filtering
- Code preview in browser
- Rich metadata support
- Built-in + custom workflow hybrid system
