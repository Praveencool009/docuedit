import { NextRequest } from 'next/server'
import sharp from 'sharp'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { extractWithGoogleOCR } from './ocr'

function buildHtml(
  data: any,
  bgImageBase64: string
): string {
  const { blocks, pageWidth, pageHeight } = data
  const scaleX = 794 / pageWidth
  const scaleY = 1123 / pageHeight

  let html = '<div style="position:relative;width:794px;height:1123px;overflow:hidden;background:white;">'
  html += '<img src="data:image/jpeg;base64,' + bgImageBase64 + '" style="position:absolute;top:0;left:0;width:794px;height:1123px;object-fit:fill;z-index:0;" />'

  html += '<style>'
  html += '[data-field]{cursor:text;box-sizing:border-box;position:absolute;border:none;outline:none;overflow:hidden;white-space:nowrap;line-height:1.1;padding:1px 2px;z-index:1;}'
  html += '[data-field]:hover{outline:1px solid rgba(66,133,244,0.6);z-index:10;}'
  html += '[data-field]:focus{outline:2px solid #4285f4;z-index:10;}'
  html += '</style>'

  for (const block of blocks || []) {
    const x = Math.round(block.x * scaleX)
    const y = Math.round(block.y * scaleY)
    const w = Math.round(block.width * scaleX) + 4
    const h = Math.round(block.height * scaleY) + 2
    const fs = Math.max(6, Math.round(block.fontSize * Math.min(scaleX, scaleY)))
    const fw = block.bold ? 'bold' : 'normal'
    const fi = block.italic ? 'italic' : 'normal'
    const color = block.color || '#000000'
    const bgColor = block.bgColor || '#ffffff'
    const angle = block.angle || 0
    const isRotated = Math.abs(angle) > 5

    html += '<div contenteditable="true" data-field="true" style="'
    html += 'position:absolute;'
    if (isRotated) {
      html += 'left:' + x + 'px;'
      html += 'top:' + y + 'px;'
      html += 'width:' + h + 'px;'
      html += 'height:' + w + 'px;'
      html += 'writing-mode:vertical-rl;'
      html += 'text-orientation:mixed;'
      html += 'transform:rotate(180deg);'
      html += 'transform-origin:center center;'
    } else {
      html += 'left:' + x + 'px;'
      html += 'top:' + y + 'px;'
      html += 'width:' + w + 'px;'
      html += 'height:' + h + 'px;'
    }
    html += 'font-size:' + fs + 'px;'
    html += 'font-weight:' + fw + ';'
    html += 'font-style:' + fi + ';'
    html += 'color:' + color + ';'
    html += 'background:' + bgColor + ';'
    html += '">' + block.text.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>'
  }

  html += '</div>'
  return html
}

export async function POST(req: NextRequest) {
  const ts = Date.now()
  const tmpPdf = join(tmpdir(), 'input_' + ts + '.pdf')
  const tmpImg = join(tmpdir(), 'page_' + ts + '.png')
  const files: string[] = []

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return Response.json({ error: 'No file uploaded' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const isPDF = file.type === 'application/pdf' || file.name?.endsWith('.pdf')
    const pages: string[] = []

    if (isPDF) {
      writeFileSync(tmpPdf, buffer)
      files.push(tmpPdf)

      execSync('mutool draw -o ' + tmpImg + ' -r 150 ' + tmpPdf + ' 1')
      files.push(tmpImg)

      const pngBuf = readFileSync(tmpImg)
      const jpgBuf = await sharp(pngBuf)
        .resize(794, 1123, { fit: 'fill' })
        .jpeg({ quality: 95 })
        .toBuffer()
      const bgBase64 = jpgBuf.toString('base64')

      const scriptPath = process.cwd() + '/pdf_extract.py'
      try {
        const output = execSync('python3 ' + scriptPath + ' ' + tmpPdf + ' 0', {
          maxBuffer: 50 * 1024 * 1024
        }).toString()
        const data = JSON.parse(output)

        if (data.blocks && data.blocks.length > 0) {
          console.log('PyMuPDF success:', data.blocks.length, 'blocks')
          pages.push(buildHtml(data, bgBase64))
        } else {
          console.log('Falling back to Google OCR')
          const ocrPages = await extractWithGoogleOCR(buffer, 'application/pdf')
          const ocrPage = ocrPages[0]
          if (ocrPage && ocrPage.blocks.length > 0) {
            const fakeData = { blocks: ocrPage.blocks.map((b:any) => ({...b, bgColor:'#ffffff'})), pageWidth: ocrPage.pageWidth, pageHeight: ocrPage.pageHeight }
            pages.push(buildHtml(fakeData, bgBase64))
          } else {
            pages.push('<div style="width:794px;height:1123px;"><img src="data:image/jpeg;base64,' + bgBase64 + '" style="width:100%;height:100%;" /></div>')
          }
        }
      } catch(e) {
        console.error('PyMuPDF error:', e)
        pages.push('<div style="width:794px;height:1123px;"><img src="data:image/jpeg;base64,' + bgBase64 + '" style="width:100%;height:100%;" /></div>')
      }
    } else {
      const jpgBuf = await sharp(buffer).resize(794, 1123, { fit: 'fill' }).jpeg({ quality: 95 }).toBuffer()
      const bgBase64 = jpgBuf.toString('base64')
      const mimeType = file.type || 'image/jpeg'
      const ocrPages = await extractWithGoogleOCR(buffer, mimeType)
      const ocrPage = ocrPages[0]
      if (ocrPage && ocrPage.blocks.length > 0) {
        const fakeData = { blocks: ocrPage.blocks.map((b:any) => ({...b, bgColor:'#ffffff'})), pageWidth: ocrPage.pageWidth, pageHeight: ocrPage.pageHeight }
        pages.push(buildHtml(fakeData, bgBase64))
      } else {
        pages.push('<div style="width:794px;height:1123px;"><img src="data:image/jpeg;base64,' + bgBase64 + '" style="width:100%;height:100%;" /></div>')
      }
    }

    return Response.json({ pages })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  } finally {
    for (const f of files) {
      try { if (existsSync(f)) unlinkSync(f) } catch {}
    }
  }
}
