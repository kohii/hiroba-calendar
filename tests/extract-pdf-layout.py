#!/usr/bin/env python3

import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "extract-pdf-text.py"
CACHE = ROOT / "data" / "pdf-cache"


def cell(text, day):
    marker = f"## cell {day}\n"
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f"missing cell {day}")
    start += len(marker)
    end = text.find("\n## ", start)
    if end < 0:
        end = len(text)
    return text[start:end]


def page_text(pdf_name):
    pdf = CACHE / pdf_name
    if not pdf.is_file():
        raise SystemExit(f"missing {pdf}")
    with tempfile.TemporaryDirectory() as directory:
        output = Path(directory) / "page.txt"
        subprocess.check_call(
            [sys.executable, str(SCRIPT), str(pdf), str(output)],
            cwd=ROOT,
        )
        text = output.read_text(encoding="utf-8")
    page, _, _rest = text.partition("\n# page 2\n")
    if "# layout: calendar-cells" not in page:
        raise SystemExit(f"{pdf_name} page 1 was not read as a calendar grid")
    return text, page


def require(page, day, phrase):
    body = cell(page, day)
    if phrase not in body:
        raise SystemExit(f"cell {day} lost {phrase}:\n{body}")
    return body


def main():
    text, urawa = page_text("urawa-2026-10.pdf")
    october_6 = require(urawa, 6, "お休み")
    require(urawa, 6, "にこにこ広場")
    require(urawa, 6, "身体測定")
    october_5 = cell(urawa, 5)
    if "お休み" in october_5:
        raise SystemExit(f"cell 5 absorbed 6's closure:\n{october_5}")
    if "リフレッシュヨガ" not in october_5:
        raise SystemExit(f"cell 5 lost its event:\n{october_5}")
    require(urawa, 7, "お休み")
    if "開始（ 1１月分） 6" in text or "お休み  7" in text:
        raise SystemExit("content-stream order leaked into the layout")
    october_26 = require(urawa, 26, "休館")
    if "ベビーカー" in october_26:
        raise SystemExit(f"cell 26 absorbed the footer:\n{october_26}")

    _text, nishi = page_text("nishi-2026-10.pdf")
    closed = require(nishi, 1, "閉")
    if "室" not in closed:
        raise SystemExit(f"cell 1 lost 閉室:\n{closed}")
    require(nishi, 3, "AM×")
    require(nishi, 12, "閉")
    require(nishi, 15, "閉")

    _text, omiya = page_text("omiya-2026-10.pdf")
    require(omiya, 5, "休館日")
    require(omiya, 12, "スポーツの日")
    require(omiya, 19, "休館日")

    _text, yono = page_text("yono-2026-10.pdf")
    require(yono, 13, "休館日")
    require(yono, 16, "午前閉館")

    _text, minami = page_text("minami-2026-10.pdf")
    require(minami, 7, "終日測定のみ")
    require(minami, 12, "休館")

    print("urawa 2026-10-06 cell keeps お休み")


if __name__ == "__main__":
    main()
