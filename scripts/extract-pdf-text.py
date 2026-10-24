#!/usr/bin/env python3

import re
import sys
from PyPDF2 import PdfReader
from PyPDF2._cmap import build_char_map
from PyPDF2.generic import FloatObject, NumberObject

WEEKDAYS = ("月", "火", "水", "木", "金", "土", "日")
DIGIT_TRANSLATION = str.maketrans("０１２３４５６７８９", "0123456789")
REJECT_AFTER_DIGIT = set("/／(（:：歳")


def user_point(cm, tm):
    a, b, c, d, e, f = cm
    text_x, text_y = tm[4], tm[5]
    return (a * text_x + c * text_y + e, b * text_x + d * text_y + f)


def is_number(value):
    return isinstance(value, (int, float, NumberObject, FloatObject))


def width_map(font):
    widths = {}
    default = 1000.0
    try:
        descendant = font["/DescendantFonts"][0].get_object()
        if descendant.get("/DW") is not None:
            default = float(descendant["/DW"])
        entries = list(descendant["/W"]) if "/W" in descendant else []
        while entries:
            start = int(entries[0])
            second = entries[1]
            if is_number(second):
                for cid in range(start, int(second) + 1):
                    widths[cid] = float(entries[2])
                entries = entries[3:]
            else:
                for offset, width in enumerate(list(second)):
                    widths[start + offset] = float(width)
                entries = entries[2:]
        return widths, default
    except Exception:
        pass
    if "/Widths" in font:
        first = int(font["/FirstChar"])
        for offset, width in enumerate(list(font["/Widths"])):
            widths[first + offset] = float(width)
    return widths, default


def load_fonts(resources):
    loaded = {}
    try:
        resources = resources.get_object()
        font_dict = resources["/Font"].get_object()
    except Exception:
        return loaded
    for name, font in font_dict.items():
        font = font.get_object()
        shim = {"/Resources": {"/Font": {name: font}}}
        try:
            _subtype, _space, encoding, mapping, _font = build_char_map(name, 200, shim)
        except Exception:
            encoding, mapping = "utf-16-be", {}
        widths, default = width_map(font)
        loaded[name] = {
            "encoding": encoding,
            "mapping": mapping or {},
            "widths": widths,
            "default": default,
        }
    return loaded


def decode_glyph(data, encoding, mapping):
    if isinstance(encoding, dict):
        chars = [encoding.get(byte, chr(byte)) for byte in data]
        text = "".join(chars)
    else:
        text = bytes(data).decode(encoding or "utf-16-be", "surrogatepass")
    if not mapping:
        return text
    return "".join(mapping.get(char, char) for char in text)


