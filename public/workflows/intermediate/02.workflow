---
name: Content Rewriter
category: Content Generation
difficulty: intermediate
tags: [rewriting, tone-adjustment, analytics]
description: Analyzes text then rewrites it to match target tone and length
use_cases: ["Marketing copy", "Style adjustment", "Content optimization"]
---
nodes:
  - id: analyze
    type: func
    expr: |
      const text = chunk || ''
      const wordCount = text.split(/\s+/).filter(Boolean).length
      const avgWordLength = text.replace(/\s/g, '').length / Math.max(wordCount, 1)

      return {
        original_words: wordCount,
        avg_word_length: avgWordLength.toFixed(1),
        original_text: text
      }

  - id: rewrite
    type: prompt
    prompt: |
      Rewrite this text with a {{ row.target_tone || 'professional and friendly' }} tone.
      Target length: {{ row.target_words || '50-100' }} words.

      Original: {{ original_text }}
    output: rewritten
    model: gpt-4.1
    temperature: 0.8
    max_tokens: 500

  - id: log_stats
    type: print
    message: "Rewrote {{ original_words }} words → ~{{ row.target_words || 100 }} words"
