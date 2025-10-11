---
name: Sentiment Analysis
category: Analysis
difficulty: beginner
tags: [sentiment, analysis, json, csv]
description: Analyzes sentiment and returns structured JSON output (works with plain text or CSV data)
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

      {{ chunk }}
    output: sentiment_result
    expect: json
    append_chunk: false
    model: gpt-4.1
    temperature: 0.3
    max_tokens: 200

  - id: log
    type: print
    message: "Sentiment: {{ sentiment_result.sentiment }} ({{ sentiment_result.score }})"
