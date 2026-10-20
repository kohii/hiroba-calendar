#!/usr/bin/env python3
import os
import PyPDF2
import json
from pathlib import Path

pdf_dir = Path('data/pdf-cache')
output_dir = Path('data/extracted-text')
output_dir.mkdir(parents=True, exist_ok=True)

for pdf_file in sorted(pdf_dir.glob('*.pdf')):
    print(f"Processing {pdf_file.name}...")
    try:
        with open(pdf_file, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = '\n'.join(page.extract_text() for page in reader.pages)
            
            output_file = output_dir / f"{pdf_file.stem}.txt"
            with open(output_file, 'w', encoding='utf-8') as out:
                out.write(text)
            
            print(f"  ✓ Extracted {len(text)} characters to {output_file.name}")
    except Exception as e:
        print(f"  ✗ Error: {e}")

print("\nDone!")
