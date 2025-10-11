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

  # Use a func node to control which fields appear in results
  # The func node returns an object - only returned fields will be in the final context
  - id: clean
    type: func
    expr: |
      # Example: return only the summary
      return { result: context.summary }

      # Example: return summary with original chunk
      # return { input: chunk, result: context.summary }

      # Example: return multiple fields
      # return {
      #   original: chunk,
      #   summary: context.summary,
      #   word_count: chunk.split(/\s+/).length
      # }
