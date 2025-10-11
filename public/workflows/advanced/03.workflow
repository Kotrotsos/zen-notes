---
name: Data Transformation Pipeline
category: Data Processing
difficulty: advanced
tags: [etl, transformation, pipeline, json]
description: Complex ETL workflow with data extraction, transformation, and formatting
use_cases: ["ETL pipelines", "Data migration", "Format conversion"]
---
nodes:
  - id: extract
    type: func
    expr: |
      // Extract and normalize data from row
      if (!row) return { skip: true }

      const normalized = {}
      for (const [key, value] of Object.entries(row)) {
        const cleanKey = key.toLowerCase().replace(/\s+/g, '_')
        const cleanValue = String(value).trim()
        normalized[cleanKey] = cleanValue
      }

      return { normalized_data: normalized }

  - id: validate_schema
    type: func
    expr: |
      const data = context.normalized_data || {}
      const requiredFields = ['id', 'name'] // customize as needed

      const missing = requiredFields.filter(f => !data[f])
      if (missing.length > 0) {
        helpers.log(`Missing required fields: ${missing.join(', ')}`)
        return { skip: true }
      }

      return { validated: true, field_count: Object.keys(data).length }

  - id: enrich
    type: prompt
    prompt: |
      Enrich this record with additional derived fields. Return enhanced JSON:

      {{ normalized_data }}

      Add fields like:
      - category (inferred from data)
      - tags (array of relevant tags)
      - priority (high/medium/low based on data)
    output: enriched_data
    expect: json
    model: gpt-4.1
    temperature: 0.3
    max_tokens: 500

  - id: transform
    type: func
    expr: |
      const base = context.normalized_data || {}
      const enriched = context.enriched_data || {}

      const final = {
        ...base,
        ...enriched,
        processed_at: new Date().toISOString(),
        pipeline_version: '1.0'
      }

      return {
        final_output: final,
        output_json: JSON.stringify(final, null, 2)
      }

  - id: report
    type: print
    message: "Transformed record {{ normalized_data.id }} with {{ field_count }} fields"
