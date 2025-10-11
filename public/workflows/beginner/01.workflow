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

  - id: clean
    type: func
    expr: |
      return { result: context.summary }
