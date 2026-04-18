import sharp from 'sharp'

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

async function sampleCorners(
  imageBuffer: Buffer,
  box: BoundingBox,
  imgWidth: number,
  imgHeight: number
): Promise<string> {
  try {
    const s = 3
    const corners = [
      { left: Math.max(0, Math.round(box.x)), top: Math.max(0, Math.round(box.y)), width: s, height: s },
      { left: Math.max(0, Math.round(box.x + box.width - s)), top: Math.max(0, Math.round(box.y)), width: s, height: s },
      { left: Math.max(0, Math.round(box.x)), top: Math.max(0, Math.round(box.y + box.height - s)), width: s, height: s },
      { left: Math.max(0, Math.round(box.x + box.width - s)), top: Math.max(0, Math.round(box.y + box.height - s)), width: s, height: s },
    ]

    let r = 0, g = 0, b = 0, count = 0
    for (const c of corners) {
      if (c.left + c.width > imgWidth || c.top + c.height > imgHeight) continue
      if (c.width <= 0 || c.height <= 0) continue
      try {
        const px = await sharp(imageBuffer)
          .extract(c)
          .resize(1, 1)
          .raw()
          .toBuffer()
        r += px[0]; g += px[1]; b += px[2]; count++
      } catch {}
    }

    if (count === 0) return '#ffffff'
    r = Math.round(r / count)
    g = Math.round(g / count)
    b = Math.round(b / count)
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
  } catch {
    return '#ffffff'
  }
}

export async function eraseTextFromImage(
  imageBuffer: Buffer,
  boxes: BoundingBox[],
  imgWidth: number,
  imgHeight: number
): Promise<Buffer> {
  const { width, height } = await sharp(imageBuffer).metadata()
  const w = width || imgWidth
  const h = height || imgHeight

  const svgRects = await Promise.all(boxes.map(async (box) => {
    const color = await sampleCorners(imageBuffer, box, w, h)
    const x = Math.max(0, box.x)
    const y = Math.max(0, box.y)
    const bw = Math.min(w - x, box.width)
    const bh = Math.min(h - y, box.height)
    return '<rect x="' + x + '" y="' + y + '" width="' + bw + '" height="' + bh + '" fill="' + color + '"/>'
  }))

  const svg = '<svg width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">' + svgRects.join('') + '</svg>'

  return await sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 95 })
    .toBuffer()
}
