#!/usr/bin/env python3
"""Extract text from PDF using PyPDF2"""
import sys
from PyPDF2 import PdfReader

if len(sys.argv) != 3:
    print("Usage: extract-pdf-text.py <pdf-path> <output-path>")
    sys.exit(1)

pdf_path = sys.argv[1]
output_path = sys.argv[2]

try:
    reader = PdfReader(pdf_path)
    full_text = ""
    
    for page in reader.pages:
        full_text += page.extract_text() + "\n\n"
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(full_text)
    
    print(f"Extracted {len(reader.pages)} pages, {len(full_text)} characters")
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
