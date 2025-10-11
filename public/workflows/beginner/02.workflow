---
name: CSV Row Filtering
category: Data Processing
difficulty: beginner
tags: [csv, filtering, validation]
description: Filter CSV rows based on custom criteria with skip logic
use_cases: ["Data cleaning", "Quality control", "Validation"]
---
nodes:
  - id: validate
    type: func
    expr: |
      // Example: skip rows where a numeric column is below threshold
      // Adjust logic for your use case
      if (!row || !row.value) {
        return { skip: true }
      }
      const numValue = parseFloat(row.value)
      if (isNaN(numValue) || numValue < 10) {
        helpers.log('Filtered out row with low value')
        return { skip: true }
      }
      return { validated: true }

  - id: report
    type: print
    message: "Row {{ index }} passed validation"