def runs_on_page(page):
    resources = page["/Resources"]
    fonts = load_fonts(resources)
    state = {
        "font": None,
        "size": 12.0,
        "hscale": 1.0,
        "tc": 0.0,
        "tw": 0.0,
        "tl": 0.0,
    }
    graphics_stack = []
    font_stack = []
    resource_stack = []
    form_depth = []
    found = []

    def pen_delta(cm, tm, amount):
        return (
            cm[0] * amount * tm[0] + cm[2] * amount * tm[1],
            cm[1] * amount * tm[0] + cm[3] * amount * tm[1],
        )

    def place(cm, tm, pieces, tc, tw):
        spec = fonts.get(state["font"])
        if spec is None:
            return
        cmf = [float(value) for value in cm]
        tmf = [float(value) for value in tm]
        x, y = user_point(cmf, tmf)
        encoding = spec["encoding"]
        step = 2 if encoding == "utf-16-be" else 1
        size = state["size"]
        hscale = state["hscale"]
        for piece in pieces:
            if is_number(piece):
                amount = (-float(piece) / 1000.0) * size * hscale
                dx, dy = pen_delta(cmf, tmf, amount)
                x += dx
                y += dy
                continue
            data = bytes(piece)
            if step == 2 and len(data) % 2:
                glyph_step = 1
            else:
                glyph_step = step
            index = 0
            while index < len(data):
                chunk = data[index : index + glyph_step]
                if glyph_step == 2 and len(chunk) < 2:
                    break
                cid = int.from_bytes(chunk, "big") if glyph_step == 2 else chunk[0]
                width = spec["widths"].get(cid, spec["default"])
                try:
                    text = decode_glyph(chunk, encoding, spec["mapping"])
                except Exception:
                    text = ""
                extra = tw if text == " " else 0.0
                amount = (width / 1000.0) * size * hscale + tc + extra
                dx, dy = pen_delta(cmf, tmf, amount)
                if text.strip():
                    found.append({"x": x, "y": y, "x2": x + dx, "text": text, "fs": size})
                x += dx
                y += dy
                index += glyph_step

    def before(operator, operands, cm, tm):
        if operator == b"q":
            graphics_stack.append(dict(state))
            return
        if operator == b"Q":
            if graphics_stack:
                state.update(graphics_stack.pop())
            return
        if operator == b"Tc":
            state["tc"] = float(operands[0])
            return
        if operator == b"Tw":
            state["tw"] = float(operands[0])
            return
        if operator == b"Tz":
            state["hscale"] = float(operands[0]) / 100.0
            return
        if operator == b"TL":
            state["tl"] = float(operands[0])
            return
        if operator == b"TD":
            state["tl"] = -float(operands[1])
            return
        if operator == b"Tf":
            state["font"] = operands[0]
            try:
                state["size"] = float(operands[1])
            except Exception:
                pass
            return
        if operator == b"Do":
            pushed = False
            try:
                current = resource_stack[-1] if resource_stack else resources
                xobject = current.get_object()["/XObject"].get_object()[operands[0]].get_object()
                if xobject.get("/Subtype") == "/Form" and "/Resources" in xobject:
                    font_stack.append(dict(fonts))
                    resource_stack.append(xobject["/Resources"])
                    fonts.update(load_fonts(xobject["/Resources"]))
                    pushed = True
            except Exception:
                pushed = False
            form_depth.append(pushed)
            return
        if operator == b"'":
            tm = [float(value) for value in tm]
            tm[5] -= state["tl"]
            place(cm, tm, [operands[0]], state["tc"], state["tw"])
            return
        if operator == b'"':
            state["tw"] = float(operands[0])
            state["tc"] = float(operands[1])
            tm = [float(value) for value in tm]
            tm[5] -= state["tl"]
            place(cm, tm, [operands[2]], state["tc"], state["tw"])
            return
        if operator == b"Tj":
            place(cm, tm, [operands[0]], state["tc"], state["tw"])
            return
        if operator == b"TJ":
            place(cm, tm, list(operands[0]), state["tc"], state["tw"])

    def after(operator, operands, cm, tm):
        if operator != b"Do" or not form_depth:
            return
        if form_depth.pop() and font_stack:
            fonts.clear()
            fonts.update(font_stack.pop())
            resource_stack.pop()

    page.extract_text(visitor_operand_before=before, visitor_operand_after=after)
    return found


def normalize_digits(text):
    return text.translate(DIGIT_TRANSLATION).strip()


def find_header(runs):
    singles = []
    for run in runs:
        token = run["text"].strip()
        if token in WEEKDAYS:
            singles.append(run)
    singles.sort(key=lambda run: -run["y"])
    clusters = []
    for run in singles:
        if clusters and abs(clusters[-1][0]["y"] - run["y"]) <= 3:
            clusters[-1].append(run)
        else:
            clusters.append([run])

    best = None
    for cluster in clusters:
        chars = {}
        for run in cluster:
            chars.setdefault(run["text"].strip(), run)
        if any(day not in chars for day in WEEKDAYS):
            continue
        ordered = sorted(chars.values(), key=lambda run: run["x"])
        span = ordered[-1]["x"] - ordered[0]["x"]
        if best is None or span > best[0]:
            best = (span, ordered)
    if best is None:
        return None
    return best[1]


