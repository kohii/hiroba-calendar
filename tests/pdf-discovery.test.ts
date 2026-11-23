import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("PDF Discovery - ipalette", () => {
  it("extracts news page links from events page", () => {
    const html = readFileSync(join(__dirname, "fixtures/ipalette-events-page.html"), "utf-8");
    
    const newsPagePattern = /href="(https:\/\/www\.i-palette\.com\/single-news\/(\d{4})-(\d{2})-i-palette-news\/)"/g;
    const newsPages: Array<{url: string, year: string, month: string}> = [];
    let match;
    
    while ((match = newsPagePattern.exec(html)) !== null) {
      newsPages.push({
        url: match[1],
        year: match[2],
        month: match[3],
      });
    }
    
    assert.ok(newsPages.length > 0, "Should find at least one news page");
    
    // Check that we find the November 2026 news page
    const nov2026 = newsPages.find(p => p.year === "2026" && p.month === "11");
    assert.ok(nov2026, "Should find November 2026 news page");
    assert.strictEqual(nov2026.url, "https://www.i-palette.com/single-news/2026-11-i-palette-news/");
  });
  
  it("extracts PDF URL from news page", () => {
    const html = readFileSync(join(__dirname, "fixtures/ipalette-news-2026-11.html"), "utf-8");
    
    const pdfPattern = /href="(https:\/\/www\.i-palette\.com\/wp\/wp-content\/uploads\/[^"]+\.pdf)"/;
    const pdfMatch = pdfPattern.exec(html);
    
    assert.ok(pdfMatch, "Should find PDF URL in news page");
    assert.strictEqual(
      pdfMatch[1],
      "https://www.i-palette.com/wp/wp-content/uploads/2026/10/2026-11-i-palette-news.pdf"
    );
  });
});
