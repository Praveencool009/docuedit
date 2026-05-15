import { NextRequest } from 'next/server'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export async function POST(req: NextRequest) {
  const ts = Date.now()
  const tmpPdf = join(tmpdir(), 'convert_' + ts + '.pdf')

  try {
    const { pdfBase64 } = await req.json()
    if (!pdfBase64) return Response.json({ error: 'No PDF data' }, { status: 400 })

    const apiSecret = process.env.CONVERTAPI_SECRET
    if (!apiSecret) return Response.json({ error: 'CONVERTAPI_SECRET not configured' }, { status: 500 })

    const pdfBuffer = Buffer.from(pdfBase64, 'base64')
    writeFileSync(tmpPdf, pdfBuffer)

    const { FormData } = await import('formdata-node')
    const { fileFromPath } = await import('formdata-node/file-from-path')

    const formData = new FormData()
    formData.set('File', await fileFromPath(tmpPdf))

    console.log('Calling ConvertAPI pdf->docx...')
    const response = await fetch(
      'https://v2.convertapi.com/convert/pdf/to/docx?Secret=' + apiSecret + '&StoreFile=true',
      { method: 'POST', body: formData as any }
    )

    const result = await response.json()
    console.log('ConvertAPI status:', response.status)
    console.log('ConvertAPI result keys:', Object.keys(result))

    if (!response.ok) throw new Error('ConvertAPI error: ' + JSON.stringify(result))

    const fileUrl = result.Files?.[0]?.Url
    if (!fileUrl) throw new Error('No file URL in response: ' + JSON.stringify(result))

    const docxRes = await fetch(fileUrl)
    const docxBuffer = Buffer.from(await docxRes.arrayBuffer())

    return Response.json({ docxBase64: docxBuffer.toString('base64') })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Word error:', message)
    return Response.json({ error: message }, { status: 500 })
  } finally {
    try { if (existsSync(tmpPdf)) unlinkSync(tmpPdf) } catch {}
  }
}
