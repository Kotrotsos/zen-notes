export const runtime = 'edge'

export async function GET(req: Request) {
  try {
    const apiKey = req.headers.get('x-openai-key') || process.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing OpenAI API key' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const resp = await fetch('https://api.openai.com/v1/models?limit=1', {
      headers: { Authorization: `Bearer ${apiKey}` },
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
