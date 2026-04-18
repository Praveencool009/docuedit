import { DocumentProcessorServiceClient } from '@google-cloud/documentai'

const client = new DocumentProcessorServiceClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  apiEndpoint: process.env.GOOGLE_PROCESSOR_REGION + '-documentai.googleapis.com'
})

export interface TextBlock {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  bold: boolean
  color?: string
  angle?: number
  pageWidth: number
  pageHeight: number
}

export async function extractWithGoogleOCR(
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ blocks: TextBlock[]; pageWidth: number; pageHeight: number }[]> {
  const projectId = process.env.GOOGLE_PROJECT_ID
  const location = process.env.GOOGLE_PROCESSOR_REGION
  const processorId = process.env.GOOGLE_PROCESSOR_ID

  const name = 'projects/' + projectId + '/locations/' + location + '/processors/' + processorId

  const request = {
    name,
    rawDocument: {
      content: fileBuffer.toString('base64'),
      mimeType
    }
  }

  const [result] = await client.processDocument(request as any)
  const document = result.document

  if (!document || !document.pages) return []

  const pages = document.pages.map((page: any) => {
    const pageWidth = page.dimension?.width || 794
    const pageHeight = page.dimension?.height || 1123
    const blocks: TextBlock[] = []

    const lines = page.lines || []
    for (const line of lines) {
      if (!line.layout?.boundingPoly?.normalizedVertices) continue

      const verts = line.layout.boundingPoly.normalizedVertices
      const x = Math.min(...verts.map((v: any) => v.x || 0)) * pageWidth
      const y = Math.min(...verts.map((v: any) => v.y || 0)) * pageHeight
      const x2 = Math.max(...verts.map((v: any) => v.x || 0)) * pageWidth
      const y2 = Math.max(...verts.map((v: any) => v.y || 0)) * pageHeight

      const textAnchor = line.layout.textAnchor
      let text = ''
      if (textAnchor?.textSegments && document.text) {
        for (const seg of textAnchor.textSegments) {
          const start = Number(seg.startIndex) || 0
          const end = Number(seg.endIndex) || 0
          text += document.text.slice(start, end)
        }
      }

      text = text.trim()
      if (!text) continue

      const height = y2 - y
      const fontSize = Math.max(6, Math.round(height * 0.85))

      blocks.push({
        text,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(x2 - x),
        height: Math.round(height),
        fontSize,
        bold: false,
        color: '#000000',
        pageWidth,
        pageHeight
      })
    }

    return { blocks, pageWidth, pageHeight }
  })

  return pages
}
