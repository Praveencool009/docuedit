#!/usr/bin/env python3
import fitz, json, sys, math

def int_to_hex(c):
    r = (c >> 16) & 0xFF
    g = (c >> 8) & 0xFF
    b = c & 0xFF
    return "#{:02x}{:02x}{:02x}".format(r,g,b)

def get_bg_color(drawings, bbox):
    x0,y0,x1,y1 = bbox
    cx = (x0+x1)/2
    cy = (y0+y1)/2
    best = None
    best_area = float("inf")
    for d in drawings:
        if not d.get("fill"):
            continue
        fill = d["fill"]
        if fill == (1.0, 1.0, 1.0):
            continue
        r = d["rect"]
        if r.x0 <= cx <= r.x1 and r.y0 <= cy <= r.y1:
            area = r.width * r.height
            if area < best_area:
                best_area = area
                best = fill
    if best:
        r2 = int(best[0]*255)
        g2 = int(best[1]*255)
        b2 = int(best[2]*255)
        return "#{:02x}{:02x}{:02x}".format(r2,g2,b2)
    return "#ffffff"

def extract(pdf_path, page_num=0):
    doc = fitz.open(pdf_path)
    page = doc[page_num]
    pw = page.rect.width
    ph = page.rect.height
    drawings = page.get_drawings()
    blocks = page.get_text("rawdict")["blocks"]
    result = []

    for block in blocks:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            dir = line.get("dir", (1, 0))
            angle = round(math.degrees(math.atan2(-dir[1], dir[0])))
            for span in line["spans"]:
                chars = span.get("chars", [])
                if not chars:
                    continue
                text = "".join(c["c"] for c in chars).strip()
                if not text:
                    continue
                bbox = span["bbox"]
                color_hex = int_to_hex(span["color"])
                bold = "bold" in span["font"].lower()
                italic = "italic" in span["font"].lower()
                bg_color = get_bg_color(drawings, bbox)
                result.append({
                    "text": text,
                    "x": round(bbox[0], 2),
                    "y": round(bbox[1], 2),
                    "width": round(bbox[2] - bbox[0], 2),
                    "height": round(bbox[3] - bbox[1], 2),
                    "fontSize": round(span["size"], 2),
                    "bold": bold,
                    "italic": italic,
                    "color": color_hex,
                    "bgColor": bg_color,
                    "angle": angle,
                    "pageWidth": round(pw, 2),
                    "pageHeight": round(ph, 2)
                })

    print(json.dumps({"blocks": result, "pageWidth": round(pw,2), "pageHeight": round(ph,2)}))

extract(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 0)
