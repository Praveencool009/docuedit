#!/usr/bin/env python3
import fitz, json, sys

def int_to_hex(c):
    r = (c >> 16) & 0xFF
    g = (c >> 8) & 0xFF
    b = c & 0xFF
    return "#{:02x}{:02x}{:02x}".format(r, g, b)

def get_bg_color(drawings, bbox):
    x0, y0, x1, y1 = bbox
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    best = None
    best_area = float("inf")
    for d in drawings:
        fill = d.get("fill")
        if not fill or fill == (1.0, 1.0, 1.0):
            continue
        r = d["rect"]
        if r.x0 <= cx <= r.x1 and r.y0 <= cy <= r.y1:
            area = r.width * r.height
            if area < best_area:
                best_area = area
                best = fill
    if best:
        return "#{:02x}{:02x}{:02x}".format(int(best[0]*255), int(best[1]*255), int(best[2]*255))
    return "#ffffff"

def extract(pdf_path, page_num=0):
    doc = fitz.open(pdf_path)
    page = doc[page_num]
    pw = page.rect.width
    ph = page.rect.height
    drawings = page.get_drawings()
    blocks = page.get_text("dict")["blocks"]
    result = []
    group_id = 0

    for block in blocks:
        if block["type"] != 0:
            continue
        lines = block["lines"]
        if not lines:
            continue

        # Split lines into paragraph groups using empty lines as separators
        para_groups = []
        current = []
        for line in lines:
            text = "".join(s["text"] for s in line["spans"]).strip()
            if text == "":
                if current:
                    para_groups.append(current)
                    current = []
            else:
                current.append(line)
        if current:
            para_groups.append(current)

        for para in para_groups:
            group_id += 1
            # Each line is its own display block but shares groupId for translation
            for line in para:
                text = "".join(s["text"] for s in line["spans"]).strip()
                if not text:
                    continue

                bbox = line["bbox"]
                spans = line["spans"]
                if not spans:
                    continue

                dom_span = max(spans, key=lambda s: len(s["text"].strip())) if spans else spans[0]
                font_size = dom_span["size"]
                bold = "bold" in dom_span["font"].lower()
                italic = "italic" in dom_span["font"].lower()
                color_hex = int_to_hex(dom_span["color"])
                bg_color = get_bg_color(drawings, bbox)

                result.append({
                    "text": text,
                    "x": round(bbox[0], 2),
                    "y": round(bbox[1], 2),
                    "width": round(bbox[2] - bbox[0], 2),
                    "height": round(bbox[3] - bbox[1], 2),
                    "fontSize": round(font_size, 2),
                    "bold": bold,
                    "italic": italic,
                    "color": color_hex,
                    "bgColor": bg_color,
                    "groupId": group_id,
                    "pageWidth": round(pw, 2),
                    "pageHeight": round(ph, 2)
                })

    print(json.dumps({
        "blocks": result,
        "pageWidth": round(pw, 2),
        "pageHeight": round(ph, 2)
    }))

extract(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 0)
