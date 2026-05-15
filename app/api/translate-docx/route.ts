import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function translateTexts(texts: string[], targetLanguage: string): Promise<string[]> {
  const batchSize = 25
  const translated: string[] = []
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    let retries = 3
    while (retries > 0) {
      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: 'Translate each item to ' + targetLanguage + '. Preserve all formatting, numbers, dates, proper nouns, URLs, emails. Return ONLY a valid JSON array with the same number of items. No explanation, no markdown fences. Input: ' + JSON.stringify(batch)
          }]
        })
        const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
        const clean = raw.replace(/^```json|^```|```$/gm, '').trim()
        translated.push(...JSON.parse(clean))
        break
      } catch {
        retries--
        if (retries === 0) batch.forEach(t => translated.push(t))
        await new Promise(r => setTimeout(r, 1000))
      }
    }
  }
  return translated
}

export async function POST(req: NextRequest) {
  const ts = Date.now()
  const tmpDir = join(tmpdir(), 'docx_' + ts)
  const tmpDocx = join(tmpdir(), 'input_' + ts + '.docx')
  const outDocx = join(tmpdir(), 'output_' + ts + '.docx')

  try {
    const { docxBase64, targetLanguage } = await req.json()
    if (!docxBase64 || !targetLanguage) {
      return Response.json({ error: 'Missing data' }, { status: 400 })
    }

    // Write docx to temp file
    const docxBuffer = Buffer.from(docxBase64, 'base64')
    writeFileSync(tmpDocx, docxBuffer)

    // Unzip docx
    mkdirSync(tmpDir, { recursive: true })
    execSync('unzip -q "' + tmpDocx + '" -d "' + tmpDir + '"')

    // Read document.xml
    const docXmlPath = join(tmpDir, 'word', 'document.xml')
    let docXml = readFileSync(docXmlPath, 'utf8')

    // Extract all text runs - get text between <w:t> tags
    const textMatches: string[] = []
    const textRegex = /<w:t[^>]*>([^<]+)<\/w:t>/g
    let match
    while ((match = textRegex.exec(docXml)) !== null) {
      const text = match[1].trim()
      if (text.length > 0) {
        textMatches.push(text)
      }
    }

    console.log('Found', textMatches.length, 'text runs to translate')

    if (textMatches.length === 0) {
      return Response.json({ error: 'No text found in document' }, { status: 400 })
    }

    // Translate all texts
    const translated = await translateTexts(textMatches, targetLanguage)

    // Replace text in XML
    let idx = 0
    docXml = docXml.replace(/<w:t([^>]*)>([^<]+)<\/w:t>/g, (fullMatch, attrs, text) => {
      const trimmed = text.trim()
      if (trimmed.length > 0 && idx < translated.length) {
        const translatedText = translated[idx++]
        // Preserve leading/trailing spaces from original
        const leadingSpace = text.match(/^(\s*)/)?.[1] || ''
        const trailingSpace = text.match(/(\s*)$/)?.[1] || ''
        // Escape XML special chars
        const escaped = (leadingSpace + translatedText + trailingSpace)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
        // Add xml:space="preserve" if there are spaces
        const needsPreserve = /^\s|\s$/.test(leadingSpace + translatedText + trailingSpace)
        const newAttrs = needsPreserve && !attrs.includes('preserve') 
          ? attrs + ' xml:space="preserve"' 
          : attrs
        return '<w:t' + newAttrs + '>' + escaped + '</w:t>'
      }
      return fullMatch
    })

    // Write modified XML back
    writeFileSync(docXmlPath, docXml)

    // Repack into docx
    execSync('cd "' + tmpDir + '" && zip -r -q "' + outDocx + '" .')

    const outBuffer = readFileSync(outDocx)
    return Response.json({ docxBase64: outBuffer.toString('base64') })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('translate-docx error:', message)
    return Response.json({ error: message }, { status: 500 })
  } finally {
    try { if (existsSync(tmpDocx)) unlinkSync(tmpDocx) } catch {}
    try { if (existsSync(outDocx)) unlinkSync(outDocx) } catch {}
    try { execSync('rm -rf "' + tmpDir + '"') } catch {}
  }
}
