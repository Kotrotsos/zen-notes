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
