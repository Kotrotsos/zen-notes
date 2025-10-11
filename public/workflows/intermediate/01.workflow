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
