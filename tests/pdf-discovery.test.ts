import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractPDFLinks,
  monthFromFilename,
  extractIPaletteNewsPages,
  extractIPalettePDFUrl,
} from "../scripts/pdf-discovery.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("PDF link extraction", () => {
  const base = "https://example.com/center/";

  it("keeps an absolute PDF URL", () => {
    const html = '<a href="https://cdn.example.com/a.pdf">schedule</a>';
    assert.deepStrictEqual(extractPDFLinks(html, base), ["https://cdn.example.com/a.pdf"]);
  });

  it("resolves a root-relative PDF URL", () => {
    const html = '<a href="/files/a.pdf">schedule</a>';
    assert.deepStrictEqual(extractPDFLinks(html, base), ["https://example.com/files/a.pdf"]);
  });

  it("resolves a protocol-relative PDF URL", () => {
    const html = '<a href="//cdn.example.com/a.pdf">schedule</a>';
    assert.deepStrictEqual(extractPDFLinks(html, base), ["https://cdn.example.com/a.pdf"]);
  });

  it("keeps a PDF URL that has a query string", () => {
    const html = '<a href="a.pdf?v=2">schedule</a>';
    assert.deepStrictEqual(extractPDFLinks(html, base), ["https://example.com/center/a.pdf?v=2"]);
  });
});

describe("month from filename", () => {
  it("reads YYYY-MM", () => {
    assert.strictEqual(monthFromFilename("nishi-2026-10.pdf"), "2026-10");
  });

  it("reads six digits", () => {
    assert.strictEqual(monthFromFilename("yono-202610.pdf"), "2026-10");
  });

  it("rejects month 13", () => {
    assert.strictEqual(monthFromFilename("bad-202613.pdf"), null);
  });
});

describe("ipalette discovery", () => {
  it("extracts news page links from events page", () => {
    const html = readFileSync(join(__dirname, "fixtures/ipalette-events-page.html"), "utf-8");
    const newsPages = extractIPaletteNewsPages(html);
    
    assert.ok(newsPages.length > 0, "Should find at least one news page");
    
    // Check that we find the November 2026 news page
    const nov2026 = newsPages.find(p => p.year === "2026" && p.month === "11");
    assert.ok(nov2026, "Should find November 2026 news page");
    assert.strictEqual(nov2026.url, "https://www.i-palette.com/single-news/2026-11-i-palette-news/");
  });
  
  it("extracts PDF URL from news page", () => {
    const html = readFileSync(join(__dirname, "fixtures/ipalette-news-2026-11.html"), "utf-8");
    const pdfUrl = extractIPalettePDFUrl(html);
    
    assert.ok(pdfUrl, "Should find PDF URL in news page");
    assert.strictEqual(
      pdfUrl,
      "https://www.i-palette.com/wp/wp-content/uploads/2026/10/2026-11-i-palette-news.pdf"
    );
  });
});
