import { describe, expect, it } from "vitest";
import { getSafeExternalHttpUrl } from "@/lib/external-url";

describe("getSafeExternalHttpUrl", () => {
  it("accepts and normalizes absolute HTTP and HTTPS URLs", () => {
    expect(getSafeExternalHttpUrl(" https://example.com/path ")).toBe("https://example.com/path");
    expect(getSafeExternalHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "mailto:hello@example.com",
    "//example.com/path",
    "/relative/path",
    "https://user:password@example.com",
    "not a URL",
    "",
    "   ",
  ])("rejects unsafe or non-absolute URL %s", (value) => {
    expect(getSafeExternalHttpUrl(value)).toBeNull();
  });

  it("rejects excessively long values", () => {
    expect(getSafeExternalHttpUrl(`https://example.com/${"a".repeat(2048)}`)).toBeNull();
  });
});
