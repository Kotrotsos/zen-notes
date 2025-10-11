---
name: Sentiment Analysis
category: Analysis
difficulty: beginner
tags: [sentiment, analysis, json, csv]
description: Analyzes sentiment and returns structured JSON output (works with plain text or CSV data)
use_cases: ["Customer feedback", "Review analysis", "Social media monitoring"]
---
nodes:
  - id: prepare
    type: func
    expr: |
      // For CSV mode, combine all row values into text
      // If row values are empty, use chunk as fallback
      // For plain text mode, use chunk as-is
      let text = chunk
      if (row) {
        const rowText = Object.values(row).filter(v => v && String(v).trim()).join(' ')
        text = rowText || chunk
      }
      helpers.log(`### PREPARED TEXT: ${text}`)
      return { text: text }

  - id: analyze
    type: prompt
    prompt: |
      Analyze the sentiment of the following text and return a JSON object with:
      - sentiment: "positive", "neutral", or "negative"
      - score: a number between 0 and 1 (0=very negative, 1=very positive)
      - reason: brief explanation

      Text: {{ text }}
    output: sentiment_result
    expect: json
    model: gpt-4.1
    temperature: 0.3
    max_tokens: 200

  - id: log_prompt
    type: print
    message: "### PROMPT SENT: Analyze the sentiment of the following text and return a JSON object with: sentiment, score, reason. Text: {{ text }}"

  - id: log_response
    type: print
    message: "### RESPONSE: {{ sentiment_result }}"

  - id: log
    type: print
    message: "Sentiment: {{ sentiment_result.sentiment }} ({{ sentiment_result.score }})"