def column_edges(header):
    xs = [run["x"] for run in header]
    gaps = [xs[index + 1] - xs[index] for index in range(6)]
    edges = [xs[0] - gaps[0] / 2]
    for index in range(6):
        edges.append((xs[index] + xs[index + 1]) / 2)
    edges.append(xs[-1] + gaps[-1] / 2)
    return edges


def column_index(edges, x):
    for index in range(7):
        if edges[index] <= x < edges[index + 1]:
            return index
    return None


def is_day_number_slot(left_gap, header_gap):
    at_cell_left = left_gap <= 24
    under_weekday = header_gap <= 16
    return at_cell_left or under_weekday


def larger_glyph_then_left(anchor):
    return (-anchor["fs"], anchor["x"])


def month_grid(anchors):
    return len(anchors) >= 20


def mark_after(run, runs):
    end = run.get("x2", run["x"])
    nearest = None
    for other in runs:
        if abs(other["y"] - run["y"]) > 1.5:
            continue
        gap = other["x"] - end
        if -0.5 <= gap <= 8 and (nearest is None or gap < nearest[0]):
            nearest = (gap, other["text"].strip()[:1])
    if nearest is None:
        return ""
    return nearest[1]


def date_anchors(runs, header, edges):
    header_y = header[0]["y"]
    header_x = {}
    for run in header:
        column = column_index(edges, run["x"])
        if column is not None:
            header_x[column] = run["x"]
    candidates = []
    for run in runs:
        token = normalize_digits(run["text"])
        if re.fullmatch(r"\d{1,2}", token) is None:
            continue
        day = int(token)
        if day < 1 or day > 31 or run["y"] > header_y - 8:
            continue
        column = column_index(edges, run["x"])
        if column is None:
            continue
        left_gap = run["x"] - edges[column]
        header_gap = abs(run["x"] - header_x.get(column, run["x"] + 99))
        if not is_day_number_slot(left_gap, header_gap):
            continue
        if mark_after(run, runs) in REJECT_AFTER_DIGIT:
            continue
        candidates.append(
            {
                "day": day,
                "x": run["x"],
                "y": run["y"],
                "column": column,
                "fs": run.get("fs", 0),
            }
        )

    candidates.sort(key=lambda anchor: -anchor["y"])
    rows = []
    for anchor in candidates:
        if rows and abs(rows[-1][0]["y"] - anchor["y"]) <= 8:
            rows[-1].append(anchor)
        else:
            rows.append([anchor])

    week_rows = []
    for row in rows:
        by_column = {}
        for anchor in row:
            current = by_column.get(anchor["column"])
            rank = larger_glyph_then_left(anchor)
            if current is None or rank < current[0]:
                by_column[anchor["column"]] = (rank, anchor)
        chosen = [by_column[column][1] for column in sorted(by_column)]
        days = [anchor["day"] for anchor in chosen]
        increasing = all(days[index] < days[index + 1] for index in range(len(days) - 1))
        if increasing and days[-1] - days[0] <= 6:
            week_rows.append(chosen)

    kept = []
    expect = 1
    previous_y = None
    for row in week_rows:
        if row[0]["day"] != expect:
            continue
        if previous_y is not None and previous_y - row[0]["y"] < 40:
            continue
        kept.extend(row)
        expect = row[-1]["day"] + 1
        previous_y = row[0]["y"]
        if expect > 31:
            break
    return kept


def merge_split_day_numbers(runs):
    digits = []
    others = []
    for run in runs:
        token = normalize_digits(run["text"])
        if re.fullmatch(r"\d{1,2}", token):
            digits.append(
                {
                    "x": run["x"],
                    "y": run["y"],
                    "x2": run.get("x2", run["x"]),
                    "text": token,
                    "fs": run.get("fs", 0),
                }
            )
        else:
            others.append(run)
    digits.sort(key=lambda run: (-run["y"], run["x"]))
    merged_digits = []
    for run in digits:
        previous = merged_digits[-1] if merged_digits else None
        if (
            previous
            and abs(previous["y"] - run["y"]) <= 1.5
            and 0 < run["x"] - previous["x"] <= 14
            and len(previous["text"] + run["text"]) <= 2
        ):
            previous["text"] += run["text"]
            previous["x2"] = run["x2"]
        else:
            merged_digits.append(dict(run))
    return others + merged_digits


