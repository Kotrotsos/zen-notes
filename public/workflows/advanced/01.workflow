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
