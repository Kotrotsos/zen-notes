---
name: Text Translation
category: Content Generation
difficulty: beginner
tags: [translation, localization, i18n]
description: Translates text to a target language with variable interpolation
use_cases: ["Localization", "Multilingual content", "International communication"]
---
nodes:
  - id: translate
    type: prompt
    prompt: |
      Translate the following text to {{ row.target_language || 'Spanish' }}:

      {{ chunk }}

      Provide only the translation, no explanations.
    output: translation
    model: gpt-4.1
    temperature: 0.3
    max_tokens: 500

  - id: report
    type: print
    message: "Translated to {{ row.target_language || 'Spanish' }}"
