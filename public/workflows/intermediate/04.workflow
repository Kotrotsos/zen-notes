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
