import { NextRequest } from 'next/server'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'

export async function POST(req: NextRequest) {
  const ts = Date.now()
  const tmpDocx = join(tmpdir(), 'preview_' + ts + '.docx')
  const tmpPdf = join(tmpdir(), 'preview_' + ts + '.pdf')
  const files: string[] = [tmpDocx, tmpPdf]

  try {
    const { docxBase64 } = await req.json()
    if (!docxBase64) return Response.json({ error: 'No docx data' }, { status: 400 })

    const apiSecret = process.env.CONVERTAPI_SECRET
    if (!apiSecret) return Response.json({ error: 'CONVERTAPI_SECRET not set' }, { status: 500 })

    // Step 1: Convert DOCX -> PDF via ConvertAPI
    const docxBuffer = Buffer.from(docxBase64, 'base64')
    writeFileSync(tmpDocx, docxBuffer)

    const boundary = 'boundary' + ts
    const CRLF = '\r\n'
    const header = Buffer.from(
      '--' + boundary + CRLF +
      'Content-Disposition: form-data; name="File"; filename="document.docx"' + CRLF +
      'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document' + CRLF + CRLF
    )
    const footer = Buffer.from(CRLF + '--' + boundary + '--' + CRLF)
    const body = Buffer.concat([header, docxBuffer, footer])

    const response = await fetch('https://v2.convertapi.com/convert/docx/to/pdf?Secret=' + apiSecret + '&StoreFile=true', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiSecret,
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
      },
      body
    })

    const result = await response.json()
    if (!response.ok) throw new Error('ConvertAPI docx->pdf failed: ' + JSON.stringify(result))

    const pdfUrl = result.Files?.[0]?.Url
    if (!pdfUrl) throw new Error('No PDF URL returned')

    // Step 2: Download PDF
    const pdfRes = await fetch(pdfUrl)
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
    writeFileSync(tmpPdf, pdfBuffer)

    // Step 3: Convert PDF pages to images using mutool
    const imgPattern = join(tmpdir(), 'page_' + ts + '_%d.png')
    execSync('mutool draw -o "' + imgPattern + '" -r 150 "' + tmpPdf + '"', { timeout: 30000 })

    // Collect all generated page images
    const pages: string[] = []
    let pageNum = 1
    while (true) {
      const imgPath = join(tmpdir(), 'page_' + ts + '_' + pageNum + '.png')
      if (!existsSync(imgPath)) break
      const imgBuffer = require('fs').readFileSync(imgPath)
      pages.push(imgBuffer.toString('base64'))
      require('fs').unlinkSync(imgPath)
      pageNum++
    }

    if (pages.length === 0) throw new Error('No pages rendered')

    return Response.json({ pages, pdfBase64: pdfBuffer.toString('base64') })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('preview error:', message)
    return Response.json({ error: message }, { status: 500 })
  } finally {
    for (const f of files) {
      try { if (existsSync(f)) unlinkSync(f) } catch {}
    }
  }
}
