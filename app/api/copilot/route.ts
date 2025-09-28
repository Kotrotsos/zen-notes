export const runtime = 'edge'

type HistoryMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      model,
      instructions,
      webSearch,
      fetchConfig,
    }: {
      messages: HistoryMessage[]
      model?: string
      instructions?: string
      webSearch?: boolean
      fetchConfig?: { enabled?: boolean; allowedDomains?: string[]; maxBytes?: number; userAgent?: string }
    } = await req.json()

    // Map chat-style history to Responses API content types.
    const input = [
      instructions ? { role: 'system', content: [{ type: 'input_text', text: instructions }] } : undefined,
      ...messages.map((m) => ({
        role: m.role,
        content: [
          m.role === 'assistant'
            ? { type: 'output_text' as const, text: m.content }
            : { type: 'input_text' as const, text: m.content },
        ],
      })),
    ].filter(Boolean) as any[]

    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4.1',
        stream: true,
        // Responses API uses unified input. We pass an instructions block then chat history.
        input,
        tools: [
          ...(webSearch ? [{ type: 'web_search' as const }] : []),
          ...(fetchConfig?.enabled
            ? [
                {
                  type: 'function' as const,
                  name: 'fetch_url',
                  description:
                    'Fetch a URL over HTTPS and return a trimmed text snapshot. Use for pages or APIs. Keep requests minimal and only when necessary.',
                  parameters: {
                    type: 'object',
                    properties: {
                      url: { type: 'string', description: 'The absolute https:// URL to fetch' },
                      maxBytes: {
                        type: 'number',
                        description: 'Optional cap for bytes to read; default from server policy',
                      },
                    },
                    required: ['url'],
                    additionalProperties: false,
                  },
                },
              ]
            : []),
        ],
      }),
    })

    if (!upstream.ok || !upstream.body) {
      const err = await upstream.text().catch(() => '')
      return new Response(`event: error\ndata: ${JSON.stringify({ error: err || upstream.statusText })}\n\n`, {
        status: 500,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    }

    // Pipe the OpenAI event stream straight through to the client.
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    let responseId: string | undefined
    const pendingArgs = new Map<string, string>() // tool_call_id -> args string (delta)

    async function handleRequiredAction(payload: any) {
      const calls = payload?.required_action?.submit_tool_outputs?.tool_calls
      if (!calls || !Array.isArray(calls)) return
      const outputs: Array<{ tool_call_id: string; output: string }> = []
      for (const c of calls) {
        if (c.type !== 'function') continue
        const name = c.name
        const id = c.id
        const argsStr = typeof c.arguments === 'string' ? c.arguments : JSON.stringify(c.arguments || {})
        if (name === 'fetch_url') {
          try {
            const args = JSON.parse(argsStr || '{}')
            const out = await secureFetch(args.url, {
              maxBytes: args.maxBytes || fetchConfig?.maxBytes || 150000,
              allowedDomains: fetchConfig?.allowedDomains || [],
              userAgent: fetchConfig?.userAgent,
            })
            outputs.push({ tool_call_id: id, output: out })
          } catch (e: any) {
            outputs.push({ tool_call_id: id, output: `Error: ${e?.message || 'fetch failed'}` })
          }
        }
      }
      if (outputs.length && responseId) {
        await fetch(`https://api.openai.com/v1/responses/${responseId}/tool_outputs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({ tool_outputs: outputs }),
        })
      }
    }

    async function secureFetch(urlStr: string, opts: { maxBytes: number; allowedDomains: string[]; userAgent?: string }) {
      try {
        const u = new URL(urlStr)
        if (u.protocol !== 'https:') throw new Error('Only https URLs are allowed')
        if (opts.allowedDomains?.length) {
          const ok = opts.allowedDomains.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`))
          if (!ok) throw new Error('Domain not allowed')
        }
        const resp = await fetch(u.toString(), {
          headers: opts.userAgent ? { 'User-Agent': opts.userAgent } : undefined,
          redirect: 'follow',
        })
        const contentType = resp.headers.get('content-type') || ''
        const reader = resp.body?.getReader()
        if (!reader) return `Status: ${resp.status} ${resp.statusText}`
        let received = 0
        let text = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          received += value.byteLength
          if (received > opts.maxBytes) break
          text += decoder.decode(value, { stream: true })
        }
        const snippet = text.slice(0, 8000)
        return `Fetched: ${u.toString()}\nStatus: ${resp.status} ${resp.statusText}\nType: ${contentType}\n\n${snippet}`
      } catch (e: any) {
        throw new Error(e?.message || 'fetch error')
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)
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
            try {
              const payload = JSON.parse(data)
              if (event === 'response.created') {
                responseId = payload?.id || payload?.response?.id
              } else if (event === 'response.required_action') {
                await handleRequiredAction(payload)
              } else if (event === 'response.tool_call.delta') {
                // accumulate args
                const id = payload?.id || payload?.tool_call_id
                const delta = payload?.delta?.arguments || ''
                if (id && delta) pendingArgs.set(id, (pendingArgs.get(id) || '') + delta)
              } else if (event === 'response.tool_call.completed') {
                const id = payload?.id
                const name = payload?.name
                if (name === 'fetch_url') {
                  const args = pendingArgs.get(id || '') || payload?.arguments || '{}'
                  pendingArgs.delete(id || '')
                  await handleRequiredAction({
                    required_action: {
                      submit_tool_outputs: {
                        tool_calls: [
                          { id, type: 'function', name, arguments: args },
                        ],
                      },
                    },
                  })
                }
              }
            } catch {}
          }
        }
        controller.close()
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
    return new Response(`event: error\ndata: ${JSON.stringify({ error: e?.message || 'Unknown error' })}\n\n`, {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
}
