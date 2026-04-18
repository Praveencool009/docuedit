import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { texts, targetLanguage } = await req.json()
    if (!texts || !targetLanguage) return Response.json({ error: 'Missing data' }, { status: 400 })

    const batchSize = 30
    const translated: string[] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      let retries = 3
      while (retries > 0) {
        try {
          const response = await client.messages.create({
            model: 'claude-opus-4-5',
            max_tokens: 4000,
            messages: [{
              role: 'user',
              content: 'Translate each item in this JSON array to ' + targetLanguage + '. Return ONLY a valid JSON array with the same number of items. Each item must be translated. No explanation, no markdown, no code fences. Input: ' + JSON.stringify(batch)
            }]
          })
          const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
          const clean = raw.replace(/^```json|^```|```$/gm, '').trim()
          const result = JSON.parse(clean)
          translated.push(...result)
          break
        } catch {
          retries--
          if (retries === 0) batch.forEach((t: string) => translated.push(t))
          await new Promise(r => setTimeout(r, 1000))
        }
      }
      if (i + batchSize < texts.length) await new Promise(r => setTimeout(r, 300))
    }

    return Response.json({ translated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
