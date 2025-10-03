export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-openai-key') || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing OpenAI API key' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { model } = await req.json().catch(() => ({ model: 'gpt-4.1' }))
    const body = {
      model: model || 'gpt-4.1',
      stream: false,
      input: [
        { role: 'user', content: [{ type: 'input_text' as const, text: 'ping' }] },
      ],
    }
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => resp.statusText)
      return new Response(JSON.stringify({ ok: false, error: text || 'Request failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
