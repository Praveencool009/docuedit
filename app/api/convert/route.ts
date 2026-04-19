import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64 } = await req.json()
    if (!pdfBase64) return Response.json({ error: 'No PDF data' }, { status: 400 })

    const clientId = process.env.ADOBE_CLIENT_ID
    const clientSecret = process.env.ADOBE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return Response.json({ error: 'Adobe credentials not configured' }, { status: 500 })
    }

    // Get Adobe access token
    const tokenRes = await fetch('https://pdf-services.adobe.io/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret
      })
    })

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token
    if (!accessToken) throw new Error('Failed to get Adobe token')

    // Upload PDF
    const uploadRes = await fetch('https://pdf-services.adobe.io/assets', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'x-api-key': clientId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mediaType: 'application/pdf' })
    })

    const uploadData = await uploadRes.json()
    const uploadUri = uploadData.uploadUri
    const assetID = uploadData.assetID

    // Upload PDF content
    const pdfBuffer = Buffer.from(pdfBase64, 'base64')
    await fetch(uploadUri, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdfBuffer
    })

    // Create export job
    const jobRes = await fetch('https://pdf-services.adobe.io/operation/exportpdf', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'x-api-key': clientId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assetID,
        targetFormat: 'docx',
        ocrLang: 'en-US'
      })
    })

    const jobLocation = jobRes.headers.get('location')
    if (!jobLocation) throw new Error('No job location returned')

    // Poll for completion
    let docxUrl = ''
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const statusRes = await fetch(jobLocation, {
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'x-api-key': clientId
        }
      })
      const statusData = await statusRes.json()
      if (statusData.status === 'done') {
        docxUrl = statusData.asset?.downloadUri
        break
      }
      if (statusData.status === 'failed') throw new Error('Conversion failed')
    }

    if (!docxUrl) throw new Error('Conversion timed out')

    // Download docx
    const docxRes = await fetch(docxUrl)
    const docxBuffer = await docxRes.arrayBuffer()
    const docxBase64 = Buffer.from(docxBuffer).toString('base64')

    return Response.json({ docxBase64 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
