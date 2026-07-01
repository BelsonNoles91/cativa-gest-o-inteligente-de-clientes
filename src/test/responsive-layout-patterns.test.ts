/**
 * Scanner estático de anti-patterns responsivos em src/pages e src/features.
 *
 * Detecta classes Tailwind que costumam causar overflow horizontal em mobile
 * (320–390px) sem breakpoint sm:/md: correspondente.
 *
 * Falsos positivos conhecidos ficam na ALLOWLIST por arquivo + padrão.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..");
const SCAN_DIRS = [
  resolve(ROOT, "src/pages"),
  resolve(ROOT, "src/features"),
];

/** { fileSuffix, pattern } — linhas que batem mas são intencionais. */
const ALLOWLIST: { file: RegExp; pattern: RegExp; reason: string }[] = [
  {
    file: /DataImportExport\.tsx$/,
    pattern: /min-w-\[640px\]/,
    reason: "tabela com scroll interno (overflow-auto no wrapper)",
  },
  {
    file: /TenantSwitcher\.tsx$/,
    pattern: /min-w-\[220px\]/,
    reason: "dropdown desktop; compact mode usa w-full",
  },
  {
    file: /FeatureFlagsConsole\.tsx$/,
    pattern: /min-w-\[200px\]/,
    reason: "input flex-1 em painel admin desktop",
  },
  {
    file: /AuditLogsTab\.tsx$/,
    pattern: /min-w-\[200px\]/,
    reason: "campo de busca flex-1",
  },
  {
    file: /ClientMembershipsTab\.tsx$/,
    pattern: /min-w-\[(130|140|180)px\]/,
    reason: "filtros admin com flex-1",
  },
  {
    file: /Dashboard\.tsx$/,
    pattern: /grid-cols-5/,
    reason: "KPI grid com breakpoint xl:grid-cols-5",
  },
  {
    file: /HeroSection\.tsx$/,
    pattern: /grid-cols-5/,
    reason: "grid marketing com md:grid-cols-5",
  },
  {
    file: /ProcessSection\.tsx$/,
    pattern: /grid-cols-5/,
    reason: "grid marketing com lg:grid-cols-5",
  },
];

const ANTI_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: "min-w-[2xx+px] sem breakpoint", regex: /min-w-\[2\d{2,}px\]/ },
  { name: "w-[16-19xx]px fixo sem sm:", regex: /className="[^"]*\bw-\[(1[6-9]\d|2[0-2]\d)px\]/ },
  {
    name: "grid-cols-[5-9] sem media query na mesma linha",
    regex: /grid-cols-[5-9](?!.*(?:sm:|md:|lg:|xl:))/,
  },
];

function collectTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectTsxFiles(full));
    } else if (/\.tsx$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function isAllowed(relPath: string, line: string, pattern: RegExp): boolean {
  return ALLOWLIST.some(
    (a) => a.file.test(relPath) && a.pattern.test(line),
  );
}

function scanFile(absPath: string): { line: number; text: string; rule: string }[] {
  const relPath = relative(ROOT, absPath);
  const content = readFileSync(absPath, "utf8");
  const lines = content.split("\n");
  const hits: { line: number; text: string; rule: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ignora comentários
    if (/^\s*(\/\/|\*)/.test(line.trim())) continue;

    for (const { name, regex } of ANTI_PATTERNS) {
      if (!regex.test(line)) continue;
      // Se a linha já tem breakpoint responsivo, provavelmente OK
      if (/\b(sm|md|lg|xl|2xl):/.test(line)) continue;
      if (isAllowed(relPath, line, regex)) continue;
      hits.push({ line: i + 1, text: line.trim(), rule: name });
    }
  }
  return hits;
}

describe("Responsive layout — anti-pattern scanner (pages + features)", () => {
  const files = SCAN_DIRS.flatMap(collectTsxFiles);

  it("varre pelo menos 50 arquivos .tsx", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("não há anti-patterns responsivos não allowlisted", () => {
    const allHits: { file: string; line: number; text: string; rule: string }[] = [];
    for (const file of files) {
      for (const hit of scanFile(file)) {
        allHits.push({ file: relative(ROOT, file), ...hit });
      }
    }

    if (allHits.length > 0) {
      const report = allHits
        .map((h) => `  ${h.file}:${h.line} [${h.rule}]\n    ${h.text}`)
        .join("\n");
      expect(allHits, `Anti-patterns encontrados:\n${report}`).toEqual([]);
    }
  });

  it("allowlist cobre casos documentados", () => {
    expect(ALLOWLIST.length).toBeGreaterThanOrEqual(5);
  });
});
