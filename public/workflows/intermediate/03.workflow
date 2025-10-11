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
