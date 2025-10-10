export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const {
      prompt,
      chunk,
      model,
      temperature,
      maxTokens,
      includeChunk,
    }: {
      prompt: string
      chunk: string
      model?: string
      temperature?: number
      maxTokens?: number
      includeChunk?: boolean
    } = await req.json()

    console.log('AI Workbench API called:', {
      promptLength: prompt?.length,
      chunkLength: chunk?.length,
      chunkPreview: chunk?.substring(0, 100) + '...',
      model,
      temperature,
      maxTokens
    })

    if (!prompt) {
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: 'Prompt is required' })}\n\n`,
        {
          status: 400,
          headers: { 'Content-Type': 'text/event-stream' },
        }
      )
    }

    // Construct the full prompt, optionally appending the chunk
    const fullPrompt = includeChunk === false ? prompt : `${prompt}\n\n${chunk || ''}`

    // Build the input for the Responses API
    const input = [
      {
        role: 'user',
        content: [{ type: 'input_text' as const, text: fullPrompt }],
      },
    ]

    const requestBody = {
      model: model || 'gpt-4.1',
      stream: true,
      input,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens && { max_output_tokens: maxTokens }),
    }

    console.log('Sending to OpenAI:', JSON.stringify(requestBody).substring(0, 200))

    const apiKey = req.headers.get('x-openai-key') || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: 'Missing OpenAI API key' })}\n\n`,
        { status: 401, headers: { 'Content-Type': 'text/event-stream' } }
      )
    }

    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!upstream.ok || !upstream.body) {
      const err = await upstream.text().catch(() => '')
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: err || upstream.statusText })}\n\n`,
        {
          status: 500,
          headers: { 'Content-Type': 'text/event-stream' },
        }
      )
    }

    // Stream the response back to the client
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader()
        let buffer = ''
        let textSent = false // Track if we've already sent the text

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              // Send done event
              controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`))
              break
            }

            buffer += decoder.decode(value, { stream: true })
            const chunks = buffer.split('\n\n')
            buffer = chunks.pop() || ''

            for (const chunk of chunks) {
              const lines = chunk.split('\n').filter(Boolean)
              let event = ''
              let data = ''

              for (const line of lines) {
                if (line.startsWith('event:')) event = line.slice(6).trim()
                if (line.startsWith('data:')) data = line.slice(5).trim()
              }

              if (!data) continue

              // Log raw event data
              console.log('RAW EVENT:', event, 'DATA:', data.substring(0, 150))

              try {
                const payload = JSON.parse(data)

                // Log all events for debugging
                console.log('OpenAI event:', event, 'payload keys:', Object.keys(payload))

                // Handle content deltas - try multiple event patterns
                if (event === 'response.output_text.delta' || event === 'response.content_part.delta') {
                  const delta = payload?.delta?.text || payload?.delta || payload?.text || ''
                  console.log('Got text delta:', delta?.substring(0, 50))
                  if (delta) {
                    controller.enqueue(
                      encoder.encode(`event: content_delta\ndata: ${JSON.stringify({ delta })}\n\n`)
                    )
                    textSent = true // Mark that we've sent content via deltas
                  }
                } else if (event === 'response.output_text.done' || event === 'response.content_part.done') {
                  // Output complete - check if it contains the full text
                  console.log('Output done event received, textSent flag:', textSent)

                  // Only send complete text if we haven't already sent deltas
                  const completeText = payload?.part?.text || payload?.text || ''
                  if (completeText && !textSent) {
                    console.log('Found complete text in done event (no prior deltas):', completeText.substring(0, 100))
                    controller.enqueue(
                      encoder.encode(`event: content_delta\ndata: ${JSON.stringify({ delta: completeText })}\n\n`)
                    )
                    textSent = true
                  } else if (textSent) {
                    console.log('Skipping complete text - already sent via deltas')
                  }

                  controller.enqueue(encoder.encode(`event: output_done\ndata: {}\n\n`))
                } else if (event === 'response.done') {
                  // Response complete
                  console.log('Response done, payload:', JSON.stringify(payload))
                  const usage = payload?.response?.usage
                  if (usage) {
                    controller.enqueue(
                      encoder.encode(`event: usage\ndata: ${JSON.stringify({ usage })}\n\n`)
                    )
                  }
                } else if (event === 'error') {
                  console.error('OpenAI error:', payload)
                  controller.enqueue(
                    encoder.encode(
                      `event: error\ndata: ${JSON.stringify({ error: payload.error || 'Unknown error' })}\n\n`
                    )
                  )
                } else {
                  console.log('Unhandled event:', event, 'Full payload:', JSON.stringify(payload).substring(0, 300))
                }
              } catch (e) {
                // Ignore malformed events
                console.error('Failed to parse event:', e)
              }
            }
          }
        } catch (e: any) {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: e.message || 'Stream error' })}\n\n`)
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (e: any) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: e?.message || 'Unknown error' })}\n\n`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/event-stream' },
      }
    )
  }
}
