---
name: Iterative Refinement
category: Content Generation
difficulty: advanced
tags: [iterative, refinement, quality, multi-step]
description: Generates content, critiques it, then refines based on feedback
use_cases: ["High-quality content", "Iterative improvement", "Quality assurance"]
---
nodes:
  - id: generate_draft
    type: prompt
    prompt: |
      Write a compelling {{ row.content_type || 'blog post introduction' }} about:

      {{ chunk }}

      Make it engaging and informative.
    output: draft
    model: gpt-4.1
    temperature: 0.8
    max_tokens: 400

  - id: critique
    type: prompt
    prompt: |
      Critique this draft and provide specific improvement suggestions as JSON:
      {
        "strengths": ["strength 1", "strength 2"],
        "weaknesses": ["weakness 1", "weakness 2"],
        "suggestions": ["suggestion 1", "suggestion 2"]
      }

      Draft:
      {{ draft }}
    output: critique_result
    expect: json
    model: gpt-4.1
    temperature: 0.5
    max_tokens: 400

  - id: refine
    type: prompt
    prompt: |
      Improve this draft based on the critique below:

      Original Draft:
      {{ draft }}

      Critique:
      Weaknesses: {{ critique_result.weaknesses }}
      Suggestions: {{ critique_result.suggestions }}

      Write the improved version:
    output: refined
    model: gpt-4.1
    temperature: 0.7
    max_tokens: 500

  - id: report
    type: print
    message: "Refined content with {{ critique_result.suggestions.length }} improvements applied"
