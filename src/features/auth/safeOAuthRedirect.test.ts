import { describe, expect, it } from "vitest";
import { safeOAuthRedirectTarget } from "@/features/auth/safeOAuthRedirect";

const origin = "https://cativa.example";

describe("safeOAuthRedirectTarget", () => {
  it("preserves same-origin app destinations and their search/hash", () => {
    expect(safeOAuthRedirectTarget("/app/agenda?view=week#today", origin))
      .toBe("/app/agenda?view=week#today");
  });

  it.each([
    null,
    "",
    "app/agenda",
    "https://attacker.example/collect",
    "//attacker.example/collect",
    "/\\attacker.example/collect",
  ])("rejects an invalid or cross-origin destination: %s", (target) => {
    expect(safeOAuthRedirectTarget(target, origin)).toBeNull();
  });

  it("preserves the same-origin invariant across an adversarial URL-parser corpus", () => {
    const corpus = [
      "/\\\\attacker.example/collect",
      "///attacker.example/collect",
      "///\\attacker.example/collect",
      "\\\\attacker.example/collect",
      "/%2f%2fattacker.example/collect",
      "/%5c%5cattacker.example/collect",
      "/%2f%5cattacker.example/collect",
      "/.%2f%2fattacker.example/collect",
      "/%252f%252fattacker.example/collect",
      "/https://attacker.example/collect",
      "/?next=https://attacker.example/collect",
      "/#//attacker.example/collect",
      "/app/%2e%2e/%2e%2e//attacker.example/collect",
      " /\\attacker.example/collect",
      "https://attacker.example/collect",
      "//attacker.example/collect",
    ];

    for (const target of corpus) {
      let canonicalOrigin: string | null = null;
      try {
        canonicalOrigin = new URL(target, origin).origin;
      } catch {
        // An unparseable target must also be rejected by the helper.
      }

      const result = safeOAuthRedirectTarget(target, origin);
      if (canonicalOrigin !== origin) {
        expect(result, `must reject ${JSON.stringify(target)}`).toBeNull();
      } else if (result !== null) {
        expect(new URL(result, origin).origin, `must remain same-origin: ${JSON.stringify(target)}`)
          .toBe(origin);
      }
    }
  });
});
