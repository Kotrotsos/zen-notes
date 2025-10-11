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
