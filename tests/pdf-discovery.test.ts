import { describe, it } from "node:test";
import assert from "node:assert";
import { extractPDFLinks, monthFromFilename } from "../scripts/pdf-discovery.ts";

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