def line_text(runs):
    runs = sorted(runs, key=lambda run: (-run["y"], run["x"]))
    lines = []
    for run in runs:
        if lines and abs(lines[-1][-1]["y"] - run["y"]) <= 1.5:
            lines[-1].append(run)
        else:
            lines.append([run])
    rendered = []
    for line in lines:
        parts = []
        previous_end = None
        for run in line:
            piece = run["text"].strip()
            if piece == "":
                continue
            gap = None if previous_end is None else run["x"] - previous_end
            if parts and gap is not None and gap <= 2.5:
                if piece.isdigit() and parts[-1].replace(" ", "").isdigit():
                    parts[-1] = parts[-1].replace(" ", "") + piece
                else:
                    parts[-1] += piece
            else:
                if parts:
                    parts.append(" ")
                parts.append(piece)
            previous_end = run.get("x2", run["x"])
        text = "".join(parts).strip()
        if text:
            rendered.append(text)
    return rendered


def render_visual_lines(runs):
    return "\n".join(line_text(runs))


def render_calendar(runs, header):
    edges = column_edges(header)
    anchors = date_anchors(runs, header, edges)
    if not month_grid(anchors):
        return "# layout: visual-lines\n" + render_visual_lines(runs)
    by_column = {index: [] for index in range(7)}
    for anchor in anchors:
        by_column[anchor["column"]].append(anchor)
    for column in by_column.values():
        column.sort(key=lambda anchor: -anchor["y"])

    row_ys = sorted({round(anchor["y"]) for anchor in anchors}, reverse=True)
    gaps = [row_ys[index] - row_ys[index + 1] for index in range(len(row_ys) - 1)]
    pitch = sorted(gaps)[len(gaps) // 2] if gaps else 70

    cells = {id(anchor): [] for anchor in anchors}
    outside = []
    for run in runs:
        column = column_index(edges, run["x"])
        if column is None:
            outside.append(run)
            continue
        dates = by_column[column]
        owner = None
        for index, anchor in enumerate(dates):
            if index + 1 < len(dates):
                floor = dates[index + 1]["y"]
            else:
                floor = anchor["y"] - pitch
            if run["y"] <= anchor["y"] + 1.5 and run["y"] > floor + 1.5:
                owner = anchor
                break
        if owner is None:
            outside.append(run)
        else:
            cells[id(owner)].append(run)

    blocks = ["# layout: calendar-cells"]
    for anchor in sorted(anchors, key=lambda item: (item["day"], -item["y"])):
        body = "\n".join(line_text(cells[id(anchor)]))
        blocks.append(f"## cell {anchor['day']}\n{body}")
    if outside:
        blocks.append("## outside-cells\n" + render_visual_lines(outside))
    return "\n\n".join(blocks)


def render_page(page, page_number):
    runs = merge_split_day_numbers(runs_on_page(page))
    header = find_header(runs)
    if header is None:
        body = "# layout: visual-lines\n" + render_visual_lines(runs)
    else:
        body = render_calendar(runs, header)
    return f"# page {page_number}\n{body}"


def extract_pdf(pdf_path):
    reader = PdfReader(pdf_path)
    pages = [render_page(page, index + 1) for index, page in enumerate(reader.pages)]
    return "\n\n".join(pages) + "\n", len(reader.pages)


def main():
    if len(sys.argv) != 3:
        print("Usage: extract-pdf-text.py <pdf-path> <output-path>")
        sys.exit(1)
    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    try:
        text, page_count = extract_pdf(pdf_path)
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
    with open(output_path, "w", encoding="utf-8") as handle:
        handle.write(text)
    print(f"Extracted {page_count} pages, {len(text)} characters")


if __name__ == "__main__":
    main()
