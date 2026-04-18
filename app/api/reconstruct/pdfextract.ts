import { execSync } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export interface TextBlock {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  bold: boolean
  color?: string
  pageWidth: number
  pageHeight: number
}

export async function extractWithPDFJS(
  fileBuffer: Buffer
): Promise<{ blocks: TextBlock[]; pageWidth: number; pageHeight: number }[]> {
  const ts = Date.now()
  const tmpPdf = join(tmpdir(), 'extract_' + ts + '.pdf')

  try {
    writeFileSync(tmpPdf, fileBuffer)

    const scriptPath = process.cwd() + '/pdf_extract.py'
    const output = execSync('python3 ' + scriptPath + ' ' + tmpPdf + ' 0', {
      maxBuffer: 50 * 1024 * 1024
    }).toString()

    const data = JSON.parse(output)
    const blocks: TextBlock[] = data.blocks || []
    const pageWidth = data.pageWidth || 595
    const pageHeight = data.pageHeight || 842

    console.log('PyMuPDF success - blocks:', blocks.length, 'page:', pageWidth, 'x', pageHeight)

    if (blocks.length === 0) return []

    return [{ blocks, pageWidth, pageHeight }]
  } catch (err) {
    console.error('PyMuPDF extraction failed:', err)
    return []
  } finally {
    try { if (existsSync(tmpPdf)) unlinkSync(tmpPdf) } catch {}
  }
}
