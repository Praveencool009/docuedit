import { NextRequest } from 'next/server'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export async function POST(req: NextRequest) {
  const ts = Date.now()
  const tmpFile = join(tmpdir(), 'input_' + ts)
  const files: string[] = []

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return Response.json({ error: 'No file uploaded' }, { status: 400 })

    const apiSecret = process.env.CONVERTAPI_SECRET
    if (!apiSecret) return Response.json({ error: 'CONVERTAPI_SECRET not set' }, { status: 500 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const isPDF = file.type === 'application/pdf' || file.name?.endsWith('.pdf')
    const fromFormat = isPDF ? 'pdf' : 'jpg'
    const mimeType = isPDF ? 'application/pdf' : 'image/jpeg'
    const filename = isPDF ? 'document.pdf' : 'document.jpg'

    const boundary = 'boundary' + ts
    const CRLF = '\r\n'
    const header = Buffer.from(
      '--' + boundary + CRLF +
      'Content-Disposition: form-data; name="File"; filename="' + filename + '"' + CRLF +
      'Content-Type: ' + mimeType + CRLF + CRLF
    )
    const footer = Buffer.from(CRLF + '--' + boundary + '--' + CRLF)
    const body = Buffer.concat([header, buffer, footer])

    console.log('ConvertAPI: converting', fromFormat, '-> docx')

    const response = await fetch(
      'https://v2.convertapi.com/convert/' + fromFormat + '/to/docx?Secret=' + apiSecret + '&StoreFile=true',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiSecret,
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
        },
        body
      }
    )

    const result = await response.json()
    if (!response.ok) throw new Error('ConvertAPI error: ' + JSON.stringify(result))

    const fileUrl = result.Files?.[0]?.Url
    if (!fileUrl) throw new Error('No file URL returned')

    const docxRes = await fetch(fileUrl)
    const docxBuffer = Buffer.from(await docxRes.arrayBuffer())

    return Response.json({ docxBase64: docxBuffer.toString('base64') })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('reconstruct error:', message)
    return Response.json({ error: message }, { status: 500 })
  } finally {
    for (const f of files) {
      try { if (existsSync(f)) unlinkSync(f) } catch {}
    }
  }
}
